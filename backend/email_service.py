"""
The lead email Meera sends the BRANCH MANAGER, silently, during the call.

v13 changed who this is for. It used to be a summary sent to the caller; the
caller now gets that as a WhatsApp (whatsapp_service.py), sent earlier in the call.
This email is now an internal lead handoff: everything the customer said, so the
branch manager can pick the lead up already knowing the whole conversation.

It is sent SILENTLY, after the KYC questions — Meera never mentions it. Nothing here
is caller-facing, so it is a plain internal lead sheet rather than warm copy.

    EMAIL_TO               the recipient (the branch-manager inbox)
    BRANCH_MANAGER_EMAIL   optional override; wins over EMAIL_TO when set
    EMAIL_FROM_NAME        display name on the From header (default "IIFL Finance")
    LEAD_EMAIL_MASK_IDS    "false" to print PAN/Aadhaar in full (default: masked)
    SMTP_USER / SMTP_PASS  only for the legacy SMTP transport (unusable on Railway)

The send runs in a worker thread (smtplib is blocking) with a hard timeout, so a
slow or unreachable SMTP server can never stall the voice call. Every failure is
swallowed into a structured result — because the send is silent, a failure is now
invisible to the caller entirely; it only shows up in the logs.
"""

import asyncio
import base64
import logging
import os
import re
import smtplib
from email.message import EmailMessage
from email.utils import formataddr
from typing import Any, Dict, Optional

from branch_data import (BRANCH_HOURS, SCHEMES, branch_for, clean,
                         format_amount, to_e164_india)

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))

# Transport. Railway blocks ALL outbound SMTP ports (587/465/25/2525 every one
# times out — verified in production via /agent/email-probe), so SMTP cannot be
# used from there no matter the credentials. HTTPS egress does work, so the
# default is Resend's HTTPS API. "smtp" stays available for hosts that allow it.
#   EMAIL_PROVIDER   "resend" (default) | "smtp"
#   RESEND_API_KEY   the re_... key
#   EMAIL_FROM       verified sender; defaults to Resend's shared onboarding
#                    address, which only delivers to the account's own email
EMAIL_PROVIDER = (os.getenv("EMAIL_PROVIDER") or "resend").strip().lower()
RESEND_ENDPOINT = "https://api.resend.com/emails"
DEFAULT_RESEND_FROM = "onboarding@resend.dev"

# Hard ceiling on the whole send. The call is live; we would rather say "the team
# will email you" than leave the caller listening to silence.
SEND_TIMEOUT_SECONDS = float(os.getenv("EMAIL_TIMEOUT_SECONDS", "12"))


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def _app_password() -> str:
    """Google prints App Passwords as 'abcd efgh ijkl mnop' — spaces are display
    only and must be stripped before authenticating."""
    return re.sub(r"\s+", "", _env("SMTP_PASS"))


def _recipient() -> str:
    """Where the lead email goes: the branch-manager inbox.

    BRANCH_MANAGER_EMAIL wins when set, so a real branch address can be swapped in
    with one Railway variable and no code change. Falls back to EMAIL_TO, which is
    what the demo currently uses.
    """
    return _env("BRANCH_MANAGER_EMAIL") or _env("EMAIL_TO")


def _resend_from() -> str:
    """The From header for Resend. An unverified account may only send from the
    shared onboarding address, so that is the fallback."""
    explicit = _env("EMAIL_FROM")
    if explicit:
        return explicit
    name = _env("EMAIL_FROM_NAME", "IIFL Finance")
    return formataddr((name, DEFAULT_RESEND_FROM))


def config_status() -> Dict[str, Any]:
    """Which env vars are present — never their values. Lets us confirm the
    Railway wiring without ever echoing a key or password."""
    pw = _app_password()
    key = _env("RESEND_API_KEY")
    to = _recipient()
    smtp_ready = bool(_env("SMTP_USER") and pw and to)
    resend_ready = bool(key and to)
    return {
        "provider": EMAIL_PROVIDER,
        "email_to_set": bool(to),
        "recipient": to,
        "recipient_is_override": bool(_env("BRANCH_MANAGER_EMAIL")),
        "mask_ids": _mask_ids(),
        # Resend (default transport)
        "resend_api_key_set": bool(key),
        "resend_from": _resend_from(),
        # SMTP (unusable on Railway — kept for hosts that permit it)
        "smtp_user_set": bool(_env("SMTP_USER")),
        "smtp_pass_set": bool(pw),
        "smtp_pass_length": len(pw),  # expect 16 for a Google App Password
        "smtp_host": SMTP_HOST,
        "smtp_port": SMTP_PORT,
        "configured": resend_ready if EMAIL_PROVIDER == "resend" else smtp_ready,
    }


async def probe_connectivity() -> Dict[str, Any]:
    """Can this container open a TCP socket to the SMTP ports at all?

    Distinguishes 'egress blocked' (every port times out) from 'bad credentials'
    (connects, then auth fails) — the two look identical from a failed send.
    """
    import socket

    def _try(port: int) -> str:
        s = socket.socket()
        s.settimeout(6)
        try:
            s.connect((SMTP_HOST, port))
            return "open"
        except Exception as exc:
            return f"{type(exc).__name__}: {exc}"
        finally:
            s.close()

    results = {}
    for port in (587, 465, 25, 2525):
        results[str(port)] = await asyncio.to_thread(_try, port)
    return {"host": SMTP_HOST, "active_port": SMTP_PORT, "ports": results}


# ---------------------------------------------------------------- content

def _mask_pan(pan: str) -> str:
    """ABCDE1234F -> ABCDE****F. Keeps the shape recognisable while withholding
    the digits, so the manager can match the lead without the email carrying a
    reusable identity document."""
    p = clean(pan).upper()
    return f"{p[:5]}****{p[9]}" if len(p) == 10 else ("*" * len(p) if p else "")


def _mask_aadhaar(aadhaar: str) -> str:
    """12 digits -> 'XXXX XXXX 1234'. Last four only: enough to confirm the
    customer read it out, not enough to reuse."""
    d = re.sub(r"\D", "", clean(aadhaar))
    return f"XXXX XXXX {d[-4:]}" if len(d) == 12 else ("*" * len(d) if d else "")


def _mask_ids() -> bool:
    """Masked by default. PAN and Aadhaar are identity documents and this email
    lands in a shared inbox, so the safe default is to withhold them; set
    LEAD_EMAIL_MASK_IDS=false when the demo needs to show the full values."""
    return _env("LEAD_EMAIL_MASK_IDS", "true").lower() not in ("false", "0", "no")


def _yes_no(v: str) -> str:
    """Normalise a spoken yes/no — Hinglish calls yield हाँ / haan / nahi as often
    as yes / no, and the manager should read one consistent word."""
    s = clean(v).lower()
    if not s:
        return ""
    if s in ("yes", "y", "true", "1", "haan", "ha", "हाँ", "हां", "ji", "जी"):
        return "Yes"
    if s in ("no", "n", "false", "0", "nahi", "nahin", "नहीं", "ना"):
        return "No"
    return clean(v)


# ------------------------------------------------------- HTML (branded lead sheet)
#
# Why HTML at all: the plain-text version below is correct but unreadable at a
# glance, and this lands in a branch manager's inbox alongside dozens of others.
# The design brief is NOT a marketing email — it is a worksheet. Priorities, in
# order: (1) who to call and on what number, above the fold and tappable;
# (2) what they asked for; (3) what is still missing, called out rather than
# hidden. IIFL orange (#F56E28) and navy (#1B1B5C) match the website and the
# demo frontend (frontend/tailwind.config.js).
#
# Email-client constraints — every one of these is deliberate, do not "modernise":
#   * tables for layout, not flex/grid  — Outlook renders neither
#   * inline styles only, no <style> rules that matter — Gmail strips <head>
#   * no external images or fonts       — blocked by default in most clients
#   * Arial/Helvetica only             — webfonts do not load
#   * tel:/mailto: links so a phone-reading manager can act in one tap

IIFL_ORANGE = "#F56E28"
IIFL_NAVY = "#1B1B5C"

# --- the IIFL logo, embedded as a data URI ---------------------------------
# Why embedded and not linked: every major client (Gmail, Outlook, Apple Mail)
# blocks remote images by default, so a hot-linked logo shows as a broken box on
# first open — and IIFL's own asset URL 403s on hot-link anyway. A data URI always
# renders. Cost is ~16 KB of base64 on a ~24 KB email, which is fine.
#
# It is a PNG, NOT the source SVG: Gmail and Outlook strip <img> SVG entirely.
# Converted from IIFL's official iifl-finance.svg at 300x57 (2x for retina,
# displayed at 150px) and flattened onto white, since the wordmark is navy and
# transparency renders inconsistently in Outlook.
_LOGO_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          "assets", "iifl-logo-email.png")


def _logo_data_uri() -> str:
    """Read the logo once and cache it. Returns "" if the file is missing, and
    the header then falls back to the wordmark as text — a missing asset must
    never break the lead email, which is the thing the manager actually needs."""
    cached = getattr(_logo_data_uri, "_cache", None)
    if cached is not None:
        return cached
    try:
        with open(_LOGO_PATH, "rb") as fh:
            uri = "data:image/png;base64," + base64.b64encode(fh.read()).decode("ascii")
    except Exception:
        logger.warning("email logo not found at %s — falling back to text", _LOGO_PATH)
        uri = ""
    _logo_data_uri._cache = uri
    return uri
_INK = "#1f2937"
_MUTED = "#6b7280"
_LINE = "#e5e7eb"
_WASH = "#f9fafb"
_FONT = "Arial,Helvetica,sans-serif"

_MISSING = '<span style="color:#9ca3af;font-style:italic;">not captured on the call</span>'


def _esc(v: Any) -> str:
    """Escape caller-supplied text before it goes into HTML. Names and spoken
    answers reach us from speech-to-text and are never trusted markup."""
    s = clean(v)
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
             .replace('"', "&quot;"))


def _rows_html(rows) -> str:
    """A label/value table. Values already HTML-safe; labels are ours."""
    if not rows:
        return f'<tr><td style="padding:6px 0;font:14px {_FONT};color:{_MUTED};">{_MISSING}</td></tr>'
    out = []
    for label, value in rows:
        out.append(
            f'<tr>'
            f'<td width="46%" style="padding:7px 12px 7px 0;font:13px {_FONT};'
            f'color:{_MUTED};vertical-align:top;">{label}</td>'
            f'<td style="padding:7px 0;font:600 14px {_FONT};color:{_INK};'
            f'vertical-align:top;">{value}</td>'
            f'</tr>'
        )
    return "".join(out)


def _section(title: str, inner: str) -> str:
    """A titled block with a hairline above it."""
    return (
        f'<tr><td style="padding:20px 28px 0 28px;border-top:1px solid {_LINE};">'
        f'<p style="margin:16px 0 8px 0;font:700 11px {_FONT};letter-spacing:1.1px;'
        f'text-transform:uppercase;color:{IIFL_ORANGE};">{title}</p>'
        f'<table border="0" cellpadding="0" cellspacing="0" width="100%">{inner}</table>'
        f'</td></tr>'
    )


def _build_html(
    *, who: str, branch: Dict[str, str], lt: str, contact_e164: str, contact_display: str,
    pin_note: str, loan_rows, kyc_rows, answer_rows, missing: list, masked: bool,
    consent_yes: bool,
) -> str:
    name_h = _esc(who)
    # The action bar: a manager's first move is always to ring the customer.
    call_cta = (
        f'<a href="tel:{_esc(contact_e164)}" style="background-color:{IIFL_ORANGE};'
        f'border-radius:5px;color:#ffffff;display:inline-block;font:700 15px {_FONT};'
        f'line-height:44px;padding:0 26px;text-decoration:none;">'
        f'Call {name_h} &rarr;</a>'
        if contact_e164 else
        f'<span style="font:14px {_FONT};color:#b91c1c;">No usable phone number captured.</span>'
    )

    # What is still outstanding. Shown ONLY when something is genuinely missing —
    # an empty warning box trains the reader to ignore the real ones.
    missing_block = ""
    if missing:
        items = "".join(
            f'<li style="margin:0 0 4px 0;">{m}</li>' for m in missing
        )
        missing_block = (
            f'<tr><td style="padding:18px 28px 0 28px;">'
            f'<table border="0" cellpadding="0" cellspacing="0" width="100%" '
            f'style="background-color:#fff8ed;border:1px solid #fcd9a8;border-radius:8px;">'
            f'<tr><td style="padding:14px 18px;">'
            f'<p style="margin:0 0 6px 0;font:700 13px {_FONT};color:#92400e;">'
            f'Still needed from this customer</p>'
            f'<ul style="margin:0;padding-left:18px;font:13px {_FONT};color:#92400e;'
            f'line-height:1.6;">{items}</ul>'
            f'</td></tr></table></td></tr>'
        )

    consent_line = (
        f'<span style="color:#047857;font-weight:700;">Yes &mdash; consent given on the call</span>'
        if consent_yes else
        f'<span style="color:#b91c1c;font-weight:700;">Not given &mdash; do not market to this customer</span>'
    )

    mask_note = (
        f'<p style="margin:10px 0 0 0;font:12px {_FONT};color:{_MUTED};">'
        f'PAN and Aadhaar are part-masked in this email. The customer read both out '
        f'in full on the call and they are stored against the application.</p>'
        if masked and kyc_rows else ""
    )

    # The masthead. `alt` carries the brand for anyone whose client still refuses
    # to render it, and the whole row degrades to the wordmark as text if the asset
    # is missing on disk.
    _logo = _logo_data_uri()
    if _logo:
        logo_cell = (
            f'<img src="{_logo}" width="150" height="28" alt="IIFL Finance" '
            f'style="display:block;border:0;outline:none;text-decoration:none;'
            f'width:150px;height:28px;" />'
        )
    else:
        logo_cell = (
            f'<p style="margin:0;font:800 20px {_FONT};color:{IIFL_NAVY};">'
            f'IIFL Finance</p>'
        )
    logo_row = (f'<tr><td style="background-color:#ffffff;padding:18px 28px 14px 28px;">'
                f'{logo_cell}</td></tr>')

    return (
        f'<div style="background-color:#eef1f5;padding:20px 12px;font:14px {_FONT};">'
        f'<table border="0" cellpadding="0" cellspacing="0" width="600" '
        f'style="max-width:600px;width:100%;margin:0 auto;background-color:#ffffff;'
        f'border-radius:8px;overflow:hidden;">'

        # --- masthead: the real IIFL logo on white.
        # It sits on WHITE, not on the navy bar below, because the official
        # wordmark is navy — on navy it would be invisible. `display:block` kills
        # the baseline gap Outlook adds under an image, and width/height are set as
        # HTML attributes as well as CSS because Outlook ignores CSS sizing.
        f'{logo_row}'

        # --- header: navy bar, orange rule. Says what this is in one line.
        f'<tr><td style="background-color:{IIFL_NAVY};padding:18px 28px;">'
        f'<p style="margin:0;font:800 17px {_FONT};color:#ffffff;letter-spacing:0.2px;">'
        f'New Gold Loan Lead</p>'
        f'<p style="margin:4px 0 0 0;font:12px {_FONT};color:#b9c0e8;'
        f'text-transform:uppercase;letter-spacing:1.4px;">'
        f'Captured on a call &middot; {_esc(branch["area"])} branch</p>'
        f'</td></tr>'
        f'<tr><td style="height:3px;background-color:{IIFL_ORANGE};font-size:0;'
        f'line-height:0;">&nbsp;</td></tr>'

        # --- the lead, above the fold: name, number, branch, one action
        f'<tr><td style="padding:24px 28px 0 28px;">'
        f'<p style="margin:0;font:800 24px {_FONT};color:{_INK};">{name_h}</p>'
        f'<p style="margin:6px 0 0 0;font:15px {_FONT};color:{_MUTED};">'
        f'{lt.title()} loan enquiry &middot; {_esc(branch["area"])}</p>'
        f'<p style="margin:14px 0 0 0;font:600 17px {_FONT};color:{_INK};">'
        f'<a href="tel:{_esc(contact_e164)}" style="color:{_INK};text-decoration:none;">'
        f'{_esc(contact_display)}</a></p>'
        f'<p style="margin:18px 0 4px 0;">{call_cta}</p>'
        f'</td></tr>'

        f'{missing_block}'

        # --- the substance
        f'{_section("What the customer asked for", _rows_html(loan_rows))}'
        f'{_section("KYC given on the call", _rows_html(kyc_rows))}'
        f'{_section("Their answers", _rows_html(answer_rows + [("Contactable?", consent_line)]))}'

        # --- routing + context the manager needs to act
        f'{_section("Routed to your branch", _rows_html([("Branch", _esc(branch["area"])), ("Address", _esc(branch["address"])), ("Branch phone", _esc(branch["phone"])), ("Open", _esc(BRANCH_HOURS)), ("Customer pincode", _esc(pin_note))]))}'

        # --- what the customer was already promised, so nobody contradicts it
        f'<tr><td style="padding:20px 28px 0 28px;border-top:1px solid {_LINE};">'
        f'<p style="margin:16px 0 8px 0;font:700 11px {_FONT};letter-spacing:1.1px;'
        f'text-transform:uppercase;color:{IIFL_ORANGE};">Already promised to the customer</p>'
        f'<table border="0" cellpadding="0" cellspacing="0" width="100%" '
        f'style="background-color:{_WASH};border-radius:8px;">'
        f'<tr><td style="padding:14px 18px;font:13px {_FONT};color:{_INK};line-height:1.75;">'
        f'&bull; A callback from a loan specialist on the number above.<br>'
        f'&bull; A WhatsApp with this branch&rsquo;s address, directions and timings '
        f'(sent during the call).<br>'
        f'&bull; That every figure quoted was <strong>indicative</strong> &mdash; final '
        f'valuation happens at the branch.'
        f'</td></tr></table>'
        f'{mask_note}'
        f'</td></tr>'

        # --- footer
        f'<tr><td style="padding:22px 28px 26px 28px;">'
        f'<p style="margin:0;font:12px {_FONT};color:{_MUTED};line-height:1.6;">'
        f'Captured automatically by Meera, IIFL&rsquo;s voice assistant, during the call. '
        f'Nothing in this email was typed by the customer.</p>'
        f'</td></tr>'
        f'<tr><td style="background-color:{_WASH};padding:14px 28px;'
        f'border-top:1px solid {_LINE};">'
        f'<p style="margin:0;font:11px {_FONT};color:#9ca3af;">'
        f'IIFL Finance &nbsp;&middot;&nbsp; 1860 267 3000 &nbsp;&middot;&nbsp; '
        f'Internal lead notification &mdash; contains customer personal data, '
        f'do not forward outside IIFL.</p>'
        f'</td></tr>'

        f'</table></div>'
    )


def build_manager_lead_email(
    name: str = "",
    pincode: str = "",
    loan_type: str = "",
    loan_amount: str = "",
    scheme: str = "",
    gold_weight: str = "",
    gold_purity: str = "",
    phone: str = "",
    pan: str = "",
    aadhaar: str = "",
    existing_loan: str = "",
    consent_given: str = "",
) -> Dict[str, str]:
    """The internal lead sheet for the branch manager.

    Everything the customer said on the call, grouped so it can be skim-read: who
    they are, what they asked for, the KYC they gave, and what was promised. Every
    field is optional — a caller who drops off midway still produces a coherent
    lead. Nothing is invented; a field we do not have is marked "not provided"
    rather than guessed, so the manager can see what is still missing.
    """
    who = clean(name) or "(name not captured)"
    branch = branch_for(pincode)
    lt = clean(loan_type).replace("_", " ") or "gold"

    # --- what they asked for
    loan_rows = []
    amount = clean(loan_amount)
    if amount:
        loan_rows.append(("Loan amount requested", format_amount(amount)))

    scheme_key = clean(scheme).lower()
    if scheme_key in SCHEMES:
        label, ltv, per_gram, rate = SCHEMES[scheme_key]
        loan_rows.append(("Scheme chosen", f"{label} — {ltv}, {per_gram}, {rate}"))

    weight = clean(gold_weight)
    if weight:
        purity = clean(gold_purity)
        loan_rows.append(("Gold to pledge",
                          f"{weight} grams" + (f", {purity} carat" if purity else "")))

    # --- KYC exactly as read out on the call
    masked = _mask_ids()
    kyc_rows = []
    if clean(pan):
        kyc_rows.append(("PAN", _mask_pan(pan) if masked else clean(pan).upper()))
    if clean(aadhaar):
        kyc_rows.append(("Aadhaar",
                         _mask_aadhaar(aadhaar) if masked
                         else re.sub(r"\D", "", clean(aadhaar))))

    # --- their answers to the qualifying questions
    answer_rows = []
    existing = _yes_no(existing_loan)
    if existing:
        answer_rows.append(("Existing loan running?", existing))
    consent = _yes_no(consent_given)
    if consent:
        answer_rows.append(("Consent to be contacted", consent))

    def _block(rows, empty="  (not captured on this call)"):
        return "\n".join(f"  {k+':':<26}{v}" for k, v in rows) if rows else empty

    contact = to_e164_india(phone) or clean(phone) or "(not captured)"
    pin = re.sub(r"\D", "", clean(pincode))
    pin_note = pin if pin else "(not captured)"
    if pin and pin not in ("400059", "400086", "400097", "400014"):
        pin_note = f"{pin} (unsupported — routed to {branch['area']})"

    subject = (f"New {lt} loan lead — {branch['area']} — {who}"
               + (f" ({format_amount(amount)})" if amount else ""))

    # --- the HTML lead sheet. Built from the SAME captured values as the text
    # body below, escaped for markup. Anything the caller did not give becomes a
    # line in "still needed" rather than a silent blank, because a manager acting
    # on a partial lead needs to know what to ask for.
    missing = []
    if not amount:
        missing.append("Loan amount &mdash; not stated on the call")
    if not weight:
        missing.append("Gold weight &mdash; needed to size the offer")
    if not clean(pan):
        missing.append("PAN &mdash; required for KYC")
    if not clean(aadhaar):
        missing.append("Aadhaar &mdash; required for KYC")
    if not to_e164_india(phone):
        missing.append("A valid mobile number &mdash; the callback cannot be placed without one")

    html_loan_rows = [(k, _esc(v)) for k, v in loan_rows]
    # Identity numbers in monospace — a manager reads these character by character
    # against a document, and proportional digits are easy to misread.
    html_kyc_rows = [(k, f'<span style="font-family:monospace;letter-spacing:0.5px;">'
                         f'{_esc(v)}</span>') for k, v in kyc_rows]
    html_answer_rows = [(k, _esc(v)) for k, v in answer_rows
                        if k != "Consent to be contacted"]

    html = _build_html(
        who=who, branch=branch, lt=lt,
        contact_e164=to_e164_india(phone),
        contact_display=contact,
        pin_note=pin_note,
        loan_rows=html_loan_rows,
        kyc_rows=html_kyc_rows,
        answer_rows=html_answer_rows,
        missing=missing,
        masked=masked,
        consent_yes=(consent == "Yes"),
    )

    body = f"""New lead from a call with Meera, IIFL's voice assistant.
The customer has been told a specialist will call them back shortly.

CUSTOMER
  {'Name:':<26}{who}
  {'Mobile:':<26}{contact}
  {'Pincode:':<26}{pin_note}
  {'Loan type:':<26}{lt.title()}

ROUTED TO — IIFL FINANCE, {branch['area'].upper()}
  {branch['address']}
  {'Branch phone:':<26}{branch['phone']}
  {'Open:':<26}{BRANCH_HOURS}

WHAT THE CUSTOMER ASKED FOR
{_block(loan_rows)}

KYC PROVIDED ON THE CALL
{_block(kyc_rows)}

THEIR ANSWERS
{_block(answer_rows)}

WHAT WAS PROMISED
  • A callback from a loan specialist, on the mobile number above.
  • A WhatsApp with this branch's address and directions (already sent).
  • Figures quoted were indicative — final valuation happens at the branch.

{'PAN/Aadhaar are masked. Set LEAD_EMAIL_MASK_IDS=false to show them in full.' if masked and kyc_rows else ''}
—
Generated automatically during the call by Meera.
IIFL Finance · 1860 267 3000
"""
    return {"subject": subject, "body": body, "html": html}


# ---------------------------------------------------------------- sending

def _send_blocking(subject: str, body: str, html: str = "") -> None:
    """Synchronous SMTP send. Raises on any failure; the async wrapper catches."""
    user, password, to = _env("SMTP_USER"), _app_password(), _recipient()
    if not (user and password and to):
        raise RuntimeError("SMTP_USER, SMTP_PASS and a recipient must all be set")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((_env("EMAIL_FROM_NAME", "IIFL Finance"), user))
    msg["To"] = to
    # Text first, then HTML as the alternative: multipart/alternative means a
    # client that cannot render HTML still shows the readable plain version.
    msg.set_content(body)
    if html:
        msg.add_alternative(html, subtype="html")

    # Port 465 speaks TLS from the first byte; 587 upgrades via STARTTLS. Some
    # hosts throttle or block one of the two, so the port is configurable and we
    # pick the matching protocol automatically.
    if SMTP_PORT == 465:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=SEND_TIMEOUT_SECONDS) as smtp:
            smtp.login(user, password)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=SEND_TIMEOUT_SECONDS) as smtp:
            smtp.starttls()
            smtp.login(user, password)
            smtp.send_message(msg)


async def _send_via_resend(subject: str, body: str, html: str = "") -> Dict[str, Any]:
    """POST the message to Resend over HTTPS — the transport that works on
    Railway. Returns a structured result; never raises."""
    import httpx

    key, to = _env("RESEND_API_KEY"), _recipient()
    if not (key and to):
        return {"email_sent": "false", "error": "resend_not_configured"}

    # Sending both parts lets Resend build multipart/alternative: HTML for normal
    # clients, the plain body as the fallback.
    payload = {"from": _resend_from(), "to": [to], "subject": subject, "text": body}
    if html:
        payload["html"] = html
    try:
        async with httpx.AsyncClient(timeout=SEND_TIMEOUT_SECONDS) as client:
            resp = await client.post(
                RESEND_ENDPOINT,
                headers={"Authorization": f"Bearer {key}",
                         "Content-Type": "application/json"},
                json=payload,
            )
    except Exception as exc:
        logger.exception("resend: request failed")
        return {"email_sent": "false", "error": f"request_failed: {str(exc)[:160]}"}

    if resp.status_code >= 400:
        # Resend explains rejections in the body — surface it, it is the fastest
        # route to diagnosing an unverified domain or a bad key.
        detail = resp.text[:300]
        logger.error("resend: HTTP %s — %s", resp.status_code, detail)
        return {"email_sent": "false",
                "error": f"http_{resp.status_code}", "detail": detail}

    logger.info("resend: sent to %s", to)
    return {"email_sent": "true", "to": to, "id": (resp.json() or {}).get("id")}


async def send_summary_email(
    name: str = "",
    pincode: str = "",
    loan_type: str = "",
    loan_amount: str = "",
    scheme: str = "",
    gold_weight: str = "",
    gold_purity: str = "",
    phone: str = "",
    pan: str = "",
    aadhaar: str = "",
    existing_loan: str = "",
    consent_given: str = "",
) -> Dict[str, Any]:
    """Build and send the branch-manager lead email. Never raises.

    The name is kept for compatibility with the existing Mozart tool and route —
    only the content and recipient changed in v13, so the tool did not need
    rebuilding. A failure returns {"email_sent": "false", ...}; because the send is
    now silent, that is invisible to the caller and shows up only in the logs.
    """
    content = build_manager_lead_email(
        name=name, pincode=pincode, loan_type=loan_type, loan_amount=loan_amount,
        scheme=scheme, gold_weight=gold_weight, gold_purity=gold_purity,
        phone=phone, pan=pan, aadhaar=aadhaar, existing_loan=existing_loan,
        consent_given=consent_given,
    )

    if not config_status()["configured"]:
        logger.error("send_summary_email: %s not configured — not sending", EMAIL_PROVIDER)
        return {"email_sent": "false", "error": f"{EMAIL_PROVIDER}_not_configured",
                "subject": content["subject"]}

    if EMAIL_PROVIDER == "resend":
        result = await _send_via_resend(content["subject"], content["body"],
                                        content.get("html", ""))
        result["subject"] = content["subject"]
        return result

    try:
        await asyncio.wait_for(
            asyncio.to_thread(_send_blocking, content["subject"], content["body"],
                              content.get("html", "")),
            timeout=SEND_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        logger.error("send_summary_email: timed out after %ss", SEND_TIMEOUT_SECONDS)
        return {"email_sent": "false", "error": "timeout", "subject": content["subject"]}
    except smtplib.SMTPAuthenticationError as exc:
        # Overwhelmingly the App Password being wrong, revoked, or blocked by
        # Workspace policy. Called out separately because the fix differs.
        logger.error("send_summary_email: SMTP auth failed — check SMTP_PASS: %s", exc)
        return {"email_sent": "false", "error": "auth_failed", "subject": content["subject"]}
    except Exception as exc:
        logger.exception("send_summary_email: send failed")
        return {"email_sent": "false", "error": str(exc)[:200], "subject": content["subject"]}

    logger.info("send_summary_email: sent to %s", _recipient())
    return {"email_sent": "true", "to": _recipient(), "subject": content["subject"]}

"""
The lead email Ira sends the BRANCH MANAGER, silently, during the call.

v13 changed who this is for. It used to be a summary sent to the caller; the
caller now gets that as a WhatsApp (whatsapp_service.py), sent earlier in the call.
This email is now an internal lead handoff: everything the customer said, so the
branch manager can pick the lead up already knowing the whole conversation.

It is sent SILENTLY, after the KYC questions — Ira never mentions it. Nothing here
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

    body = f"""New lead from a call with Ira, IIFL's voice assistant.
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
Generated automatically during the call by Ira.
IIFL Finance · 1860 267 3000
"""
    return {"subject": subject, "body": body}


# ---------------------------------------------------------------- sending

def _send_blocking(subject: str, body: str) -> None:
    """Synchronous SMTP send. Raises on any failure; the async wrapper catches."""
    user, password, to = _env("SMTP_USER"), _app_password(), _recipient()
    if not (user and password and to):
        raise RuntimeError("SMTP_USER, SMTP_PASS and a recipient must all be set")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((_env("EMAIL_FROM_NAME", "IIFL Finance"), user))
    msg["To"] = to
    msg.set_content(body)

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


async def _send_via_resend(subject: str, body: str) -> Dict[str, Any]:
    """POST the message to Resend over HTTPS — the transport that works on
    Railway. Returns a structured result; never raises."""
    import httpx

    key, to = _env("RESEND_API_KEY"), _recipient()
    if not (key and to):
        return {"email_sent": "false", "error": "resend_not_configured"}

    payload = {"from": _resend_from(), "to": [to], "subject": subject, "text": body}
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
        result = await _send_via_resend(content["subject"], content["body"])
        result["subject"] = content["subject"]
        return result

    try:
        await asyncio.wait_for(
            asyncio.to_thread(_send_blocking, content["subject"], content["body"]),
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

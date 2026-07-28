"""
Transactional email for the IIFL demo — the summary Ira sends DURING the call.

Sends over Gmail SMTP with an App Password. Everything sensitive comes from the
environment; nothing is hardcoded:

    SMTP_USER        the Gmail address that sends (e.g. someone@nurix.ai)
    SMTP_PASS        a Google App Password (16 chars, spaces stripped)
    EMAIL_TO         the recipient
    EMAIL_FROM_NAME  display name on the From header (default "IIFL Finance")

DEMO NOTE: the recipient is a fixed EMAIL_TO, not the caller's own address — we
never collect an email on the call. Ira's script is worded accordingly.

The send runs in a worker thread (smtplib is blocking) with a hard timeout, so a
slow or unreachable SMTP server can never stall the voice call. Every failure is
swallowed into a structured result — the caller-facing prompt turns a False into
"our team will send it shortly", so an outage degrades the wording, not the call.
"""

import asyncio
import logging
import os
import re
import smtplib
from email.message import EmailMessage
from email.utils import formataddr
from typing import Any, Dict, Optional

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
    smtp_ready = bool(_env("SMTP_USER") and pw and _env("EMAIL_TO"))
    resend_ready = bool(key and _env("EMAIL_TO"))
    return {
        "provider": EMAIL_PROVIDER,
        "email_to_set": bool(_env("EMAIL_TO")),
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

# Spoken scheme id -> the published product name and its headline terms.
# Mirrors frontend/src/lib/goldSchemes.ts, which is the source of truth. Never
# invent a rate here; if the schemes change, change them there and copy across.
_SCHEMES = {
    "saver":   ("IIFL Swarna Saver",   "55% LTV", "₹7,300/gram", "11.88% p.a."),
    "balance": ("IIFL Swarna Balance", "65% LTV", "₹8,635/gram", "14.4% p.a."),
    "max":     ("IIFL Swarna Max",     "75% LTV", "₹9,960/gram", "17.4% p.a."),
}

# Branch + local event per pincode. Mirrors frontend/src/lib/branches.ts and the
# branch_knowledge block of the DSL prompt — the addresses are real, the events
# are demo colour. All three must agree or the email will contradict the call.
_BRANCHES = {
    "400059": {
        "area": "Andheri East",
        "address": ("1st Floor, Tarani Business Centre, Marol Maroshi Road, "
                    "Opposite Lok Bharti Complex, Marol, Andheri East, Mumbai — 400059"),
        "directions": "On Marol Maroshi Road, right opposite Lok Bharti Complex.",
        "phone": "+91 22 7107 4667",
        "event": ("Free gold purity checking camp this Saturday in Marol, "
                  "10:00 AM – 4:00 PM. Bring your gold, get it checked free of charge."),
    },
    "400086": {
        "area": "Ghatkopar West",
        "address": ("Shop No. 5 & 6, Ground Floor, Anupam B Building, LBS Marg, "
                    "Ghatkopar West, Mumbai — 400086"),
        "directions": "On LBS Marg, ground floor of Anupam Building — five minutes from Ghatkopar station.",
        "phone": "+91 22 7107 4600",
        "event": ("'Seedhi Baat' gold loan awareness session this Sunday, 11:00 AM, "
                  "near LBS Marg market. How gold loans work, explained plainly."),
    },
    "400097": {
        "area": "Malad East",
        "address": ("Shop No. 2, Kurar Sangita Building, Shantaram Talao Road, "
                    "Near St George High School, Kurar, Malad East, Mumbai — 400097"),
        "directions": "On Shantaram Talao Road, near St George High School in Kurar village.",
        "phone": "+91 22 7107 4610",
        "event": ("Financial literacy camp next week near St George School, Kurar — "
                  "gold loans, savings and interest explained simply. Free entry."),
    },
    "400014": {
        "area": "Dadar East",
        "address": ("201, 2nd Floor, Parasmani Shopping Centre, 95 Naigaum Cross Road, "
                    "MMGS Marg, Near Dadar Railway Station, Dadar East, Mumbai — 400014"),
        "directions": "Right next to Dadar station, Parasmani Shopping Centre, second floor.",
        "phone": "+91 22 7107 4620",
        "event": ("Branch open house later this month, 5:00 – 7:00 PM — come talk "
                  "through a gold loan with no pressure. Refreshments provided."),
    },
}

_FALLBACK_PINCODE = "400059"
_BRANCH_HOURS = "9:30 AM – 6:00 PM (Sunday closed)"


def _clean(v: Any) -> str:
    """Drop unresolved template tokens — an unset DSL variable arrives literally
    as '<<scheme>>' and must never reach the customer-facing email."""
    if v is None:
        return ""
    s = str(v).strip()
    if not s or s.lower() in ("none", "null", "undefined"):
        return ""
    if ("<<" in s and ">>" in s) or ("{{" in s and "}}" in s):
        return ""
    return s


def _branch_for(pincode: str) -> Dict[str, str]:
    key = re.sub(r"\D", "", _clean(pincode))
    return _BRANCHES.get(key) or _BRANCHES[_FALLBACK_PINCODE]


def _format_amount(raw: str) -> str:
    """Render a rupee amount with Indian digit grouping (₹5,00,000)."""
    digits = re.sub(r"[^\d]", "", raw)
    if not digits:
        return raw
    n = digits[::-1]
    groups = [n[:3]] + [n[i:i + 2] for i in range(3, len(n), 2)]
    return "₹" + ",".join(groups)[::-1]


def build_summary(
    name: str = "",
    pincode: str = "",
    loan_type: str = "",
    loan_amount: str = "",
    scheme: str = "",
    gold_weight: str = "",
    gold_purity: str = "",
) -> Dict[str, str]:
    """Render the subject and body from what was actually captured on the call.

    Every field is optional: a caller who drops off after the amount still gets a
    coherent email. Nothing is invented — a field we do not have is simply omitted.
    """
    name = _clean(name) or "there"
    branch = _branch_for(pincode)

    rows = []
    amount = _clean(loan_amount)
    if amount:
        rows.append(("Loan amount discussed", _format_amount(amount)))

    scheme_key = _clean(scheme).lower()
    if scheme_key in _SCHEMES:
        label, ltv, per_gram, rate = _SCHEMES[scheme_key]
        rows.append(("Scheme selected", f"{label} ({ltv}, {per_gram}, {rate})"))

    weight = _clean(gold_weight)
    if weight:
        purity = _clean(gold_purity)
        rows.append(("Gold to pledge", f"{weight} grams" + (f", {purity} carat" if purity else "")))

    lt = _clean(loan_type).replace("_", " ") or "gold"
    subject = f"Your IIFL {lt.title()} Loan — summary, branch details & local event"

    detail_block = (
        "\n".join(f"  • {k}: {v}" for k, v in rows)
        if rows else "  • We'll confirm the details when our specialist calls you."
    )

    body = f"""Hello {name},

Thank you for speaking with us about your {lt} loan today. Here is a summary of
what we discussed, along with your nearest branch details.

YOUR LOAN DETAILS
{detail_block}

These figures are indicative. Final valuation happens at the branch and our loan
specialist will confirm your exact offer.

YOUR NEAREST BRANCH — IIFL FINANCE, {branch['area'].upper()}
  {branch['address']}
  How to find it: {branch['directions']}
  Phone: {branch['phone']}
  Open: {_BRANCH_HOURS}

WHAT TO BRING
  • Your gold
  • One KYC document (Aadhaar or PAN)
  No income proof and no guarantor required.

HAPPENING NEAR YOU
  {branch['event']}

One of our loan specialists will call you shortly to take this forward.

Warm regards,
Ira
IIFL Finance
1860 267 3000
"""
    return {"subject": subject, "body": body}


# ---------------------------------------------------------------- sending

def _send_blocking(subject: str, body: str) -> None:
    """Synchronous SMTP send. Raises on any failure; the async wrapper catches."""
    user, password, to = _env("SMTP_USER"), _app_password(), _env("EMAIL_TO")
    if not (user and password and to):
        raise RuntimeError("SMTP_USER, SMTP_PASS and EMAIL_TO must all be set")

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

    key, to = _env("RESEND_API_KEY"), _env("EMAIL_TO")
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
) -> Dict[str, Any]:
    """Build and send the summary. Never raises — a failure returns
    {"email_sent": "false", ...} and Ira softens her line to a promise."""
    content = build_summary(name, pincode, loan_type, loan_amount,
                            scheme, gold_weight, gold_purity)

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

    logger.info("send_summary_email: sent to %s", _env("EMAIL_TO"))
    return {"email_sent": "true", "to": _env("EMAIL_TO"), "subject": content["subject"]}

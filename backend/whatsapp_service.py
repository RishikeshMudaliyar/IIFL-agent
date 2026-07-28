"""
The WhatsApp Ira sends the CALLER during the call — thank-you + branch details.

Sent proactively, before the KYC questions: the caller has just heard about their
neighbourhood branch, so the message lands while that is still fresh, and it gives
them something concrete before being asked for PAN and Aadhaar.

Deliberately carries NO loan figures. It goes out before KYC, when the amount and
scheme are still indicative — the numbers belong in the branch-manager email, which
is sent after everything is captured. See email_service.build_manager_lead_email.

    TWILIO_ACCOUNT_SID     the AC... account sid
    TWILIO_AUTH_TOKEN      the account auth token
    TWILIO_WHATSAPP_FROM   sender, e.g. "whatsapp:+14155238886" (the sandbox)
    WHATSAPP_FALLBACK_TO   recipient used when the call carries no phone number
    TWILIO_CONTENT_SID     optional; an approved template, for a real WA sender

TRANSPORT: Twilio's REST API over HTTPS. Railway blocks all outbound SMTP (proved
via /agent/email-probe), so HTTPS is the only viable transport from that host —
the same constraint that moved email onto Resend's API.

SANDBOX CONSTRAINT: on the shared sandbox number every recipient must first send
"join <code>" to it, and the opt-in lapses after 72h of inactivity. A message to a
non-joined number fails with Twilio error 63015/63016. That is an account-level
rule, not something this code can work around — see HANDOFF for the demo-day step.

Like the email path, this never raises: every failure becomes
{"whatsapp_sent": "false", ...} and Ira's prompt softens her line accordingly. A
tool exception mid-call would surface to the model as a hard failure.
"""

import logging
import os
from typing import Any, Dict, Optional

from branch_data import BRANCH_HOURS, branch_for, clean, to_e164_india

logger = logging.getLogger(__name__)

TWILIO_API_ROOT = "https://api.twilio.com/2010-04-01"
DEFAULT_SANDBOX_FROM = "whatsapp:+14155238886"

# Hard ceiling on the send. The call is live; we would rather Ira move on than
# leave the caller listening to silence while Twilio is slow.
SEND_TIMEOUT_SECONDS = float(os.getenv("WHATSAPP_TIMEOUT_SECONDS", "12"))


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def _from_address() -> str:
    """The sender, always prefixed 'whatsapp:'. A bare number is a very easy
    misconfiguration and Twilio's error for it is opaque, so fix it up here."""
    raw = _env("TWILIO_WHATSAPP_FROM", DEFAULT_SANDBOX_FROM)
    return raw if raw.startswith("whatsapp:") else f"whatsapp:{raw}"


def config_status() -> Dict[str, Any]:
    """Which env vars are present — never their values. Mirrors the email
    equivalent so the Railway wiring can be verified without exposing a token."""
    sid, token = _env("TWILIO_ACCOUNT_SID"), _env("TWILIO_AUTH_TOKEN")
    frm = _from_address()
    return {
        "twilio_account_sid_set": bool(sid),
        "twilio_account_sid_prefix": sid[:6] + "…" if sid else "",
        "twilio_auth_token_set": bool(token),
        "whatsapp_from": frm,
        "is_sandbox_sender": frm.endswith("+14155238886"),
        "fallback_to_set": bool(_env("WHATSAPP_FALLBACK_TO")),
        "content_sid_set": bool(_env("TWILIO_CONTENT_SID")),
        "configured": bool(sid and token),
    }


# ---------------------------------------------------------------- content

def build_message(name: str = "", pincode: str = "") -> str:
    """The caller-facing WhatsApp: thank-you, branch address, hours, what to bring.

    Wording approved by the demo leads. Kept short enough to read without tapping
    "read more" in WhatsApp, which truncates at roughly 1000 characters.
    """
    who = clean(name)
    branch = branch_for(pincode)
    greeting = f"🙏 Namaste {who}, thank you for contacting IIFL Finance!" if who \
        else "🙏 Namaste, thank you for contacting IIFL Finance!"

    return f"""{greeting}

Your nearest branch:
*IIFL Finance — {branch['area']}*
{branch['address']}

📍 {branch['directions']}
📞 {branch['phone']}
🕘 {BRANCH_HOURS}

*What to bring:*
• Your gold
• One KYC document (Aadhaar or PAN)

— Ira, IIFL Finance
1860 267 3000"""


# ---------------------------------------------------------------- sending

def _resolve_recipient(phone: str) -> str:
    """Where the WhatsApp goes: the caller's own number, else the demo fallback.

    A web/mic demo call has no PSTN number attached, so WHATSAPP_FALLBACK_TO keeps
    the demo working from the browser. Returns "" if neither is usable.
    """
    to = to_e164_india(phone)
    if to:
        return to
    fallback = to_e164_india(_env("WHATSAPP_FALLBACK_TO"))
    if fallback:
        logger.info("whatsapp: no caller number on the call — using the fallback")
    return fallback


async def send_branch_whatsapp(
    name: str = "",
    pincode: str = "",
    phone: str = "",
) -> Dict[str, Any]:
    """Send the branch-details WhatsApp. Never raises.

    Returns {"whatsapp_sent": "true"|"false", ...}; the DSL branches on the flag so
    a failure changes only Ira's wording, never the call flow.
    """
    import httpx

    cfg = config_status()
    if not cfg["configured"]:
        logger.error("send_branch_whatsapp: Twilio not configured — not sending")
        return {"whatsapp_sent": "false", "error": "twilio_not_configured"}

    to = _resolve_recipient(phone)
    if not to:
        logger.error("send_branch_whatsapp: no usable recipient (phone=%r)", phone)
        return {"whatsapp_sent": "false", "error": "no_recipient"}

    sid, token = _env("TWILIO_ACCOUNT_SID"), _env("TWILIO_AUTH_TOKEN")
    body = build_message(name, pincode)

    form: Dict[str, str] = {"From": _from_address(), "To": f"whatsapp:{to}"}
    content_sid = _env("TWILIO_CONTENT_SID")
    if content_sid:
        # An approved WA Business sender messaging outside the 24h service window
        # must use a template. Free-form Body is correct for the sandbox and
        # inside the window, so the template is opt-in via env.
        form["ContentSid"] = content_sid
    else:
        form["Body"] = body

    url = f"{TWILIO_API_ROOT}/Accounts/{sid}/Messages.json"
    try:
        async with httpx.AsyncClient(timeout=SEND_TIMEOUT_SECONDS) as client:
            resp = await client.post(url, data=form, auth=(sid, token))
    except Exception as exc:
        logger.exception("whatsapp: request failed")
        return {"whatsapp_sent": "false", "error": f"request_failed: {str(exc)[:160]}"}

    if resp.status_code >= 400:
        detail = resp.text[:300]
        logger.error("whatsapp: HTTP %s — %s", resp.status_code, detail)
        try:
            code = (resp.json() or {}).get("code")
        except Exception:
            code = None
        # 63015/63016: the recipient has not joined the sandbox, or the 72h
        # opt-in has lapsed. Overwhelmingly the cause of a demo-day failure, so
        # name it explicitly rather than leaving a bare HTTP status in the logs.
        if code in (63015, 63016):
            logger.error(
                "whatsapp: %s has NOT joined the Twilio sandbox (or the 72h "
                "opt-in expired). Send 'join <code>' from that phone to %s.",
                to, _from_address(),
            )
            return {"whatsapp_sent": "false", "error": "recipient_not_opted_in",
                    "twilio_code": code, "to": to}
        return {"whatsapp_sent": "false", "error": f"http_{resp.status_code}",
                "detail": detail, "twilio_code": code}

    payload = resp.json() or {}
    logger.info("whatsapp: queued to %s (sid=%s)", to, payload.get("sid"))
    return {"whatsapp_sent": "true", "to": to, "sid": payload.get("sid"),
            "status": payload.get("status")}

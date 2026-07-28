"""
HTTP endpoints for external agent tool calls (AgentX/VoiceX integration).

These endpoints let a hosted voice/chat agent drive the Playwright browser
over HTTP instead of through the internal WebSocket flow.

Endpoints:
- POST /agent/session/start   - Launch browser, return session_id
- POST /agent/fill-field      - Fill a form field
- POST /agent/click-button    - Click a form button
- POST /agent/send-whatsapp   - WhatsApp the caller their branch details (before KYC)
- GET  /agent/whatsapp-config - Report which Twilio env vars are set (no values)
- POST /agent/send-email      - Email the branch manager the lead (silent, after KYC)
- GET  /agent/email-config    - Report which email env vars are set (no values)
"""

import asyncio
import logging
import os
import time
import uuid
from datetime import datetime
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, model_validator
from typing import Any, Dict, Optional

from playwright_service import playwright_service
from email_service import config_status, probe_connectivity, send_summary_email
from whatsapp_service import config_status as whatsapp_config_status
from whatsapp_service import send_branch_whatsapp

logger = logging.getLogger(__name__)

agent_router = APIRouter(prefix="/agent", tags=["Agent Tool Calls"])


def _origin() -> str:
    """The frontend origin, derived from FORM_URL (which may be a full page URL)."""
    base = os.getenv("FORM_URL")
    if not base:
        raise HTTPException(status_code=500, detail="FORM_URL environment variable is not set")
    base = base.rstrip("/")
    for suffix in ("/gold-application", "/business-application",
                   "/secured-application", "/loan-application"):
        if base.endswith(suffix):
            return base[: -len(suffix)]
    return base


# The four pincodes with real branch data (mirrors frontend src/lib/branches.ts).
# An unsupported pincode falls back to Andheri East rather than an empty hero.
SUPPORTED_PINCODES = {"400059", "400086", "400097", "400014"}
FALLBACK_PINCODE = "400059"


def _hero_url(pincode: Optional[str] = None) -> str:
    """The branch hero (page 1) for this caller's pincode.

    This is what the browser opens when the call connects — the caller sees
    their own neighbourhood branch before any form appears.
    """
    pin = "".join(ch for ch in str(pincode or "") if ch.isdigit())
    if pin not in SUPPORTED_PINCODES:
        pin = FALLBACK_PINCODE
    return f"{_origin()}/branch/{pin}"


def _get_form_url(loan_type: Optional[str] = None) -> str:
    """Resolve the form URL for a given loan type.

    FORM_URL is treated as a BASE origin (e.g. https://iifl-frontend…app). We
    append the per-loan-type page so the agent's browser opens the right form:
      gold             -> /gold-application
      business         -> /business-application
      secured_business -> /secured-application
    If FORM_URL already points at a specific page (legacy), it's used as-is.
    """
    base = os.getenv("FORM_URL")
    if not base:
        raise HTTPException(status_code=500, detail="FORM_URL environment variable is not set")
    base = base.rstrip("/")

    # Legacy: FORM_URL already includes a page path -> use verbatim.
    if base.endswith("-application") or base.endswith("/loan-application"):
        return base

    lt = (loan_type or "").strip().lower().replace("-", "_").replace(" ", "_")
    page_by_type = {
        "gold": "/gold-application",
        "business": "/business-application",
        "secured_business": "/secured-application",
        "secured": "/secured-application",
    }
    page = page_by_type.get(lt, "/gold-application")  # default to gold for the demo
    return f"{base}{page}"


# ---------- session-id resolution (demo robustness) ----------
#
# The voice agent's DSL passes `session_id: <<session_id>>`. If that call
# variable is not populated at call time the LLM sends an empty string or the
# literal, unresolved "<<session_id>>" token -- and every fill_field then failed
# with "Session ... not found", so the form never visibly filled.
#
# Since the noVNC live view watches the single X display (it is not keyed by
# session), the only thing that actually matters is that start_session and the
# subsequent fill_field calls agree on ONE id. So we treat a missing/unresolved
# id as "the current demo session" and pin it to the most recent live session.

_PLACEHOLDER_SIDS = {"", "<<session_id>>", "session_id", "none", "null", "undefined", "{{session_id}}"}


def _is_placeholder_sid(sid: Optional[str]) -> bool:
    """True when the model sent nothing usable (empty or an unresolved token)."""
    if sid is None:
        return True
    s = str(sid).strip()
    if s.lower() in _PLACEHOLDER_SIDS:
        return True
    # Any leftover templating braces/angle-brackets means it never interpolated.
    return ("<<" in s and ">>" in s) or ("{{" in s and "}}" in s)


def _resolve_sid(sid: Optional[str], *, create: bool = False) -> str:
    """Resolve the session id a tool call should act on.

    create=True  (start_session): mint a stable id when none was supplied.
    create=False (fill_field/click_button): fall back to the most recently
                 started live session so fills land on the open form.
    """
    from playwright_service import PLAYWRIGHT_SESSIONS

    if not _is_placeholder_sid(sid):
        resolved = str(sid).strip()
        # Known session -> use it. Unknown but sessions exist -> the agent sent a
        # different id than start_session did; prefer the live one over failing.
        if resolved in PLAYWRIGHT_SESSIONS or create or not PLAYWRIGHT_SESSIONS:
            return resolved
        latest = _latest_sid(PLAYWRIGHT_SESSIONS)
        logger.warning(
            "Unknown session_id %r from agent; using live session %r instead", resolved, latest
        )
        return latest

    if PLAYWRIGHT_SESSIONS:
        latest = _latest_sid(PLAYWRIGHT_SESSIONS)
        logger.warning("Placeholder session_id %r; using live session %r", sid, latest)
        return latest

    minted = f"demo-{uuid.uuid4().hex[:12]}"
    logger.warning("Placeholder session_id %r and no live session; minted %r", sid, minted)
    return minted


def _latest_sid(sessions: dict) -> str:
    """Most recently created session id."""
    return max(sessions.items(), key=lambda kv: kv[1].get("created_at") or datetime.min)[0]


# ---------- request models ----------

def _unwrap_payload(data: Any) -> Any:
    if isinstance(data, dict) and "payload" in data:
        return data["payload"]
    return data


class StartSessionRequest(BaseModel):
    session_id: str
    loan_type: Optional[str] = None
    # Drives which branch hero variant opens. Optional so an older DSL that
    # doesn't send it still works (falls back to Andheri East).
    pincode: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def unwrap(cls, v): return _unwrap_payload(v)


class GoToFormRequest(BaseModel):
    session_id: Optional[str] = None
    loan_type: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def unwrap(cls, v): return _unwrap_payload(v)


class FillFieldRequest(BaseModel):
    session_id: str
    field_name: str
    value: str

    @model_validator(mode="before")
    @classmethod
    def unwrap(cls, v):
        v = _unwrap_payload(v)
        if isinstance(v, dict) and "value" in v:
            v["value"] = str(v["value"])
        return v


class ClickButtonRequest(BaseModel):
    session_id: str
    button: str

    @model_validator(mode="before")
    @classmethod
    def unwrap(cls, v): return _unwrap_payload(v)


# ---------- endpoints ----------

@agent_router.post("/session/start")
async def start_session(
    request: Request,
    body: Optional[StartSessionRequest] = None,
    session_id: Optional[str] = Query(default=None),
    loan_type: Optional[str] = Query(default=None),
    pincode: Optional[str] = Query(default=None),
):
    raw_body = await request.body()
    logger.info(f"start_session raw body: {raw_body}")
    sid = (body.session_id if body else None) or session_id
    lt = (body.loan_type if body else None) or loan_type
    pin = (body.pincode if body else None) or pincode
    if not sid:
        try:
            raw = await request.json()
        except Exception:
            raw = {}
        logger.info(f"start_session parsed json: {raw}")
        sid = raw.get("session_id")
        lt = lt or raw.get("loan_type")
        pin = pin or raw.get("pincode")
    # A missing/unresolved session_id must not break the demo -- mint one.
    sid = _resolve_sid(sid, create=True)

    # EVERY loan type now opens DIRECTLY ON ITS FORM.
    #
    # Gold used to land on the branch hero and only reach the form via a second
    # go_to_form call. That created a race: start_session takes ~4s to boot
    # Chromium, the model fired go_to_form ~1s later, it failed with "Session
    # not found", the form never opened and every subsequent fill failed against
    # a page that was never there (live call 10a18b44, 2026-07-28 -- the caller
    # was never asked for PAN/Aadhaar and the lead email came back empty).
    # Opening the form here removes the second hop, so there is no window to
    # race. The branch hero is demo dressing; the form is what must load.
    start_url = _get_form_url(lt)
    logger.info(f"start_session loan_type={lt!r} pincode={pin!r} -> url={start_url}")
    result = await playwright_service.start_session(start_url, sid)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("message", "Failed to start session"))
    logger.info(f"Agent session started: {sid}")
    return {"session_id": sid, "message": result.get("message")}


@agent_router.post("/go-to-form")
async def go_to_form(
    request: Request,
    body: Optional[GoToFormRequest] = None,
    session_id: Optional[str] = Query(default=None),
    loan_type: Optional[str] = Query(default=None),
):
    """Navigate to the application form.

    start_session now opens the form directly, so this is a NO-OP re-navigation
    in the normal case. It is kept because the published prompt still calls it,
    and because it must never be the thing that breaks a call: if the session is
    still booting we WAIT for it rather than failing (that race is exactly what
    broke live call 10a18b44), and any failure is reported as a soft success so
    the agent carries on talking instead of stalling mid-call.
    """
    if body:
        sid, lt = body.session_id, body.loan_type
    else:
        try:
            raw = await request.json()
        except Exception:
            raw = {}
        sid = session_id or raw.get("session_id")
        lt = loan_type or raw.get("loan_type")
    sid = _resolve_sid(sid)
    url = _get_form_url(lt or "gold")
    logger.info(f"go_to_form loan_type={lt!r} -> {url}")

    # Tolerate a session that is still booting: poll briefly instead of failing
    # instantly the way the old code did.
    deadline = time.monotonic() + 15.0
    last_err = None
    while time.monotonic() < deadline:
        try:
            result = await playwright_service.navigate(
                sid, url, wait_for="#loan-amount-input"
            )
            if result.get("success"):
                return result
            last_err = result.get("error") or result.get("message")
        except Exception as exc:  # noqa: BLE001 - never surface mid-call
            last_err = str(exc)
        await asyncio.sleep(0.75)

    # Soft-succeed: the form is already open from start_session in the normal
    # case, so a failure here must not read as a hard error to the agent.
    logger.warning(f"go_to_form could not confirm navigation for {sid}: {last_err}")
    return {
        "success": True,
        "url": url,
        "message": "Form is open.",
        "detail": f"navigation not confirmed: {last_err}",
    }


@agent_router.post("/fill-field")
async def fill_field(
    request: Request,
    body: Optional[FillFieldRequest] = None,
    session_id: Optional[str] = Query(default=None),
    field_name: Optional[str] = Query(default=None),
    value: Optional[str] = Query(default=None),
):
    if body:
        sid, fn, val = body.session_id, body.field_name, body.value
    else:
        raw = await request.json()
        sid = session_id or raw.get("session_id")
        fn = field_name or raw.get("field_name")
        val = value or str(raw.get("value")) if raw.get("value") is not None else value
    if not all([fn, val is not None]):
        raise HTTPException(status_code=422, detail="field_name and value are required")
    # Resolve to the live session even if the agent sent an empty/unresolved id.
    sid = _resolve_sid(sid)
    result = await playwright_service.fill_field(sid, fn, val)
    if not result.get("success"):
        return result
    return result


@agent_router.post("/click-button")
async def click_button(
    request: Request,
    body: Optional[ClickButtonRequest] = None,
    session_id: Optional[str] = Query(default=None),
    button: Optional[str] = Query(default=None),
):
    if body:
        sid, btn = body.session_id, body.button
    else:
        raw = await request.json()
        sid = session_id or raw.get("session_id")
        btn = button or raw.get("button")
    if not btn:
        raise HTTPException(status_code=422, detail="button is required")
    sid = _resolve_sid(sid)
    result = await playwright_service.click_button(sid, btn)
    return result


class ShowOffersRequest(BaseModel):
    session_id: Optional[str] = None
    loan_type: Optional[str] = None
    # What the caller answered — used to size the offers on the page.
    loan_amount: Optional[str] = None
    gold_weight: Optional[str] = None
    gold_purity: Optional[str] = None
    # The LTV scheme the caller chose — decides which offer leads the page.
    scheme: Optional[str] = None
    # Keeps the branch CTA on the offers page local to the caller.
    pincode: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def unwrap(cls, v): return _unwrap_payload(v)


# How the LLM might name a scheme -> the canonical id the frontend expects.
_SCHEME_ALIASES = {
    "saver": "saver", "swarna_saver": "saver", "iifl_swarna_saver": "saver",
    "55": "saver", "low": "saver",
    "balance": "balance", "swarna_balance": "balance", "iifl_swarna_balance": "balance",
    "65": "balance", "medium": "balance", "mid": "balance", "middle": "balance",
    "max": "max", "swarna_max": "max", "iifl_swarna_max": "max",
    "75": "max", "high": "max",
}


def _canon_scheme(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    key = str(raw).strip().lower().replace("-", "_").replace(" ", "_").replace("%", "")
    return _SCHEME_ALIASES.get(key)


def _offers_url(loan_type: Optional[str], amount: Optional[str],
                grams: Optional[str], purity: Optional[str],
                scheme: Optional[str] = None, pincode: Optional[str] = None) -> str:
    """Build the /offers/{type} URL, carrying the caller's answers as params."""
    base = os.getenv("FORM_URL")
    if not base:
        raise HTTPException(status_code=500, detail="FORM_URL environment variable is not set")
    base = base.rstrip("/")
    # FORM_URL may legacy-point at a specific page; offers always hang off the origin.
    for suffix in ("/gold-application", "/business-application", "/secured-application",
                   "/loan-application"):
        if base.endswith(suffix):
            base = base[: -len(suffix)]
            break

    lt = (loan_type or "").strip().lower().replace("-", "_").replace(" ", "_")
    slug = {"business": "business", "secured_business": "secured", "secured": "secured"}.get(lt, "gold")

    params = []
    for key, val in (("amount", amount), ("grams", grams), ("purity", purity),
                     ("scheme", _canon_scheme(scheme)), ("pincode", pincode)):
        if val is None:
            continue
        s = str(val).strip()
        # Ignore unresolved template tokens (e.g. an unset <<loan_amount>>).
        if not s or ("<<" in s and ">>" in s) or ("{{" in s and "}}" in s):
            continue
        params.append(f"{key}={quote(s)}")
    qs = ("?" + "&".join(params)) if params else ""
    return f"{base}/offers/{slug}{qs}"


@agent_router.post("/show-offers")
async def show_offers(
    request: Request,
    body: Optional[ShowOffersRequest] = None,
    session_id: Optional[str] = Query(default=None),
    loan_type: Optional[str] = Query(default=None),
):
    """Navigate the live browser to the offers page and return the rendered cards."""
    if body:
        sid, lt = body.session_id, body.loan_type
        amount, grams, purity = body.loan_amount, body.gold_weight, body.gold_purity
        scheme, pin = body.scheme, body.pincode
    else:
        try:
            raw = await request.json()
        except Exception:
            raw = {}
        raw = _unwrap_payload(raw) or {}
        sid = session_id or raw.get("session_id")
        lt = loan_type or raw.get("loan_type")
        amount, grams, purity = raw.get("loan_amount"), raw.get("gold_weight"), raw.get("gold_purity")
        scheme, pin = raw.get("scheme"), raw.get("pincode")

    sid = _resolve_sid(sid)
    url = _offers_url(lt, amount, grams, purity, scheme, pin)
    logger.info(f"show_offers loan_type={lt!r} -> {url}")
    return await playwright_service.show_offers(sid, url)


class SendWhatsAppRequest(BaseModel):
    """What the branch-details WhatsApp needs: who they are and where they live.

    `phone` is the caller's own number — the agent passes the pre-normalised
    <<phone_e164>> it was handed as a dynamic variable, so nothing is asked on the
    call. When it is absent (a web/mic demo has no PSTN number) the service falls
    back to WHATSAPP_FALLBACK_TO.
    """
    session_id: Optional[str] = None
    name: Optional[str] = None
    pincode: Optional[str] = None
    phone: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def unwrap(cls, v): return _unwrap_payload(v)


@agent_router.post("/send-whatsapp")
async def send_whatsapp(request: Request, body: Optional[SendWhatsAppRequest] = None):
    """WhatsApp the caller their branch address and details, DURING the call.

    Sent before the KYC questions, so the caller has something concrete in hand
    before being asked for PAN and Aadhaar.

    Always returns HTTP 200 with a `whatsapp_sent` of "true"/"false" — never an
    error status. A 5xx would surface to the agent as a hard tool failure mid-call;
    instead Meera reads the flag and softens her line.
    """
    if not body:
        try:
            raw = await request.json()
        except Exception:
            raw = {}
        raw = _unwrap_payload(raw) or {}
        body = SendWhatsAppRequest(
            **{k: raw.get(k) for k in SendWhatsAppRequest.model_fields})

    logger.info("send_whatsapp: name=%r pincode=%r phone=%r",
                body.name, body.pincode, body.phone)

    return await send_branch_whatsapp(
        name=body.name or "", pincode=body.pincode or "", phone=body.phone or "",
    )


@agent_router.get("/whatsapp-config")
async def whatsapp_config():
    """Which Twilio env vars are set — presence only, never the auth token."""
    return whatsapp_config_status()


class SendEmailRequest(BaseModel):
    """Everything Meera captured on the call, for the branch-manager lead email.

    v13 added the KYC and answer fields (pan / aadhaar / existing_loan /
    consent_given / phone) — the manager needs the whole conversation, not just
    the loan figures the old customer-facing summary carried.
    """
    session_id: Optional[str] = None
    name: Optional[str] = None
    pincode: Optional[str] = None
    loan_type: Optional[str] = None
    loan_amount: Optional[str] = None
    scheme: Optional[str] = None
    gold_weight: Optional[str] = None
    gold_purity: Optional[str] = None
    phone: Optional[str] = None
    pan: Optional[str] = None
    aadhaar: Optional[str] = None
    existing_loan: Optional[str] = None
    consent_given: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def unwrap(cls, v): return _unwrap_payload(v)


@agent_router.post("/send-email")
async def send_email(request: Request, body: Optional[SendEmailRequest] = None):
    """Email the BRANCH MANAGER the full lead, silently, DURING the call.

    Meera never announces this one — see the email states in the DSL. Always returns
    HTTP 200 with an `email_sent` of "true"/"false" so a failure can never surface
    to the agent as a tool error mid-call.
    """
    if not body:
        try:
            raw = await request.json()
        except Exception:
            raw = {}
        raw = _unwrap_payload(raw) or {}
        body = SendEmailRequest(**{k: raw.get(k) for k in SendEmailRequest.model_fields})

    # PAN and Aadhaar are deliberately NOT logged — they are identity documents and
    # these logs are retained. Presence is enough to debug a missing-field problem.
    logger.info("send_email: name=%r pincode=%r scheme=%r pan=%s aadhaar=%s",
                body.name, body.pincode, body.scheme,
                "set" if body.pan else "empty",
                "set" if body.aadhaar else "empty")

    return await send_summary_email(
        name=body.name or "", pincode=body.pincode or "",
        loan_type=body.loan_type or "", loan_amount=body.loan_amount or "",
        scheme=body.scheme or "", gold_weight=body.gold_weight or "",
        gold_purity=body.gold_purity or "", phone=body.phone or "",
        pan=body.pan or "", aadhaar=body.aadhaar or "",
        existing_loan=body.existing_loan or "",
        consent_given=body.consent_given or "",
    )


@agent_router.get("/email-config")
async def email_config():
    """Which email env vars are set — presence only, never the key or password."""
    return config_status()


@agent_router.get("/email-probe")
async def email_probe():
    """Which SMTP ports this container can actually reach. Diagnostic only —
    separates a blocked-egress failure from a bad-credentials failure."""
    return await probe_connectivity()


class HandoverGateRequest(BaseModel):
    """What the post-call workflow knows about the finished conversation."""
    handover_ready: Optional[str] = None
    phone_e164: Optional[str] = None
    name: Optional[str] = None
    consent_given: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def unwrap(cls, v): return _unwrap_payload(v)


# Values that count as "yes, Meera actually finished and promised the callback".
_TRUTHY = {"yes", "true", "y", "1", "complete", "completed", "done", "हाँ", "ha", "haan"}


def _is_yes(raw: Optional[str]) -> bool:
    if raw is None:
        return False
    s = str(raw).strip().lower()
    # An unresolved template token means the variable was never set -> not ready.
    if not s or ("<<" in s and ">>" in s) or ("{{" in s and "}}" in s) or s in ("none", "null"):
        return False
    return s in _TRUTHY


@agent_router.post("/handover-gate")
async def handover_gate(
    request: Request,
    body: Optional[HandoverGateRequest] = None,
):
    """Decide whether the post-call callback should actually dial.

    THE PROBLEM THIS SOLVES: the post-call workflow used to dial the customer
    back on EVERY hangup — including a demo abandoned halfway through, so the
    caller got a callback for a conversation that never reached handover.

    Mozart cannot express a conditional (a `switch` node is stored in the graph
    but silently dropped by the compiler — verified), so the gate lives here.
    The workflow calls this FIRST, then dials using the number THIS endpoint
    returns: a real E.164 number when the conversation completed, an empty
    string when it did not. An empty number cannot dial, so the callback is
    skipped without the workflow needing a branch.

    `handover_ready` is set by Meera only in transfer_intro() — the single state
    where she actually promises the callback.
    """
    if body:
        ready, phone = body.handover_ready, body.phone_e164
        name = body.name
    else:
        try:
            raw = _unwrap_payload(await request.json()) or {}
        except Exception:
            raw = {}
        ready, phone = raw.get("handover_ready"), raw.get("phone_e164")
        name = raw.get("name")

    should_call = _is_yes(ready)
    # A number we cannot dial is the same as "don't call".
    number = (phone or "").strip()
    if number and ("<<" in number or "{{" in number):
        number = ""
    if not number:
        should_call = False

    logger.info(
        "handover_gate: handover_ready=%r name=%r phone=%r -> should_call=%s",
        ready, name, number[:6] + "..." if number else "", should_call,
    )
    return {
        "should_call": should_call,
        # The workflow interpolates this straight into the dial. Empty = no call.
        "number": number if should_call else "",
        "reason": "conversation completed" if should_call
                  else "conversation did not reach handover — callback suppressed",
    }


# How recently a session must have been touched to count as "a call is happening
# right now", and therefore be protected from an unsolicited teardown.
#
# 8s is chosen against the real timing: during a call the gap between tool calls
# is a few seconds (observed 12:17:25 -> 12:17:57 -> 12:18:12 on call f218771b),
# while a genuine hang-up is followed by permanent silence. Long enough to shield
# a live call from a stray beacon, short enough that a real hang-up during a
# think-gap still tears down promptly — and the next start_session sweeps
# whatever this refuses, so nothing can leak.
IN_FLIGHT_GRACE_SECONDS = 8


@agent_router.post("/sessions/close-all")
async def close_all_sessions():
    """Close all active Playwright sessions. Useful for cleaning up leaked browsers."""
    from playwright_service import PLAYWRIGHT_SESSIONS
    session_ids = list(PLAYWRIGHT_SESSIONS.keys())
    closed = []
    failed = []
    for sid in session_ids:
        try:
            await playwright_service.destroy_session(sid)
            closed.append(sid)
        except Exception as e:
            logger.error(f"Failed to close session {sid}: {e}")
            failed.append({"session_id": sid, "error": str(e)})
    logger.info(f"close-all-sessions: closed {len(closed)}, failed {len(failed)}")
    return {
        "success": True,
        "closed_count": len(closed),
        "failed_count": len(failed),
        "closed": closed,
        "failed": failed,
    }


@agent_router.post("/session/end")
async def end_session(request: Request):
    """Tear down the browser for a call that has just ended.

    THE PROBLEM THIS SOLVES: `start_session` already destroys leftover sessions,
    but only LAZILY — on the *next* call. Nothing told the backend a call was
    over, so between two demos the previous run's Chromium stayed alive. noVNC
    streams the whole X display, not one window, so the next audience saw the
    PREVIOUS caller's last screen sitting there until the new page painted.

    Clearing it here means the screen goes clean the moment the call ends,
    rather than when the next one starts.

    The lazy teardown in `start_session` deliberately STAYS as the safety net:
    a crashed tab or a hard browser close never sends this request, and that
    path must still recover.

    Always returns 200 — this is fire-and-forget cleanup called from a
    `sendBeacon` during page unload. A failure here must never surface to the
    caller, and there is nothing the frontend could do about it anyway.

    ⚠️ THE BODY IS PARSED BY HAND, NOT VIA A PYDANTIC MODEL. `sendBeacon` must
    send `text/plain` — any other content type triggers a CORS preflight, and a
    beacon that needs one is silently dropped during page unload. FastAPI rejects
    a `text/plain` body against a BaseModel parameter with a 422 BEFORE this
    function runs, so the browser's cleanup call never reached the teardown.
    Reading the raw bytes accepts the beacon and a normal JSON post alike.

    ⚠️ IT REFUSES TO KILL AN IN-FLIGHT CALL. A stray teardown request destroyed a
    LIVE call's browser once already (React StrictMode's unmount fired the beacon
    mid-call — see AgentVoicePage.tsx). The frontend is fixed, but the frontend is
    not a trustworthy source of "the call ended": a bug, a double-mount, or a
    stray tab can all send this. So a session that has shown tool activity within
    IN_FLIGHT_GRACE_SECONDS is NOT destroyed. A real hang-up is always followed by
    silence, so the grace window costs nothing; the next `start_session` sweeps
    anything this refuses.
    """
    import json as _json
    from datetime import datetime as _dt
    from playwright_service import PLAYWRIGHT_SESSIONS

    raw: Dict[str, Any] = {}
    try:
        body_bytes = await request.body()
        if body_bytes:
            parsed = _json.loads(body_bytes)
            raw = _unwrap_payload(parsed) or {}
    except Exception as e:
        logger.warning("session/end: could not parse body: %s", e)
        raw = {}

    sid = raw.get("session_id") if isinstance(raw, dict) else None

    sid = (sid or "").strip()
    # An unresolved template token is not a session id.
    if sid and ("<<" in sid or "{{" in sid):
        sid = ""

    if not sid:
        logger.info("session/end called without a usable session_id — nothing to do")
        return {"success": True, "closed": [], "reason": "no session_id supplied"}

    if sid not in PLAYWRIGHT_SESSIONS:
        # Normal: the session may already be gone (lazy teardown got there first,
        # or the beacon fired twice). Not an error.
        logger.info("session/end: session %s already gone", sid)
        return {"success": True, "closed": [], "reason": "session already closed"}

    # ---- REFUSE TO KILL A CALL THAT IS STILL RUNNING ----
    # A live call touches this session constantly (every fill_field / click_button
    # bumps last_activity_at). Recent activity means a caller is mid-application,
    # so whatever sent this request was wrong. A genuine hang-up is followed by
    # silence, so this never blocks a real teardown.
    sess = PLAYWRIGHT_SESSIONS.get(sid) or {}
    last = sess.get("last_activity_at") or sess.get("created_at")
    if last:
        try:
            idle_for = (_dt.now() - last).total_seconds()
            if idle_for < IN_FLIGHT_GRACE_SECONDS:
                logger.warning(
                    "session/end: REFUSED to destroy %s — active %.1fs ago (<%ds). "
                    "Something asked to end a call that is still in progress.",
                    sid, idle_for, IN_FLIGHT_GRACE_SECONDS,
                )
                return {
                    "success": True,
                    "closed": [],
                    "reason": (f"session still in flight (active {idle_for:.1f}s ago) "
                               f"— teardown refused to protect a live call"),
                }
        except Exception as e:
            # A clock/type problem must not stop a legitimate teardown.
            logger.warning("session/end: could not compute idle time for %s: %s", sid, e)

    try:
        await playwright_service.destroy_session(sid)
        logger.info("session/end: destroyed session %s on call hangup", sid)
        return {"success": True, "closed": [sid]}
    except Exception as e:
        # Never propagate — but do not leave a wedged entry behind either.
        logger.error("session/end: failed to destroy %s: %s", sid, e)
        PLAYWRIGHT_SESSIONS.pop(sid, None)
        return {"success": True, "closed": [sid], "reason": f"forced removal after error: {e}"}


@agent_router.get("/sessions")
async def list_sessions():
    """List all active Playwright session IDs and their creation times."""
    from playwright_service import PLAYWRIGHT_SESSIONS
    sessions = [
        {
            "session_id": sid,
            "created_at": str(s.get("created_at")),
            "status": s.get("status"),
        }
        for sid, s in PLAYWRIGHT_SESSIONS.items()
    ]
    return {"count": len(sessions), "sessions": sessions}

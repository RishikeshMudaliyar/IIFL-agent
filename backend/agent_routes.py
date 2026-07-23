"""
HTTP endpoints for external agent tool calls (AgentX/VoiceX integration).

These endpoints let a hosted voice/chat agent drive the Playwright browser
over HTTP instead of through the internal WebSocket flow.

Endpoints:
- POST /agent/session/start   - Launch browser, return session_id
- POST /agent/fill-field      - Fill a form field
- POST /agent/click-button    - Click a form button
"""

import logging
import os

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, model_validator
from typing import Any, Optional

from playwright_service import playwright_service

logger = logging.getLogger(__name__)

agent_router = APIRouter(prefix="/agent", tags=["Agent Tool Calls"])


def _get_form_url() -> str:
    url = os.getenv("FORM_URL")
    if not url:
        raise HTTPException(status_code=500, detail="FORM_URL environment variable is not set")
    return url


# ---------- request models ----------

def _unwrap_payload(data: Any) -> Any:
    if isinstance(data, dict) and "payload" in data:
        return data["payload"]
    return data


class StartSessionRequest(BaseModel):
    session_id: str

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
):
    raw_body = await request.body()
    logger.info(f"start_session raw body: {raw_body}")
    sid = (body.session_id if body else None) or session_id
    if not sid:
        try:
            raw = await request.json()
        except Exception:
            raw = {}
        logger.info(f"start_session parsed json: {raw}")
        sid = raw.get("session_id")
    if not sid:
        raise HTTPException(status_code=422, detail="session_id is required")
    form_url = _get_form_url()
    result = await playwright_service.start_session(form_url, sid)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("message", "Failed to start session"))
    logger.info(f"Agent session started: {sid}")
    return {"session_id": sid, "message": result.get("message")}


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
    if not all([sid, fn, val is not None]):
        raise HTTPException(status_code=422, detail="session_id, field_name and value are required")
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
    if not all([sid, btn]):
        raise HTTPException(status_code=422, detail="session_id and button are required")
    result = await playwright_service.click_button(sid, btn)
    return result


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

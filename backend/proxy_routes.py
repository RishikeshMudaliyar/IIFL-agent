"""
CORS proxy for Nurix widget API.

Forwards requests from the frontend to api-in.nurixlabs.tech,
bypassing the browser's CORS restriction.
"""

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import Response

proxy_router = APIRouter(prefix="/nurix-proxy")
# Second proxy for the agentX platform host. The widget gateway (api-in) does NOT
# expose the outbound-call / transcript / call-status endpoints — those live on
# agentx-prod. The outbound-phone-call flow (trigger call + poll transcript) goes
# through here.
agentx_router = APIRouter(prefix="/agentx-proxy")

NURIX_API_BASE = "https://api-in.nurixlabs.tech"
AGENTX_API_BASE = "https://agentx-prod.nurixlabs.tech"

SKIP_HEADERS = {"host", "content-length", "transfer-encoding", "connection"}


async def _forward(base: str, path: str, request: Request) -> Response:
    target_url = f"{base}/{path}"
    if request.url.query:
        target_url += f"?{request.url.query}"

    headers = {k: v for k, v in request.headers.items() if k.lower() not in SKIP_HEADERS}
    body = await request.body()

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.request(
            method=request.method,
            url=target_url,
            headers=headers,
            content=body,
            follow_redirects=True,
        )

    proxy_headers = {
        k: v for k, v in response.headers.items()
        if k.lower() not in {"transfer-encoding", "connection"}
    }

    return Response(
        content=response.content,
        status_code=response.status_code,
        headers=proxy_headers,
        media_type=response.headers.get("content-type"),
    )


@proxy_router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"])
async def nurix_proxy(path: str, request: Request):
    """Widget gateway proxy (api-in.nurixlabs.tech)."""
    return await _forward(NURIX_API_BASE, path, request)


@agentx_router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"])
async def agentx_proxy(path: str, request: Request):
    """agentX platform proxy (agentx-prod.nurixlabs.tech) — outbound calls,
    transcripts, call status."""
    return await _forward(AGENTX_API_BASE, path, request)

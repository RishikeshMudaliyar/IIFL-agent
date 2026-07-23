# IIFL Finance — AI Loan Form-Filling Agent

Demo app for **IIFL Finance** (IIFL Enterprise Connect). An AI voice/chat agent that qualifies a
loan lead and fills the IIFL loan application form live on-screen, then warm-transfers to a human.

- `frontend/` — Vite + React web app (IIFL branding: orange `#F56E28` / navy `#1B1B5C`, Roboto),
  embeds the Nurix voice/chat widgets and a live-form-fill (noVNC) panel.
- `backend/` — FastAPI + Playwright agent (`/agent/*` tool endpoints driven by Mozart workflows,
  `/nurix-proxy`, `/vnc` live view, `/ws` legacy Gemini path).
- `scripts/` — onboarding helpers (discover agents, mint widget keys, point Mozart workflows, set Railway vars).
- `NEW-CLIENT-PLAYBOOK.md` — the rebrand → wire → deploy runbook.

Architecture: user ↔ Nurix agent → tool → Mozart `*_iifl` workflow → backend `/agent/*` →
Playwright fills the deployed form → streamed to the browser via noVNC.

## Config / secrets
Secrets are **not** committed. Provide real values as host/Railway **environment variables**:
- Backend: `DB_HOST`, `DB_PASSWORD`, `FORM_URL`, `TWILIO_*`, `SMSLOCAL_API_KEY`, etc. (`backend/run-env.yaml` ships with `SET_IN_RAILWAY` placeholders).
- Frontend: `VITE_BACKEND_WS_URL`, `VITE_BACKEND_URL`, and the `VITE_NURIX_*` widget keys/IDs
  (the hardcoded defaults in `src/hooks/` and `index.html` are `REPLACE_WITH_*` placeholders — set the
  real IIFL channel-connection values via env or replace them before deploy).

## Run locally
- Backend: `cd backend && python -m uvicorn app:app --port 8000`
- Frontend: `cd frontend && npm install && npm run dev`  (http://localhost:3000)

## Deployed
Frontend + backend are deployed on Railway (project `iifl-agent`). See `NEW-CLIENT-PLAYBOOK.md` §5–6.

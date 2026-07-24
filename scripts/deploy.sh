#!/usr/bin/env bash
# One-shot Railway deploy for the IIFL demo (run from anywhere in the repo).
#
# You must run this yourself — `railway login` is interactive (opens a browser).
# If not logged in yet:  railway login
#
# Project: iifl-agent (id ca37dab8-a04a-4521-b62f-6d86c6a82d0b)
#   frontend service: iifl-frontend  (svc c938de4b)
#   backend  service: iifl-backend   (svc d8bef0b5)
#
# Adjust FRONTEND_SVC / BACKEND_SVC below if `railway status` shows different
# service names in your linked project.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_SVC="${FRONTEND_SVC:-iifl-frontend}"
BACKEND_SVC="${BACKEND_SVC:-iifl-backend}"

echo "==> Repo: $REPO_ROOT"
echo "==> Railway account:"
railway whoami || { echo "Not logged in. Run: railway login"; exit 1; }

echo
echo "==> Linking project (pick 'iifl-agent' if prompted)…"
railway link 2>/dev/null || true

# ---- Frontend: set the new outbound build vars, then deploy ----
echo
echo "==> Setting frontend build vars (outbound phone-call flow)…"
cd "$REPO_ROOT/frontend"
railway variables --service "$FRONTEND_SVC" \
  --set VITE_NURIX_WORKSPACE_ID=ed51dad4-783e-4adf-8ec0-1b14b8938a5d \
  --set VITE_NURIX_VOICE_AGENT_ID=56dfd3b8-5426-44c3-b1ea-3db962638948 \
  --set VITE_NURIX_AGENTX_BASE=https://agentx-prod.nurixlabs.tech

echo "==> Deploying frontend…"
railway up --service "$FRONTEND_SVC"

# ---- Backend: no new vars (the /agentx-proxy route is code-only) ----
echo
echo "==> Deploying backend…"
cd "$REPO_ROOT/backend"
railway up --service "$BACKEND_SVC"

echo
echo "==> Done. Verify:"
echo "    frontend: https://iifl-frontend-production.up.railway.app"
echo "    backend : https://iifl-backend-production.up.railway.app/agentx-proxy/voice/web/transcript/00000000-0000-0000-0000-000000000000"
echo "    (the backend URL should return {\"transcript\":[],\"error\":\"Transcript not found...\"} — proves /agentx-proxy is live)"

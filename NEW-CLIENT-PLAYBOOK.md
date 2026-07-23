# New-Client Onboarding & Deploy Playbook

How to stand up a new client on the AI loan form-filling agent: **rebrand → wire Nurix agents → deploy to Railway → connect Mozart workflows → live view.** Fork this repo per client and follow the steps. Worked example throughout: **Muthoot FinCorp**.

> Secrets in this doc are placeholders (`$ADMIN_KEY`, `$DB_PASSWORD`, …). Never commit real ones — they go in Railway env vars. IDs (workspace/agent/channel/project) are not secrets and are shown as concrete examples.
>
> **Repeatable helpers live in [`scripts/`](scripts/)** — `nurix_discover.py` (agents/channels/keys), `mint_widget_key.py`, `mozart_point_workflows.py`, `railway_set_backend_vars.py`. See [`scripts/README.md`](scripts/README.md).

---

## 0. Architecture (what you're wiring)

- **`frontend/`** — Vite + React. Branded UI, embeds the Nurix **voice + chat** agents via hooks (`src/hooks/use-nurix-voice.ts`, `use-nurix-chat.ts`), and a **"Live form filling"** split-panel (`components/LiveFormPanel.tsx`) that streams the backend browser via noVNC.
- **`backend/`** — FastAPI + Playwright (heavy container: Chromium + Xvfb + x11vnc + noVNC + nginx). Endpoints:
  - `/agent/session/start`, `/agent/fill-field`, `/agent/click-button` → called by **Mozart** workflows to drive the form.
  - `/nurix-proxy/*` → CORS proxy to `api-in.nurixlabs.tech` (voice call bootstrap).
  - `/vnc/vnc.html` + `/websockify` → live view of the Playwright browser.
  - `/ws` → local Gemini live agent (separate; needs GCP creds, optional).
- **Nurix platform:** agents live in a **workspace**; each agent has a **channel-connection** (voice=`VOICE`, chat=`TEXT`) and a domain-scoped **widget API key**. **Mozart** is the workflow engine whose HTTP tasks call the backend.

**Runtime flow:** user ↔ Nurix agent → Mozart `*_<client>` workflows → backend `/agent/*` → Playwright fills the **deployed frontend** form → streamed to the browser via `/vnc`.

### Nurix hosts
| Host | Purpose | Auth |
|---|---|---|
| `agentx-in.nurixlabs.tech` | agents + channel-connections + widget keys | `workspace-id` + `x-admin-key` headers; open OpenAPI at `/openapi.json` |
| `mozart-in.nurixlabs.tech` | workflows | `workspace-id` header; open, no auth. OpenAPI at `/v3/api-docs` |
| `api-in.nurixlabs.tech` | public gateway (voice `/agentx/voice/web/call`, chat) | widget key + gateway key. **403 "Missing Authentication Token" on unmatched routes — use `agentx-in` for admin/discovery** |
| `chat-in.nurixlabs.tech` | chat WebSocket | widget key in query |
| `cadence-in.nurixlabs.tech` | CRM webhook lead ingestion | **VPN/internal only**; needs a per-campaign key |
| `zero.nurixlabs.tech` | web console (Deploy page → mint widget keys) | login |

---

## Agent internals — prompt · config · tools · workflows · widget keys
*How the deployed agent actually works, and where each piece lives so you can clone/edit it per client.*

**The chain:** user speaks/types → **Nurix agent** (voice or chat) decides to call a **tool** → Nurix runs the tool's bound **Mozart workflow** → the workflow's single HTTP task POSTs to the **backend `/agent/*`** → backend **Playwright** performs the browser action → **noVNC** streams it to the live panel.

### Tools (3) — each maps 1:1 to a Mozart workflow and a backend endpoint
| Tool | Mozart workflow | Backend endpoint | Args |
|---|---|---|---|
| `start_session` | `start_playwright_connection_flow_<client>` | `POST /agent/session/start` | `session_id` (UUID) |
| `fill_field` | `fill_field_flow_<client>` | `POST /agent/fill-field` | `session_id`, `field_name`, `value` |
| `click_button` | `click_button_flow_<client>` | `POST /agent/click-button` | `session_id`, `button` |

- Field names the form understands: `mobile`, `otp`, `terms`, `pan`, `full_name`, `consent1`, `consent2`, `email`, `dob`, `gender`, `employment`, `income`, `building`, `road`, `pincode`, `city`, `state`. Buttons: `apply_now`, `verify_continue`, `continue`, `get_loan_offer`, `back_to_step3/4`.
- **Reference tool schemas in the repo:** `backend/system_prompt.txt` (TOOL sections + Function JSON, ~lines 73–140) and `backend/test_chat_flow.py` (`FunctionDeclaration`s). These drive the **local** `/ws` Gemini agent; the **deployed** Nurix agents carry equivalent tool defs in their agent config.

### Agent prompt (two surfaces — don't confuse them)
1. **Deployed Nurix agent prompt** — what greets/drives the live voice+chat (e.g. "Welcome to Muthoot Fin Corp!", voice persona "Maya"). Lives in the **Nurix console** → `zero.nurixlabs.tech` → Agents → *(agent)* → **Build**. Sets greeting, step-by-step flow, and which tools it may call. Read via agentx-in: `/voice/agent-config/all` (workspace key) or `/admin/{voice,text}/agent-config/{agent_id}` (high-priv `x-admin-key`).
2. **Local reference prompt** — `backend/system_prompt.txt`: the flow spec for the local Gemini `/ws` agent (start_session → greet → ask mobile → fill_field → apply_now → OTP → PAN → …). **Update the client name here too.**

*Per client:* clone the DMI agent (console duplicate, or agentx-in `POST /admin/agent/{agent_id}/clone` with `source-workspace-id`/`destination-workspace-id`), then edit greeting + client name.

### Agent config
- **Local** (`backend/`): `config.py` + `run-env.yaml` — Gemini model/voice, DB, SMS/Twilio, `FORM_URL`.
- **Nurix** (per agent — console / agentx-in `agent-config`): `llm_config` (model), `tts_config`/`stt_config`/`vad_config` (voice), `begin_sentence` (chat greeting), `tools`, `agent_variables`, `primary_language`/`supported_languages`, `post_conversation_workflow`. Clone-and-tweak per client.

### Workflows (Mozart)
- 3 per client — clones of the `*_dmi` originals. Clone via mozart `POST /api/metadata/workflow/{name}/clone` (or console), renamed `_<client>`.
- Each is a single `HTTP_SYNC` task (`ping_service`); the only per-environment change is its URL → `<BACKEND_URL>/agent/*` (see §7).
- The agent's tools are **bound to these workflows** (agent config / `workflow_as_a_tool`), so `fill_field` tool → runs `fill_field_flow_<client>` → hits the backend.

### Widget → API key (how the in-page widget authenticates)
- Each agent has a **channel-connection** (`GET /channels/connections/`): `id` (=channel-connection-id), `agent_id`, `account_id`, `chat_widget_config`, `gateway_api_key`.
- The **widget API key is minted per (channel-connection, domain)**: console Deploy page `zero.nurixlabs.tech/channel/<cc-id>/deploy` → enter the deployed frontend **domain** → **Generate API Key**. API equivalent: `POST /chat-widget/api-key {"channel_connection_id": <cc>, "domain": "<host>"}`; verify with `GET /chat-widget/api-key?channel_con_id=<cc>` → `{api_key, domain, status:"ACTIVE"}`.
- The key is **domain-scoped** — only works when the page origin matches the whitelisted domain. Hence: deploy frontend → whitelist its URL → mint → wire.
- Used in `frontend/src/hooks/use-nurix-chat.ts` (chat `api_key`) and `use-nurix-voice.ts` (voice `api-key` + account-shared **gateway** `x-api-key` for `/agentx/voice/web/call`). The `index.html` embedded widgets use `data-widget-id`+`data-api-key`, but the hooks are the primary path.

---

## 1. Prerequisites
- CLIs authenticated: `gh`, `railway`, plus `git`, `node`/`npm`, `python3`.
- From the platform team: the client's **`workspace_id`** and the **agentx admin key** (`x-admin-key`).
- The client's **brand site** (for colours / logo / copy).

```bash
export WS="<client-workspace-id>"          # e.g. 46b1fe6f-1629-4e07-96df-77de72ef6a37
export ADMIN="<agentx-admin-key>"          # x-admin-key
```

---

## 2. Create the client repo
```bash
rsync -a --exclude venv --exclude node_modules --exclude dist --exclude build \
      --exclude __pycache__ --exclude '*.pyc' --exclude '.env' --exclude '.env.*' \
      --exclude '.git' --exclude '*.log' --exclude '.DS_Store' <template>/ <client>-agent/
cd <client>-agent
git init && git add -A && git commit -m "Initial: <Client> agent"
gh repo create <client>-agent --private --source=. --remote=origin --push
```
**Secret hygiene (do once):**
- Sanitize `backend/run-env.yaml` secrets → placeholders (`DB_PASSWORD`, `TWILIO_*`, `SMSLOCAL_API_KEY`). Real values go to Railway vars. (`run-env.yaml` is baked into the image by the Dockerfile but **not read at runtime** — the app uses `os.getenv`; Railway injects the vars.)
- Remove hardcoded fallbacks: `config.py` / `database.py` → `os.getenv("DB_PASSWORD", "")`.
- Verify: `git ls-files -z | xargs -0 grep -nE "<known-db-pw>|<token>"` returns nothing.

---

## 3. Rebrand the frontend
Pull colours + logo from the client site (a quick `read_page`/computed-style grab works). Then:

| File | Change |
|---|---|
| `src/config/branding.ts` | `CLIENT_NAME`, `CLIENT_LOGO` |
| `public/<client>.svg` | the logo. If the brand logo is monochrome **white** (built for a coloured header), recolor its fills to the brand hex so it shows on white — **but keep the luminance-mask rects white** (`<mask>` `fill="white"`), only recolor artwork paths. Keep a `.white.svg` variant for dark bgs. |
| `tailwind.config.js` | repoint the `abc.*` palette to brand colours (keys stay, values change) |
| `src/index.css` | remap legacy brand hexes: `.abc-button` gradient, crimson `#C41E3A/#8B0000/#A01830/#E63946/#fce4e8`, gold `#fde68a/#fbbf24/#d97706`, `accent-color`; and `@apply` `yellow/amber/orange` → brand family |
| `src/**/*.tsx` | sweep Tailwind `yellow|amber|orange-N` utilities → brand family, **preserving shade N**. Fix landing-page decorative reds. **Leave `red-*` — it's form validation.** |
| `index.html` | `<title>`, meta (title/desc/keywords/author/og/twitter), favicons → `/<client>.svg`, `theme-color` → brand hex |

Color sweep one-liner (adjust `<brand>`, e.g. `sky`):
```bash
perl -i -pe 's/\b(bg|text|border|from|to|via|ring|shadow|divide|outline|decoration|accent|caret|placeholder)-(yellow|amber|orange)-(\d{2,3})\b/$1-<brand>-$3/g' \
  $(grep -rl -E "(yellow|amber|orange)-[0-9]" src) src/index.css
```
Catch leftover client-name strings incl. HTML-entity form: `grep -rniE "oldname|old&amp;name" src index.html`.

Build to verify: `cd frontend && npm ci && npm run build`.

---

## 4. Discover the Nurix agents  (`agentx-in`)
```bash
H=(-H "workspace-id: $WS" -H "x-admin-key: $ADMIN" -H "user-id: setup")
B=https://agentx-in.nurixlabs.tech

# agent_ids + types (find the VOICE and TEXT agents)
curl -s "${H[@]}" "$B/agent/list" | python3 -m json.tool   # -> agent_name, agent_id, agent_type

# channel connections: cc-id (`id`), agent_id, account_id, gateway_api_key
curl -s "${H[@]}" "$B/channels/connections/" | python3 -m json.tool
```
Record per client:
- **Voice** agent: `channel-connection-id`, `account_id`.
- **Chat** agent: `agent_id`, `channel-connection-id`, `account_id`.

_Worked example (IDs genericized):_ voice `<voice-agent-id>` cc `<voice-cc-id>` acct `<voice-account-id>` · chat `<chat-agent-id>` cc `<chat-cc-id>` acct `<chat-account-id>`.

---

## 5. Deploy to Railway  (2 services)
```bash
cd <client>-agent
railway init --name <client>-agent
railway add --service <client>-backend
railway add --service <client>-frontend
# assign public domains (do first to resolve the cross-references below)
railway domain --service <client>-backend  --port 8080     # -> BACKEND_URL
railway domain --service <client>-frontend --port 8080     # -> FRONTEND_URL

# backend env (from run-env.yaml real values); FORM_URL -> the deployed frontend
railway variables --service <client>-backend \
  --set "FORM_URL=$FRONTEND_URL/loan-application" \
  --set "DB_PASSWORD=$DB_PASSWORD" --set "USE_VERTEX_AI=true" ...   # + the rest of run-env.yaml
# frontend build arg -> backend ws
railway variables --service <client>-frontend --set "VITE_BACKEND_WS_URL=wss://<backend-host>/ws"

railway up backend  --path-as-root --service <client>-backend  --detach   # heavy image ~10-15 min
railway up frontend --path-as-root --service <client>-frontend --detach   # quick
```
Wait for green:
```bash
curl -s $BACKEND_URL/health ; curl -s -o /dev/null -w "%{http_code}\n" $FRONTEND_URL
curl -s -o /dev/null -w "%{http_code}\n" $BACKEND_URL/vnc/vnc.html   # expect 200
```

---

## 6. Mint widget keys & wire the hooks
Widget keys are **per channel-connection + per domain**. In the console **Deploy** page for each channel: `zero.nurixlabs.tech/channel/<cc-id>/deploy` → enter the **deployed frontend domain** (e.g. `<client>-frontend-production.up.railway.app`) → **Generate API Key**. Do it for the **chat** and **voice** channels.
Fetch/verify anytime: `curl -s "${H[@]}" "$B/chat-widget/api-key?channel_con_id=<cc>"`.

Set the values in `frontend/src/hooks/`:
- `use-nurix-chat.ts` → `accountId`, `apiKey` (chat widget key), `agentId`.
- `use-nurix-voice.ts` → `channelConnectionId`, `apiKey` (voice widget key), `gatewayApiKey` (the **account-shared** key — same one works across workspaces), `apiBase` = `<BACKEND_URL>/nurix-proxy/agentx`.

Validate before/after deploy:
```bash
# chat: WS should return a greeting (Origin must be the whitelisted domain)
#   wss://chat-in.nurixlabs.tech/chat/CHAT_WIDGET/<account>/<uuid>?user_id=<uuid>&api_key=<chatkey>&agent_id=<agent>
# voice: 200 + LiveKit token
curl -s -X POST "https://api-in.nurixlabs.tech/agentx/voice/web/call" \
  -H "content-type: application/json" -H "api-key: <voice-widget-key>" \
  -H "channel-connection-id: <cc>" -H "user-id: $(uuidgen)" \
  -H "x-api-key: <gateway-key>" -H "Origin: https://<frontend-domain>" \
  -d '{"overide_previous_context":true,"custom_dynamic_variables_config":{}}'
```
Commit → `railway up frontend --path-as-root --service <client>-frontend --detach`.

---

## 7. Point the Mozart workflows at the backend  (`mozart-in`)
The client has **3 cloned workflows**: `start_playwright_connection_flow_<client>`, `fill_field_flow_<client>`, `click_button_flow_<client>`. **NEVER touch the `*_dmi` originals** (they live in the same workspace).

For each workflow:
```bash
MB=https://mozart-in.nurixlabs.tech
# displayName -> uuid
curl -s -H "workspace-id: $WS" "$MB/api/metadata/workflow/fill_field_flow_<client>?isDisplayName=true" | python3 -c "import sys,json;print(json.load(sys.stdin)['name'])"
# GET draft (node-graph WorkflowUI) -> edit the type:"http" node's data.url -> PUT draft -> publish
#   url pattern: <BACKEND_URL>/agent/{session/start | fill-field | click-button}
curl -s -H "workspace-id: $WS" "$MB/api/metadata/workflow/<uuid>/draft"      # nodes[type=http].data.url
curl -s -X PUT  -H "workspace-id: $WS" -H "Content-Type: application/json" -d @draft.json "$MB/api/metadata/workflow/<uuid>/draft"
curl -s -X POST -H "workspace-id: $WS" "$MB/api/metadata/workflow/<uuid>/publish"
# verify (published form): tasks[0].inputParameters.http_request.uri == new url
curl -s -H "workspace-id: $WS" "$MB/api/metadata/workflow/<uuid>"
```
Map: `start_playwright_connection` → `/agent/session/start`, `fill_field` → `/agent/fill-field`, `click_button` → `/agent/click-button`.

_(Local testing before deploy: `ngrok http 8000`, point the URLs at the tunnel, and add a `ngrok-skip-browser-warning: true` header on the http node. Remove it once on Railway.)_

---

## 8. Live-form-filling view
Already in the template: `frontend/src/components/LiveFormPanel.tsx` + `src/config/backend.ts`. It embeds `<BACKEND_URL>/vnc/vnc.html` and renders as the right pane on the agent pages.
- Set `VITE_BACKEND_URL` (frontend) to the backend URL if not using the default in `config/backend.ts`.
- The VNC is a **single shared desktop** — run **one demo at a time**. Stale/parallel sessions bleed into the view. Reset: `curl -X POST $BACKEND_URL/agent/sessions/close-all`. Session cap is 2 (oldest auto-evicted); idle sessions are reaped.

---

## 9. Verification checklist
- [ ] Frontend branded; `<title>` and favicon = client.
- [ ] `$BACKEND_URL/health` = 200, `/agent/sessions` = 200, `/vnc/vnc.html` = 200.
- [ ] **Chat**: agent greets with the client name.
- [ ] **Voice**: `/agentx/voice/web/call` returns a LiveKit token; page connects.
- [ ] **Live panel** shows the form (`POST /agent/session/start {"session_id":"<uuid>"}` opens it).
- [ ] Mozart 3 `*_<client>` workflows point at `$BACKEND_URL/agent/*`; **`*_dmi` untouched**.
- [ ] No secrets committed.

---

## 10. Gotchas
- **Cloud Mozart can't reach `localhost`** — the backend URL in the workflows must be public (Railway or a tunnel).
- **Widget keys are domain-scoped** — whitelist the exact deployed frontend domain, or the widgets 403.
- **`api-in` 403s unmatched routes** ("Missing Authentication Token") — use `agentx-in` directly for discovery/admin.
- **Backend DB init is non-fatal**; the `/ws` Gemini agent needs GCP/Vertex creds (doesn't affect the Mozart flow or widgets).
- **CRM webhook API key** = `cadence-in` (VPN-only) + a **campaign_id**; minted with `POST /internal/webhook-api-keys {campaign_id, workspace_id, label}` — one-time secret, no self-serve revoke.
- **ngrok-free** shows an interstitial for some clients — add `ngrok-skip-browser-warning: true`; not needed on Railway.

---

## Appendix — worked-reference shape (client IDs genericized)
- Repo + Railway project: one per client.
- URLs: `https://<client>-frontend-production.up.railway.app`, `https://<client>-backend-production.up.railway.app`.
- Workspace `<workspace-id>`. Voice agent `<voice-agent-id>` (cc `<voice-cc>`, acct `<voice-account-id>`). Chat agent `<chat-agent-id>` (cc `<chat-cc>`, acct `<chat-account-id>`).
- Brand: set the client's primary/navy/light hexes + tagline.

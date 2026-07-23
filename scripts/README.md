# scripts/

Reusable helpers for onboarding a new client. Full flow: [`../NEW-CLIENT-PLAYBOOK.md`](../NEW-CLIENT-PLAYBOOK.md).

All are stdlib-only Python 3 (no `pip install`) except `railway_set_backend_vars.py`, which shells out to the authenticated `railway` CLI.

## Env (never commit real keys — pass via env)
```bash
export NURIX_WORKSPACE_ID=<client workspace uuid>
export NURIX_ADMIN_KEY=<agentx admin/discovery key>     # x-admin-key
# optional host overrides: NURIX_AGENTX_HOST, NURIX_MOZART_HOST
```

## Scripts
| Script | What it does | Example |
|---|---|---|
| `nurix_discover.py` | List agents + channel-connections + widget keys for the workspace (get agent_id / cc-id / account_id). Read-only. | `python3 scripts/nurix_discover.py` |
| `mint_widget_key.py` | Mint/list a **domain-scoped** widget key for a channel-connection (usually done in the console Deploy page). | `python3 scripts/mint_widget_key.py --cc 254 --domain <frontend-host>` |
| `mozart_point_workflows.py` | Point the 3 `*_<client>` Mozart workflows at a backend base URL (draft → publish → verify). **Never touches `*_dmi`.** | `python3 scripts/mozart_point_workflows.py --client muthoot --base-url https://<backend>` |
| `railway_set_backend_vars.py` | Push `run-env.yaml` → Railway backend service vars (with FORM_URL / backend-url overrides). Run from the repo dir; needs the `railway` CLI. Point `--run-env` at a copy holding REAL secrets. | `python3 scripts/railway_set_backend_vars.py --service <client>-backend --form-url https://<frontend>/loan-application --backend-url https://<backend>` |

## Typical order
1. `nurix_discover.py` → record agent_ids / cc-ids / accounts.
2. Deploy to Railway (playbook §5) → `railway_set_backend_vars.py`.
3. Whitelist the deployed frontend domain → `mint_widget_key.py` (or console) → wire the hooks.
4. `mozart_point_workflows.py --base-url <backend>` → point workflows at the backend.

# v12 backup — the factory artifacts, mirrored here because they are NOT in any git repo

The V-Agent-Factory `.gitignore` excludes `clients/*/` (line 8), so everything under
`V-agent-Factory/clients/iifl/loan-lead-qualification/` lives **only on the machine that
built it**. These copies exist so a fresh clone of THIS repo can still rebuild/republish v12.

| file | what it is |
|---|---|
| `dsl-prompt/iifl-loan-v12-sop-content.txt` | the authored v12 SOP, **comments intact** |
| `push_sop_v12_phone_native.py` | pushes it to Ira's draft; strips `//` comments at push time and runs 38 fail-closed gates |
| `simulate_v12.py` | the 7-scenario behavioural harness (model `gemma-4-31b-it` via the sim service) |
| `create_send_email_flow_iifl.json` | the Mozart TOOL workflow graph for the email tool |
| `2026-07-28-publish-request.md` | the audit artifact approved before publishing 24874 |
| `evals/findings.json` | raw simulation findings (201, triaged to 1 real defect — see HANDOFF.md) |

**To use these,** copy them back into
`V-agent-Factory/clients/iifl/loan-lead-qualification/` (same relative paths) and run the push
script with the factory venv: `./.venv/bin/python clients/.../push_sop_v12_phone_native.py`.
It needs `output/agent-ids.json`, which is also gitignored — the ids are in
`../PLATFORM-CONFIG.md` and in the `iifl-live-infra` memory.

⚠️ The push script does NOT publish. Publishing is the operator's gate (`va-audit-and-approve`).

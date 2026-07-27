# IIFL "Ira" — platform-side config (NOT in code, lives on the NuPlay/Mozart platform)

Snapshot of the **working** configuration as of **2026-07-27**, after the batch that made live
form-filling actually work end-to-end. Everything here was set via API, not in this repo — so if the
platform is ever rebuilt or an agent re-published, **re-verify against this file.**

Workspace `ed51dad4-783e-4adf-8ec0-1b14b8938a5d` · Agent (Ira) `56dfd3b8-5426-44c3-b1ea-3db962638948`

---

## ⚠️ READ THIS FIRST: publishing the agent can silently revert an action schema

Observed 2026-07-27: after the operator published the agent, `start_playwright_connection_flow_iifl`
had **lost its `loan_type` property** and was back to `session_id`-only. `fill_field_flow_iifl`'s enum
survived the same publish. Publishing appears to re-sync tool definitions and can clobber out-of-band
action edits.

**Rule: after EVERY publish, re-read both actions and re-apply if reverted.**

```
mcp__nurix-local__nurix_get_action(action_id)          # read
mcp__nurix-local__nurix_update_action(action_id, dto)  # write — dto MUST be {"action": {...}}
```
Unwrapped dto → HTTP 500 `Cannot invoke ActionDTO.getName() because actionDTO is null`.

---

## 1. Action: `fill_field_flow_iifl`
`action_id` **`462cd2f0-e123-4699-89c1-85b4db8d5305`** · tool_id `4b470d2f-57ec-4ca0-98ce-8278133a61f4`

**This enum is the thing that broke the demo.** It was cloned from muthoot and kept muthoot's field
names, so 13 of 14 IIFL fields were unsendable by the LLM. Required `field_name` enum:

```
gold_weight, gold_purity, loan_amount, pan, aadhaar, existing_loan, consent,
biz_type, biz_years, biz_turnover, gst,
collateral_type, collateral_value, existing_emi,
mobile, otp, full_name, email, pincode, city          <- legacy/extra, harmless
```
`required: [session_id, field_name, value]`

Any new form field needs BOTH: a selector in `backend/playwright_service.py` AND an entry in this enum.
Miss the enum and the model simply cannot send it — it will silently substitute a legal field instead.

## 2. Action: `start_playwright_connection_flow_iifl`
`action_id` **`fac5bd80-9823-42ad-8fe4-56a2311cae95`** · tool_id `909a3e2d-d5ff-4ad8-a57b-fb6e93058ba8`

```
properties: session_id (string), loan_type (string, enum: gold|business|secured_business|secured)
required:   [session_id, loan_type]        <- loan_type made REQUIRED so it can't be omitted
```

## 2b. Action: `show_offers_flow_iifl`  (added 2026-07-27, v5)
`action_id` **`5fd22d25-770b-41e0-9533-cc1e6d318ce3`** · tool_id `a82fb71c-1087-411a-9810-71ca9534c524`
workflow uid `ee177d5d-fbcd-472b-a048-86a972496c8c` → `POST /agent/show-offers`

```
properties: session_id, loan_type (enum), loan_amount, gold_weight, gold_purity
required:   [session_id, loan_type]
```
⚠️ **Created by cloning `fill_field_flow_iifl`'s draft, and the clone inherited that
workflow's input schema (the stale muthoot `field_name` enum).** The schema above had to be
re-applied after creation. If this workflow is ever recreated the same way, fix the schema again.
Cloning gotcha: the display name lives in BOTH `displayName` AND `nodes[0].data.label` — set both
or the create 409s as a duplicate.

## 3. Action: `click_button_flow_iifl`
`action_id` `1a89739c-09d6-4901-96fd-fec3e03c25d3` · tool_id `6b83e178-8d33-4950-a718-527c3ff8bab8`

**Rewritten 2026-07-27 (v7).** Was still the legacy ABCD button enum, which would have made the
LTV scheme choice unsendable — the same class of bug as the muthoot `field_name` enum. Now:

```
button enum: scheme_saver, scheme_balance, scheme_max,
             start_application, get_loan_offer,
             apply_now, verify_continue, continue, back_to_step4   <- legacy, harmless
required:    [session_id, button]
```
`scheme_*` is how the caller's chosen LTV tier gets highlighted on screen.

## 3b. Action: `go_to_form_flow_iifl`  (NEW 2026-07-27, v7)
`action_id` **`14c2318d-78dd-43da-81d2-7903092d89c6`** · tool_id **`642a0840-fada-4e06-9411-9180cf08ac0e`**
workflow uid **`0cdbd9bf-b370-4718-a164-3d8a9b71bccf`** → `POST /agent/go-to-form`

```
properties: session_id (string), loan_type (string, enum: gold|business|secured_business|secured)
required:   [session_id]
```
The branch-hero → application-form hop. Verified executing through Mozart end-to-end
(`status: COMPLETED`, backend `success: true`) on 2026-07-27.

⚠️ **Creation gotchas, both hit on the way in:**
- `POST /api/metadata/workflow` returns **500 "Request method 'POST' is not supported"**.
  The real creation route is **`POST /api/metadata/workflow-with-style-v2`** (nodes + edges graph).
  Extract the real id from `nodes[0].data.workflow_def_id` — the `displayName` you pass is ignored.
- MCP `nurix_create_workflow_tool` wants an **UNWRAPPED** ActionDTO (`{"name": ...}`), unlike
  `nurix_update_action`, which requires the **wrapped** form (`{"action": {...}}`). Passing the
  wrapped form to create fails with `Column 'action' cannot be null` — *and still creates the row*,
  so the retry then 409s. If you see that 409, the tool already exists: look it up with
  `nurix_get_server_tool_by_name` rather than trying to create it again.

## 4. Mozart workflow bodies (what actually reaches the backend)
Read: `GET mozart-in.nurixlabs.tech/api/metadata/workflow/{DISPLAY_NAME}?isDisplayName=true` → `.name` is the uid.
Edit: `GET /api/metadata/workflow/{uid}/draft` → patch `nodes[type=="http"].data.body` → `PUT` same path → `POST /{uid}/publish`.
(A plain `GET /api/metadata/workflow/{name}` 404s — needs the uid or `?isDisplayName=true`.)

| workflow | uid | body |
|---|---|---|
| `start_playwright_connection_flow_iifl` | `5d4978b0-cd0e-4496-ad67-2ec79d0c0e55` | `{session_id, loan_type}` ← `loan_type` ADDED 2026-07-27. **v7: `pincode` added to the ACTION schema; the workflow body still needs it** (see below) |
| `fill_field_flow_iifl` | `2c4ee4f4-1e1b-46c9-bb67-c24193fd5441` | `{session_id, field_name, value}` |
| `click_button_flow_iifl` | `3409f4c3-7a41-4aa5-9c24-665dd1a89959` | `{session_id, button}` |
| `show_offers_flow_iifl` | `ee177d5d-fbcd-472b-a048-86a972496c8c` | `{session_id, loan_type, loan_amount, gold_weight, gold_purity, scheme, pincode}` ← `scheme`+`pincode` ADDED 2026-07-27 (v7) |
| `go_to_form_flow_iifl` | `0cdbd9bf-b370-4718-a164-3d8a9b71bccf` | `{session_id, loan_type}` ← NEW 2026-07-27 (v7) |

💡 **Both halves of a tool argument must be updated — the ACTION schema *and* the workflow BODY.**
The action schema is what the LLM can send; the Mozart HTTP body is what actually reaches the
backend. `pincode` was added to `start_playwright_connection_flow_iifl` in both places on
2026-07-27 — the schema alone would have let the LLM send a pincode that the body silently
dropped, giving every caller the Andheri East hero. Same applies to `scheme` on show_offers.

**Verified end-to-end 2026-07-27** (Mozart `sync/execute` → backend log):
```
pincode 400086 -> /branch/400086      pincode 400014 -> /branch/400014
pincode 400097 -> /branch/400097      go_to_form     -> /gold-application
```

All point at `https://iifl-backend-production.up.railway.app/agent/*`.
Backend safely tolerates an unresolved `${workflow.input.loan_type}` token (falls back to gold) — verified.

## 5. Agent input variables (must exist or `<<var>>` interpolates empty)
`name, phone, pincode, pincode_spoken, loan_type, session_id` (+ derived/collect vars, + system `timezone`).
- **`session_id`** — was registered but never SENT by the frontend; that was root cause #2.
- **`pincode_spoken`** — added 2026-07-27 (id 135427). The spaced form the agent actually speaks.

## 6. Published prompt
DSL **v4** = `dsl-prompt/iifl-loan-v4-sop-content.txt` (compiled 56285 chars).
LLM `gemma-4-31b` / cerebras · TTS `eleven_turbo_v2_5`.
Push with `push_sop_v5_pincode_session.py` (has fail-closed gates); publishing stays the operator's gate.

## 6b. HANDOVER = CALLBACK via a second agent (changed 2026-07-27, v6)

Ira no longer warm-transfers. She promises a callback and ends. A post-call workflow then
dials the customer back with a second agent, **Priya**, who answers a quick question or two
and does the actual warm transfer to the human.

| piece | id |
|---|---|
| Warm-up agent **Priya** | `52bbc61b-8ba5-4801-9286-0f9c8eccebd0` (cloned from Ira, PUBLISHED, `call_direction: outbound`) |
| Priya's SOP | `dsl-prompt/iifl-warmup-v1-sop-content.txt` (compiled 35374) |
| Post-call workflow | `iifl_handover_callback`, `workflow_def_id` **`bdf1bba0-fb79-42c4-b034-fff3dc96a34b`** — **GATED, see below** |
| Attached to Ira via | `PUT /agent/{ira}/post-conversation-workflow?check_draft=false` `{"post_conversation_workflow": "<def_id>"}` |
| Trunk (shared with Ira) | `ST_aGf9DfQ4w48v`, number `+918035462787` |

- Priya keeps ONLY the `warm_transfer` tool (+ save_conversation_variable). The 4 form/offer
  tools were deleted from her — she does not fill forms. Ira keeps the form/offer tools and
  **lost** her `warm_transfer` tool.
- The workflow POSTs `http://agentx.agentx/voice/outbound-call` — **cluster-internal**, which is
  why this works at all: the Railway backend *cannot* reach agentx-prod (blocked egress), so
  routing the callback through our backend would have failed.
- ⚠️ **It dials `${workflow.input.agent_input.phone_e164}`, not `phone`.** `/voice/outbound-call`
  requires E.164; the frontend's raw `phone` is 10 digits and would not dial. `phone_e164` is a
  registered input variable on Ira, computed by `toE164India()` in `frontend/src/lib/phone.ts`.
- Trunk assignment route (the one that actually works):
  `POST /voice/sip-trunk/{trunk_id}/assign-agent` with `{"agent_id", "phone_number_id"}`.
  MCP `nurix_assign_phone_to_agent` **422s** — it omits the required phone field.
  `/telephony/trunk/...` paths all 404.

## 6c. The callback GATE (added 2026-07-27) — and why it isn't a switch node

**Bug it fixes:** the callback workflow was `start -> http -> end`, unconditional. It dialled
the customer back on **every hangup**, including a demo abandoned halfway through.

**The gate:** Ira sets `handover_ready` via `%%infer` in **`transfer_intro()` and nowhere else** —
the one state where she actually promises a callback. The workflow is now two chained HTTP tasks:

```
ask_gate          POST  <backend>/agent/handover-gate   {handover_ready, phone_e164, name}
                        -> {"should_call": bool, "number": "<E.164 or empty>"}
trigger_callback  POST  http://agentx.agentx/voice/outbound-call
                        number: ${ask_gate.output.response.body.number}
```
An incomplete conversation returns an **empty number**, which cannot dial — so the callback is
suppressed with no branch needed. Both nodes keep `continue_with_error: true`.

⚠️ **A `switch` node does NOT work on Mozart.** It is accepted into the stored graph and
returned by `GET /draft`, but the **compiler silently drops it** — the compiled workflow kept
only the bare HTTP task. Verified directly. **Always verify against `GET /api/metadata/workflow/{uid}`
(the compiled `tasks`), never the draft graph**, or you will believe a gate is live when it isn't.
Two chained HTTP nodes DO compile, and node 2 can read `${node1.output.response.body.*}`.

Gate behaviour (verified live):

| input | dials? |
|---|---|
| `handover_ready=yes` + valid phone | ✅ yes |
| variable absent / empty / `<<unresolved>>` | ❌ no |
| ready but no phone | ❌ no |
| `haan` / `true` / `1` / `completed` | ✅ yes |

## 7. Warm transfer
Tool id (literal name) `Transfer to loan expert`, `tool_type: warm_transfer`, static → **+919356598610**.
Runtime fn the LLM calls: `Transfer_To_Loan_Expert`.

---

## Pre-demo checklist
1. **Warm the container** — Chromium/Xvfb cold-start is the leading theory for the one 30s
   `start_session` timeout (Mozart's MCP limit) seen on call `25332de0`. Backend is 3.3s warm.
   ```
   curl -sX POST $BACKEND/agent/session/start -H 'Content-Type: application/json' \
        -d '{"session_id":"warmup","loan_type":"gold"}'
   curl -sX POST $BACKEND/agent/sessions/close-all
   ```
2. Confirm both action schemas above (publish may have reverted them).
3. VPN on; test from the deployed frontend origin (widget keys are domain-scoped, localhost 403s).

## Debugging a bad call
`nurix_conversation_messages(conversation_id=<call_id>, agent_ids=…)` — the **`tools[]`** array carries
each tool's input/output/error and is what exposed the real bug. `nurix_get_transcript` 500s (`'speaker'`).

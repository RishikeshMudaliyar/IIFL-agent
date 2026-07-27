# IIFL demo — state of the world as of 2026-07-27

Checkpoint written at the end of the build session, immediately before a **major scope
change**. Read this first, then `agent-build/loan-lead-qualification/PLATFORM-CONFIG.md`
for every ID and the platform gotchas.

Git tag for this state: **`handover-callback-2026-07-27`**.

---

## What the demo does today (all live, all deployed)

A caller lands on the IIFL site, fills a 4-field hero form (name / phone / pincode /
loan type), and starts a web voice call. Then:

1. **Ira** (main voice agent) opens the matching loan form in a real Chromium browser the
   caller watches over noVNC, greets them by name with their loan type and pincode.
2. She shares an IIFL differentiator, invites questions, then asks the qualifying
   questions for their loan type — **filling each answer into the form live on screen**.
3. PAN and Aadhaar are captured, read back digit-by-digit, and confirmed before filling.
4. She **asks** for T&C consent (never auto-ticks). If they ask what it covers she gives
   one or two short points, then asks again. A "no" is respected and not argued with.
5. An **offers page** appears with 2 indicative offers derived from their answers; she
   reads out the best one or two.
6. She says the team will call them back, and ends.
7. A **post-call workflow** fires on hangup and dials the caller back with **Priya**, a
   second agent whose only real job is to warm-transfer them to a human on
   **+91 93565 98610**. Ira is completely out of the transfer path.

Live URLs: frontend `https://iifl-frontend-production.up.railway.app`,
backend `https://iifl-backend-production.up.railway.app`.

---

## The three loan types

`gold` / `business` / `secured` — the site sends the short form `secured`, the SOP branches
on both `secured` and `secured_business`. Each has its own form page and its own field set.
All three are verified filling end-to-end at the backend level.

---

## ⚠️ The one unresolved defect — read before changing anything

**Gemma sometimes does not call `fill_field` for a captured answer.** Confirmed on call
`6d5d605b-ab35-4afb-82e3-0b9664ca188f`: `gold_weight=4`, `gold_purity=18`,
`loan_amount=75000` were all captured as variables but **`fill_field` was never invoked**
for any of them. Every tool call that *did* fire returned success.

The pattern is a turn-boundary problem, and the timestamps prove it: the three skipped
fills all had the model answering in the **same second** as the capture (question flows
straight into the next question, so it packs acknowledgement + next question into one
response and drops the tool call). The three that filled — `pan`, `aadhaar`,
`existing_loan` — all had something forcing a **separate turn** first (PAN and Aadhaar have
read-back/confirm states; existing_loan is followed by the consent turn).

**This is NOT a backend, schema, session, or selector problem.** All of those are verified
healthy — every one of the skipped fields fills successfully when called directly.

Mitigation shipped in v6: a MECHANICAL response_rule telling the model to call `fill_field`
**in the same response**, before speaking, and that short answers ("4", "18") still count.
This is a nudge, not a guarantee — **it has not yet been confirmed on a live call.**

**If it is still flaky, the next lever is structural, not more prompt wording:** give every
form question the same shape that already works — an intermediate state that forces a turn
boundary between the answer and the next question (mirror the PAN/Aadhaar confirm pattern).
A model A/B against `gpt-4.1-mini` is the fallback after that.

---

## ⚠️ Publishing the agent reverts out-of-band changes — happened 3 times

Publishing Ira has repeatedly clobbered things set via the API:

- once it reverted `start_playwright_connection_flow_iifl`'s action schema (dropped `loan_type`)
- once it reverted the whole v6 SOP back to v5 **and** wiped `post_conversation_workflow` to null,
  while keeping the tool deletion — leaving a mismatch where Ira promised a transfer she no
  longer had, and the call ended on two failed `click_button` calls

**After EVERY publish, re-verify before testing:** the compiled prompt, the
`post_conversation_workflow` attachment, both agents' tool lists, and all three action
schemas. PLATFORM-CONFIG.md lists the exact calls.

---

## Where things live

| | |
|---|---|
| Repo | `github.com/RishikeshMudaliyar/IIFL-agent` (private), branch `main` |
| Frontend | `frontend/` — Vite/React. Forms in `src/pages/*Application.tsx`, shared inputs in `src/components/forms/FormKit.tsx`, offers in `src/pages/OffersPage.tsx` + `src/lib/offerTable.ts` |
| Backend | `backend/` — FastAPI + Playwright. `agent_routes.py` (HTTP tools), `playwright_service.py` (selectors + browser driving) |
| Prompts | `agent-build/loan-lead-qualification/dsl-prompt/` — Ira is `iifl-loan-v6-*`, Priya is `iifl-warmup-v1-*` |
| Platform IDs + gotchas | `agent-build/loan-lead-qualification/PLATFORM-CONFIG.md` ← **the important one** |
| Factory (not in this repo) | `../V-agent-Factory/clients/iifl/loan-lead-qualification/` — push scripts, judge/sim reports |

Deploy: `railway up --service iifl-frontend` / `--service iifl-backend` from the respective
directory. The frontend does **not** auto-deploy from a git push.

---

## Things that cost real time to discover — don't rediscover them

1. **Tool schema enums gate what the LLM can send.** IIFL's tools were cloned from muthoot
   and kept muthoot's `field_name` enum, so 13 of 14 IIFL fields were unsendable. The model
   jammed an Aadhaar number into `pan` because `pan` was the only legal value. Any new form
   field needs BOTH a selector in `playwright_service.py` AND an entry in the action enum.
2. **`session_id` must be sent by the frontend** and stay stable for the whole call. An
   empty/unresolved one made every fill fail with "Session not found".
3. **ElevenLabs reads bare digits as quantities** — `560068` becomes "five lakh sixty
   thousand". Identifiers must be emitted space-separated (`5 6 0 0 6 8`). Prose rules do
   not fix this; the text itself has to change. Hence the `pincode_spoken` variable.
4. **React state, not DOM attributes, for form UI.** The radio highlight was set via
   `setAttribute` and got wiped on every re-render (FormShell consumes `useLead()`).
5. **`/voice/outbound-call` needs E.164** — hence `phone_e164`. A bare 10-digit number does
   not dial.
6. **Railway cannot reach agentx-prod** (blocked egress). The callback works only because
   the Mozart workflow calls the cluster-internal `http://agentx.agentx` address.
7. **Debug calls via `nurix_conversation_messages`** — its `tools[]` array carries every
   tool's input/output/error and is what found each real bug. `nurix_get_transcript` 500s.
8. **Warm the container before a demo.** One `start_session` timed out at Mozart's 30s MCP
   limit on a cold container; warm it and it answers in ~3s.

---

## Verified working, end to end

All three loan types fill every field and produce offers (backend-level, direct API):

```
gold     10g/22K  -> Swarna Express  ₹35,000 @13.5%  EMI ₹3,134
business 20L      -> Vyapar Growth   @17.5%          EMI ₹82,787
secured  30L      -> Sampatti Plus   @12%            EMI ₹43,041
```

Offer figures are **derived from IIFL's published numbers only** (gold from 0.99%/mo ≈
11.88%/yr, 75% LTV, ≤24mo; business unsecured ≤₹75L over ≤3yr; secured ₹3L–₹3Cr from ~11%/yr
over 12–180mo). The only modelling is that rate improves with ticket size inside each
published band. Everything is labelled indicative. **Never invent a rate** — `offerTable.ts`
is the single source of truth for both the UI and what the agent says.

---

## Open items carried into the next session

- **Confirm the fill fix on a live call** (the one real unknown above).
- **The handover callback has never been observed end-to-end on a real call** — the code,
  workflow, agent, and trunk are all wired and verified, but no test call has actually
  produced the callback yet. Needs a real phone number in the hero form.
- The 30s cold-start `start_session` timeout is mitigated by warming, not fixed.
- `MAX_CONCURRENT_SESSIONS = 2` eviction has a benign race (3 concurrent starts all survived).
- v3's changelog claims the "loan offers" step was removed; `offer_intro` was in fact still
  present throughout, and v5 deliberately reinstated a real offers step.

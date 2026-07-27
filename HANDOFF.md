# IIFL demo — state of the world as of 2026-07-27 (v7, gold-first rebuild)

The **scope change landed**. This describes the NEW flow. Read this first, then
`agent-build/loan-lead-qualification/PLATFORM-CONFIG.md` for every ID and the platform gotchas.

Previous checkpoint tag (pre-scope-change): **`handover-callback-2026-07-27`**.

---

## What changed in v7 — the short version

The demo is now **gold-loan-first and hyperlocal**. Two structural changes:

1. **The call opens on a BRANCH HERO, not a form.** The caller's pincode selects one of
   four real Mumbai branch pages. Ira asks "application shuru karein, ya pehle aapki
   nearest branch ke baare mein bata doon?" — and only moves to the form when they agree.
2. **The gold form is built around three LTV schemes.** The caller states an amount, hears
   three options, and picks one — which highlights on screen and drives the offer.

Business and secured loans are **untouched** and still work exactly as before.

## The four branches (real data, IIFL's own locator)

| Pincode | Branch | Landmark the agent actually says |
|---|---|---|
| 400059 | Andheri East (Marol) | Marol Maroshi Rd, Tarani Business Centre, opp. Lok Bharti Complex |
| 400086 | Ghatkopar West | LBS Marg, Anupam Building, 5 min from Ghatkopar station |
| 400097 | Malad East (Kurar) | Shantaram Talao Rd, near St George High School |
| 400014 | Dadar East | Parasmani Shopping Centre, 2nd floor, next to Dadar station |

All 9:30 AM–6:00 PM, Sunday closed. An unsupported pincode falls back to Andheri East.
Addresses/landmarks/timings are **real**; the per-branch "local colour" line is fabricated
demo material, confined to one field (`hyperlocal`) in `frontend/src/lib/branches.ts` so it
can be reviewed or swapped in one place.

## The three LTV schemes

| Scheme | LTV | ₹/gram (22K) | Rate | Tenure |
|---|---|---|---|---|
| IIFL Swarna Saver | 55% | ₹7,300 | 11.88% p.a. (0.99%/mo) | 12 mo |
| IIFL Swarna Balance | 65% | ₹8,635 | 14.4% p.a. (1.2%/mo) | 18 mo |
| IIFL Swarna Max | 75% | ₹9,960 | 17.4% p.a. (1.45%/mo) | 24 mo |

⚠️ **75% is the RBI/IIFL published LTV CEILING.** The original ask specified 0.8/1.0/1.25
LTV, which cannot legally exist (>100% LTV = lending more than the collateral is worth).
The tiers were placed **at and below** the cap instead, preserving the intended trade-off:
low LTV = cheaper rate but more gold pledged. Per-gram = 22K Mumbai rate (₹13,285/g,
26 Jul 2026) × LTV. Rates sit inside IIFL's published 11.88–27% p.a. band.
Single source of truth: `frontend/src/lib/goldSchemes.ts`. **Never invent a rate.**

## The flow end to end

A caller fills the 4-field hero form (name / phone / pincode / loan type) and starts a web
voice call. Then:

1. **Ira** opens the **branch hero for their pincode** in a real Chromium browser they watch
   over noVNC, and greets them by name.
2. She thanks them for the enquiry and offers the choice: **apply now, or hear about the
   nearest branch first?** If they want the branch, she gives address-by-landmark, timings,
   and (if it lands naturally) the local colour line.
3. On agreement she calls **`go_to_form`** — the browser moves to `/gold-application`.
4. **Loan amount** → she presents the **three schemes** with grams-needed for *their* amount
   → the caller picks one → **the chosen card highlights on screen**.
5. **Gold weight** → **purity** → **PAN** → **Aadhaar** (both read back digit-by-digit and
   confirmed before filling) → **existing loan** → **T&C consent** (asked, never auto-ticked).
6. An **offers page** appears led by *their chosen scheme*, with the next tier up for
   comparison, plus a same-day-disbursal CTA naming their own branch.
7. She adds **one** urgency line ("teen baje tak aa jaayein to paisa aaj hi mil sakta hai"),
   skipping it if the caller sounds hesitant, and says the team will call back.
8. A **post-call workflow** fires on hangup and dials the caller back with **Priya**, who
   warm-transfers to a human on **+91 93565 98610**. Ira is out of the transfer path.

Live URLs: frontend `https://iifl-frontend-production.up.railway.app`,
backend `https://iifl-backend-production.up.railway.app`.

## Verified end-to-end 2026-07-27 (through Mozart, not just the raw endpoint)

```
pincode 400086 -> /branch/400086     pincode 400097 -> /branch/400097
pincode 400014 -> /branch/400014     go_to_form     -> /gold-application
every gold field fills · scheme_balance click OK · offers page returns 2 cards
30g 22K, asked ₹2,00,000, scheme=balance
  -> IIFL Swarna Balance ₹2,00,000 @14.4% EMI ₹12,421 (18mo)   [their choice, leads]
  -> IIFL Swarna Max     ₹2,00,000 @17.4% EMI ₹9,927  (24mo)   [comparison]
```

**v7 SOP is pushed to Ira's DRAFT and passes all 15 gates. It is NOT published —
publishing stays the operator's gate.**

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

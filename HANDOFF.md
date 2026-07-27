# IIFL demo — state of the world as of 2026-07-27 (v10)

**v10 IS BUILT AND DEPLOYED.** v10 is a **frontend-only** change: the call page now looks like a
real inbound phone call (smartphone mockup, rings, auto-answers, then shows the transcript).
**No agent, prompt, tool, PCA or backend change — Ira is untouched and still on published version
24843 (SOP v9).** v9 fixed the two defects the first live call exposed (below). Read this first,
then `agent-build/loan-lead-qualification/PLATFORM-CONFIG.md` for every ID and the platform
gotchas.

Tags: `v10-checkpoint-2026-07-27` (this state), `v9-checkpoint-2026-07-27`,
`v8-checkpoint-2026-07-27`, `v7-checkpoint-2026-07-27`.

---

## 📱 v10 — THE CALL PAGE IS NOW A PHONE CALL (frontend only)

Confirmed working on a live call by the operator. Deployed to Railway; frontend bundle
`index-C5tJ62rI.js` verified serving from `iifl-frontend-production.up.railway.app`.

**What the demo now does:** hero form → "Talk to AI" → the left panel shows a **device-framed
incoming call** from *IIFL Finance · 1860 267 3000* (pulsing "Ira" avatar, ring animation,
Decline/Answer) → after **~3 s it auto-answers** → the panel becomes the in-call screen (Ira
avatar, live MM:SS timer, green pulse) with the **existing transcript underneath, unchanged**.
The right half (`LiveFormPanel` / noVNC) is untouched.

| | |
|---|---|
| New | `frontend/src/components/PhoneCallFrame.tsx` — `mode="ringing"` \| `mode="in-call"`, device bezel + notch, live status-bar clock, call timer. Self-contained: CSS keyframes are inlined, so **no `tailwind.config` change** |
| Changed | `frontend/src/pages/AgentVoicePage.tsx` — a one-way `phase` state (`"ringing"` → `"connected"`) that **gates the `<LiveKitRoom>` mount** |
| Unchanged | `VoiceConversation` — transcript streaming, interim-bubble collapsing and `sanitizeTranscript` are all byte-identical. Deliberate: the fragile, already-debugged parts stayed out of the blast radius |
| Caller ID | `IIFL_CALLER_NUMBER` at the top of `PhoneCallFrame.tsx` = `1860 267 3000` (IIFL's real published customer-care number). One-line change if the client wants a branch landline instead |
| Ring length | `RING_DURATION_MS = 3000`, same file |

### 🔴 Two invariants in this code — do not "simplify" either

1. **Gating the `<LiveKitRoom>` mount is load-bearing, not cosmetic.**
   `<LiveKitRoom connect audio>` starts the conversation the *instant it mounts*. If it mounted
   during the ring, Ira would deliver her `नमस्ते!` greeting while the screen still said
   "Incoming call". The room must mount only at `phase === "connected"`, which is what makes her
   greeting land exactly on pickup.
2. **The phase flip is ONE-WAY. Never flip back to `"ringing"`.**
   Flipping back would unmount `<LiveKitRoom>` mid-call — precisely the v9 Defect 1 teardown
   failure that killed live calls. **Decline** therefore takes the hang-up path (`cleanUp()` then
   `/home`) rather than rewinding the phase. There is no room to disconnect during a ring because
   it was never mounted.

### One deploy surprise worth knowing

`railway up --service iifl-frontend` printed `reqwest error … operation timed out` at the end.
That is only the CLI's **log-streaming socket** dropping — the upload and build had already
started. Check `railway status` rather than retrying; a blind retry queues a second redundant build.

Also: **the git push appeared to trigger an `iifl-backend` redeploy** (it went Deploying → Online
~40 s after the push) even though no backend file changed. This **contradicts** §"Where things
live", which says the frontend does not auto-deploy from a git push. Backend came back healthy, so
nothing is broken, but the trigger wiring is not what the note claims. Unconfirmed — verify before
relying on either behaviour.

---

## 🔴 v9 — TWO LIVE-CALL DEFECTS FOUND AND FIXED (call `f218771b`)

The first real voice call exposed two serious bugs. **Both are fixed, deployed and published
(Ira version 24843).** Read this before anything else.

### Defect 1 — the cleanup killed the LIVE call's browser (a v8 REGRESSION)

Symptoms the operator saw: noVNC showed **"Reconnecting…"** mid-call, and the demo **jumped back
to the branch hero** even though the conversation was already past scheme selection.

Cause: v8's teardown was wired to fire on component **unmount**. `<React.StrictMode>`
(`index.tsx`) deliberately mounts → unmounts → remounts every component, so the unmount fired the
teardown beacon **during the call**, and the remount minted a **new** `useFormSessionId()`.

Evidence from the call:

```
12:17:25  start_session  -> web-6c978c49   OK
12:17:57  go_to_form     -> /gold-application   OK
12:18:12  fill_field loan_amount=700000   OK
12:19:17  *** a second session web-d20ec74a appears — nothing asked for it ***
12:19:30  click_button scheme_max -> "Button 'scheme_max' not found"   FAILED
```

Ira's click went to the original session whose browser had just been destroyed; the form silently
stopped filling from that point.

**Two-part fix (both shipped):**
1. **Never tear down on unmount.** Cleanup now runs ONLY on a genuine end — explicit hang-up,
   LiveKit `onDisconnected`, or `pagehide` (which StrictMode does not fire). Leaving the page any
   other way is covered by the backend's lazy teardown, which is what that safety net is for.
2. **The session id survives a remount.** `useFormSessionId()` now keeps the id in a module-scope
   variable, not `useState` (which is per-mount), and `resetFormSessionId()` clears it only when a
   call really ends.
3. **Backend guard — `IN_FLIGHT_GRACE_SECONDS = 8`.** `/agent/session/end` now REFUSES to destroy
   a session touched within the last 8s. The frontend is not a trustworthy source of "the call
   ended"; a real hang-up is followed by silence, so the window costs nothing.

Verified live: a stray beacon mid-call → `"teardown refused to protect a live call"`, session
survives. After 10s of silence → `{"closed":["guard-test"]}`, `count:0`.

### Defect 2 — Ira chose the scheme, and chose the most expensive one

The caller said *"जो सबसे best रहेगा मेरे लिए… मेरे पास ज़्यादा पैसे नहीं है"* and Ira replied
*"तो क्या मैं आपके लिए **Swarna Max** select कर दूँ?"* — the **highest-interest** scheme (17.4%),
recommended to the most cost-sensitive signal in the call, and chosen *for* them.

**Fix (SOP v9):** new `gold_scheme_help()` state for "which is best for me?", plus hard rules:
never select for the caller; never default to Max; when money is tight the honest answer is
**Saver** (the cheapest); and never say *"क्या मैं आपके लिए select कर दूँ?"* — recommend, then have
the caller confirm the scheme **by name**. The three-scheme pitch was also cut from nine numbers
to three names (the cards on screen carry the detail).

Verified by replaying the exact failing exchange against the published prompt:
now recommends **Saver** with the reason, and asks *"क्या आप Swarna Saver लेना चाहेंगे?"*.
All five gates are enforced in `push_sop_v9_scheme_choice.py`.

---

## ⏭️ START HERE IN A NEW SESSION

**Everything is deployed and published — nothing is pending.** Ira runs published version
**24843** (SOP v9) — **v10 did not touch her**, so there is nothing to republish. Both Railway
services are live with the v10 frontend / v9 agent.

> ⚠️ The old "🔴 republish Ira first" instruction is **GONE — it was already done.** Ira reports
> `has_unpublished_changes: false`. Do not re-push an older SOP over v9.

Run **`TEST-SCRIPT-v7.md`** for the core flow (still accurate — v8 changes wording and adds
states, it does not change the v7 happy path), plus the v8 scenarios in §"Testing v8" below.

**After every publish, re-verify** (publishing has reverted out-of-band changes 3×):
compiled prompt, `post_conversation_workflow` attachment, both agents' tool lists, and all
5 action schemas. PLATFORM-CONFIG.md §"READ THIS FIRST" lists the exact calls.
*(Checked after the v8 publish — everything survived this time.)*

### What is verified working vs. what is not

| | |
|---|---|
| ✅ Verified live (through Mozart, not just the raw endpoint) | pincode → correct branch hero (400086/400097/400014 each tested); `go_to_form` → form; every gold field fills; scheme click lands; offers page leads with the chosen tier; callback gate returns correct decisions across 6 cases |
| ✅ **v10, confirmed by the operator on a live call** | the **phone-call UI**: the ring shows, auto-answers after ~3 s, and the transcript renders inside the phone frame with Ira's greeting landing on pickup. Live bundle hash verified serving |
| ✅ **v9, verified live** | **session teardown, now safe** — a genuine hang-up destroys the browser (`count:0`), while a stray mid-call beacon is REFUSED (`teardown refused to protect a live call`). The v8 version of this killed live calls — see the v9 section at the top |
| ⚠️ PARTLY proven on a real voice call | call `f218771b` confirmed live: the **area name** is spoken ("आप दादर ईस्ट side में हैं"), the proactive IIFL line lands, `start_session`/`go_to_form`/`fill_field` all fire. It also exposed the two v9 defects. The rest of the flow past scheme selection has still NOT been heard end-to-end |
| ❌ Never once observed working | **the Priya callback actually ringing.** All five links now verified individually (see §"The callback" below) — but no test call has ever produced the callback. Still a pre-existing unknown |
| ⚠️ Known-fragile | `fill_field` turn-boundary defect (below). Mitigated by a prompt rule, never confirmed fixed on a live call. **v8 adds conversational turns, which could aggravate it — watch this on the next live call** |

---

## What changed in v8

### 1. Two defects fixed

**Session teardown was not the bug it looked like.** The backend logic was always correct
(verified: start A → start B destroys A). The real gap was that **nothing told the backend a
call had ended** — `endCall()` only did `room.disconnect()`. Teardown was therefore *lazy*,
happening only on the NEXT `start_session`, so the old Chromium stayed alive between demos and
noVNC (which streams the whole X display) kept showing the previous caller's last screen.

Fix: new **`POST /agent/session/end`** + the frontend calling it on every exit path (hang up,
agent disconnect, Back, tab close, reload) via `navigator.sendBeacon`. The lazy teardown
deliberately REMAINS as the safety net for a crashed tab that never sends the beacon.

> ⚠️ **`sendBeacon` must send `text/plain`** — any other content type triggers a CORS preflight,
> and a beacon needing one is silently dropped during unload. FastAPI rejects `text/plain`
> against a Pydantic body parameter with a 422 *before* the handler runs, so `/agent/session/end`
> parses the raw body by hand. Caught by testing the real content type; the JSON path had
> worked fine and hid it.

**The callback gate was widened.** `handover_ready` is now set at **`offer_read()`** as well as
`transfer_intro()`. Reaching the priced offers means the demo delivered its value, so hanging up
there still earns a callback. It is still never set before the offers — an abandoned demo (drop
during PAN capture) still produces no callback, which is the whole point of the gate.

### 2. Three conversational changes

| | |
|---|---|
| **Area name, not digits** | `confirm_context()` now says "आप अंधेरी ईस्ट side में हैं, right?" instead of reading "4 0 0 0 5 9". Each branch block gained an `area_spoken` name. **An unknown pincode must name NO area** — the model is explicitly forbidden from inventing a neighbourhood. `pincode_spoken` stays available for when the caller disputes the area |
| **Proactive benefits** | `iifl_welcome()` adds ONE matched IIFL strength; `branch_spiel()` adds ONE line from the new `branch_benefits` block (valuation in front of you, 30-min disbursal, insured vault at *that* branch, no income proof). One line each, never stacked |
| **Hesitation → facts** | New `hesitant` intent + one `reassure_and_continue()` state reached from the **global** block, so doubt anywhere in the call lands in one handler and returns the caller to where they were. Backed by `rules.objection_handling` |

**Hesitation signals** (operator-chosen): explicit doubt ("सोचता हूँ", "बाद में", "interest ज़्यादा है"),
competitor comparison (Muthoot/Manappuram/bank), and stalling/repeated questions.
**Silence was deliberately EXCLUDED** — on a voice call an STT gap and think-time are
indistinguishable from hesitation, so it would misfire constantly.

> 🔒 **Two safety rules, both gated in the push script.**
> **(a) Never disparage a competitor.** Say what IIFL is; never claim another lender is worse,
> slower or dearer, and never quote a rate we have not verified. This is a regulated lending
> conversation.
> **(b) Hesitation HARD-SUPPRESSES the urgency CTA.** Detecting reluctance and then pushing a
> deadline is the worst possible outcome. Reassurance and urgency are mutually exclusive.
>
> **No new figures entered the prompt** — every claim in `objection_handling` traces to
> `iifl_intro` / `faq_answers` / `goldSchemes.ts`.

### Testing v8

Beyond `TEST-SCRIPT-v7.md`:

1. **Area name** — call with pincode `400086`; Ira must say "घाटकोपर वेस्ट", never the digits.
2. **Unknown pincode** — use one not in the four; she must name **no** area and invent nothing.
3. **Objection** — say "Muthoot में कम rate मिल रहा है". Expect: acknowledgement + an
   IIFL-positive fact, **no** attack on Muthoot, **no** invented comparison, **no** urgency line.
4. **Hesitation then offers** — say "सोचकर बताता हूँ" late in the call; the urgency CTA must be skipped.
5. **Two demos back to back** — the second must open clean, with no flash of the first.

### The callback — where it actually stands

All five links are now individually verified: gate endpoint ✅, compiled Mozart workflow ✅,
workflow attached to Ira ✅, `handover_ready`+`phone_e164` registered ✅, published SOP sets the
variable ✅. It has still **never been observed ringing**.

Two candidate causes remain, and they are **not separable without one deliberate test call**:
- **(a)** the variable was never set because the operator hung up before the offers — **v8's
  widened gate should fix this**;
- **(b)** the post-call workflow does not fire at all for a **web/WebRTC** call
  (`/voice/web/call`), whereas the callback was built and verified for **phone** calls.

**The one diagnostic:** run a call to the offers, hang up, then
`railway logs --service iifl-backend | grep handover_gate`.

| observed | cause | next move |
|---|---|---|
| `should_call=True` and no ring | dial path / Priya's trunk | investigate `/voice/outbound-call` + trunk `ST_aGf9DfQ4w48v` |
| `should_call=False` | variable still unset | check `%%infer handover_ready` fired at `offer_read()` |
| **no `handover_gate` line at all** | **(b)** — workflow never fires on web calls | the fix must run in the **browser**: Railway egress to agentx-prod is BLOCKED (re-verified: 30s timeout → 500, while api-in answers in ~1s), so a backend-triggered callback cannot work |

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

## Three defects found and fixed after the first live test (same day)

**1. Every caller got the Andheri branch, whatever pincode they typed.**
The digit-spacing rule in the prompt used `560068` as its worked example, and gemma sent *that*
to `start_session` instead of `<<pincode>>` — a few-shot leak. Examples now use `400059` (a real
supported pincode, so a copy is harmless) plus an explicit "use the caller's own `<<pincode>>`"
instruction at the tool call site. **Note: action-schema enums are NOT enforced at runtime** —
`560068` was not in the enum and still reached the backend. Prompt wording is the real control;
the backend's unsupported-pincode fallback is the safety net (it worked).

**2. Priya called back even when the demo was abandoned halfway.**
The post-call workflow was `start → dial → end`, unconditional. Now Ira sets `handover_ready`
via `%%infer` in **`transfer_intro()` and nowhere else**, and the workflow is two chained HTTP
tasks: `ask_gate` (backend `/agent/handover-gate`) → `trigger_callback`, with the dial reading
`${ask_gate.output.response.body.number}`. An incomplete conversation returns an **empty number**,
which cannot dial. The push script gates that `handover_ready` appears exactly twice and only
inside `transfer_intro()`, so it can never be set early again.

⚠️ **A Mozart `switch` node does NOT work** — it is stored in the graph and reads back intact,
but the **compiler silently drops it**. Verified. Always check the compiled `tasks`
(`GET /api/metadata/workflow/{uid}`), never the draft graph.

**3. A second demo showed the previous demo's last screen.**
Three independent causes, all fixed:
- `MAX_CONCURRENT_SESSIONS = 2` left the old browser alive, and noVNC shows the whole X display —
  so the previous run's offers page sat there until the new page painted (and leaked one caller's
  data into the next demo). Now every `start_session` tears down all other sessions first.
- `setLead` **merges**, so a field left blank inherited the last caller's value (a stale pincode
  opened the wrong branch). Added `replaceLead()` — one atomic write — used on the landing page.
- The noVNC iframe `src` was a constant and could reuse its cached document. Now cache-busted
  once per mount.

Also: **`scheme` was never registered as an agent variable**, so the offers page could not have
received the caller's chosen LTV tier. Registered.

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

**Do first**
1. ~~Republish Ira~~ — **DONE.** Ira is published on SOP v9 (version 24843) and re-verified.
2. **Run a real voice call through the whole v8 flow.** Nothing in v7 or v8 has been exercised by
   gemma on a live call yet — only via the API and Mozart. `TEST-SCRIPT-v7.md` plus the five v8
   scenarios above. **This is now the single highest-value thing left.**
3. **While on that call, run the callback diagnostic** (§"The callback" above) — it is the one
   experiment that separates the two remaining candidate causes.

**Known unknowns (not regressions)**
- **The fill_field turn-boundary defect** — the one genuinely fragile thing. Mitigated by a
  MECHANICAL prompt rule, never confirmed on a live call. If still flaky, the next lever is
  **structural** (give every form question the PAN/Aadhaar-style confirm state that already
  works), then a model A/B against `gpt-4.1-mini`. Note the scheme step is a `click_button`,
  not a fill, and carries its own rule.
- **The callback has never actually rung.** All pieces verified individually. If a *complete*
  call produces no callback, check the backend log for `handover_gate: … should_call=True` —
  that separates "my gate suppressed it" from the pre-existing unknown.
- The 30s cold-start `start_session` timeout is mitigated by warming, not fixed.

**Nice to have**
- Business and secured loans are untouched by v7 and still work, but have not been re-tested
  since the change. Worth one smoke test each if the client might ask.
- The fabricated hyperlocal lines (one `hyperlocal` field per branch in
  `frontend/src/lib/branches.ts`, plus the matching "local colour" line in the prompt) are the
  **only** invented content. Worth a read-through before the client sees it.
- v3's changelog claims the "loan offers" step was removed; `offer_intro` was in fact still
  present throughout, and v5 deliberately reinstated a real offers step.

## Where the platform-side scripts live

`agent-build/loan-lead-qualification/push_sop_v7_branch_schemes.py` is the v7 SOP pusher
(backed up here because `V-agent-Factory/clients/*` is gitignored — the factory copy is the
one that runs, from `V-agent-Factory/clients/iifl/loan-lead-qualification/`). It fail-closes on
19 gates including the `handover_ready` placement. Run it with the factory venv:

```
cd ~/IIFL/V-agent-Factory/clients/iifl/loan-lead-qualification
../../../.venv/bin/python push_sop_v7_branch_schemes.py     # pushes to DRAFT only
```

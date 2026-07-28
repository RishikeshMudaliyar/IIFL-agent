# IIFL demo — state of the world as of 2026-07-28 (v13)

## ✅ v13 — THE DEMO RAN AND THE TEAM LIKED IT

**v13 IS PUBLISHED, VERIFIED AND DEMO-PROVEN.** It is the version that ran the IIFL
Enterprise Connect demo on 2026-07-28 and was well received. Tag
**`v13-checkpoint-2026-07-28`**. Read this section, then
`agent-build/loan-lead-qualification/PLATFORM-CONFIG.md` for every ID and the platform gotchas.

Tags: `v13-checkpoint-2026-07-28` (**this state — the demo-proven one**),
`v12-checkpoint-2026-07-28`, `v11-checkpoint-2026-07-28`, `v10-checkpoint-2026-07-27`,
`v9-checkpoint-2026-07-27`, `v8-checkpoint-2026-07-27`, `v7-checkpoint-2026-07-27`.

### 🔜 START HERE NEXT SESSION — what is still open

1. **RENAME THE AGENT: Ira → Meera.** Major, operator-confirmed. Not started. Every
   surface is listed in "The Ira → Meera rename" below — it is far wider than the
   agent's display name (prompt body, opening line, WhatsApp signature, email
   signature, `EMAIL_FROM`, frontend copy).
2. **The 2:30 team-meeting feedback.** ⚠️ **NOT CAPTURED — the items were never
   written down in the build session.** Ask the operator to restate them before
   planning; do not guess from these notes.

### What v13 does that v12 did not

| | v12 | **v13** |
|---|---|---|
| Caller gets | Summary **email** at the end | **WhatsApp** with branch address/details, sent **before the KYC questions** |
| Branch manager gets | nothing | **Email** with every input + every answer (PAN, Aadhaar, existing loan, consent), sent **silently after consent** |
| Schemes | Ira asked the caller to pick, and blocked until they did | **Information only** — names the three, invites questions, never solicits a pick |

### The three v13 behaviours to protect

- **WhatsApp goes over Twilio's REST API (HTTPS), never SMTP.** Railway blocks all
  outbound SMTP. `whatsapp_service.py`; `branch_data.py` is the single source of
  branch/scheme truth shared with the email so the two can never contradict.
- **The manager email is SILENT but must not be skippable.** `lead_email_action()`
  keeps a mandatory explicit instruction line. A tool-only state with no instruction
  gets skipped by the model — that is the v12 `go_to_form` regression (call
  `2044aa31`) and it broke every form fill.
- **A caller who never picks a scheme is a VALID outcome.** All three scheme states
  fall through to `gold_q3()`; `offer_read()` presents the offers generically when
  `<<scheme>>` is empty. Never re-add a block-until-chosen rule.

### Conversation fixes earned from live calls (do not regress these)

From call **`372c5ce1`** (the 11:54 feedback):
- No `"select कर लूँ?" / "fix करें?"` — asking permission to record a choice
  describes operating a screen the caller cannot see. It derailed three turns.
- No standalone filler turns (`"एक मिनिट बस"`, `"Okay..."`), no repeating yourself,
  each confirmation asked once.
- Burst-turn rule: callers speak in two or three fragments; answer the latest once.
- `branch_hook()` capped at **two sentences**; the local event lives in the WhatsApp
  only. It previously produced an 85-word monologue that ran out of breath.

From call **`05ab9af5`** (the demo rehearsal):
- `confirm_context()` must **not** re-introduce Ira — the static opening line already
  says who she is.
- `iifl_welcome()` invokes `go_to_form` **first**, then speaks the trust lines **and**
  the loan-amount question as ONE turn. Previously the tool ran after the turn,
  leaving a 31-second gap the model filled with a bare `"Okay..."`.

### ⚠️ Known-fragile, NOT fixed

- **"Agent stuck".** Mitigated by the burst-turn rule, root cause unfixed: the
  platform's turn handling when caller speech arrives while a tool is running.
  Prompt rules reduce it; they cannot eliminate it. Set expectations accordingly.
- **Twilio WhatsApp sandbox opt-in expires after 72h of inactivity.** Every recipient
  must WhatsApp `join contrast-place` to `+14155238886` again. **This is the single
  most likely thing to break a future demo.** An approved WA Business sender would
  remove the constraint (`TWILIO_CONTENT_SID` is already wired for that path).
- **The Priya callback ringing has still never been observed working.** Pre-existing.

### Publishing

**Publishing is operator-only in this setup** — the permission classifier blocks both
the MCP `nurix_publish_draft` and the raw `POST /agent/{id}-draft/draft/publish`. Push
scripts stop at the draft by design; the operator publishes in the NuPlay UI.
Publishing has silently reverted schemas/prompts **3 times**, so re-verify the
compiled prompt, all 7 tools and both action schemas afterwards. v13's publishes came
through clean.

**`opening_dialogue` is NOT writable by any API** — four routes return HTTP 200 and
silently ignore it. Change it in the NuPlay UI. Currently:
`"Hello, मै Ira बोल रही हु IIFL Finance bank से..."` ← **must change in the rename.**

---

## 📋 THE IRA → MEERA RENAME (open, not started)

Operator-confirmed after the demo. **The name is in more places than the agent's
display name** — a partial rename is worse than none, because the caller then hears
"Meera" but the WhatsApp is signed "Ira". Verified inventory as of the v13 checkpoint:

### Customer-visible — these MUST all change together
| Where | Current | Note |
|---|---|---|
| `opening_dialogue` (NuPlay UI) | `"Hello, मै Ira बोल रही हु IIFL Finance bank से..."` | ⚠️ **UI only — no API writes this** |
| SOP body (4 refs) | `confirm_context()` example, `closing()`, persona | Factory copy, then push + publish |
| `whatsapp_service.py:103` | `"— Ira, IIFL Finance"` | WhatsApp signature |
| `email_service.py:251` | `"New lead from a call with Ira, IIFL's voice assistant."` | Manager email body |
| `email_service.py:281` | `"Generated automatically during the call by Ira."` | Manager email footer |
| `PhoneCallFrame.tsx:135,196` | `Ira` | The on-screen caller name in the phone UI |

### Platform / config
- **Agent display name:** `IIFL Finance - Ira (Loan Voice)` → Meera (NuPlay UI).
  Agent id `56dfd3b8-…` does NOT change; do not create a new agent.
- **`EMAIL_FROM=ira@nurix.tech`** → decide whether to move to a `meera@` sender.
  ⚠️ **A new address needs Resend domain verification first** or every email
  silently fails. `EMAIL_FROM_NAME` is `IIFL Finance` and can stay.
- **Voice/TTS:** unchanged unless the team also wants a different voice.

### Not customer-visible — cosmetic, do last or skip
Code comments and docstrings across `agent_routes.py`, `email_service.py`,
`whatsapp_service.py`, `use-nurix-outbound.ts`, `branches.ts`, `BranchHero.tsx`,
`AgentVoicePage.tsx`. No behaviour depends on them.

### Suggested order
1. SOP + `opening_dialogue` (the spoken name) → push → **operator publishes** → verify
2. Backend strings (WhatsApp + email signatures) → commit → auto-deploys
3. `PhoneCallFrame.tsx` → **`railway up --service iifl-frontend`** (the frontend does
   NOT auto-deploy from a git push)
4. Agent display name in the UI
5. Comments, if anyone cares

⚠️ **Verify with one live call afterwards.** Two independent things must agree: what
the caller HEARS (prompt + opening line) and what they RECEIVE (WhatsApp + email
signatures). Grep for `Ira` across `iifl-agent/` and the factory SOP as the final check.

---

## 📋 THE 2:30 TEAM-MEETING FEEDBACK (open — CONTENT NOT CAPTURED)

⚠️ **The items were never recorded in the build session.** The operator flagged that
feedback exists and must be actioned, but the specifics were not shared, so there is
nothing here to work from. **Ask the operator to restate them before planning any
work, and do not infer them from the notes above** — guessing at feedback is how a
regression gets shipped as a fix.

Once restated, treat them the way the `372c5ce1` and `05ab9af5` items were treated:
reproduce from a real conversation log first (`nurix_conversation_messages`, whose
`tools[]` array carries each call's inputs/outputs), then add a push-script gate per
fix so a later edit that deletes the rule fails loudly.

---

## ☎️ v12 — PHONE-NATIVE REWRITE + LIVE IN-CALL EMAIL

**The premise changed.** The caller is on a **phone and can see nothing**. The browser form still
fills — that is how the demo team watches the backend work — but Ira no longer knows it exists.
Operator directive: no "look at your screen" anywhere, and never offer to help fill a form; just ask
questions and record silently.

### The flow now (operator-specified)
Enthusiastic self-intro from IIFL Finance → context-aware *"your gold loan enquiry just came in from
[area]"* → **loose** offers/trust talk with no hard numbers → **form opens silently** → amount →
three schemes as **three short phrases** → grams → purity → **branch + local-event hook** → PAN →
Aadhaar → existing loan → consent → **email sent live during the call** → last questions → callback.

### 🔴 THE v12 REGRESSION — READ BEFORE TOUCHING `go_to_form()`
Making `go_to_form()` silent left a state whose body was **only a tool call**, and gemma **skipped it
entirely** (`iifl_welcome()` → `gold_q1()`). The browser stayed on the branch page, so on live call
**`2044aa31`** all 7 `fill_field` calls and the `click_button` failed with **"field not found"** and
the application captured **nothing** — while Ira sounded flawless.

⚠️ **A DSL state whose body is only a tool call reads as skippable to the model.**

Fix (live in `24874`, gated in the push script so it cannot regress):
1. `go_to_form()` carries an explicit *"Do not speak. Invoke the tool NOW. Mandatory"* line.
2. `response_rules` gained an **ordering rule** — go_to_form BEFORE any fill; if it has not run,
   run it first in the same response.
3. A rule to never surface a fill error to the caller.

**NOT yet re-tested on a live call. That is the #1 action.**

### 🔴 STILL BROKEN — 30 seconds in the NuPlay UI (operator-only)
`opening_dialogue` is still the v9 line *"क्या मै जल्दी से आपके लिये **application start** कर दुं?"* —
mentions an application, asks permission (both removed in v12), wrong feminine auxiliaries, and it
**caused a double-greeting** on call 2044aa31.

**Four API routes all returned HTTP 200 and silently ignored the write** (`/v2/voice/agent-config/
{draft}`, `/voice/agent-config/{draft}` partial *and* full-object, `/agent/{draft}`, and MCP
`nurix_update_voice_agent` — whose response does not even include the field). **Do not burn time
re-deriving this.** Fix in **Agent settings → Opening dialogue**:

```
नमस्ते! मैं Ira बोल रही हूँ IIFL Finance से. एक second दीजिए.
```

### 📧 The live in-call email — WORKING
`send_email_flow_iifl` (tool `e2cc59a1-…`, action `00e03dbc-…`, workflow `1dfb5342-…`) → backend
`POST /agent/send-email`. **Confirmed firing on live call 2044aa31 and delivering to Sanchit.**
Renders amount (Indian digit grouping), chosen scheme + terms, grams/purity, the caller's branch with
directions, and their pincode's local event.

- ⚠️ **Railway blocks ALL outbound SMTP** (587/465/25/2525 all time out — proven via
  `GET /agent/email-probe`). A Gmail App Password can never work from Railway. Mail goes over
  **Resend's HTTPS API**; `EMAIL_PROVIDER=resend|smtp` selects transport.
- ⚠️ Resend sends only **FROM a verified domain**: Nurix's is **`nurix.tech`**, not `nurix.ai`.
  The restriction is on the *sender*, so `EMAIL_TO=sanchit.goel@nurix.ai` is fine.
- ⚠️ **Do NOT "claim" `nurix.ai` in Resend** — it belongs to another Nurix team and claiming
  **revokes their access**, which could break production email.
- Never returns non-200: failure → `email_sent:"false"` → Ira's `email_failed()` state softens to
  "our team will send it shortly" rather than erroring mid-call or claiming a false send.

### 🗜️ Prompt cut 22% — comments stripped at PUSH time
The platform preamble says *"// marks a silent comment. Never speak or act on comment text"*, so
comments cost tokens and buy nothing. `push_sop_v12_phone_native.py` strips whole-line `//` before
pushing: SOP 66,978→53,932; **compiled 105,412→82,283**. Proven lossless (218 instruction lines,
79 states, 26 tool calls, 181 routes, 4 `say()`, 6 switch cases, 112 intent handlers all identical).
**Comments stay in the authored file** — they document why each guardrail exists. ~29,000 chars of the
compiled prompt is the platform's own preamble and is not ours to cut.

### Verification status
- ✅ 38/38 static gates pass against the **compiled** prompt.
- ✅ Post-publish: agent ACTIVE, 6 tools attached and enabled, **all 6 action schemas intact** —
  the first clean publish in four attempts (it had silently reverted 3× before).
- ✅ Simulation `evals/sim-v12-run1/` — 7 scenarios × 3 = 21 conversations. 201 raw findings triaged
  to **1 real defect** (a v9 line saying "Application भरने से"), fixed + gated. The rest were checker
  false positives — notably the adversarial scenario where Ira **correctly denies** a screen exists —
  or the platform-contract `<derived-variable>` emission.
- ❌ `va-dsl-judge` **never run on v12** — operator accepted the risk. Would statically check the new
  Devanagari (branch_hook, email states, reworded opening).
- ❌ **No live call since the hotfix.**
- ❌ The Priya callback has **still** never been observed ringing (pre-existing).

### How to debug the next live call
Get the conversation id and run
`nurix_conversation_messages(conversation_id, agent_ids)`. **Read the `tools[]` array, not the
transcript** — it shows `success:false` / "field not found" that the transcript hides completely.
That is how 2044aa31 was diagnosed; the transcript looked perfect.

---

**v11 (2026-07-28, frontend only):** the ring is now **5 s, not 3 s**
(`RING_DURATION_MS` in `PhoneCallFrame.tsx`). Deployed via `railway up` and verified live —
served bundle `index-BiIBb4In.js` contains `5e3`. Ira untouched (published 24843 / SOP v9).

---

## 📱 v10 — THE CALL PAGE IS NOW A PHONE CALL (frontend only)

Confirmed working on a live call by the operator. Deployed to Railway; frontend bundle
`index-BiIBb4In.js` (v11) verified serving from `iifl-frontend-production.up.railway.app`.

**What the demo now does:** hero form → "Talk to AI" → the left panel shows a **device-framed
incoming call** from *IIFL Finance · 1860 267 3000* (pulsing "Ira" avatar, ring animation,
Decline/Answer) → after **~5 s it auto-answers** (3 s until v11) → the panel becomes the in-call screen (Ira
avatar, live MM:SS timer, green pulse) with the **existing transcript underneath, unchanged**.
The right half (`LiveFormPanel` / noVNC) is untouched.

| | |
|---|---|
| New | `frontend/src/components/PhoneCallFrame.tsx` — `mode="ringing"` \| `mode="in-call"`, device bezel + notch, live status-bar clock, call timer. Self-contained: CSS keyframes are inlined, so **no `tailwind.config` change** |
| Changed | `frontend/src/pages/AgentVoicePage.tsx` — a one-way `phase` state (`"ringing"` → `"connected"`) that **gates the `<LiveKitRoom>` mount** |
| Unchanged | `VoiceConversation` — transcript streaming, interim-bubble collapsing and `sanitizeTranscript` are all byte-identical. Deliberate: the fragile, already-debugged parts stayed out of the blast radius |
| Caller ID | `IIFL_CALLER_NUMBER` at the top of `PhoneCallFrame.tsx` = `1860 267 3000` (IIFL's real published customer-care number). One-line change if the client wants a branch landline instead |
| Ring length | `RING_DURATION_MS = 5000`, same file |

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

### Two deploy facts worth knowing

1. **`railway up` may end with `reqwest error … operation timed out`. That is NOT a build failure** —
   it is only the CLI's log-streaming socket dropping after the upload and build have already
   started. Check `railway status`; a blind retry queues a second redundant build.
2. **The push to `main` redeployed `iifl-backend`, and that is expected** — investigated and
   resolved, no longer an open question. `iifl-backend` **is** GitHub-connected and auto-deploys on
   every push to `main`; `iifl-frontend` is **not** connected at all and deploys only via
   `railway up`. So the old note "the frontend does not auto-deploy" was only half the story.
   Full table in §"Where things live".

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
| ✅ **The WHOLE TAIL re-verified on live prod 2026-07-27** (v10 checkpoint) | one session driven end to end against the live backend: `start_session` → `go_to_form(gold)` → `loan_amount`/`gold_weight`/`gold_purity` → `click_button scheme_saver` → `pan`/`aadhaar`/`existing_loan` → `consent` → `show_offers`. **Every step returned success**, offers led with the caller's chosen **Swarna Saver @ 11.88%** (not Max — v9 behaviour holds), amount correctly capped by the gold at **₹1,82,500** (25g × ₹7,300, below the ₹7,00,000 requested). Callback gate correct both ways. Session torn down, `count:0` |
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

**Re-confirmed 2026-07-27 (v10 checkpoint) that the defect is purely model-side:** the three
fields that gemma skipped (`loan_amount`, `gold_weight`, `gold_purity`) were each driven directly
against the live backend and **all three filled successfully**, as did `pan`/`aadhaar`/
`existing_loan`/`consent` and `click_button scheme_saver`. So the executor, selectors, schemas and
session handling are all healthy — **if a field is blank on a demo, the tool was never called; do
not go looking in `playwright_service.py`.** The lever remains structural (force a turn boundary
per question), not more prompt wording.

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

Deploy — **the two services behave DIFFERENTLY** (confirmed 2026-07-27 via `railway status --json`):

| Service | GitHub connected? | How it deploys |
|---|---|---|
| **`iifl-frontend`** | **No** (`source.repo: null`) | **Only** `railway up --service iifl-frontend` from `frontend/`. A git push does nothing. Its deployments carry no commit hash |
| **`iifl-backend`** | **Yes** — `RishikeshMudaliyar/IIFL-agent`, config `/backend/railway.json` | **Auto-deploys on every push to `main`**, even when no backend file changed. `railway up --service iifl-backend` also works |

Consequences, both real:
- **A frontend change is NOT live until you run `railway up`.** Pushing to `main` is not enough.
- **Any push to `main` redeploys the backend.** Harmless for frontend-only commits (it rebuilds the
  same backend image), but it means a broken backend commit goes live the moment you push — there is
  no "push now, deploy later" safety gap on that service.

Verify a frontend deploy really landed by matching the served bundle hash to your local build —
the hashes are content-derived, so equality is proof:
`curl -s <frontend-url>/ | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js'` vs `ls frontend/dist/assets/`.

---

## Things that cost real time to discover — don't rediscover them

0. **The `/agent/*` JSON field names are NOT what you'd guess** — hit twice while verifying v10.
   Getting one wrong does **not** error loudly; the value silently arrives as `None` and you get a
   plausible-but-wrong result. Copy these exactly (source of truth: the Pydantic models in
   `backend/agent_routes.py`):
   - `POST /agent/click-button` → **`button`**, *not* `button_name`. (A wrong key here **does** 422.)
   - `POST /agent/show-offers` → **`loan_amount`, `gold_weight`, `gold_purity`**, *not*
     `amount`/`grams`/`purity`. Sending the guessable names made grams parse as 0, so the offer
     collapsed to the `Math.max(10000, …)` floor in `frontend/src/lib/offerTable.ts` and showed
     **₹10,000** for a ₹7,00,000 request. Nothing was broken — the call was wrong. If offers ever
     read ₹10,000, suspect the payload keys **before** the offer logic.
   - `POST /agent/go-to-form` → **`loan_type`** (`gold` | `business` | `secured_business`), *not*
     `form`. A wrong key silently defaults to **gold**, so business/secured appear "broken" and land
     on `/gold-application` when in fact the request never named a type.
   - `POST /agent/fill-field` → `field_name` + `value` (this one is as expected).

   **The pattern:** these endpoints accept an unknown key without complaint and fall back to a
   default. Three of my four verification calls hit this and each *looked* like an app bug. Read the
   Pydantic model before writing a curl, and when a result looks wrong, **re-check your payload keys
   first**.

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
2. **Run a real voice call through the whole v8 flow — ONE THING LEFT, and it needs a human.**
   Everything mechanical is now verified on live prod (see the table above: the full tail from
   `start_session` through `show_offers`, both non-gold loan types, and the callback gate both
   ways). What remains is **whether gemma actually calls the tools in the right order while
   talking** — the `fill_field` turn-boundary defect is the only real risk, and it cannot be
   reproduced or cleared through the API, because the API path always calls the tool correctly.
   Run `TEST-SCRIPT-v7.md` + the five v8 scenarios on a real voice call. **This is the single
   highest-value thing left and the only genuinely open item.**
3. **While on that call, run the callback diagnostic** (§"The callback" above) — it is the one
   experiment that separates the two remaining candidate causes. The gate itself is confirmed
   correct on live prod (`should_call:true` + number when ready, `false` + empty when not), so if a
   *complete* call still produces no callback, **the gate is exonerated** and the cause is
   downstream in the workflow/telephony leg.

**Known unknowns (not regressions)**
- **The fill_field turn-boundary defect** — the one genuinely fragile thing. Mitigated by a
  MECHANICAL prompt rule, never confirmed on a live call. If still flaky, the next lever is
  **structural** (give every form question the PAN/Aadhaar-style confirm state that already
  works), then a model A/B against `gpt-4.1-mini`. Note the scheme step is a `click_button`,
  not a fill, and carries its own rule.
- **The callback has never actually rung.** All pieces verified individually, and the **gate is now
  confirmed correct against live prod** (ready+valid phone → `should_call:true` with the number;
  not-ready → `should_call:false` with an empty number). So the gate can be ruled out: if a
  *complete* call produces no callback, the cause is downstream (workflow trigger or telephony leg),
  not suppression. Still check the backend log for `handover_gate: … should_call=True` to confirm.
- The 30s cold-start `start_session` timeout is mitigated by warming, not fixed.

**Nice to have**
- ~~Business and secured loans have not been re-tested~~ — **DONE 2026-07-27 (v10).** Both smoke
  tested on live prod: `go_to_form` routes correctly (`business` → `/business-application`,
  `secured_business` → `/secured-application`) and offers render — Vyapar Starter 19% / Growth 17.5%
  at ₹5,00,000; Sampatti Base 13% / Plus 12% at ₹25,00,000. Safe if the client asks.
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

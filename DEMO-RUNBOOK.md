# IIFL "Meera" demo — operator runbook

**For whoever is running the demo.** You do not need to understand how it is built.
Follow this top to bottom. Everything below was verified against the live system on
**2026-07-28**.

**What the audience sees:** a customer fills a short form on IIFL's site → an AI agent
(**Meera**) calls them → she talks them through a gold loan in Hinglish, filling an
application on screen as she goes → the customer gets a **WhatsApp** with their nearest
branch details → the **branch manager gets an email** with the whole lead → she promises a
specialist callback.

---

# PART 1 — THE DAY BEFORE (do not skip)

## ☐ 1.1 The WhatsApp opt-in — THE #1 THING THAT BREAKS

The WhatsApp is sent from a **Twilio sandbox number**, and a sandbox will only message a
phone that has explicitly opted in. **The opt-in expires after 72 hours of no messages.**

**On the exact phone you will use in the demo**, send a WhatsApp message:

| | |
|---|---|
| **To** | `+1 415 523 8886` |
| **Message** | `join contrast-place` |

You should get a confirmation reply. **If you skip this, everything else works and the
WhatsApp silently never arrives** — the call sounds perfect and nothing errors.

> **As of 28 Jul, only `+91 91678 76538` is opted in** (joined 06:44, so it lapses around
> **06:44 on 31 Jul**). **Any other phone will receive nothing until it joins.**
> Re-send the join message the morning of the demo — it is free and takes 10 seconds.

## ☐ 1.2 Decide the demo phone number and pincode

- **Phone** — must be the number from 1.1. Meera calls it, so it must be reachable and
  ideally on speaker.
- **Pincode** — use **one of these four only**:

| Pincode | Branch |
|---|---|
| `400059` | Andheri East (Marol) |
| `400086` | Ghatkopar West |
| `400097` | Malad East |
| `400014` | Dadar East |

Any other pincode silently falls back to **Andheri East**, so Meera will name a branch
that is not the caller's. Don't improvise a pincode on stage.

## ☐ 1.3 Know where the lead email lands

Right now the lead email goes to **`rishikesh.mudaliyar@nurix.ai`**, *not* to a real
branch manager. If you want to show it live, either have access to that inbox or ask for
`BRANCH_MANAGER_EMAIL` to be pointed at yours before the demo. **This is a one-variable
change; ask early, not on the day.**

## ☐ 1.4 Record a backup video

Do a full successful run and screen-record it. If the live call fails on stage, play the
video. This is the single highest-value 10 minutes of prep.

---

# PART 2 — 30 MINUTES BEFORE

## ☐ 2.1 Do you need VPN?

- **The demo itself: NO VPN NEEDED.** Both demo URLs are public — verified.
- **VPN is only needed** to open Nurix's internal tools (the NuPlay console, agent
  settings, logs). If you are only *running* the demo, you do not need it.
- If you might need to check the agent config or logs mid-session, connect the VPN
  beforehand so you are not fighting it live.

## ☐ 2.2 Wake the system up (IMPORTANT — cold start is slow)

The backend sleeps when idle. A cold start can take ~30 s and has previously hit a
timeout mid-demo. Warm it by opening these in a browser; every one must load:

| Check | URL | Expect |
|---|---|---|
| Frontend | https://iifl-frontend-production.up.railway.app | IIFL landing page |
| Backend | https://iifl-backend-production.up.railway.app/health | `{"status":"healthy"...}` |
| Branch page | https://iifl-frontend-production.up.railway.app/branch/400086 | Ghatkopar West page |
| Form | https://iifl-frontend-production.up.railway.app/gold-application | blank gold form |

Then **reload the landing page once more** right before you start.

## ☐ 2.3 Clear any leftover browser session

Open: https://iifl-backend-production.up.railway.app/agent/sessions

- `{"count":0,"sessions":[]}` → good, carry on.
- Anything else → a previous demo is still open. Starting a new demo **does** destroy the
  old one automatically, so this is usually self-healing — but check it anyway, because the
  symptom if it goes wrong (the audience seeing the previous customer's screen) is the
  worst-looking failure in the demo. To clear it deliberately, ask an engineer to run:
  `curl -X POST https://iifl-backend-production.up.railway.app/agent/sessions/close-all`

## ☐ 2.4 Phone ready

Ringer ON, volume UP, **speaker mode**, do-not-disturb OFF. The audience needs to hear her.

---

# PART 3 — RUNNING THE DEMO

## ☐ 3.1 Open the landing page

https://iifl-frontend-production.up.railway.app

Use a **fresh tab** (or hard-refresh) if you have already run one demo in this tab.

## ☐ 3.2 Fill the form — 4 things

| Field | What to enter |
|---|---|
| Loan type | **Gold Loans** (already selected) |
| Full Name | a first name — she will use it out loud |
| Mobile Number | the 10-digit number from step 1.1, no `+91` |
| Enter Pincode | one of the four from 1.2 |
| Consent tick | tick it (the button stays greyed out otherwise) |

Click **"Talk to AI Agent"**.

## ☐ 3.3 The call

The screen becomes a **ringing phone** from *IIFL Finance · 1860 267 3000*, rings ~5 s,
then **answers itself**. Your real phone rings at the same time — **answer it.**

Then just have the conversation. What the audience should watch:

1. She greets by name and knows their **area** ("घाटकोपर वेस्ट side से").
2. She asks the **loan amount**.
3. She names **three schemes** (Saver / Balance / Max) — as information, and asks if
   they have questions. *She will not ask them to choose; that is intentional.*
4. **Gold weight** → **purity**.
5. She names their **nearest branch** and says she is sending WhatsApp details.
   → **check the phone: the WhatsApp should arrive here.**
6. **PAN**, then **Aadhaar** — she reads each back digit by digit to confirm.
7. Existing loan? → **consent**.
8. She reads out **indicative offers** (amount, EMI, tenure).
9. She promises a **specialist callback** and ends.

**Behind the scenes at step 7:** the branch-manager email is sent silently. Don't mention
it during the call — open the inbox afterwards as the reveal.

## ☐ 3.4 Suggested things to say (they show off real behaviour)

| Say this | What it demonstrates |
|---|---|
| *"Swarna Max ke baare mein detail mein batao"* | Answers about **the scheme you asked for**, with the right LTV and per-gram figure |
| *"mera gold safe rahega?"* | Real IIFL vault + insurance answer |
| *"koi hidden charges hain?"* | "Seedhi Baat", Key Fact Statement |
| *"America ka president kaun hai?"* | **Politely refuses and returns to the loan** — a good one for the audience |
| *"interest zyada lag raha hai, Muthoot mein kam hai"* | Handles the objection **without disparaging the competitor** |

---

# PART 4 — AFTER THE CALL

1. **The WhatsApp** — branch address, directions, timings, what to bring.
2. **The lead email** (inbox from 1.3) — IIFL-branded lead sheet: name, tappable number,
   what they asked for, KYC (PAN/Aadhaar **part-masked** by design), their answers, and
   the branch it routed to. Good to project.
3. **The filled application** on screen.

---

# PART 5 — IF SOMETHING GOES WRONG

| Symptom | Most likely cause | What to do |
|---|---|---|
| **No WhatsApp** | opt-in lapsed (step 1.1) | Nothing live. Show the email instead; re-join afterwards. **Most common failure.** |
| Phone never rings | wrong/short number, or the call did not launch | Check the number is 10 digits, reload, retry once |
| She names the **wrong branch** | pincode not one of the four | Restart with a supported pincode |
| Screen shows the **previous** customer | leftover session (step 2.3) | Hard-refresh, start again in a new tab |
| Long silence early on | cold start | Wait ~30 s once; if dead, restart the call. Prevent with step 2.2 |
| She says *"our team will send the details shortly"* | WhatsApp send failed | Correct, honest behaviour — she is designed not to claim a send that failed |
| **Form on screen stays empty** | the known form-fill defect | The conversation still works. **Do not draw attention to the screen**; carry on and report it afterwards |
| Specialist callback never rings | never reliably worked | **Do not promise the audience a callback demo.** Treat as out of scope |

**Golden rule on stage: never say "that should have happened".** Move to the next thing.
The conversation is the demo; the screen is a bonus.

---

# PART 6 — KNOWN LIMITS (so you don't oversell)

- **The gold rate, LTVs and EMIs are indicative demo figures** built from IIFL's published
  numbers. Never present them as a live quote.
- **The "local event" mentioned for a branch is fabricated demo colour.** Addresses,
  landmarks and timings are real.
- **The callback has never been demonstrated end to end.** Don't promise it.
- **The on-screen form fill is the least reliable part.** It has failed on a live call
  before while the conversation itself was flawless.
- Meera **only** does gold loans. Business/secured exist but are not the demo.
- She **will not** discuss anything other than the gold loan, by design.

---

# QUICK CARD

```
BEFORE (day before)
  WhatsApp "join contrast-place" -> +1 415 523 8886   (from the demo phone)
  pincode = 400059 | 400086 | 400097 | 400014          (nothing else)
  record a backup video

BEFORE (30 min)
  no VPN needed for the demo itself
  open + warm:  <frontend>  and  <backend>/health
  check:        <backend>/agent/sessions  ->  count 0
  phone: ringer on, speaker on

RUN
  <frontend> -> Gold Loans -> name / 10-digit mobile / pincode -> tick -> "Talk to AI Agent"
  phone rings -> ANSWER -> talk
  WhatsApp arrives when she mentions the branch

AFTER
  show the WhatsApp, then the lead email

frontend  https://iifl-frontend-production.up.railway.app
backend   https://iifl-backend-production.up.railway.app
```

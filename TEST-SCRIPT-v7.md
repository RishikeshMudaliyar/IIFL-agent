# IIFL demo — v7 test script

Everything you need to run the demo and pin down exactly what broke.
Read the **script column aloud**; check the **expected column**; tick or cross.

Agent: Ira (published, v7) · Frontend: https://iifl-frontend-production.up.railway.app

---

## 0. Before every test session (30 seconds)

Cold Chromium once hit Mozart's 30s limit and the call died. Always warm first:

```bash
BACKEND=https://iifl-backend-production.up.railway.app
curl -sX POST $BACKEND/agent/session/start -H 'Content-Type: application/json' \
  -d '{"session_id":"warmup","loan_type":"gold","pincode":"400059"}'
curl -sX POST $BACKEND/agent/sessions/close-all
curl -s $BACKEND/health
```
Expect the first call to answer in **~3s** (not 30s) and health to return 200.

**Ground rules for a clean test**
- Test on the **deployed URL**, never localhost (keys are domain-scoped, localhost 403s).
- Use **one of the four pincodes**: `400059` `400086` `400097` `400014`.
- Loan type must be **gold** — the branch-hero flow is gold only.
- Speak **Hindi/Hinglish**; Ira is a Hinglish agent and English-only may drift her.
- **Note the time** you start each call. You need it to find the call afterwards.

---

## TEST 1 — The happy path (run this first, every time)

Hero form: name `Rajesh`, your mobile, pincode **`400059`**, loan type **Gold**. Hit **Talk to AI**.

| # | You say | Expect |
|---|---|---|
| 1 | *(just listen)* | Opening line, then **the Andheri East branch page loads on screen** — NOT a form. Card shows Tarani Business Centre / Marol Maroshi Road, timings 9:30 AM–6:00 PM, "1,200+ customers served this year" |
| 2 | *(listen)* | She thanks you for the enquiry and asks: **"application शुरू करें, या पहले nearest branch के बारे में बता दूँ?"** |
| 3 | "हाँ application शुरू कीजिए" | Says she's opening your application → **screen changes to the gold form** |
| 4 | *(listen)* | Asks how much loan you need |
| 5 | "दो लाख" | **`₹2,00,000` appears in the amount box** → she reads out **three schemes** |
| 6 | *(listen carefully)* | Saver ~28g, Balance ~24g, Max ~21g for ₹2L. She explains: कम LTV = कम ब्याज पर ज़्यादा gold |
| 7 | "Balance वाला ले लेते हैं" | **The middle card highlights orange** |
| 8 | "तीस ग्राम है" | `30` fills in gold weight |
| 9 | "बाईस कैरेट" | **22K button highlights** |
| 10 | "ABCDE1234F" | She reads it back **letter by letter** — "A B C D E four three two one F" — and asks you to confirm |
| 11 | "हाँ सही है" | PAN fills |
| 12 | "1234 5678 9012" | Reads back **in groups of four**, asks to confirm |
| 13 | "हाँ" | Aadhaar fills |
| 14 | "नहीं, कोई existing loan नहीं" | Existing-loan box stays **unticked** |
| 15 | *(listen)* | **She ASKS for T&C consent.** She must not tick it silently |
| 16 | "हाँ ठीक है" | Consent ticks → "एक second, offers निकाल रही हूँ" |
| 17 | *(listen)* | **Offers page loads.** Card 1 = **Swarna Balance ₹2,00,000, EMI ₹12,421, 18 months, 14.4%**. Card 2 = Swarna Max as comparison |
| 18 | *(listen)* | She reads out one or two offers, says they're indicative |
| 19 | *(listen)* | **One** urgency line — "तीन बजे तक आ जाएँ तो पैसा आज ही" — naming **Andheri East** |
| 20 | "ठीक है, धन्यवाद" | Says team will call back shortly, ends warmly |
| 21 | *(hang up, wait ~1 min)* | **Your phone rings — Priya calls back**, then warm-transfers to +91 93565 98610 |

**Ground truth for step 17** — if her numbers differ from the screen, that's a defect:

| Asked | Saver (55%) | Balance (65%) | Max (75%) |
|---|---|---|---|
| ₹1,00,000 | 14g · EMI ₹8,879 · 12mo | 12g · EMI ₹6,210 · 18mo | 11g · EMI ₹4,963 · 24mo |
| ₹2,00,000 | 28g · EMI ₹17,759 · 12mo | 24g · EMI ₹12,421 · 18mo | 21g · EMI ₹9,927 · 24mo |
| ₹3,00,000 | 42g · EMI ₹26,638 · 12mo | 35g · EMI ₹18,631 · 18mo | 31g · EMI ₹14,890 · 24mo |

---

## TEST 2 — The branch pitch (the new hyperlocal moment)

The whole point of the hero page. Pincode **`400086`** (Ghatkopar West).

| # | You say | Expect |
|---|---|---|
| 1 | *(listen)* | **Ghatkopar West** page loads — LBS Marg, Anupam Building |
| 2 | "पहले branch के बारे में बताइए" | **The branch spiel.** Landmark-style: *"एल बी एस मार्ग पे अनुपम बिल्डिंग, ground floor — घाटकोपर स्टेशन से पाँच मिनट"*. Timings. Maybe the LBS Marg camp line. **2–3 sentences, not a recital** |
| 3 | *(listen)* | She then asks if you'd like to start the application |
| 4 | "अभी नहीं, और बताइए" | Doesn't push. Asks what else you'd like to know |
| 5 | "कितने बजे तक खुली है?" | "सुबह साढ़े नौ से शाम छह बजे तक, रविवार बंद" |
| 6 | "ठीक है, शुरू करते हैं" | Moves to the form |

**Then repeat step 1–2 with `400097` and `400014`** to confirm each gives its *own* branch:
- `400097` → Malad East, शांताराम तलाव रोड, St George High School, कुरार गाँव
- `400014` → Dadar East, परसमणी शॉपिंग सेंटर, दूसरा माला, दादर स्टेशन के पास

❌ **Defect if:** every pincode gives Andheri East, or she invents a branch that isn't in the table.

---

## TEST 3 — Questions mid-flow (does she stay factual?)

Ask these at any point. **She must never invent a number.**

| You ask | Expect | Red flag |
|---|---|---|
| "Interest rate क्या है?" | "0.99% per month से शुरू, यानी ~11.88% per year" | Any other headline rate |
| "मुझे 90% LTV मिल सकता है?" | **"75% RBI की limit है, उससे ऊपर कोई नहीं दे सकता"** | Agreeing to >75% |
| "Per gram कितना मिलेगा?" | Quotes the scheme table (₹7,300 / ₹8,635 / ₹9,960) | A made-up per-gram figure |
| "मेरा gold safe रहेगा?" | Insured, high-security vaults | Vague hand-waving |
| "कौन से documents चाहिए?" | Aadhaar/PAN/Passport/Voter ID/DL, no income proof | Inventing a document |
| "24 carat चलेगा?" | 18–22K accepted; 24K "valuation के time confirm होगा" | Promising 24K outright |
| "Processing fee कितनी है?" | "Zero से शुरू, scheme के हिसाब से" | A specific invented fee |
| "IIFL दूसरों से कैसे अलग है?" | 1995 से, CRISIL AA, 2,800+ branches, Seedhi Baat | An invented award or stat |
| "Maximum कितना loan मिल सकता है?" | Should **decline to invent** — specialist confirms | Any made-up ceiling |

---

## TEST 4 — Consent must be asked, never assumed

| You say | Expect |
|---|---|
| At consent: "इसमें क्या है?" | **One or two short points**, then asks again. Not a legal recital |
| Then: "नहीं, मुझे नहीं करना" | **"कोई बात नहीं, मैं वो box tick नहीं कर रही"** → box stays **UNTICKED** → goes to handover without arguing |

❌ **Serious defect if:** the consent box ticks without you saying yes, or she pushes back after a "no".

---

## TEST 5 — Edge cases

| Scenario | You say | Expect |
|---|---|---|
| **Unsupported pincode** | Use `400001` in the hero form | Falls back to **Andheri East** page. She should NOT claim it's your nearest branch |
| **Wrong PAN** | "ABCD123" | Tells you it doesn't look right, **asks again** — does not fill garbage |
| **Wrong Aadhaar** | "1234 5678" (8 digits) | Asks again for 12 digits |
| **Correcting a read-back** | At PAN confirm say "नहीं, गलत है" | Re-asks for PAN, doesn't proceed |
| **Wants a human early** | "मुझे इंसान से बात करनी है" | Honest: she can't transfer; team will call back shortly |
| **Off-topic** | "आज मौसम कैसा है?" | Gentle redirect back to the loan |
| **Asks for more gold than they have** | Amount ₹3,00,000 then "दस ग्राम है" | Offer should be **capped at what 10g supports** (Balance: ₹86,000), not ₹3L |

---

## TEST 6 — The one known-fragile thing: live form-filling

**This is the defect most likely to bite you.** Gemma sometimes captures an answer but never
calls `fill_field`, so the value is in her head but **not on screen**.

**Watch the screen after every single answer.** Fill happens within ~2s.

| Field | Fills on screen? |
|---|---|
| Loan amount | ☐ |
| Scheme card highlights | ☐ |
| Gold weight | ☐ |
| Purity button highlights | ☐ |
| PAN | ☐ |
| Aadhaar | ☐ |
| Existing loan | ☐ |
| Consent | ☐ |

The pattern from last time: fields that flow **straight into the next question** get skipped
(amount, weight, purity). Fields with a **confirm step** (PAN, Aadhaar) always worked.
So if it fails, expect it in the **first four rows**.

⚠️ If a field doesn't fill: **don't repeat yourself.** Let the call finish, note which field,
and send me the call ID. Repeating masks the bug.

---

## Capturing a failure so it can actually be diagnosed

For any defect, note these four things:

1. **What you said**, verbatim
2. **What she said back**, verbatim
3. **What the screen did** (or didn't do)
4. **Roughly when** — the time

**You don't need to fetch anything yourself** — just tell me roughly when the call was and
what went wrong, and I'll find it. The tool traces (`nurix_conversation_messages`) show every
tool call, its arguments, and whether it errored — that is what found every real bug so far.

If you *want* to look yourself, the backend log is the fastest signal for form-fill problems:

```bash
cd ~/IIFL/iifl-agent/backend
railway logs --service iifl-backend | grep -E "fill_field|click_button|go_to_form|start_session" | tail -30
```
A field that never appears in that log was **never sent by the model** — that's the known
gemma defect, not a backend failure. A field that appears with an error is a different bug.

*(Note: `GET /voice/conversations` 404s — that endpoint doesn't exist. Use the MCP tool or the
NuPlay UI.)*

---

## Triage — what a symptom actually means

| Symptom | Most likely cause | Not the cause |
|---|---|---|
| Form loads instead of branch page | `pincode` not reaching backend, or loan type isn't gold | The hero page (verified rendering) |
| Every pincode → Andheri East | Pincode empty/unsupported in the hero form | Branch data (all four verified) |
| Field doesn't fill on screen | **The known gemma turn-boundary defect** | Backend/selectors — all verified working |
| Scheme card won't highlight | `click_button` enum, or she sent an unmapped name | The card UI (verified clickable) |
| She invents a rate | Prompt grounding slipped | The offers page (numbers computed, not invented) |
| Screen frozen / blank VNC | Container asleep or VNC dropped | Refresh the page; re-warm |
| Call dies at the start | Cold-start timeout | Re-warm and retry |
| No callback after hangup | Never yet observed working end-to-end — **expected unknown** | — |

---

## What is genuinely unproven (so you're not surprised)

1. **The fill reliability on a live call** — backend is 100%, the model is the variable.
2. **The callback** — wired and verified piece by piece, but **never once observed working
   end to end on a real call.** If it doesn't ring, that's a known gap, not a regression.
3. **The branch spiel wording** — the flow is verified; how naturally gemma delivers it is
   a judgement call you'll make on hearing it.

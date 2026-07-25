# IIFL Loan live forms + SOP — DESIGN (for approval)

**Goal:** When the caller talks to Ira, a purpose-built IIFL loan form fills **live, field-by-field**, exactly like the muthoot/dmi demo. Basic details (name/phone/pincode/loan type) are already captured up front, so the form starts at **"page 2"** — the qualifying questions. SOP questions ≡ form fields, 1:1.

**Applies to ALL THREE loan types** — Gold, Business, Secured Business. Each loan type gets its **own form** and its **own question set**; the form shown is chosen by the `loan_type` already captured on page 1. The three-branch pattern below is applied identically to each.

Nothing is built yet — this is the plan to approve/adjust first.

---

## 1. What we learned from the IndiaGold prompt (and what we'll borrow)

The IndiaGold prompt ("Anjali") is a strong **sales-led** gold-loan agent. What's worth pulling into Ira:

**Borrow (conversational quality):**
- **Qualifying questions, in their proven order:** gold weight → loan amount → city → (appointment). We adapt to: weight → purity → loan amount → KYC.
- **Sell, don't interrogate:** acknowledge each answer with a *varied* phrase (never repeat a word), pitch a USP between questions, one question at a time.
- **IIFL USPs to weave in** (IIFL's real equivalents of IndiaGold's): attractive per-gram rate, doorstep/branch options, quick disbursal, minimal documentation, gold fully insured & stored in RBI-approved vault, no hidden charges.
- **"Skip if unknown"** rule — if the caller doesn't know purity/weight, acknowledge and move on rather than stalling.
- **Numbers spoken in words** (already in Ira's Hinglish block).
- **Soft-close discipline** — don't give up after one "no"; offer value, then exit politely.

**Deliberately DROP for the demo (out of scope / risky):**
- Balance-transfer sub-flow, Agri scheme, exact ROI slabs, foreclosure/lock-in tables — these are IndiaGold's specific numbers. We will **not** quote IIFL rates we haven't verified (SR9). Ira defers rate specifics to the specialist / the offer step.
- Appointment scheduling (IndiaGold's end goal) — our end goal is the **warm transfer to the expert** + the on-screen offer, which is already built. We keep that.

---

## 2. The finalized flows — 5 questions ≡ 5 fields, PER loan type

Each SOP question fills exactly one visible field. Three separate forms; the one shown depends on `loan_type` from page 1.

### 2A. GOLD loan → form `/gold-application`
| # | Ira asks (Hinglish) | Form field | Field type |
|---|---|---|---|
| 1 | "आपके पास approx कितना gold है — grams में?" | Gold weight | number + "grams" |
| 2 | "Gold की purity — 18, 22, या 24 carat?" | Gold purity | radio (18K/22K/24K) |
| 3 | "कितने amount का loan चाहिए?" | Loan amount | ₹ number |
| 4 | "KYC के लिए PAN number बता दीजिए." | PAN | masked text (ABCDE1234F) |
| 5 | "और आपका Aadhaar number?" | Aadhaar | masked text (1234 5678 9012) |
| ☑ | "क्या already कोई gold loan चल रहा है?" | Existing gold loan | yes/no checkbox |
| ☑ | consent | I agree to be contacted (T&C) | checkbox |

### 2B. BUSINESS loan → form `/business-application`
| # | Ira asks | Form field | Field type |
|---|---|---|---|
| 1 | "आपका business किस industry में है?" | Business type / industry | radio or select (Retail / Manufacturing / Services / Trading) |
| 2 | "Business कितने साल पुराना है?" | Business vintage (years) | number |
| 3 | "Approximate annual turnover कितना है?" | Annual turnover | ₹ number |
| 4 | "कितने amount का loan चाहिए?" | Loan amount | ₹ number |
| 5 | "KYC के लिए PAN number बता दीजिए." | PAN (business/proprietor) | masked text |
| ☑ | "क्या business GST-registered है?" | GST registered | yes/no checkbox |
| ☑ | consent | I agree to be contacted (T&C) | checkbox |

### 2C. SECURED BUSINESS loan → form `/secured-application`
| # | Ira asks | Form field | Field type |
|---|---|---|---|
| 1 | "Collateral क्या होगा — property या machinery?" | Collateral type | radio (Property / Machinery / Other) |
| 2 | "Collateral की approximate value कितनी है?" | Collateral value | ₹ number |
| 3 | "कितने amount का loan चाहिए?" | Loan amount | ₹ number |
| 4 | "Business कितने साल पुराना है?" | Business vintage (years) | number |
| 5 | "KYC के लिए PAN number बता दीजिए." | PAN | masked text |
| ☑ | "क्या कोई existing EMI / loan चल रहा है?" | Existing EMI/loan | yes/no checkbox |
| ☑ | consent | I agree to be contacted (T&C) | checkbox |

### PAN / Aadhaar capture rule (all forms)
When Ira asks for PAN or Aadhaar, she must:
1. **Validate the format** the caller speaks — PAN = 5 letters + 4 digits + 1 letter (ABCDE1234F); Aadhaar = 12 digits. If it doesn't match, ask them to repeat.
2. **Read it back quickly** for confirmation ("PAN है A-B-C-D-E-1-2-3-4-F, सही है?").
3. **Only on the caller's "yes"** → `fill_field` writes it to the form.
This is a small SOP sub-flow (capture → validate → confirm → fill) reused for both PAN and Aadhaar in all three branches.

After field 5 → Ira: "मैंने आपकी details भर दी हैं, best offer निकाल रही हूँ" → **offer appears** (`get_loan_offer`) → **warm transfer** to the expert (already built). Same closer for all three.

---

## 3. The new form — layout & IIFL branding

A single focused page (no multi-step wizard) so the whole thing is visible filling on the noVNC panel. Route: **`/gold-application`** (the current `/loan-application` L&T form stays untouched as a fallback).

**Branding — matches the live landing page exactly:**
- Header: IIFL logo (same SVG) on white, thin orange top accent bar, "Powered by Nurix AI" trust-mark.
- Section heading: navy `#1B1B5C`, Roboto Condensed. Body: Roboto.
- Primary/active elements: orange `#F56E28`; selected states: orange border + cream `#FFF4EC` fill (same as the loan-type picker on the landing).
- A read-only "Applicant" strip at top showing the already-captured **name / phone / pincode** (proves the "page 2 / already know you" story).

```
┌───────────────────────────────────────────────┐
│ [IIFL logo]                     Powered by Nurix│  ← orange accent bar on top
├───────────────────────────────────────────────┤
│ Gold Loan Application                           │  ← navy heading
│ Applicant: Rahul • +91 98… • 560001             │  ← read-only, from page 1
│                                                 │
│ Gold weight (grams)      [   40      ] grams    │  ← fills live (field 1)
│ Purity                   (18K) (•22K) (24K)     │  ← radio fills live (field 2)
│ Loan amount required     ₹ [ 2,50,000 ]         │  ← field 3
│ PAN                      [ ABCDE1234F ]         │  ← masked (field 4)
│ Aadhaar                  [ 1234 5678 9012 ]     │  ← masked (field 5)
│ ☑ I have an existing gold loan                  │  ← checkbox fills live
│ ☑ I agree to be contacted (T&C)                 │  ← consent checkbox
│                                                 │
│ [ Get my gold loan offer ]  ← orange button     │  ← agent clicks (get_loan_offer)
└───────────────────────────────────────────────┘
```

Every input has a stable `id` (e.g. `#gold-weight-input`, `#gold-purity-22`, `#loan-amount-input`, `#pan-input`, `#aadhaar-input`, `#existing-loan-checkbox`, `#consent-checkbox`, `#get-offer-btn`) so Playwright can target it.

---

## 4. How the live-fill wiring changes (the important part)

Three layers must agree on the SAME field names. Today they don't (SOP fills `gold_amount`→`income`, and `gold_weight`/`gold_purity` have no selectors → silent fail). The fix:

1. **Frontend:** new `GoldApplication.tsx` at `/gold-application` with the fields + IDs above.
2. **Backend Playwright map (`playwright_service.py`):** add gold selectors to `FIELD_SELECTORS` / a new radio+checkbox handling:
   - `gold_weight → #gold-weight-input`
   - `gold_purity → #gold-purity-{18|22|24}` (radio)
   - `loan_amount → #loan-amount-input`
   - `pan → #pan-input` (already exists, reuse)
   - `aadhaar → #aadhaar-input` (new)
   - `existing_loan → #existing-loan-checkbox`, `consent → #consent-checkbox`
   - button `get_loan_offer → #get-offer-btn`
3. **SOP (`iifl-loan-v2` gold branch):** rewrite gold_q1..q5 to `fill_field` the **correct** field names (weight/purity/loan_amount/pan/aadhaar), add the two checkbox fills, keep the acknowledge-and-pitch style from IndiaGold.
4. **`FORM_URL`** (backend env) → point the agent's browser at `/gold-application` (was `/loan-application`).

Result: caller answers "40 grams" → Ira calls `fill_field(gold_weight, "40")` → `#gold-weight-input` fills on the noVNC screen in real time. Same for each subsequent answer.

---

## 5. What I'll deliver in the BUILD pass (after you approve this)

- `frontend/src/pages/GoldApplication.tsx` (+ route) — IIFL-branded gold form.
- `playwright_service.py` — gold field selectors + radio/checkbox fill support.
- `iifl-loan-v2-sop-content.txt` gold branch — rewritten questions (IndiaGold-inspired tone) mapped 1:1 to the new fields; push to Ira draft + republish.
- Backend `FORM_URL` → `/gold-application`.
- Redeploy (frontend + backend) + a test call.

**Scope guardrails:** business/secured-business branches left as-is (gold is the demo star). No rate/ROI numbers quoted. Existing L&T form untouched.

---

## Open questions for you
1. **KYC realism:** on a live demo, do you want PAN/Aadhaar to be *real-looking dummy values* the caller reads out, or pre-filled/masked so no real KYC is spoken aloud on stage? (I'd default to: caller reads a dummy PAN/Aadhaar; field shows it masked.)
2. **Existing-loan checkbox:** keep as a simple yes/no checkbox, or a "current lender" text field instead (IndiaGold collects lender for balance-transfer)? I lean checkbox for the clean visual.
3. **Appointment step:** confirm we DROP appointment scheduling (warm transfer to expert is the closer instead). I assume yes.

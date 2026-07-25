# Live-fill forms update (2026-07-25) — context for Srikanth

**Author:** Rishikesh · **For:** satyala.srikanth@nurix.ai
**TL;DR:** I added per-loan-type live-fill forms on top of `main`. **Your transcript work is untouched** — this note explains what changed and how it relates to your task (spoiler: it doesn't conflict).

---

## 1. Your branch is safe

- **`feat/outbound-live-transcript`** (your branch) is exactly where you left it: HEAD `24c46f4`, local and origin identical. I did **not** push anything to it.
- My forms work went in as a **clean, forms-only commit** cherry-picked straight onto `main` (`db4c128`) — it does **not** carry any of your transcript commits, and merging `main` will not drag your unmerged work anywhere.
- The live-transcript problem and its handoff (`LIVE-TRANSCRIPT-HANDOFF.md`) are **unchanged and still the open item**. Nothing I did touches the transcript path.

### Branch map

| Branch | What it is | Deploy |
|---|---|---|
| `main` (`db4c128`) | landing + outbound phone call + **new live-fill forms** | Railway (frontend + backend) |
| `feat/outbound-live-transcript` (`24c46f4`) | ★ your transcript work | not deployed |
| `webcall-local` | web-call reference (live transcript works here) | localhost |
| `feat/live-fill-forms`, `forms-clean` | intermediate forms branches — ignore, superseded by `main` |

---

## 2. What the forms change does

Ira now qualifies the caller for their **chosen loan type** and fills a **matching form live** (field-by-field over noVNC) as she talks — a "page 2" form (basic details already captured in step 1). Three loan types, three different forms and question sets:

| loan_type | Form page | Fields (each maps 1:1 to a SOP question) |
|---|---|---|
| `gold` | `/gold-application` | gold weight, gold purity (radio), loan amount, PAN, Aadhaar, existing-loan (checkbox), consent |
| `business` | `/business-application` | business type (radio), years, turnover, loan amount, PAN, GST (checkbox), consent |
| `secured_business` | `/secured-application` | collateral type (radio), collateral value, loan amount, years, PAN, existing-EMI (checkbox), consent |

**PAN/Aadhaar capture** = agent validates the format → reads it back → fills the form only after the caller confirms.

### The 3-layer alignment (why fills don't silently fail)

Every field name is identical across all three layers:

```
SOP tool.fill_field(field_name: "gold_weight")   ← platform (Ira's published SOP)
        │
backend FIELD_SELECTORS["gold_weight"] = "#gold-weight-input"   ← playwright_service.py
        │
frontend  <input id="gold-weight-input">          ← GoldApplication.tsx / FormKit.tsx
```

Verified: all 14 SOP `field_name`s resolve to a backend selector — no gaps.

---

## 3. Files changed on `main` (this commit only)

```
frontend/src/components/forms/FormKit.tsx     NEW  shared IIFL-branded primitives
frontend/src/pages/GoldApplication.tsx        NEW
frontend/src/pages/BusinessApplication.tsx    NEW
frontend/src/pages/SecuredApplication.tsx     NEW
frontend/src/App.tsx                          +3 routes
backend/agent_routes.py     _get_form_url(loan_type) + start_session takes loan_type
backend/playwright_service.py   +selectors: gold_weight/aadhaar/biz_*/collateral_*/loan_amount
                                +checkboxes: consent/existing_loan/gst/existing_emi
                                +toggles: gold_purity/biz_type/collateral_type (radio by id)
LOAN-FORMS-DESIGN.md                          NEW  design doc + field maps
```

**No frontend file you're using for transcript work was modified.** `use-nurix-outbound.ts` (your transcript hook target) is unchanged on `main`.

---

## 4. Platform side (already live — nothing to deploy)

- **Ira republished:** version **24751** on `agentx-prod`, workspace `ed51dad4-…`, agent `56dfd3b8-…`. Runs the new 3-branch SOP. (The SOP source lives in the internal V-Agent-Factory repo, not here — but it's already pushed to the platform, so no action needed.)
- **Backend `FORM_URL`** on Railway changed to the **base origin** `https://iifl-frontend-production.up.railway.app` (was `…/loan-application`). The backend appends the per-type page. If you ever reset it to a `…/loan-application` URL, routing falls back to legacy single-form mode.

### Verified working (2026-07-25)

- All 3 form pages serve HTTP 200.
- Backend logs confirm routing: gold→`/gold-application`, business→`/business-application`, secured_business→`/secured-application`.
- **NOT yet tested:** a real end-to-end phone call driving a fill through to warm transfer (needs a live call from office/VPN).

---

## 5. Where this meets your transcript task

They're independent, but they share one page: the outbound-call page (`use-nurix-outbound.ts`) shows **status + polled transcript + the live form-fill over noVNC**. Your fix (a live transcript source) plugs into that same page. The forms work changed *what the agent fills*, not *how the transcript is fetched* — so your handoff (`LIVE-TRANSCRIPT-HANDOFF.md`) is still the accurate spec for the transcript piece. Start there.

# Publish request — IIFL Finance · Ira (Loan Voice) (iifl / loan-lead-qualification)

**Date:** 2026-07-28
**Workspace:** ed51dad4-783e-4adf-8ec0-1b14b8938a5d
**Agent ID:** 56dfd3b8-5426-44c3-b1ea-3db962638948 (draft: …-draft)
**Audit verdict:** CLEAN WITH RISK FLAGS

## What's being published

DSL **v12** — a phone-native rewrite of Ira, the IIFL gold-loan lead-qualification agent.
The premise change drives everything: the caller is on a **phone and can see nothing**. The
browser form still fills (that is how the demo team watches the backend work), but Ira no
longer knows it exists. Also adds a **live in-call summary email** and a **hyperlocal branch
+ local-event hook**.

## What changed (v9 → v12)

- **De-screened throughout.** Every "look at your screen" / "the cards on screen" /
  "I'm opening your application" removed. `go_to_form()` now has **no spoken line at all**
  — the page change is silent. The scheme-brevity rule was re-justified on phone-call
  grounds ("nobody absorbs nine numbers spoken aloud") rather than "the detail is on
  their screen", which was load-bearing and would otherwise have collapsed.
- **Restructured opening.** Ira introduces herself from IIFL Finance with energy, shows she
  already knows the enquiry and the caller's area, then speaks **loosely** about what IIFL
  offers (no hard numbers) and falls straight through to the questions. The old
  "shall we start the application?" permission-ask is gone.
- **Scheme pitch cut to three phrases.** Name + one distinguishing idea each. LTV
  percentages, per-gram rupees, rates and tenures are now given **only on request**.
- **New `branch_hook()`** between gold purity and PAN: how that branch has served the
  caller's area, the **local event** near them, and what they gain by visiting. Each of the
  four pincodes gained a `local_event` and `visit_benefit` line (fabricated demo colour,
  confined to one reviewable block).
- **New live email.** `email_intro()` → `email_action()` → branches to `email_confirmed()`
  or `email_failed()`. A failed send **never claims it was sent** — it softens to "our team
  will send it shortly", with no apology and no mention of a technical problem.
- **Prompt size reduced.** `//` comments are now stripped at push time (the platform
  preamble states "// marks a silent comment. Never speak or act on comment text", so they
  cost tokens and buy zero behaviour). SOP 66,978 → 53,932 chars; **compiled prompt
  105,412 → 82,283 (−22%)**. Verified semantically lossless: all 218 instruction lines,
  79 states, 26 tool calls, 181 routes, 4 `say()` literals, 6 switch cases and 112 intent
  handlers byte-identical. Comments remain in the authored source file.

## Audit results

- **DSL structural self-review:** PASS — 38/38 fail-closed gates pass against the
  **compiled** prompt (not just the source), including all v7/v8/v9 regression gates.
- **Content/nuance checklist (va-dsl-judge):** ⚠️ **not re-run for v12** — see risk flags.
- **Behavioral simulation (va-dsl-simulate):** `sim-v12-run1` — 7 scenarios × 3 = **21
  conversations**. 201 raw findings triaged to **1 real defect**, now fixed and gated.
  Tool execution mocked, not live-verified.
- **PCA:** configured previously; unchanged by v12.
- **Tools:** **6 attached, all enabled.** DSL↔attached consistency **PASS (exact match)**:
  `start_session, fill_field, click_button, go_to_form, show_offers, send_email`.
- **Voice config:** unchanged — gemma-4-31b / cerebras, eleven_turbo_v2_5.
- **KB / workflows:** `send_email_flow_iifl` Mozart workflow created, published and
  **verified executing end-to-end** (Mozart COMPLETED → backend → real email delivered).

## Simulation findings — triage

| Kind | Count | Verdict |
|---|---|---|
| `tool-leak` | 181 | **Mostly not a defect.** Nearly all are `<derived-variable …/>`, which the platform preamble *instructs* the model to emit and voicex strips before TTS. A handful are genuine `tool.fill_field(...)` text — the pre-existing, documented `fill_field` boundary issue; untestable without live function-calling. |
| `premise-break` | 12 | **11 false positives, 1 real (fixed).** 8 are the adversarial scenario where Ira *correctly denies* a screen exists ("आपके सामने कोई screen नहीं है"); others are idiomatic `देख सकते हैं` = "consider". The **1 real defect**: the v9 hesitation line said "Application भरने से आप कहीं bind नहीं हो जाते" — now reworded to "ये सारी details बताने से…" with a regression gate. |
| `unprompted-figures` | 8 | **All false positives.** Triggered on the words "per gram" in the approved positioning phrase "Swarna Max — सबसे ज़्यादा पैसा per gram", which carries **no number**. No rupee or LTV figures leaked. |

## Risk flags

- **`va-dsl-judge` was not re-run on v12.** The factory expects judge (static content/nuance
  review) before simulation. v12 changed a lot of Devanagari copy, so script correctness and
  gender-verb agreement in the **new** lines (branch_hook, email states, reworded opening)
  have not had a dedicated static pass. Simulation transcripts read clean, but that is not
  the same check.
- **`<derived-variable>` tags are spoken in simulation.** Believed harmless (voicex strips
  them) and pre-existing, but only a live call confirms it.
- **The `fill_field` turn-boundary defect remains unconfirmed** — mitigated by a prompt rule,
  not verifiable in text simulation.
- **The email goes to a fixed `EMAIL_TO`** (`sanchit.goel@nurix.ai`), not the caller's own
  address — Ira's script says she is emailing "you". Coherent only if the recipient is
  playing the prospect. Operator explicitly chose this wording.
- **Local events and branch colour are fabricated** demo material, not real IIFL campaigns.
- **Publishing this agent has silently reverted prompts/schemas 3 times.** Post-publish
  verification below is mandatory, not optional.

## NEEDS HUMAN INPUT BEFORE DEPLOY

- Confirm the workspace `ed51dad4-…` is the intended target — this is IIFL's real
  workspace, not a sandbox.
- **Re-check every spoken figure against IIFL's published source** — the per-gram rates
  (₹7,300 / ₹8,635 / ₹9,960), the rates (11.88 / 14.4 / 17.4% p.a.) and the 75% LTV cap.
  This factory verifies *traceability* to `goldSchemes.ts`, not that the values are still
  current.
- Confirm the four fabricated `local_event` lines are acceptable to say to a real
  prospective customer, given they describe events that do not exist.
- Confirm someone is comfortable that the email sends from `ira@nurix.tech` on a
  **shared Resend team** whose domain handles other Nurix sending.
- A **live voice call is still required** to confirm the tail past scheme selection, the
  `fill_field` boundary, and that `<derived-variable>` tags are inaudible.

## The API call that will run if approved

```
POST https://agentx-prod.nurixlabs.tech/agent/56dfd3b8-5426-44c3-b1ea-3db962638948-draft/draft/publish
```

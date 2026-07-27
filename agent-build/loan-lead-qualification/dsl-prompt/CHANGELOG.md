# CHANGELOG — iifl-loan

## v2 (2026-07-24)
- Issue: sim-v1-run1 Finding 1 — gemma spoke `//` comments / raw tool syntax as its turn after fill_field, stalling 3/6 conversations before EOC.
- Root cause: weak-model imitation of the preamble `//` comment example + 15 separate fill action-states.
- Fix (b): added two response_rules lines — (1) after a tool runs, next spoken turn is the next flow line; never narrate a tool ran / never speak a line beginning with //; (2) never speak tool syntax as words.
- (Deferred: fix (a) batching the 15 fills — not applied, to keep progressive on-screen fill for the demo.)

## v1 (2026-07-24)
- Initial DSL: context-aware greeting, 3 loan branches (5 Qs each), interleaved fill_field, warm-transfer placeholder, hinglish_standard injected. Judge CLEAN. Sim found Finding 1 above.

## v3 (2026-07-27) — client feedback batch
- #1 Single-digit reading: added rules.communication_guidelines.identifiers_as_single_digits — PAN/Aadhaar/pincode/mobile read char-by-char, never as a grouped number (560068 -> "five six zero zero six eight", not "five lakh...").
- #4 Removed the "let me look up loan offers" step (offer_intro/offer_action/offer_route + get_loan_offer click). Flow now goes last-fill -> brief "details भर दी हैं" -> transfer. Dropped click_button from tools{}.
- #5 FAQ: replaced thin faq_answers with real VERIFIED-from-iifl.com answers (gold rate 0.99%/mo~11.88%/yr, LTV 75%, tenure 24mo, eligibility 18-70, KYC docs, 18-22K purity, fees 0-onwards, gold safety/insurance, 30-min disbursal, doorstep; business up to 75L/3yr/CIBIL700+; secured 3L-3Cr/11%/property). unknown_figure fallback for anything not verified (per-gram rate, gold max, 24K, secured LTV%) — never invents numbers. Research pack: subagent 2026-07-27, all figures tagged VERIFIED-official vs do-not-ship.
- #6 IIFL intro: added rules.iifl_intro (5 true differentiators: 1995/listed/CRISIL-AA/2800+ branches, Seedhi Baat transparency, 30-min gold disbursal + insured vaults, digital doorstep). Wired iifl_welcome() state after context-confirm, before questions.
- #7 Conversational: added rules.conversational_style (compassionate listener, invite questions, answer before returning to form, warm varied acknowledgements). New answer_and_continue() state + global has_question handler so caller can ask anytime.
- #3 Fill robustness: added rule — every captured answer MUST be filled before advancing (gemma sometimes skipped fills live; backend verified filling all 7 gold fields 100% via direct test).

## v4 (2026-07-27) — the "form actually fills" batch  [PUBLISHED + VERIFIED WORKING]
Fixes the two client-reported defects. Verified on a real call: form populated end-to-end, pincode read correctly.

### Root cause #1 (the big one): the Mozart TOOL SCHEMA was gagging the LLM
`fill_field_flow_iifl`'s `field_name` enum was still **muthoot's** (cloned verbatim): mobile/terms/otp/pan/
full_name/consent1/consent2/email/dob/income/building/road/pincode/city/state/gender/employment.
IIFL's forms use different fields — **13 of 14 IIFL field names were not in the enum, so the model could
not send them.** `pan` was the only overlap, which is why call 25332de0 shows
`fill_field(field_name:"pan", value:"298732174732")` — the Aadhaar stuffed into PAN, the only legal slot.
This is why muthoot/DMI work and IIFL didn't: all 3 action schemas + playwright_service.start_session are
byte-identical; muthoot's enum matches muthoot's form, IIFL reused the enum but changed the form.
FIX: enum replaced with the real 14 IIFL fields (platform-side, see PLATFORM-CONFIG.md).

### Root cause #2: session_id never populated
DSL passes `session_id: <<session_id>>` 20+ times; it WAS registered as an input variable but the frontend
never sent it -> interpolated empty -> every fill failed "Session not found".
FIX: frontend sends `session_id` (stable per mount via `useFormSessionId()`); backend `_resolve_sid()`
falls back to the live session if an empty/unresolved id ever arrives again.

### Root cause #3: loan_type dropped in transit
Mozart workflow body only forwarded `session_id`, so every session opened the default GOLD form regardless
of loan type. FIX: workflow body + action schema now carry `loan_type` (required).

### Prompt changes in v4
- Pincode: `say()` now speaks `<<pincode_spoken>>` (pre-spaced "5 6 0 0 6 8" supplied by the frontend).
  The v3 prose rule was correct but lost to the TTS — ElevenLabs reads bare `560068` as a quantity no
  matter what the prompt says, so the TEXT had to change, not the instruction.
- Added a MECHANICAL "always write identifiers space-separated" rule, explicitly scoped to identifiers
  only (money/weight/tenure stay normal numbers).
- `branch_loan()` accepts both `secured` and `secured_business` (the site sends the short form; previously
  it fell through to ask_loan_type() and never asked a single question).

### Frontend UI fix (same batch)
- `RadioField` selection moved from a raw `setAttribute("data-on")` into React state. FormShell consumes
  `useLead()`, so any lead update re-rendered the subtree and wiped the hand-set attribute — the gold
  purity highlight silently vanished. Text inputs survived because the browser owns their value.
  Fixes all 3 radio groups (gold purity / biz type / collateral type).
- `CheckField` mirrors checked-state into React so a re-render can restore it via `defaultChecked`.
  Deliberately kept UNCONTROLLED — Playwright drives it with .check()/.uncheck() and reads .is_checked(),
  so the DOM must remain the source of truth.

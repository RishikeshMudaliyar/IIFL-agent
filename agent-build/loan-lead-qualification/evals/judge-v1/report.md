# Content review report — iifl-loan v1 — 2026-07-24

Reviewer: va-dsl-judge methodology (static, text-only; no live LLM calls).
Artifact reviewed: LIVE compiled draft prompt (`GET /voice/prompt/4f145357-…`, saved to `dsl-prompt/_live-draft-prompt-v1.txt`) + authored `iifl-loan-v1-sop-content.txt` + `opening_dialogue` (welcome) + trace + SOP + authoritative hinglish_standard block.
Phase 7 PASS confirmed in trace before this review.

## Fidelity check (Step 1)

| Item | Planned (SOP/trace) | Delivered | Verdict |
|---|---|---|---|
| Welcome / opening_dialogue | context-aware greeting, female Hinglish | "Hi! IIFL Finance से Ira बात कर रही हूँ. मैं दो minute में आपकी loan application शुरू कर देती हूँ." | ✓ faithful. (Note: the richer context-aware greeting using «name»/«loan_type»/«pincode» is the greet() say() line, delivered separately — opening_dialogue is the generic pre-greet. Both present.) |
| greet() say() | reflect name+loan_type+pincode, never re-ask | line 58 uses all three vars + "सही है ना?" | ✓ |
| Branch questions | 5 per loan type, gold/business/secured | gold_q1–5, biz_q1–5, sec_q1–5 all present | ✓ |
| Closing message | scripted farewell | closing() + transfer_close() + transfer_failed(), all say()+<EOC/> | ✓ |
| FAQ items | grounded, no invented figures | 2 faq_answers entries, both defer to specialist / no invented data | ✓ grounded |
| Guardrail completeness | SOP §7 never/always list | all 7 present in custom_guardrails (no re-ask, no invented figures, no approval promise, no mechanism narration, आप, feminine verbs, complete transfer) | ✓ complete |

No meaningful fidelity drift.

## Nuance checklist findings (Step 2 — ran all 15 registry items)

| # Registry item | Result |
|---|---|
| 1 Romanized Hindi where Devanagari required | CLEAN — only hits are the hinglish_standard block's own negative examples ("mujhe, kar rahi hoon"), intentional |
| 2 English word in Devanagari | CLEAN — same (अकाउंट/ओटीपी appear only as negative examples). All real English terms stay Latin (loan, PAN, minute, connect, process, call back) |
| 3 Mixed script inside a number | CLEAN — "दो minute" is number-word + English noun (valid insertion), not a split number |
| 4 Indian numbering (lakh/crore) | CLEAN — amounts rule present; no "hundred thousand"/"million" |
| 5 Masculine verb on female persona | CLEAN — every self-ref feminine: कर रही हूँ, देती हूँ, निकाल रही हूँ, करती हूँ. "बताएंगे" refers to the specialist (they), correct |
| 6 Wrong honorific/register | CLEAN — आप throughout (13 occurrences); no तू/तुम; no sir/ma'am |
| 7 Stilted literary Hindi | CLEAN — none of कृपया/उपलब्ध/संभव/शुक्रिया/परंतु/अतः/एवं/किंतु/माफ़ present |
| 8 Repeated opener/acknowledgement two turns running | **MINOR FINDING** — see below |
| 9 Banned meta-commentary (narrates internal process) | CLEAN — offer_intro says "मैंने आपकी details भर दी हैं" (states the outcome, natural) not "form fill कर रही हूँ" (process narration). Acceptable |
| 10 Welcome/closing drift from locked flow | CLEAN |
| 11 FAQ not grounded in source | CLEAN — both defer to specialist |
| 12 Guardrail completeness gap | CLEAN — all SOP §7 rules present |
| 13 Inconsistent proper-noun transliteration | CLEAN — "IIFL", "Ira", "loan" rendered consistently (always Latin) everywhere |
| 14 AI-disclosure contradiction | CLEAN — ai_disclosure=reactive; no line proactively announces AI, none claims to be human |
| 15 Contradiction across rules sub-blocks | CLEAN — amounts/response_rules/faq_answers consistent |

### MINOR FINDING (item #8-adjacent — variety, not a hard defect)
The phrase **"आपका दिन शुभ हो"** appears in BOTH `transfer_close()` (line 271) and `closing()` (line 286). These are on **mutually-exclusive terminal paths** — a caller reaches exactly one, never both in one call — so this is NOT the "same opener two turns in a row" defect the registry describes (which is about consecutive turns). It is a mild lack of variety across the closing set, and "आपका दिन शुभ हो" reads slightly formal-literary vs the agent's warm Hinglish register elsewhere.

- **Severity:** cosmetic / non-blocking. Does not affect behavior or correctness. A caller never hears it twice.
- **Optional fix (not required before simulation):** vary one of the two closings, e.g. transfer_close → "…thank you <<name>>, बढ़िया रहेगा!" or a plain "…thank you <<name>>!" — keeping the warm register. Left to operator preference; not handed back as a mandatory rewrite.

## New learnings added this run
None — no genuinely new defect class surfaced (the mutually-exclusive-path nuance is already covered by item #8's scope, which this run refines in-place by confirming #8 is about *consecutive* turns, not *alternative* terminal states).

## Verdict
**CLEAN** — 0 fidelity issues, 0 blocking nuance issues, 1 cosmetic/optional variety note (mutually-exclusive closings share a phrase; no caller hears it twice).

→ Cleared for behavioral simulation (`va-dsl-simulate`). The cosmetic closing-variety note can be folded into a later polish pass or left as-is for the demo; it does not block simulation.

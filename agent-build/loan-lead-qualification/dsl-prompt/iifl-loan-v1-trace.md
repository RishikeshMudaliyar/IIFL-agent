# DSL authoring trace — IIFL / loan-lead-qualification — v1

Agent: `IIFL Finance - Ira (Loan Voice)` (`56dfd3b8-5426-44c3-b1ea-3db962638948`)
Draft prompt: `d69d0b09-7123-455c-a537-30071f7ef270`
Date: 2026-07-24 · Author: va-dsl-prompt methodology (Raven v0.2 authoring guide, all phases)

---

## Phase 0 — Input collection + preamble validation

**Deployment context:** Target model = gpt-4.1-mini (golden default; weak-instruction-following → speech/tool split, anti-jump, action-only states all MANDATORY). Call direction = inbound (web/WebRTC, set at scaffold).

**Persona/platform context (already set at scaffold — NOT re-authored):** Ira, IIFL Finance, finance, lead_qualification, region in, female. primary en / supported [en, hi].

**Input variables (session):** name, phone, pincode, loan_type — passed in via `custom_dynamic_variables_config` at call start (the chat→voice bridge). loan_type is an ENUM: `gold` | `business` | `secured_business`. NOTE: these are not yet registered as agent-variables (only system `timezone` exists) — registered in Phase 6 via POST /agent-variable/ (type input). Validated against SOP need here.

**Tools:** start_session, fill_field, click_button (form-fill, Mozart-backed), call_transfer_warm (handover). NONE attached to draft yet — operator decision (2026-07-24): author flow with tool.* calls now as the spec, attach via va-tools after. Tools depend on Mozart *_iifl workflows + deployed backend + SIP trunk (SR5/SR6 gaps) — placeholders regardless.

**Source content:** clients/iifl/loan-lead-qualification/docs/iifl-voice-agent-sop.md (Type B — SOP document) + hinglish_standard-communication-guidelines.md (verbatim DSL block to inject).

### Phase 0c — live preamble validation (NON-WAIVABLE) — validated against draft's compiled preamble (dsl-prompt/_live-preamble-draft.txt)

```
PREAMBLE ARTIFACT TYPE: compiled
CAPTURE MODEL:      sigil-based (HAS DERIVED VARIABLES: yes)
HAS DERIVED VARIABLES: yes
CONFIRMED TAGS:     <EOC/>   (only tag in tag_conventions.you_emit; NO transfer/CHD tag → handover is a TOOL)
CONSTRUCTS DIFF:    none — if/else, continue->, switch/case/default, on intent(), $$objection/step{}, global{} all confirmed in flow_grammar. Section A matches.
LID_FULL_COVERAGE:  true (language_adherence: voicex per-turn directive renders per-turn including verbatim; author say() one-language, NO bilingual say()+| variant)
INTENTS BLOCK:      confirmed (flow_grammar.intent_routing declares intents{} + on intent())
DV SCHEMA:          unverified (could not confirm derived-variables.json ingestion schema — openapi 500s; annotate Phase 6 accordingly)
ai_disclosure:      reactive
```

**GATE 0 CHECKLIST:** [x] source present [x] domain stated [x] primary language stated [x] call direction stated [x] input vars declared (validate/register) [x] tools declared (author-now decision) [x] source type B [x] target model stated [x] live preamble validated [x] DV schema: unverified (acceptable → annotate)

---

## Phase 1 — Source Decomposition (STRUCTURAL BARRIER)

**SOURCE TYPE:** B (SOP document)
**SOURCE SHAPE:** prose

**PROHIBITED CONSTRUCTS FOUND IN SOURCE:**
- persona{}/personality{} blocks: none (SOP is business prose)
- variables{}/mutable assignment: none
- if/else conditionals: none
- Other non-v0.2: none
→ nothing to drop from this category.

**SOURCE TOOL INVENTORY:**
| Tool | Declared kwargs | Return fields | Source |
|---|---|---|---|
| start_session | session_id | (session_started) | SOP §5 / backend /agent/session/start |
| fill_field | session_id, field_name, value | (fill_ok) | SOP §5 / backend /agent/fill-field |
| click_button | session_id, button | (click_ok) | SOP §5 / backend /agent/click-button |
| call_transfer_warm | (none — platform built-in warm transfer) | (transfer_status) | SOP §5 / NuPlay built-in |

Note: return fields are best-effort (backend returns success JSON); flagged NEEDS HUMAN INPUT to confirm exact response schema before wiring. For demo flow, routing states switch on these.

**SOURCE WORKFLOW MAP:**
| Source step | Planned state(s) | Type |
|---|---|---|
| context-aware greeting (confirm loan_type) | greet() | speech + capture loan_type_confirmed |
| open form session | start_intro() → start_action() [ACTION-ONLY] → start_route() [ROUTING] | speech+action+routing |
| branch on loan_type | branch_loan() [ROUTING switch on <<loan_type>>] | routing |
| gold Qs (5) interleaved w/ fill | gold_q1()..gold_q5() + fill action states | speech/capture + action |
| business Qs (5) | biz_q1()..biz_q5() + fill action states | speech/capture + action |
| secured business Qs (5) | sec_q1()..sec_q5() + fill action states | speech/capture + action |
| advance form to offer | offer_intro() → offer_action() [ACTION-ONLY click get_loan_offer] → offer_route() | speech+action+routing |
| warm human handover | transfer_intro() (speech) → transfer_action() [ACTION-ONLY call_transfer_warm] → transfer_close() [EOC] | speech+action+close |
| transfer fail fallback | transfer_failed() [EOC] | speech+close |
| FAQ (in-call, few) | rules{ faq_answers{} } | rules |
| repeated OOS / can't-answer | $$objection handle_offtopic() | objection ladder |
| goodbye anytime | global on intent(goodbye) -> closing() | global |

**Design simplification for demo robustness (weak model):** rather than 15 distinct fill action-states (one per field, brittle on gpt-4.1-mini across a long call), each loan branch collects its 4–5 answers across ask-capture states, then a SINGLE consolidated fill sequence per branch drives the form. This keeps the flow tractable while still calling fill_field for each captured value. Documented in CORRECTED FROM SOURCE. Actually — to keep tool-call fidelity AND tractability, we interleave: each qualifying-answer speech state is followed by its own fill action-state. This is the faithful shape; accept the state count.

**FIELD DROPS:**
| Source block | Reason |
|---|---|
| persona name/company/domain | FIELD-bucket — set at scaffold, in preamble |
| "reactive AI disclosure" | preamble ai_disclosure_policy owns it |
| "female verb agreement / आप honorific / script rules" | these are the hinglish_standard block → goes into rules{} communication_guidelines as authored DOMAIN voice policy (NOT dropped — operator-supplied authoritative content), NOT persona re-authoring |

**Phase 1 barrier: PASS.**

---

## Phase 2 — Conflict detection

- Type 0 (insufficient): no — SOP is complete.
- Type 1–5, 8: none material. SOP is clean; qualifying Qs are concrete.
- FIDELITY-SENSITIVE: the 3 loan branches each have an ordered 5-question sequence. Not an escalation ladder — straightforward ordered collection, modeled as sequential ask-capture states (verbatim fidelity, not collapsed). No consent needed (not consolidating).
- Type 6 (AI disclosure): SOP says reactive, matches preamble. No conflict.
- Type 8 (placeholder data): the transfer destination number is not provisioned (SR6). call_transfer_warm authored as placeholder → flagged NEEDS HUMAN INPUT.

**Phase 2: PASS (no blocking conflicts).**

---

## Phase 3 — Flow architecture

```
$$entry greet() [capture loan_type_confirmed; ANTI-JUMP]
  -> start_intro() -> start_action()[ACTION] -> start_route()[ROUTING switch session_started]
       -> branch_loan() [ROUTING switch <<loan_type>>]
            case gold            -> gold_q1() ...
            case business        -> biz_q1() ...
            case secured_business-> sec_q1() ...
            default              -> ask_loan_type() [re-ask; ANTI-JUMP]

  each branch: ask_qN() [%%collect ans_N; ANTI-JUMP on intent] -> fill_qN_action()[ACTION fill_field] -> ask_q(N+1)()
  last question fill -> offer_intro() -> offer_action()[ACTION click get_loan_offer] -> offer_route()[ROUTING]
       -> transfer_intro() (speech) -> transfer_action()[ACTION call_transfer_warm; on_error -> transfer_failed()]
            -> transfer_close() [say + EOC]
       transfer_failed() [say + EOC]

global: goodbye -> closing(); wants_human -> transfer_intro()
$$objection handle_offtopic() { step step step -> closing() }
closing() [say + EOC]
```

Model = gpt-4.1-mini → every caller-input state has ANTI-JUMP default self-loop; every tool in its own ACTION-ONLY state; routing states switch-only.

---

## Phase 4 — Authoring notes

- hinglish_standard{} block injected VERBATIM into rules{} as `communication_guidelines{}` sub-block (operator-supplied authoritative DSL content). Female persona → auxiliary rule resolves feminine.
- LID_FULL_COVERAGE true → all say() authored in Hinglish (one rendering); no bilingual variants.
- Greeting say() uses <<name>>, <<loan_type>>, <<pincode>> interpolation (context-aware).
- fill_field value args come from %%collect'd caller answers (source (b) DV) or session vars (source (a)).
- call_transfer_warm has no kwargs (platform built-in) — placeholder for SR6.
- The qualifying answers are captured %%collect (agent asks & waits). loan_type_confirmed is %%infer (confirm/deny of the pre-known loan_type).

### SIGIL INVENTORY
| Flow sigil | State | DV key | capture_mode | data_type |
|---|---|---|---|---|
| %%infer loan_type_confirmed | greet() | loan_type_confirmed | infer | STRING |
| %%collect gold_weight | gold_q1() | gold_weight | collect | STRING |
| %%collect gold_purity | gold_q2() | gold_purity | collect | STRING |
| %%collect gold_amount | gold_q3() | gold_amount | collect | STRING |
| %%collect gold_city | gold_q4() | gold_city | collect | STRING |
| %%collect gold_existing | gold_q5() | gold_existing | collect | STRING |
| %%collect biz_industry | biz_q1() | biz_industry | collect | STRING |
| %%collect biz_years | biz_q2() | biz_years | collect | STRING |
| %%collect biz_turnover | biz_q3() | biz_turnover | collect | STRING |
| %%collect biz_amount | biz_q4() | biz_amount | collect | STRING |
| %%collect biz_gst | biz_q5() | biz_gst | collect | STRING |
| %%collect sec_collateral | sec_q1() | sec_collateral | collect | STRING |
| %%collect sec_value | sec_q2() | sec_value | collect | STRING |
| %%collect sec_amount | sec_q3() | sec_amount | collect | STRING |
| %%collect sec_vintage | sec_q4() | sec_vintage | collect | STRING |
| %%collect sec_existing | sec_q5() | sec_existing | collect | STRING |

(derived-variables.json authored in the sop-content push script; UNVERIFIED SCHEMA noted.)

---

## Phase 4.5 — Flow coverage reconciliation

| Source step | Authored state(s) | Exists? |
|---|---|---|
| greeting | greet() | ✓ |
| open session | start_intro/start_action/start_route | ✓ |
| branch loan_type | branch_loan() | ✓ |
| gold 5 Qs + fill | gold_q1..q5 + fill_gold_q1..q5_action | ✓ |
| business 5 Qs + fill | biz_q1..q5 + fill_biz_*_action | ✓ |
| secured 5 Qs + fill | sec_q1..q5 + fill_sec_*_action | ✓ |
| advance to offer | offer_intro/offer_action/offer_route | ✓ |
| warm handover | transfer_intro/transfer_action/transfer_close | ✓ |
| transfer fail | transfer_failed() | ✓ |
| FAQ | rules.faq_answers | ✓ (rules, not flow — correct) |
| offtopic ladder | $$objection handle_offtopic | ✓ |
| goodbye | global on intent(goodbye) | ✓ |

flow{} present with $$entry ✓. Every tool appears as tool.* in flow ✓. No call-once tools. **PASS.**

---

## Phase 5 — Gates 5A–5R
All gates reviewed against the authored sop_content below. Summary: 5A structure ✓ (one $$entry, all switch have default, all tool.* have on_error, all targets declared). 5B speech/tool split ✓ (each tool in own action-only state; routing states switch-only). 5C EOC only on spoken closes ✓. 5D anti-jump ✓ (every caller-input default self-loops). 5E var safety ✓ (no jinja; no language gate; DVs before tool use). 5F/5G platform leak/dedup ✓ (dropped disclosure/silence/persona; hinglish_standard kept as domain voice — not preamble-owned). 5H no invented constructs ✓. 5I tool timing ✓. 5J var accounting — see table below. 5K capture model ✓. 5L quality ✓ (fixed lines are say()). 5M flow exists ✓. 5N tools preserved ✓ (all 4 in tools{}). 5O no procedure in rules ✓. 5P routing consistency ✓. 5R intents complete ✓.

**Gate 5J — variable accounting:**
| <<var>> | State | Class | Source |
|---|---|---|---|
| <<name>> | greet() | (a) input | session |
| <<loan_type>> | greet(), branch_loan() | (a) input | session |
| <<pincode>> | greet() | (a) input | session |
| <<session_id>> | start/fill/offer actions | (a) input-literal-ish | session (generated; see note) |
| <<session_started>> | start_route() | (c) tool return | start_session |
| <<gold_weight>>..<<sec_existing>> | fill_*_action | (b) DV | derived-variables.json |
| <<click_ok>>/<<fill_ok>>/<<transfer_status>> | *_route | (c) tool return | tools{} |

Note on session_id: generated per-call. Registered as an input/session variable seeded at call start (or a literal). Flagged in NEEDS HUMAN INPUT — confirm how session_id is minted (frontend passes it as a dynamic var, matching the muthoot pattern). For authoring, treated as session input <<session_id>>.

---

## Phase 6.5 — DV reconciliation: 16 sigils ↔ 16 config entries, all capture_mode match (infer×1, collect×15). PASS. (schema UNVERIFIED annotation carried.)

## Phase 6.6 — Tool-arg binding: start_session(session_id: <<session_id>> = (a)); fill_field(session_id=(a), field_name="literal", value=<<dv>>=(b)); click_button(session_id=(a), button="literal"=(d)); call_transfer_warm() no kwargs. All bound. PASS. Return-schema: session_started/fill_ok/click_ok/transfer_status all declared in tools{} -> (). PASS.

## Phase 7 — compile check against preamble: all constructs (state(){}, say(), |, <<var>>, tool.x(on_error:), switch/case/default, on intent(), $$objection/step, global, <EOC/>) confirmed present in preamble. No jinja, no language gate. PASS.

→ Emit Phase 6 output (sop_content pushed to draft via script).

# CHANGELOG — iifl-loan

## v2 (2026-07-24)
- Issue: sim-v1-run1 Finding 1 — gemma spoke `//` comments / raw tool syntax as its turn after fill_field, stalling 3/6 conversations before EOC.
- Root cause: weak-model imitation of the preamble `//` comment example + 15 separate fill action-states.
- Fix (b): added two response_rules lines — (1) after a tool runs, next spoken turn is the next flow line; never narrate a tool ran / never speak a line beginning with //; (2) never speak tool syntax as words.
- (Deferred: fix (a) batching the 15 fills — not applied, to keep progressive on-screen fill for the demo.)

## v1 (2026-07-24)
- Initial DSL: context-aware greeting, 3 loan branches (5 Qs each), interleaved fill_field, warm-transfer placeholder, hinglish_standard injected. Judge CLEAN. Sim found Finding 1 above.

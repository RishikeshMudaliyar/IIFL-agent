# v16 — the OPERATOR-AUTHORED prompt (canonical)

**`iifl-loan-v16-sop-content.txt` is a verbatim copy of what the operator hand-edited
and published in the NuPlay UI on 2026-07-28. It is the source of truth.** Any future
version starts from this file, NOT from v15 — v15 exists only as the intermediate that
carried the tool-only fix.

## What the operator changed vs. v15 (all conversational polish, no logic)

The theme is **more natural spoken Hinglish**: em-dashes and formal connectors replaced
with the way people actually talk, and some numbers spoken in Devanagari.

- **Punctuation → speech.** Dozens of `—` replaced with commas or dropped. Em-dashes
  read as a pause the TTS does not always honour.
- **Numbers spoken in Devanagari** where they are quantities in a Hindi sentence:
  `eighteen से seventy` → `अठारह से सत्तर`, `three lakh से three crore` → `तीन लाख से तीन करोड`,
  `twelve से one eighty months` → `बारह से एक सौं अस्सी महिनों`.
- **Softer, more natural phrasings** in `faq_answers`, `objection_handling`,
  `iifl_intro` ("अब तक IIFL Finance पर 80 लाख से ज़्यादा customers ने भरोसा किया है",
  "एक खास बात यह है की…"), and `on_comparison` ("हमारी एक policy है - 'Seedhi Baat'").
- **`confirm_context()` example reshaped** to an open invitation:
  "मुझे बस अभी आपकी gold loan की enquiry मिली है… तो कहिये, मै आपकी कैसे कर सकती हुं".
- **`gold_scheme_explain()`** asks "आप इनके बारे मे कुछ specifically जानना चाहते हो?".
- **`urgency_ctas` reduced from 3 lines to 2**, and the "आज तीन बजे तक" deadline replaced
  with the softer "अगर आप आज ही branch से contact करेंगे". `urgency_close()` no longer
  names a branch in its example.
- **`offer_intro()` / `transfer_intro()` rewritten** — "बढ़िया" → "Okay" / "Great!".
- **Two rules removed:** the standalone-filler ban (correctly — those turns are
  platform-emitted tool-call backchannel, not model turns, so a prompt rule cannot
  suppress them) and the "answer ONLY the latest" burst rule, changed to "answer both of
  them as a part of one message".

## What was PRESERVED (verified by audit, do not regress)

- ✅ **26 tool calls, 0 tool-only** — the v15 fix survived. `MANDATORY` ×21,
  "in THIS response" ×19.
- ✅ CRISIL / AA-rated / 1995 appear **only** inside the ban line.
- ✅ `scope_gold_only`, `offtopic_policy`, the never-guess-scheme rule,
  `ACKNOWLEDGE PLAINLY`, and the no-escalate guardrail all intact.

## One thing to note

`transfer_intro()` now says **"Great!"**, which the item-4 ban list still names as a
banned celebration word. The operator chose it deliberately as a neutral English opener,
so it stays — but the ban list and this line technically disagree. Harmless; worth a
decision if the ack rules are revisited.

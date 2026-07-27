# v8 plan — session cleanup, callback, and a persuasive Ira

Written 2026-07-27, after diagnosing the two live-call defects reported by the operator.
Read `HANDOFF.md` (v7 state) first. This plan builds on v7, it does not replace it.

---

## Part 0 — What the diagnosis actually found

Both reported bugs were investigated against the LIVE platform, not from memory.
**Four of the five callback links were already healthy** — the fix is narrower than expected.

| Link | State | Evidence |
|---|---|---|
| `/agent/handover-gate` | ✅ healthy | `handover_ready=yes` + phone → `should_call:true`; unset/`<<unresolved>>` → suppressed |
| Compiled Mozart workflow | ✅ healthy | `ask_gate` → `trigger_callback` both present; dial reads `${ask_gate.output.response.body.number}` |
| Workflow attached to Ira | ✅ healthy | `post_conversation_workflow_display_name: iifl_handover_callback` |
| `handover_ready` / `phone_e164` registered | ✅ healthy | variable ids 136209 / 136216 |
| Ira published on v7 | ✅ **already done** | `has_unpublished_changes: false`; published SOP contains `handover_ready`, `go_to_form`, `branch_knowledge` |

> The HANDOFF's "🔴 republish Ira first" instruction is **stale** — it was completed. Do not redo it.

### Bug 1 — session teardown

**The backend teardown logic is correct.** Verified live: started session `test-demo-A`, then
`test-demo-B` with a different id; A was destroyed automatically (`count:1`, only B present).

The defect is **when** it runs. `playwright_service.start_session()` tears down stale sessions
*lazily* — only on the NEXT `start_session`. But the call ends at
`AgentVoicePage.tsx:216` with only `room?.disconnect()`; **nothing tells the backend the call
is over.** So between two demos the previous Chromium stays alive, and because noVNC streams the
whole X display, the previous caller's last screen is what the next audience sees until the new
page paints.

**Fix = eager cleanup on hangup.** Do not touch the (working) lazy teardown; it stays as the
safety net for a browser-crash / closed-tab case where no cleanup call is ever sent.

### Bug 2 — Priya's callback

Two candidate causes, and they were **not separable from static inspection** — the conversation
record for the reported call (`132079`) returned an empty transcript and empty `tools[]`.

- **(a)** `handover_ready` was never set, because the operator hung up on the happy turn.
  `%%infer` only fires if gemma actually *executes* `transfer_intro()`. Ending the call at or
  just before Ira's closing line leaves the variable unset → the gate correctly suppresses.
- **(b)** the post-call workflow does not fire at all for a **web/WebRTC** call
  (`/voice/web/call`), whereas the callback was built and verified for **phone** calls.

**Step 1 of this plan is the experiment that separates them.** The rest of the callback work
depends on its result, so it runs first and nothing is built on a guess.

---

## Part 1 — Fix the two defects

### 1.1 Determine which callback cause is real  ← DO THIS FIRST

Run one deliberate web call, let it run **to its natural end** (do not hang up early — let Ira
finish `handover_close()` and let her end the call), then immediately:

```bash
# Did the gate even get asked? This line separates (a) from (b).
railway logs --service iifl-backend | grep handover_gate
```

| Observation | Cause | Fix |
|---|---|---|
| `handover_gate: ... should_call=True` present, no call rings | callback dial path / trunk | investigate `/voice/outbound-call` + Priya's trunk |
| `handover_gate: ... should_call=False` | (a) variable unset | §1.2 override |
| **no `handover_gate` line at all** | (b) workflow never fires on web calls | §1.3 backend-triggered fallback |

Cause (b) is the more likely of the two and the one with the bigger fix, so §1.3 is specified
in full rather than deferred.

### 1.2 Callback gate — keep it, add a demo override

**Operator decision: keep the gate honest, add an explicit early-set so a shortened demo still
calls back.** Today `handover_ready` is set only in `transfer_intro()`, at the very end.

Change: set it at the **offers** step instead — the point where the demo has genuinely delivered
its value and a callback is legitimately warranted, even if the operator cuts the call short.

- Add `| %%infer handover_ready` to `offer_read()`, keeping the one in `transfer_intro()`.
- **This breaks the v7 push-script gate**, which asserts `sop.count("handover_ready") == 2`
  and that it appears only inside `transfer_intro()`
  (`push_sop_v7_branch_schemes.py:86-92`). Update those assertions to expect the two `%%infer`
  sites + comments, and to assert *both* are at/after `offer_read()` — so the protection
  ("never set early, never at the top of the call") is preserved, not deleted.

The gate keeps suppressing genuinely abandoned demos (caller drops during PAN capture → still
no callback), which was the whole point of building it.

### 1.3 Eager session cleanup on hangup — and the web-call callback fallback

One backend endpoint solves both:

**New `POST /agent/session/end`** in `agent_routes.py`:
1. destroys the Playwright session for that `session_id` (fixes Bug 1 — the screen is cleared
   the moment the call ends, not when the next one starts);
2. if cause (b) is confirmed, ALSO triggers the callback — it already has `handover_ready` and
   `phone_e164` from the call variables.

⚠️ **The callback trigger CANNOT be a direct call to agentx-prod from Railway** — Railway's
egress to agentx-prod is blocked (documented, cost a session to discover). The callback works
today only because Mozart runs it cluster-internally via `http://agentx.agentx`. So the backend
must trigger the **Mozart workflow**, not the dial. Verify Railway → Mozart reachability
before building this; if that is also blocked, the fallback is to have the **browser** trigger
it directly (the browser can reach agentx-prod — this is the same constraint that forced
`use-nurix-outbound.ts` to call agentx-prod directly).

**Frontend** (`AgentVoicePage.tsx`): call the new endpoint on `endCall()` AND on
`onDisconnected`, using `navigator.sendBeacon` so it survives page navigation/unload.
Keep it fire-and-forget — a cleanup failure must never block the UI or the redirect to `/home`.

---

## Part 2 — A proactive, persuasive Ira (SOP v8)

All three requests are **prompt-layer** changes (plus one small data addition). No new tools, no
new platform objects — which keeps the blast radius small and avoids the publish-reversion risk.

### 2.1 Use the AREA NAME, not the pincode digits

Today: `"...आप pincode 4 0 0 0 5 9 में हैं, right?"` — reading digits back is robotic.
Wanted: `"...आप अंधेरी ईस्ट, मरोळ side में हैं, right?"`

The area names **already exist** in `rules.branch_knowledge` (मरोळ / घाटकोपर वेस्ट / मलाड ईस्ट /
दादर ईस्ट) — they are simply not used in `confirm_context()`.

- Add an `area_spoken` line per pincode in `branch_knowledge` (the natural spoken area name).
- Rewrite `confirm_context()`'s `say()` to use the area name instead of `<<pincode_spoken>>`.
- **Keep `pincode_spoken` registered and available** — it is still the correct thing to say if
  the caller disputes the location, and removing it would regress the digit-reading fix.
- **Unsupported pincode:** must NOT guess an area. Fall back to the existing v7 behaviour —
  confirm the loan type without naming an area at all. This is a real branch of the logic and
  needs an explicit instruction, or gemma will invent a neighbourhood.

### 2.2 Proactive IIFL + branch benefits

Today `iifl_intro` is largely **reactive** ("use these to answer why-IIFL"). Make it land
*proactively* at two natural points, without turning Ira into a monologue:

- **At `iifl_welcome()`** — one differentiator tied to what they came for
  (gold → 30-minute disbursal + insured vaults).
- **At `branch_spiel()`** — reframe from directions-only to *why this branch helps them*:
  same-day disbursal, in-branch valuation in front of them, gold in an insured vault at that
  location. Uses the real branch data already present.

Guardrail: **at most one benefit line per turn**, never stacked, and skipped entirely if the
caller is already moving forward. The existing `conversational_style` rule (warm, short turns,
never a sales monologue) stays authoritative and must be restated here so v8 does not
accidentally license a pitch.

### 2.3 Hesitation detection → motivate with facts

**Operator-selected signals** (silence was deliberately excluded — on a voice call STT gaps and
think-time are indistinguishable from hesitation, so it would misfire):

1. **Explicit doubt** — "सोचता हूँ", "बाद में", "पता नहीं", "let me think", "interest ज़्यादा है"
2. **Comparison / competitor** — Muthoot, Manappuram, a bank, "कहीं और कम रate मिलेगा?"
3. **Repeated questions / stalling** — same question again, or many questions without progress

**Design decision: a `rules` block + a global intent, NOT a new state per question.**
The SOP already has 30+ states; adding a hesitation branch to each would balloon the compiled
prompt (~46K chars today) and risk the turn-boundary defect. A global `on intent("hesitant")`
that routes to ONE `reassure_and_continue()` state — mirroring the existing
`answer_and_continue()` pattern that already works — returns the caller to exactly where they
left off.

New `rules.objection_handling` block, every claim sourced from the **already-verified**
`iifl_intro` / `faq_answers` (no new factual claims — see the honesty constraint below):

| Objection | Response material |
|---|---|
| "Interest ज़्यादा है" | The LTV trade-off — a lower-LTV scheme *is* the cheaper rate. Concrete, and it moves them toward a real choice rather than arguing. |
| "और कहीं देख रहा हूँ" | CRISIL AA-rated, listed, since 1995, 2,800+ branches; "Seedhi Baat" — no hidden charges, all fees in the Key Fact Statement before disbursal. |
| "सोचता हूँ / बाद में" | No pressure. Application is free and non-binding; the specialist confirms everything. Their branch is nearby whenever they want. |
| "Gold safe रहेगा?" | Fully insured, high-security vaults — at *their own named branch*. |

⚠️ **Honesty constraint (non-negotiable).** Competitor claims must stay
**IIFL-positive, never competitor-negative**: state what IIFL is, never assert Muthoot/
Manappuram is worse, and never compare rates we have not verified. The demo's existing rule —
*never invent a number* — extends here: no new figures enter the prompt, only ones already
verified in `iifl_intro` / `faq_answers` / `goldSchemes.ts`. This keeps the compliance posture
of a regulated-lender demo intact.

Also: hesitation must **suppress the urgency CTA** — `urgency_close()` already says to skip it
for a hesitant caller. Wire the hesitation signal into that explicitly, so the agent does not
detect hesitation and then immediately push a deadline.

---

## Part 3 — Sequencing, risk, verification

### Order (deliberate: cheap diagnosis → low-risk backend → prompt last)

1. **§1.1 the one experiment** — decides the callback fix. Everything else is independent of it.
2. **§1.3 backend `/agent/session/end` + frontend hangup hook** — self-contained; fixes the
   visible screen bug regardless of the callback outcome.
3. **§2.1–2.3 SOP v8** — one push, one publish, one test cycle.
4. **§1.2 gate override** — folded into the same SOP push.

Prompt changes land **last and together** because each publish carries the reversion risk below.

### Risks

- ⚠️ **Publishing Ira has reverted out-of-band changes 3×.** After publishing v8, re-verify:
  compiled prompt, `post_conversation_workflow` attachment, both agents' tool lists, all 5
  action schemas. `PLATFORM-CONFIG.md §"READ THIS FIRST"` has the exact calls.
- ⚠️ **The `fill_field` turn-boundary defect is still unresolved.** v8 adds conversational
  turns (hesitation, benefits), which *could* aggravate it — more talking, more chances to pack
  a fill into a speaking turn. Watch it during the test call; if it regresses, the documented
  next lever is structural (PAN-style confirm state on every question), not more wording.
- **Prompt size** — v7 compiles to ~46.6K chars. v8 adds a rules block and one state; keep the
  additions tight and re-check the compiled size after pushing.

### Verification

- **Bug 1:** run two demos back to back; the second must open on a clean branch hero with no
  flash of the previous run. Confirm `/agent/sessions` returns `count:0` immediately after a
  hangup (today it stays at 1 until the next call).
- **Bug 2:** one complete call → `handover_gate ... should_call=True` in the logs → Priya rings.
  Then one deliberately abandoned call (hang up during PAN) → **no** callback. Both halves
  matter: the gate must still suppress.
- **v8 behaviour:** area name spoken instead of digits; an unsupported pincode names no area;
  a scripted objection ("Muthoot में कम rate है") produces a factual IIFL-positive reply with no
  invented numbers and no competitor attack; a hesitant caller gets **no** urgency CTA.

`TEST-SCRIPT-v7.md` covers the v7 flow; add these as new scenarios rather than editing it in
place, so the v7 regression cases stay intact.

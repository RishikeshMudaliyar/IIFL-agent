#!/usr/bin/env python
"""Push DSL v8 — hyperlocal area names, proactive benefits, hesitation handling.

Three behaviour changes on top of v7's branch-hero + LTV-scheme flow:

1. AREA NAME, NOT PINCODE DIGITS. confirm_context() now says "आप अंधेरी ईस्ट side
   में हैं, right?" instead of reading "4 0 0 0 5 9" back. Each branch block gains
   an `area_spoken` name. An UNKNOWN pincode must name no area at all — the model
   is explicitly forbidden from guessing a neighbourhood.

2. PROACTIVE BENEFITS. iifl_welcome() adds ONE matched IIFL strength; branch_spiel()
   adds ONE line from the new branch_benefits block (what they GET at that branch).
   One line each, never stacked — the conversational_style rule still outranks it.

3. HESITATION -> FACTS, NOT PRESSURE. New `hesitant` intent + one
   reassure_and_continue() state reached from the global block, so doubt at ANY
   point lands in one handler. Backed by rules.objection_handling.
   Operator-chosen signals: explicit doubt, competitor comparison, stalling.
   Silence was deliberately EXCLUDED — on a voice call an STT gap and think-time
   are indistinguishable from hesitation, so it would misfire.

   COMPETITOR RULE IS ABSOLUTE: say what IIFL is, never that another lender is
   worse, and never quote a rate we have not verified. No new figure enters the
   prompt — every claim traces to iifl_intro / faq_answers / gold_schemes.

   Hesitation also HARD-SUPPRESSES the urgency CTA. Detecting reluctance and then
   pushing a deadline is the worst outcome on this call.

4. CALLBACK GATE WIDENED (operator decision). `handover_ready` is now set at
   offer_read() as well as transfer_intro() — reaching the priced offers means the
   demo delivered its value, so hanging up there still earns a callback. It is
   still never set before the offers, so an abandoned demo still produces none.

Pushes sop_content via PUT /v2/voice/agent-config/{DRAFT}, then verifies the
compiled prompt. Does NOT publish — that stays the operator's gate.
"""
import httpx, json, pathlib, sys

D = pathlib.Path(__file__).parent
ids = json.loads((D / "output" / "agent-ids.json").read_text())
WS, AID, EMAIL = ids["workspace_id"], ids["agent_id"], ids["operator_email"]
DRAFT = f"{AID}-draft"
H = {"workspace-id": WS, "tenant-id": WS, "user-id": "123", "user-email": EMAIL,
     "Accept": "application/json", "Content-Type": "application/json"}
B = "https://agentx-prod.nurixlabs.tech"

cfg = httpx.get(f"{B}/voice/agent-config/{DRAFT}", headers=H, timeout=40,
                follow_redirects=True).json()
cfg = cfg.get("data", cfg)
PID = cfg.get("system_prompt_id")
print("draft system_prompt_id:", PID)

sop = (D / "dsl-prompt" / "iifl-loan-v8-sop-content.txt").read_text()


# Compare DEFINITION sites ("  name() {"), not first mention — a state is
# routinely referenced by an earlier `-> name()` before it is defined.
def _def_at(text, state):
    return text.index(f"  {state}() {{")


# ================= v8 gates: the NEW behaviour =================

# --- 1. Area name instead of pincode digits ---
assert "area_spoken" in sop, "area_spoken missing — v8 says the area, not the digits"
for pin, area in (("400059", "अंधेरी ईस्ट"), ("400086", "घाटकोपर वेस्ट"),
                  ("400097", "मलाड ईस्ट"), ("400014", "दादर ईस्ट")):
    _blk = sop.index(f"pin_{pin}")
    _nxt = sop.find("pin_", _blk + 5)
    assert "area_spoken" in sop[_blk:_nxt if _nxt > 0 else len(sop)], \
        f"pin_{pin} has no area_spoken line"
    assert area in sop, f"spoken area name for {pin} missing: {area}"
# The old digit-reading say() must be GONE from confirm_context.
assert "pincode <<pincode_spoken>> में हैं" not in sop, \
    "confirm_context still reads the pincode digits back — v8 says the area name"
# But pincode_spoken must REMAIN available (needed if the caller disputes the area,
# and removing it would regress the v3 digit-reading fix).
assert "<<pincode_spoken>>" in sop, "pincode_spoken must stay available"
# An unknown pincode must NEVER get an invented neighbourhood.
assert "never guess" in sop.lower() or "never invent" in sop.lower(), \
    "missing the do-not-invent-an-area guard for unsupported pincodes"

# --- 2. Proactive benefits ---
assert "branch_benefits" in sop, "rules.branch_knowledge.branch_benefits missing"
_bs = _def_at(sop, "branch_spiel")
_bs_end = sop.index("}", sop.index("on intent", _bs))
assert "branch_benefits" in sop[_bs:_bs_end + 400], \
    "branch_spiel does not use branch_benefits"
_iw = _def_at(sop, "iifl_welcome")
assert "iifl_intro" in sop[_iw:_iw + 900], \
    "iifl_welcome does not proactively use an iifl_intro strength"
# One at a time — the anti-monologue guard must survive.
assert "conversational_style" in sop, "conversational_style rule lost"

# --- 3. Hesitation handling ---
assert "hesitant" in sop, "hesitant intent missing"
assert "objection_handling" in sop, "rules.objection_handling missing"
assert "reassure_and_continue()" in sop, "reassure_and_continue state missing"
assert 'on intent("hesitant")' in sop, "hesitant never routed"
# It must be GLOBAL — doubt can surface anywhere in the call.
_g = sop.index("  global {")
assert 'on intent("hesitant")' in sop[_g:sop.index("}", _g)], \
    "hesitant must be handled in the global block"
# The three operator-selected signals.
for sig in ("सोचता हूँ", "Muthoot", "interest"):
    assert sig in sop, f"hesitation signal missing: {sig}"
# COMPETITOR SAFETY — absolute. Never disparage, never quote a rival's rate.
assert "NEVER say" in sop and "worse" in sop, \
    "missing the never-disparage-a-competitor rule"
# Hesitation must suppress urgency, not stack with it.
assert "mutually exclusive" in sop or "SKIP the urgency" in sop, \
    "hesitation must hard-suppress the urgency CTA"

# --- 4. Callback gate: now exactly TWO sites, both at/after the offers ---
assert sop.count("%%infer handover_ready") == 2, \
    "handover_ready must be inferred at exactly two states (offer_read + transfer_intro)"
_first = sop.index("%%infer handover_ready")
_second = sop.index("%%infer handover_ready", _first + 1)
_or_def, _ti_def = _def_at(sop, "offer_read"), _def_at(sop, "transfer_intro")
assert _or_def < _first < _ti_def, \
    "the first handover_ready must sit inside offer_read()"
assert _ti_def < _second, "the second handover_ready must sit inside transfer_intro()"
# THE POINT OF THE GATE: never set before the caller has been priced. If it ever
# appears before the offers, an abandoned demo starts calling people back again.
assert _def_at(sop, "offer_action") < _first, \
    "handover_ready set BEFORE the offers — that re-opens the abandoned-demo bug"

# ================= v7/v6/v5 regression gates (unchanged) =================
assert "branch_knowledge" in sop, "rules.branch_knowledge missing"
assert "branch_spiel()" in sop, "branch_spiel state missing"
assert "wants_branch_info" in sop, "wants_branch_info intent missing"
assert "go_to_form()" in sop, "go_to_form state missing"
assert "tool.go_to_form(" in sop, "go_to_form tool never invoked"
assert "tool.start_session(session_id: <<session_id>>, loan_type: <<loan_type>>, pincode: <<pincode>>" in sop, \
    "start_session must pass pincode"
for pin in ("400059", "400086", "400097", "400014"):
    assert f"pin_{pin}" in sop, f"branch block for {pin} missing"

assert "gold_schemes" in sop, "rules.gold_schemes missing"
assert "gold_scheme_explain()" in sop, "scheme explanation state missing"
assert "tool.click_button(session_id: <<session_id>>, button: \"scheme_<<scheme>>\"" in sop, \
    "scheme choice must be clicked"
for tier in ("Swarna Saver", "Swarna Balance", "Swarna Max"):
    assert tier in sop, f"scheme {tier} missing"
for fig in ("7,300", "8,635", "9,960", "11.88", "14.4", "17.4"):
    assert fig in sop, f"scheme figure {fig} missing"
# REGULATORY: never imply an LTV above the 75% cap.
for illegal in ("125%", "1.25 LTV", "100% LTV", "85% LTV", "80% LTV"):
    assert illegal not in sop, f"LTV above the RBI cap present: {illegal}"
assert "75% RBI की limit है" in sop, "the 75% cap explanation is missing"
assert '%%collect loan_amount' in sop and '%%collect scheme' in sop, "collect tags missing"
assert "urgency_ctas" in sop and "urgency_close()" in sop, "urgency CTA missing"

assert 'case "secured":' in sop and 'case "secured_business":' in sop, "secured branches missing"
assert "ask_consent()" in sop and "explain_consent()" in sop, "consent ask states missing"
assert "consent_declined()" in sop, "consent decline path missing"
assert "tnc_summary" in sop, "rules.tnc_summary missing"
assert sop.count('field_name: "consent", value: "true"') == 1, \
    "consent must be filled exactly once, inside fill_consent() after a real yes"
assert "show_offers" in sop and "offer_action()" in sop and "offer_read()" in sop, "offers states missing"
assert _def_at(sop, "offer_action") < _def_at(sop, "transfer_intro"), \
    "offers must come before handover"
for a, b, why in (("gold_q1", "gold_scheme_explain", "amount before scheme"),
                  ("gold_scheme_explain", "gold_q3", "scheme before gold weight"),
                  ("gold_q3", "gold_q4", "weight before purity"),
                  ("gold_q4", "gold_pan", "purity before PAN")):
    assert _def_at(sop, a) < _def_at(sop, b), f"question order wrong: {why}"
for marker in ("identifiers_as_single_digits", "iifl_intro", "conversational_style",
               "faq_answers", "confirm_context()", "-> start_action()",
               'field_name: "pan"', "MECHANICAL RULE"):
    assert marker in sop, f"SOP regression — missing {marker}"
print(f"gates passed ({len(sop)} chars)")

put_body = {"sop": {
    "goal": ("Welcome the caller to their nearest IIFL branch by name, help them choose "
             "a gold loan LTV scheme, fill the application live, answer doubts with facts "
             "rather than pressure, show indicative offers, and hand over to a human "
             "specialist via callback."),
    "sop_content": sop,
}}
r = httpx.put(f"{B}/v2/voice/agent-config/{DRAFT}", headers=H, json=put_body,
              timeout=120, follow_redirects=True)
print("PUT sop_content:", r.status_code)
if r.status_code >= 400:
    print(r.text[:1500]); sys.exit(2)

rv = httpx.get(f"{B}/voice/prompt/{PID}", headers=H, timeout=40,
               follow_redirects=True).json()
rec = rv.get("data", rv) or {}
pt = rec.get("prompt", "") or ""
print("\nVERIFY compiled prompt len:", len(pt), "version:", rec.get("version"))
checks = {
    # v8
    "area_spoken present":       "area_spoken" in pt,
    "all 4 area names":          all(a in pt for a in ("अंधेरी ईस्ट", "घाटकोपर वेस्ट",
                                                       "मलाड ईस्ट", "दादर ईस्ट")),
    "no digit-readback in ctx":  "pincode <<pincode_spoken>> में हैं" not in pt,
    "branch_benefits present":   "branch_benefits" in pt,
    "objection_handling":        "objection_handling" in pt,
    "hesitant intent":           "hesitant" in pt,
    "reassure state":            "reassure_and_continue()" in pt,
    "hesitant is global":        'on intent("hesitant")' in pt,
    "no-disparage rule":         "NEVER say" in pt,
    "urgency suppressed":        ("mutually exclusive" in pt or "SKIP the urgency" in pt),
    "handover_ready x2":         pt.count("%%infer handover_ready") == 2,
    # v7 regressions
    "branch_knowledge present":  "branch_knowledge" in pt,
    "all 4 pincodes":            all(f"pin_{p}" in pt for p in ("400059","400086","400097","400014")),
    "branch_spiel state":        "branch_spiel()" in pt,
    "go_to_form invoked":        "tool.go_to_form(" in pt,
    "start_session has pincode": "pincode: <<pincode>>" in pt,
    "gold_schemes present":      "gold_schemes" in pt,
    "scheme click":              'button: "scheme_<<scheme>>"' in pt,
    "no LTV above cap":          not any(x in pt for x in ("125%", "100% LTV", "85% LTV")),
    "urgency CTA":               "urgency_ctas" in pt,
    "amount before scheme":      _def_at(pt, "gold_q1") < _def_at(pt, "gold_scheme_explain"),
    "pincode_spoken kept":       "<<pincode_spoken>>" in pt,
    "consent asked not auto":    "ask_consent()" in pt,
    "offers step present":       "show_offers" in pt,
    "mechanical spacing rule":   "MECHANICAL RULE" in pt,
    "faq_answers kept":          "faq_answers" in pt,
}
for k, v in checks.items():
    print(f"  {'OK ' if v else 'FAIL'} {k}")
print("\nALL GOOD — draft updated. Publish is the operator's call."
      if all(checks.values()) else "\n*** SOME CHECKS FAILED ***")

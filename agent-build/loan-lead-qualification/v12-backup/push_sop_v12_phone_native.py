#!/usr/bin/env python
"""Push DSL v12 — PHONE-NATIVE conversation + live in-call summary email.

The premise change that drives everything else: the caller is on a PHONE and can
see nothing. The browser form still fills (it is how the demo team watches the
backend work), but Ira no longer knows it exists. Every "look at your screen",
every "I'm opening your application", and every offer to help fill a form is gone.

1. DE-SCREENED. A hard rule at the top of response_rules states the caller cannot
   see anything, and every screen-dependent instruction was rewritten. Two that
   mattered structurally:
     * the scheme brevity rule used to be justified by "the detail is on their
       screen" — it is now justified by "nobody absorbs nine numbers spoken
       aloud", which is the real reason and survives losing the screen;
     * go_to_form() had a spoken line ("मैं आपकी application खोल रही हूँ") and now
       has NONE — the page change is silent.

2. RESTRUCTURED OPENING (operator's flow, points 1-4). confirm_context() now
   introduces Ira from IIFL Finance with energy and shows she already knows the
   enquiry and the area. iifl_welcome() speaks LOOSELY about what IIFL offers with
   no hard numbers, then falls straight through to the questions — the old "shall
   we start the application?" permission-ask is gone, because from the caller's
   side there is no application.

3. SCHEME PITCH CUT TO THREE PHRASES (point 5). Name + one distinguishing idea
   each. LTV percentages, per-gram rupees, rates and tenures are now RESERVED for
   when the caller asks. The caller-chooses guardrails are untouched.

4. BRANCH HOOK AFTER THE GOLD QUESTIONS (point 6). New branch_hook() state between
   purity and PAN: how that branch has served the caller's area, the local event
   near them, and what they gain by visiting. Each of the four pincodes gained a
   `local_event` and a `visit_benefit` line. The hesitation rule still outranks it
   — a hesitant caller gets no visit nudge.

5. LIVE EMAIL (point 8). email_intro() announces it, email_action() calls the new
   send_email tool, and the result BRANCHES: email_confirmed() on success,
   email_failed() otherwise — which softens to "our team will send it shortly"
   and never claims a send that did not happen, never apologises, never mentions
   a technical problem.

   Transport note: Railway blocks all outbound SMTP, so the backend sends over
   Resend's HTTPS API. Verified end-to-end through Mozart (COMPLETED -> backend
   -> email_sent true).

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

sop_authored = (D / "dsl-prompt" / "iifl-loan-v12-sop-content.txt").read_text()


def strip_comments(text):
    """Remove whole-line // comments before pushing.

    The platform preamble states "// marks a silent comment. Never speak or act on
    comment text" — so comments cost prompt tokens and buy zero behaviour. They are
    kept in the AUTHORED file because they document why each guardrail exists (the
    provenance of several rules is a specific observed live failure), and stripped
    only on the way to the platform.

    Only lines whose FIRST non-whitespace is // are dropped. A line that merely
    mentions the marker — e.g. the response_rules line about never speaking a line
    that begins with // — is content and must survive.
    """
    kept = [l for l in text.split("\n") if not l.lstrip().startswith("//")]
    out = []
    for l in kept:                      # collapse blank runs left behind
        if not l.strip() and out and not out[-1].strip():
            continue
        out.append(l)
    return "\n".join(out)


sop = strip_comments(sop_authored)
assert sop.count("{") == sop.count("}"), "comment strip unbalanced the braces"
assert "begins with //" in sop, "the // marker rule was wrongly stripped"
print(f"comment strip: {len(sop_authored)} -> {len(sop)} chars "
      f"(-{len(sop_authored) - len(sop)}, {(len(sop_authored) - len(sop)) * 100 // len(sop_authored)}%)")


def _def_at(text, state):
    """Compare DEFINITION sites, not first mention — a state is routinely
    referenced by an earlier `-> name()` before it is defined."""
    return text.index(f"  {state}() {{")


# ================= v12 gates: the caller cannot see anything =================
# THE PREMISE. Without this rule the model happily says "देखिए screen पे" because
# every earlier version told it the caller was looking at a form.
assert "THIS IS A PHONE CALL" in sop, "missing the phone-call premise rule"
assert "CANNOT SEE ANYTHING" in sop, "missing the caller-cannot-see rule"
assert "NEVER offer to help them fill a form" in sop, \
    "missing the ban on offering form-filling help"

# go_to_form must be SILENT. A spoken line here is the single most visible
# premise break — it tells the caller a screen exists.
# go_to_form must be MANDATORY and must not be skippable. Live call 2044aa31 proved
# a bodyless tool-only state gets skipped: the model jumped from iifl_welcome() to
# gold_q1(), the form never opened, and all 7 fills + the scheme click failed with
# "field not found". The state now carries an explicit do-not-skip instruction, and
# response_rules carries an ordering rule as a second line of defence.
_gtf = _def_at(sop, "go_to_form")
_gtf_body = sop[_gtf:sop.index("}", sop.index("tool.go_to_form", _gtf))]
assert "Do not speak" in _gtf_body, \
    "go_to_form() must instruct the model to invoke the tool silently, not omit guidance entirely"
assert "mandatory" in _gtf_body.lower(), "go_to_form() must be marked mandatory"
assert "ORDERING RULE — go_to_form BEFORE any fill" in sop, \
    "response_rules must carry the go_to_form-before-fill ordering rule"
assert "application खोल" not in sop, \
    "the 'I am opening your application' line must be gone"
assert "आपकी application ready है" not in sop, \
    "the 'your application is ready' greeting must be gone"

# No screen-dependent phrasing anywhere in an instruction line. (Devanagari
# "आपके सामने" is allowed — it means 'in front of you AT THE BRANCH', i.e. the
# in-person valuation, which is a real IIFL selling point.)
for banned in ("on screen", "options on screen", "cards on screen",
               "the caller's screen", "on their screen"):
    assert banned not in sop, f"screen-dependent phrasing still present: {banned!r}"

# Scheme brevity must now be justified by the phone, not by a screen.
assert "nobody can hold nine numbers" in sop or "nobody absorbs" in sop or \
       "cannot hold numbers in their head" in sop, \
    "the scheme brevity rule lost its phone-call justification"
assert "Do NOT state LTV percentages" in sop, \
    "missing the rule reserving LTV/per-gram/rate figures for when asked"

# Found by simulation (sim-v12-run1, hesitant-1/2/3): the v9 reassurance line said
# "Application भरने से आप कहीं bind नहीं हो जाते", which tells a phone caller they
# are filling something. Reassurance must not resurrect the form.
assert "Application भरने से" not in sop and "application भरने से" not in sop, \
    "the hesitation reassurance must not mention filling an application"

# --- The branch hook (operator point 6) ---
assert "branch_hook()" in sop, "branch_hook state missing"
assert "local_event" in sop, "local_event lines missing from branch_knowledge"
assert "visit_benefit" in sop, "visit_benefit lines missing from branch_knowledge"
for pin in ("400059", "400086", "400097", "400014"):
    _blk = sop.index(f"pin_{pin}")
    _nxt = sop.find("pin_", _blk + 5)
    _seg = sop[_blk:_nxt if _nxt > 0 else len(sop)]
    assert "local_event" in _seg, f"pin_{pin} has no local_event line"
    assert "visit_benefit" in _seg, f"pin_{pin} has no visit_benefit line"
# It must sit AFTER the gold questions and BEFORE PAN — the operator's ordering.
assert _def_at(sop, "gold_q4") < _def_at(sop, "branch_hook") < _def_at(sop, "gold_pan"), \
    "branch_hook must sit between the gold questions and PAN capture"
# Hesitation still outranks the visit nudge.
assert "SKIP THIS LINE COMPLETELY if the caller has shown any hesitation" in sop, \
    "branch_hook must suppress the visit nudge for a hesitant caller"

# --- The live email (operator point 8) ---
assert "send_email(session_id:" in sop, "send_email not declared in tools{}"
assert "tool.send_email(" in sop, "send_email never invoked"
assert "email_intro()" in sop and "email_action()" in sop, "email states missing"
assert "email_confirmed()" in sop and "email_failed()" in sop, \
    "the email result must branch — success and failure need separate states"
# THE HONESTY GATE: a failed send must never be reported as sent.
assert "Do NOT say the email has been sent" in sop, \
    "email_failed must not claim the email was sent"
assert "do NOT mention any technical problem" in sop, \
    "email_failed must not surface a technical failure to the caller"
# The email must come after the details are captured, before the close.
assert _def_at(sop, "transfer_intro") < _def_at(sop, "email_intro"), \
    "the email should be sent after the callback is promised"
assert _def_at(sop, "email_intro") < _def_at(sop, "urgency_close"), \
    "the email must precede the closing urgency line"

# ================= v9 gates: the caller picks the scheme =================
assert "gold_scheme_help()" in sop, "gold_scheme_help state missing"
assert "NEVER steer them to the most expensive" in sop, "missing the do-not-upsell rule"
assert "NEVER default to Swarna Max" in sop, "missing the never-default-to-Max rule"
assert "THE CALLER CHOOSES" in sop, "missing the caller-chooses rule"
assert "never congratulate them on a choice they did not make" in sop, \
    "missing the guard against confirming an unmade choice"
assert "NEVER ask \"क्या मैं आपके लिए ये select कर दूँ?\"" in sop, \
    "missing the ban on 'shall I select it for you' phrasing"
assert "confirm the scheme BY NAME" in sop, "the caller must confirm the scheme by name"
assert "Swarna SAVER" in sop, "Saver must be named as the honest cheapest answer"
_gse = _def_at(sop, "gold_scheme_explain")
_gse_end = sop.index("  gold_scheme_question()", _gse)
assert "-> gold_scheme_help()" in sop[_gse:_gse_end], \
    "an unclear reply must route to gold_scheme_help(), never straight to a click"

# ================= v8 gates =================
assert "area_spoken" in sop, "area_spoken missing"
for pin, area in (("400059", "अंधेरी ईस्ट"), ("400086", "घाटकोपर वेस्ट"),
                  ("400097", "मलाड ईस्ट"), ("400014", "दादर ईस्ट")):
    assert area in sop, f"spoken area name for {pin} missing: {area}"
assert "pincode <<pincode_spoken>> में हैं" not in sop, \
    "confirm_context must not read the pincode digits back"
assert "<<pincode_spoken>>" in sop, "pincode_spoken must stay available"
assert "never guess" in sop.lower() or "never invent" in sop.lower(), \
    "missing the do-not-invent-an-area guard"
assert "branch_benefits" in sop, "branch_benefits missing"
_iw = _def_at(sop, "iifl_welcome")
assert "iifl_intro" in sop[_iw:_iw + 900], "iifl_welcome must use an iifl_intro strength"
assert "conversational_style" in sop, "conversational_style rule lost"
assert "hesitant" in sop and "objection_handling" in sop, "hesitation handling missing"
assert "reassure_and_continue()" in sop, "reassure_and_continue state missing"
_g = sop.index("  global {")
assert 'on intent("hesitant")' in sop[_g:sop.index("}", _g)], \
    "hesitant must be handled in the global block"
for sig in ("सोचता हूँ", "Muthoot", "interest"):
    assert sig in sop, f"hesitation signal missing: {sig}"
assert "NEVER say" in sop and "worse" in sop, "missing the never-disparage rule"
assert "mutually exclusive" in sop or "SKIP the urgency" in sop, \
    "hesitation must hard-suppress the urgency CTA"

# --- Callback gate: still exactly TWO sites, both at/after the offers ---
assert sop.count("%%infer handover_ready") == 2, \
    "handover_ready must be inferred at exactly two states"
_first = sop.index("%%infer handover_ready")
_second = sop.index("%%infer handover_ready", _first + 1)
assert _def_at(sop, "offer_read") < _first < _def_at(sop, "transfer_intro"), \
    "the first handover_ready must sit inside offer_read()"
assert _def_at(sop, "transfer_intro") < _second, \
    "the second handover_ready must sit inside transfer_intro()"
assert _def_at(sop, "offer_action") < _first, \
    "handover_ready set BEFORE the offers — that re-opens the abandoned-demo bug"

# ================= v7/v6/v5 regression gates =================
assert "branch_knowledge" in sop and "branch_spiel()" in sop, "branch states missing"
assert "wants_branch_info" in sop, "wants_branch_info intent missing"
assert "tool.go_to_form(" in sop, "go_to_form tool never invoked"
assert "tool.start_session(session_id: <<session_id>>, loan_type: <<loan_type>>, pincode: <<pincode>>" in sop, \
    "start_session must pass pincode"
assert "gold_schemes" in sop and "gold_scheme_explain()" in sop, "scheme states missing"
assert 'tool.click_button(session_id: <<session_id>>, button: "scheme_<<scheme>>"' in sop, \
    "scheme choice must be clicked"
for tier in ("Swarna Saver", "Swarna Balance", "Swarna Max"):
    assert tier in sop, f"scheme {tier} missing"
for fig in ("7,300", "8,635", "9,960", "11.88", "14.4", "17.4"):
    assert fig in sop, f"scheme figure {fig} missing"
for illegal in ("125%", "1.25 LTV", "100% LTV", "85% LTV", "80% LTV"):
    assert illegal not in sop, f"LTV above the RBI cap present: {illegal}"
assert "75% RBI की limit है" in sop, "the 75% cap explanation is missing"
assert "%%collect loan_amount" in sop and "%%collect scheme" in sop, "collect tags missing"
assert "urgency_ctas" in sop and "urgency_close()" in sop, "urgency CTA missing"
assert 'case "secured":' in sop and 'case "secured_business":' in sop, "secured branches missing"
assert "ask_consent()" in sop and "explain_consent()" in sop, "consent ask states missing"
assert "consent_declined()" in sop, "consent decline path missing"
assert "tnc_summary" in sop, "rules.tnc_summary missing"
assert sop.count('field_name: "consent", value: "true"') == 1, \
    "consent must be filled exactly once, after a real yes"
assert "show_offers" in sop and "offer_action()" in sop and "offer_read()" in sop, \
    "offers states missing"
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
    "goal": ("Have a warm, natural phone conversation that qualifies the caller for a "
             "gold loan, capture their details silently in the background, tell them "
             "about their neighbourhood branch and the local event near them, email "
             "them a summary during the call, and hand over to a human specialist via "
             "callback. The caller experiences only a phone call — never a form."),
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
    # v12 — the premise
    "phone-call premise":        "THIS IS A PHONE CALL" in pt,
    "caller cannot see":         "CANNOT SEE ANYTHING" in pt,
    "no form-filling offer":     "NEVER offer to help them fill a form" in pt,
    "go_to_form silent":         "application खोल" not in pt,
    "no 'application ready'":    "आपकी application ready है" not in pt,
    "no screen phrasing":        not any(x in pt for x in ("on screen", "on their screen")),
    "scheme brevity rejustified": "Do NOT state LTV percentages" in pt,
    # v12 — branch hook
    "branch_hook state":         "branch_hook()" in pt,
    "local_event lines":         "local_event" in pt,
    "visit_benefit lines":       "visit_benefit" in pt,
    "hook after purity":         _def_at(pt, "gold_q4") < _def_at(pt, "branch_hook"),
    "hook before PAN":           _def_at(pt, "branch_hook") < _def_at(pt, "gold_pan"),
    # v12 — email
    "send_email declared":       "send_email(session_id:" in pt,
    "send_email invoked":        "tool.send_email(" in pt,
    "email branches":            "email_confirmed()" in pt and "email_failed()" in pt,
    "email honesty gate":        "Do NOT say the email has been sent" in pt,
    # v9
    "gold_scheme_help state":    "gold_scheme_help()" in pt,
    "no-upsell rule":            "NEVER steer them to the most expensive" in pt,
    "never-default-to-Max":      "NEVER default to Swarna Max" in pt,
    "caller-chooses rule":       "THE CALLER CHOOSES" in pt,
    # v8
    "area_spoken present":       "area_spoken" in pt,
    "all 4 area names":          all(a in pt for a in ("अंधेरी ईस्ट", "घाटकोपर वेस्ट",
                                                       "मलाड ईस्ट", "दादर ईस्ट")),
    "branch_benefits present":   "branch_benefits" in pt,
    "objection_handling":        "objection_handling" in pt,
    "hesitant is global":        'on intent("hesitant")' in pt,
    "urgency suppressed":        ("mutually exclusive" in pt or "SKIP the urgency" in pt),
    "handover_ready x2":         pt.count("%%infer handover_ready") == 2,
    # v7 regressions
    "all 4 pincodes":            all(f"pin_{p}" in pt for p in ("400059","400086","400097","400014")),
    "go_to_form invoked":        "tool.go_to_form(" in pt,
    "start_session has pincode": "pincode: <<pincode>>" in pt,
    "scheme click":              'button: "scheme_<<scheme>>"' in pt,
    "no LTV above cap":          not any(x in pt for x in ("125%", "100% LTV", "85% LTV")),
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

#!/usr/bin/env python
"""Push DSL v7 — branch-hero opening + three-LTV-scheme gold flow.

The scope change: the call no longer opens on a form. It opens on a HYPERLOCAL
BRANCH HERO for the caller's pincode, Ira offers "application, or branch info
first?", and only then does the browser move to the form (go_to_form).

The gold form is re-ordered around the LTV schemes:
    loan amount -> choose scheme (55/65/75) -> gold weight -> purity
    -> PAN -> Aadhaar -> existing loan -> consent -> offers

Four supported pincodes with REAL branch data (IIFL's own locator):
    400059 Andheri East (Marol) · 400086 Ghatkopar West
    400097 Malad East (Kurar)   · 400014 Dadar East

Scheme numbers are grounded, never invented: 75% is the RBI/IIFL published LTV
CEILING, so the three tiers sit at and below it (55/65/75). Per-gram figures are
22K Mumbai rate (Rs 13,285/g, 26 Jul 2026) x LTV. Rates sit inside IIFL's
published 0.99%/month (11.88%/yr) to 27%/yr band.

Pushes sop_content via PUT /v2/voice/agent-config/{DRAFT}, then verifies the
compiled prompt. Does NOT publish — that's the operator's gate.
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

sop = (D / "dsl-prompt" / "iifl-loan-v7-sop-content.txt").read_text()

# ---------------- fail-closed gates: the NEW v7 behaviour ----------------
# Branch-first opening
assert "branch_knowledge" in sop, "rules.branch_knowledge missing"
assert "branch_spiel()" in sop, "branch_spiel state missing"
assert "wants_branch_info" in sop, "wants_branch_info intent missing"
assert "go_to_form()" in sop, "go_to_form state missing"
assert "tool.go_to_form(" in sop, "go_to_form tool never invoked"
# start_session must now carry the pincode (it selects the hero variant)
assert "tool.start_session(session_id: <<session_id>>, loan_type: <<loan_type>>, pincode: <<pincode>>" in sop, \
    "start_session must pass pincode"
# All four real branches present
for pin in ("400059", "400086", "400097", "400014"):
    assert f"pin_{pin}" in sop, f"branch block for {pin} missing"

# The three LTV schemes
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

# Question ORDER: amount -> scheme -> weight -> purity -> PAN.
# Checked at DEFINITION sites (see _def_at below) for the same reason.
assert '%%collect loan_amount' in sop and '%%collect scheme' in sop, "collect tags missing"

# Urgency CTA
assert "urgency_ctas" in sop and "urgency_close()" in sop, "urgency CTA missing"

# Compare DEFINITION sites ("  name() {"), not first mention — a state is
# routinely referenced by an earlier `-> name()` before it is defined.
def _def_at(text, state):
    return text.index(f"  {state}() {{")


# CALLBACK GATE — `handover_ready` is what stops Priya calling back after an
# abandoned demo. It must be set in transfer_intro() and NOWHERE else: setting it
# anywhere earlier would re-open the exact bug it fixes.
assert "%%infer handover_ready" in sop, "handover_ready gate variable missing"
assert sop.count("handover_ready") == 2, \
    "handover_ready must appear exactly twice (the %%infer tag + its comment) — " \
    "it must be set ONLY in transfer_intro()"
_ti = _def_at(sop, "transfer_intro")
assert _ti < sop.index("%%infer handover_ready") < sop.index("-> urgency_close()"), \
    "handover_ready must be set inside transfer_intro()"

# ---------------- regression gates: what v5/v6 already fixed ----------------
assert "<<pincode_spoken>>" in sop, "must speak pincode_spoken"
assert "<<pincode>> में हैं" not in sop, "raw <<pincode>> still inside a say()"
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
print(f"gates passed; sop len {len(sop)}")

put_body = {"sop": {
    "goal": ("Welcome the caller to their nearest IIFL branch, help them choose a gold "
             "loan LTV scheme, fill the application live, show indicative offers, and "
             "hand over to a human specialist via callback."),
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
    "pincode_spoken in say":     "<<pincode_spoken>>" in pt,
    "consent asked not auto":    "ask_consent()" in pt,
    "offers step present":       "show_offers" in pt,
    "mechanical spacing rule":   "MECHANICAL RULE" in pt,
    "faq_answers kept":          "faq_answers" in pt,
}
for k, v in checks.items():
    print(f"  {'OK ' if v else 'FAIL'} {k}")
print("\nALL GOOD — draft updated. Publish is the operator's call."
      if all(checks.values()) else "\n*** SOME CHECKS FAILED ***")

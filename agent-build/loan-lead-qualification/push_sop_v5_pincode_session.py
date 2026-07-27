#!/usr/bin/env python
"""Push DSL v4 — pincode-spoken + session_id/branch fixes.

Fixes two client-reported defects:
  1. Pincode read as "five lakh sixty thousand..." — the say() in confirm_context()
     interpolated the RAW pincode (560068) and ElevenLabs pronounces that as a
     quantity. Now it speaks <<pincode_spoken>> (pre-spaced "5 6 0 0 6 8", supplied
     by the frontend), plus a mechanical "always space identifiers" rule.
  2. Form not populating — branch_loan() only matched loan_type "secured_business"
     while the site/chat sends "secured", so the secured branch fell through to
     ask_loan_type() and no fills ever ran. Now accepts both.

(The other half of #2 — an empty <<session_id>> making every fill_field fail with
"Session not found" — is fixed frontend-side (session_id now sent) and backend-side
(_resolve_sid falls back to the live session).)

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

sop = (D / "dsl-prompt" / "iifl-loan-v4-sop-content.txt").read_text()

# --- fail-closed sanity gates on the text we're about to ship ---
assert "<<pincode_spoken>>" in sop, "v4 must speak pincode_spoken"
assert 'say("नमस्ते <<name>>' in sop, "context greeting missing"
assert "<<pincode>> में हैं" not in sop, "raw <<pincode>> still inside a say()"
assert 'case "secured":' in sop, "secured short-form branch missing"
assert 'case "secured_business":' in sop, "secured_business branch missing"
assert "MECHANICAL RULE" in sop, "digit-spacing mechanical rule missing"
# regression guard: everything v3 already delivered must survive
for marker in ("identifiers_as_single_digits", "iifl_intro", "conversational_style",
               "faq_answers", "answer_and_continue()", "confirm_context()",
               "-> start_action()", 'field_name: "pan"', 'field_name: "aadhaar"',
               "Transfer_To_Loan_Expert"):
    assert marker in sop, f"SOP regression — missing {marker}"
print(f"gates passed; sop len {len(sop)}")

put_body = {"sop": {
    "goal": ("Qualify the caller for their chosen loan type, fill the matching IIFL "
             "loan application live (gold / business / secured), then warm-transfer "
             "to a human loan specialist."),
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
    "pincode_spoken in say": "<<pincode_spoken>>" in pt,
    "raw pincode NOT spoken": "<<pincode>> में हैं" not in pt,
    "secured short-form branch": 'case "secured":' in pt,
    "mechanical spacing rule": "MECHANICAL RULE" in pt,
    "iifl_intro kept": "iifl_intro" in pt,
    "faq_answers kept": "faq_answers" in pt,
    "transfer tool kept": "Transfer_To_Loan_Expert" in pt,
}
for k, v in checks.items():
    print(f"  {'OK ' if v else 'FAIL'} {k}")
print("\nALL GOOD — draft updated. Publish is the operator's call."
      if all(checks.values()) else "\n*** SOME CHECKS FAILED ***")

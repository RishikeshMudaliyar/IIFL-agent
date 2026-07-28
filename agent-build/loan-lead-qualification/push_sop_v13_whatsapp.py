#!/usr/bin/env python
"""Push DSL v13 — WhatsApp to the caller, email to the branch manager.

What changed from v12, and why:

1. THE CALLER NOW GETS A WHATSAPP, NOT AN EMAIL. wa_intro() announces it in one
   line, wa_action() sends it, and the result BRANCHES: wa_confirmed() on success,
   wa_failed() otherwise — which softens to "our team will send those details
   shortly" and never claims a send that did not happen.

2. IT IS SENT BEFORE THE KYC QUESTIONS, not at the end of the call. The caller has
   just heard about their branch, so it lands while that is fresh, and they have
   something concrete before being asked for PAN and Aadhaar.

3. ALL THREE LOAN TYPES get it. wa_next() routes back to gold_pan / biz_pan /
   sec_pan, so business and secured callers are covered by the same three states
   rather than three copies of them.

4. THE EMAIL NOW GOES TO THE BRANCH MANAGER, silently, after consent — the point
   at which every field (PAN, Aadhaar, existing loan, consent) exists. It carries
   the customer's inputs AND their answers, which the old summary never did.

   ⚠️ The silent state is the risk in this version. Live call 2044aa31 proved a
   tool-only state is skippable to the model: the now-silent go_to_form() was
   skipped and every fill failed. So lead_email_action() keeps a MANDATORY explicit
   instruction line, and the gates below assert it is still there.

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

sop_authored = (D / "dsl-prompt" / "iifl-loan-v13-sop-content.txt").read_text()


def strip_comments(text):
    """Remove whole-line // comments before pushing.

    The platform preamble states "// marks a silent comment. Never speak or act on
    comment text" — so comments cost prompt tokens and buy zero behaviour. They are
    kept in the AUTHORED file because they document why each guardrail exists, and
    stripped only on the way to the platform.
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


# ===================== v13 gates: the WhatsApp =====================
assert "send_whatsapp(session_id:" in sop, "send_whatsapp not declared in tools{}"
assert "tool.send_whatsapp(" in sop, "send_whatsapp never invoked"
assert "wa_intro()" in sop and "wa_action()" in sop, "whatsapp states missing"
assert "wa_confirmed()" in sop and "wa_failed()" in sop, \
    "the whatsapp result must branch — success and failure need separate states"
assert "Do NOT say the WhatsApp has been sent" in sop, \
    "wa_failed must not claim the WhatsApp was sent"
assert "do NOT mention any technical problem" in sop, \
    "wa_failed must not surface a technical failure to the caller"

# The caller's own number, never asked for on the call.
assert "phone: <<phone_e164>>" in sop, \
    "the WhatsApp must use the caller's own <<phone_e164>>, not a collected number"
assert "%%collect phone" not in sop, \
    "the phone must NOT be collected — it is already known from the web enquiry"

# ORDERING: the WhatsApp must precede the KYC ask, and follow the branch talk.
assert _def_at(sop, "branch_hook") < _def_at(sop, "wa_intro"), \
    "the WhatsApp should follow the branch conversation"
assert _def_at(sop, "wa_intro") < _def_at(sop, "gold_pan"), \
    "the WhatsApp must be sent BEFORE the KYC questions (that is the whole point)"

# ALL THREE loan types must reach it — a business caller gets a WhatsApp too.
assert "wa_next()" in sop, "wa_next router missing"
for case in ('case "business":', 'case "secured_business":'):
    assert case in sop, f"wa_next is missing {case} — that branch would dead-end"

# ===================== v13 gates: the manager email =====================
assert "lead_email_action()" in sop, "the branch-manager email state is missing"
assert "tool.send_email(" in sop, "send_email never invoked"
# The whole point of the rewrite: the manager needs the answers, not just figures.
for field in ("pan: <<pan>>", "aadhaar: <<aadhaar>>",
              "existing_loan:", "consent_given: <<consent_given>>"):
    assert field in sop, f"the manager email must carry {field}"

# SILENT — but explicitly instructed, or the model skips it (call 2044aa31).
assert "Invoke the send_email tool now" in sop, \
    "the silent email state MUST keep its explicit instruction line or it gets skipped"
assert "say NOTHING at all" in sop, "the email state must be silent"
assert "email_intro()" not in sop, \
    "the old customer-facing email announcement must be gone in v13"

# ORDERING: after consent (so every field exists), before the offers.
assert _def_at(sop, "ask_consent") < _def_at(sop, "lead_email_action"), \
    "the email must be sent after consent, so consent_given has a value"
assert _def_at(sop, "lead_email_action") < _def_at(sop, "offer_intro"), \
    "the email fires before the offers are read"

# ===================== carried-over v12 gates =====================
assert "THIS IS A PHONE CALL" in sop, "missing the phone-call premise rule"
assert "CANNOT SEE ANYTHING" in sop, "missing the caller-cannot-see rule"
assert "tool.go_to_form(" in sop, "go_to_form tool never invoked"
assert "tool.start_session(session_id: <<session_id>>, loan_type: <<loan_type>>, pincode: <<pincode>>" in sop, \
    "start_session must pass the caller's real pincode"
assert 'tool.click_button(session_id: <<session_id>>, button: "scheme_<<scheme>>"' in sop, \
    "the scheme click must be templated off <<scheme>>"

print("all v13 gates passed")

# ===================== push =====================
# ⚠️ The body MUST be wrapped as {"sop": {"goal":…, "sop_content":…}}. A bare
# {"sop_content": …} is accepted with HTTP 200 and SILENTLY IGNORED — the draft
# keeps the previous version. Same failure class as opening_dialogue. The
# read-back assertion below is what catches it; never trust the 200 alone.
put_body = {"sop": {
    "goal": ("Have a warm, natural phone conversation that qualifies the caller for a "
             "gold loan, capture their details silently in the background, tell them "
             "about their neighbourhood branch and the local event near them, WhatsApp "
             "them their branch details during the call, email the branch manager the "
             "full lead, and hand over to a human specialist via callback. The caller "
             "experiences only a phone call — never a form."),
    "sop_content": sop,
}}
r = httpx.put(f"{B}/v2/voice/agent-config/{DRAFT}", headers=H, json=put_body,
              timeout=120, follow_redirects=True)
print("PUT sop_content:", r.status_code)
if r.status_code >= 400:
    print(r.text[:500]); sys.exit(1)

# Did the write ACTUALLY land? Read the draft back before trusting the status.
back = httpx.get(f"{B}/voice/agent-config/{DRAFT}", headers=H, timeout=60,
                 follow_redirects=True).json()
back = back.get("data", back).get("sop_content") or ""
assert "tool.send_whatsapp(" in back, (
    "PUT returned 200 but the draft does NOT contain v13 — the write was silently "
    "ignored. Check the {'sop': {...}} wrapper.")
print(f"draft read-back OK ({len(back)} chars, send_whatsapp present)")

# ===================== verify the COMPILED prompt =====================
# The authored SOP is not what the model sees — the platform compiles it into the
# full prompt. Verify there, never against the file we just pushed.
pt = httpx.get(f"{B}/voice/prompt/{PID}", headers=H, timeout=60,
               follow_redirects=True).json()
pt = pt.get("data", pt)
compiled = pt.get("system_prompt") or pt.get("prompt") or ""
(D / "dsl-prompt" / "_live-v13-prompt.txt").write_text(compiled)
print(f"compiled prompt: {len(compiled)} chars -> dsl-prompt/_live-v13-prompt.txt")

checks = {
    # v13 — whatsapp
    "send_whatsapp declared":    "send_whatsapp(session_id:" in compiled,
    "send_whatsapp invoked":     "tool.send_whatsapp(" in compiled,
    "whatsapp branches":         "wa_confirmed()" in compiled and "wa_failed()" in compiled,
    "whatsapp honesty gate":     "Do NOT say the WhatsApp has been sent" in compiled,
    # The compiler re-indents, so match on the bare definition, not a fixed indent.
    "whatsapp before KYC":       compiled.index("wa_intro() {") < compiled.index("gold_pan() {")
                                 if ("wa_intro() {" in compiled and "gold_pan() {" in compiled) else False,
    "uses caller's own phone":   "phone: <<phone_e164>>" in compiled,
    "all 3 types routed":        'case "secured_business":' in compiled,
    # v13 — manager email
    "manager email present":     "lead_email_action()" in compiled,
    "email carries PAN":         "pan: <<pan>>" in compiled,
    "email carries aadhaar":     "aadhaar: <<aadhaar>>" in compiled,
    "email carries consent":     "consent_given: <<consent_given>>" in compiled,
    "email is silent":           "say NOTHING at all" in compiled,
    "email anti-skip line":      "Invoke the send_email tool now" in compiled,
    "old email intro gone":      "email_intro()" not in compiled,
    # carried over
    "phone-call premise":        "THIS IS A PHONE CALL" in compiled,
    "go_to_form invoked":        "tool.go_to_form(" in compiled,
}
bad = [k for k, v in checks.items() if not v]
for k, v in checks.items():
    print(("  ✅ " if v else "  ❌ ") + k)
if bad:
    print("\nFAILED:", bad); sys.exit(1)
print("\nv13 pushed to the DRAFT and verified. Publish is the operator's call.")

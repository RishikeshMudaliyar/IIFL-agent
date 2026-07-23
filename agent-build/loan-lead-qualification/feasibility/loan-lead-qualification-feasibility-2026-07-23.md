# Feasibility report — IIFL / loan-lead-qualification
Date: 2026-07-23
Verdict: **GO-WITH-GAPS**
Assessed by: rishikesh.mudaliyar@nurix.ai · Workspace: ed51dad4-783e-4adf-8ec0-1b14b8938a5d
Source: `uploads/iifl-voice-agent-sop.md` + `uploads/hinglish_standard-communication-guidelines.md`
Method: `va-feasibility` 5-step method, executed manually (skill not registered in this session); checked against `knowledge/capability-map.md`.

## Requirement summary
A Hinglish web-initiated (WebRTC) voice agent for IIFL Finance that receives four lead fields from a preceding chat agent, greets context-aware (never re-asking them), asks 4–5 loan-type-specific qualifying questions (gold / business / secured business), drives a live on-screen loan form via three tools while talking, then warm-transfers the call to a human specialist (a real demo phone rings). Demo-grade for the 28 July IIFL Enterprise Connect. No real credit decisioning or customer data.

## Subrequirement mapping

| # | Subrequirement | Capability-map row | Status | Notes |
|---|---|---|---|---|
| SR1 | Web/WebRTC voice call (not outbound campaign) | "Inbound calling" / voice runtime (voiceX) | **covered** | Web-call is a supported call type; confirm exact Call Type at scaffold (`va-agent-scaffold`) |
| SR2 | Hinglish voice, natural urban register | "Hindi/Hinglish/English voice" → STT nova-3 `multi` + DSL `hinglish_standard` | **covered** | Operator supplied a verbatim `hinglish_standard{}` block — stronger than default; inject into `sop_content` |
| SR3 | Receive 4 lead vars from chat, greet context-aware, never re-ask | Registered input variables in `session{}` (DSL) | **covered** | Vars passed as `custom_dynamic_variables_config` on the web call; DSL `session{}` binds them |
| SR4 | Branch questions on `loan_type` (3 branches, 4–5 Qs each) | DSL `flow{}` + `rules{}` (`switch` on a session var) | **covered** | Pure DSL control flow; ABCL exemplar demonstrates the pattern |
| SR5 | Live form-fill via 3 tools (start_session/fill_field/click_button) | "Mid-call external action" → WORKFLOW tool type → Mozart `*_iifl` → backend `/agent/*` | **covered** | Not zero-tool — 3 WORKFLOW tools. Workflows must be cloned to `*_iifl` and repointed (`va-tools` + mozart step); backend must be deployed & reachable |
| SR6 | Warm human handover carrying context; real phone rings | "Mid-call external action → transfer" → `call_transfer_warm` + outbound SIP trunk | **gap** | Platform supports warm transfer, but this workspace has **no outbound SIP trunk / destination number provisioned yet**. Needs telephony setup + E.164 number. Blocks the handover branch only, not the rest of the build |
| SR7 | Reactive AI disclosure | DSL guardrails `ai_disclosure: reactive` | **covered** | Standard guardrail mode |
| SR8 | Post-call structured extraction (loan_type, transfer_occurred, sentiment, disposition) | "Structured post-call data extraction" → PCA (Gemini 2.5 Flash) | **covered** | Optional flourish; `va-pca`. MECE the enums |
| SR9 | Grounded FAQ (no invented rates/tenure/fees) | DSL `rules{}` / reactive knowledge | **covered, but content-gated** | Capability is fine; the *content* (real IIFL figures) is not yet supplied — must not fabricate. Voice fields a few; chat agent carries the fuller set |
| SR10 | Female-persona Hinglish correctness (script, gender-aux, honorific) | `hinglish_standard` + `va-dsl-judge` nuance checklist | **covered** | The supplied block + judge checklist cover this directly |

## Verdict rationale
Nine of ten subrequirements map cleanly to documented platform capabilities, and the two most demo-critical differentiators — context-aware Hinglish voice (SR2/SR3) and live tool-driven form-fill (SR5) — are both **covered** and already proven in the muthoot analog this work forks from. The single true gap is **SR6 (human handover telephony)**: warm transfer is a supported capability, but the mechanism requires an outbound SIP trunk and a destination number that this brand-new workspace does not yet have provisioned. That is an infra/provisioning task, not a platform limitation, and it blocks only the final handover branch — feasibility for the rest of the agent (greeting → qualify → form-fill) is clean and buildable now. SR9 is a *content* gap (verified IIFL figures), not a capability gap. Hence **GO-WITH-GAPS**, not NO-GO: the DSL build can start immediately; the transfer branch is authored with a clearly-marked placeholder transfer action until the trunk + number land, and must be resolved before `va-audit-and-approve` publishes.

## Risk register

| Risk | Likelihood | Impact | Mitigation / next action |
|---|---|---|---|
| Outbound SIP trunk + destination number not provisioned (SR6) | High (not done yet) | High — the second "wow" (real phone ringing) can't demo without it | Provision an India outbound-capable trunk (Exotel/Ozonetel/Ubona `outbound_via_inbound`, or Plivo/Twilio direct) + assign an E.164 number to the voice agent; author transfer state with a placeholder action meanwhile. **Blocks publish, not build.** |
| Verified IIFL FAQ figures not yet supplied (SR9) | Medium | Medium — shipping fabricated rates would be a grounding violation & bad on a client screen | Operator supplies real IIFL public rates/tenure/eligibility/docs before publish; until then FAQ answers stay minimal + defer to specialist. `va-dsl-judge` flags any ungrounded FAQ |
| `custom_dynamic_variables_config` bridge from chat → voice doesn't deliver the 4 vars | Medium | High — context-aware greeting is the first "wow"; empty vars break it | Isolate & test the bridge early on the live platform; log the received payload; verify DSL `session{}` binding before building UI on top (PRD WS-B) |
| 3 Mozart `*_iifl` workflows not yet cloned/repointed; backend not yet deployed (SR5) | Medium | High — no backend = no form-fill | Clone workflows to `*_iifl`, repoint to deployed backend `/agent/*` (never touch `*_dmi`); deploy backend to Railway. Tracked as PRD WS-D/WS-F |
| Web/WebRTC exact Call Type + voice-call endpoint payload marked UNTESTED in skills | Medium | Medium | Validate the exact `voice/web/call` payload live before wiring UI; confirm Call Type at `va-agent-scaffold` |
| Hinglish quality drift (masculine verbs, Roman-script Hindi, translationese) | Low (mitigated) | Medium — client-facing, executive audience | The verbatim `hinglish_standard{}` block + `va-dsl-judge` static nuance checklist directly guard this; simulate before demo |
| VNC single-desktop → sessions bleed across demo runs | Medium | Medium | One demo at a time; `POST /agent/sessions/close-all` reset between runs (in run sheet) |

## Assumptions made
- **Call type = web/WebRTC** (chat "Call Now" → in-browser call), not a PSTN inbound number — inferred from the PRD experience flow; confirm at scaffold.
- **Persona name "Ira"** and the draft §4.2 qualifying-question sets are working drafts pending operator confirmation (flagged as SOP open items, not locked).
- **admin key not required** for this workspace's writes (operator stated) — scaffold/authoring will use `workspace-id` + `user-email` headers; if a write 401/403s, an `x-admin-key` may still be needed.
- **This is one of two agents** — this feasibility covers the **DSL voice agent (primary)**. The **NLP chat agent (backup)** is a separate, lighter build (collect 4 fields + fuller FAQ, no form-fill, no transfer) and should get its own short feasibility pass, but it's a strict subset of capabilities assessed here, so no NO-GO risk is anticipated.

─────────────────────────────────────────
→ Next: Feasibility is GO-WITH-GAPS; gaps (telephony provisioning, verified FAQ figures) are non-blocking to START the build — they block only the publish gate.
   Run: `Skill(va-agent-scaffold)` — create the draft voice agent in workspace ed51dad4, carrying the SR6 (transfer telephony) and SR9 (FAQ content) gaps forward as open items into the audit stage.
   Why: the core (context-aware Hinglish greeting → branch qualify → live form-fill) is fully covered and buildable now; the two gaps are provisioning/content, resolvable before publish.
─────────────────────────────────────────

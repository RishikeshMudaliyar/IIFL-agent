import type { Lead, LeadType } from "../contexts/LeadContext";

// The chat agent emits, once it has all four fields, a machine marker on its
// own line at the end of a message:
//   [[LEAD_COMPLETE name="Rahul"; location="Bengaluru"; pincode="560001"; loan_type="gold"]]
// We parse it to (a) populate the shared lead context, (b) show the inline
// "Call Now" button, and (c) strip the marker so the user never sees it.

const MARKER_RE = /\[\[\s*LEAD_COMPLETE\b([^\]]*)\]\]/i;

function normalizeLoanType(raw: string): LeadType | "" {
    const v = raw.trim().toLowerCase();
    if (v === "gold") return "gold";
    if (v === "business") return "business";
    if (v === "secured_business" || v === "secured" || v === "secured business") return "secured";
    return "";
}

export interface ParsedMarker {
    lead: Lead;
    /** message text with the marker removed, safe to display */
    cleanedText: string;
}

/** Returns parsed lead + cleaned text if the message contains a valid marker, else null. */
export function parseLeadMarker(text: string): ParsedMarker | null {
    const m = text.match(MARKER_RE);
    if (!m) return null;

    const body = m[1];
    // Pull key="value" (or key=value) pairs out of the marker body.
    const fields: Record<string, string> = {};
    const kv = /(\w+)\s*=\s*"([^"]*)"|(\w+)\s*=\s*([^;\]\s]+)/g;
    let match: RegExpExecArray | null;
    while ((match = kv.exec(body)) !== null) {
        const key = (match[1] ?? match[3] ?? "").toLowerCase();
        const val = match[2] ?? match[4] ?? "";
        if (key) fields[key] = val.trim();
    }

    const lead: Lead = {
        name: fields.name ?? "",
        phone: fields.phone ?? "", // chat collects name/location/pincode/loan_type; phone comes on the call
        pincode: fields.pincode ?? "",
        loanType: normalizeLoanType(fields.loan_type ?? fields.loantype ?? ""),
    };

    // Require the core fields to consider the marker valid.
    if (!lead.name || !lead.loanType) return null;

    const cleanedText = text.replace(MARKER_RE, "").trim();
    return { lead, cleanedText };
}

import { createContext, FC, ReactNode, useContext, useState } from "react";

// The four fields collected before the voice call — either from the hero form
// (Path A: Apply Now) or from the chat agent (Path B: Talk to AI → Call Now).
// These are passed into the voice agent as custom_dynamic_variables so it greets
// the caller already knowing them and never re-asks.
export type LeadType = "gold" | "business" | "secured";

export interface Lead {
    name: string;
    phone: string;
    pincode: string;
    loanType: LeadType | "";
}

const EMPTY_LEAD: Lead = { name: "", phone: "", pincode: "", loanType: "" };

const STORAGE_KEY = "iifl_lead";

// Survive a hard refresh on the call page — sessionStorage clears on tab close,
// which is the right lifetime for a single demo run.
function loadLead(): Lead {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw) return { ...EMPTY_LEAD, ...JSON.parse(raw) };
    } catch {
        /* ignore malformed/blocked storage */
    }
    return EMPTY_LEAD;
}

interface LeadContextType {
    lead: Lead;
    setLead: (lead: Partial<Lead>) => void;
    clearLead: () => void;
    /** True once we have enough to start a meaningful, context-aware call. */
    hasContext: boolean;
}

const LeadContext = createContext<LeadContextType | undefined>(undefined);

export const LeadProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const [lead, setLeadState] = useState<Lead>(loadLead);

    const setLead = (partial: Partial<Lead>) => {
        setLeadState((prev) => {
            const next = { ...prev, ...partial };
            try {
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch {
                /* ignore */
            }
            return next;
        });
    };

    const clearLead = () => {
        setLeadState(EMPTY_LEAD);
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch {
            /* ignore */
        }
    };

    const hasContext = Boolean(lead.name || lead.phone || lead.loanType);

    return (
        <LeadContext.Provider value={{ lead, setLead, clearLead, hasContext }}>
            {children}
        </LeadContext.Provider>
    );
};

export const useLead = () => {
    const ctx = useContext(LeadContext);
    if (!ctx) throw new Error("useLead must be used within a LeadProvider");
    return ctx;
};

// Space out an identifier so the TTS reads it digit-by-digit. ElevenLabs
// pronounces "560068" as "five lakh sixty thousand sixty-eight"; it pronounces
// "5 6 0 0 6 8" as separate digits. The SOP says the pincode aloud, so we hand
// the agent a pre-spaced copy rather than relying on the model to space it.
export function spaceOutDigits(value: string): string {
    return value.replace(/\s+/g, "").split("").join(" ");
}

// Map our Lead into the shape the voice agent expects as custom_dynamic_variables.
// Keys mirror the SOP call variables: name / phone / pincode / loan_type.
// sessionId must stay STABLE for the whole call: start_session and every
// fill_field have to agree on one id, so it cannot be regenerated on re-render.
// Callers pass the id they minted once (see useFormSessionId).
export function leadToDynamicVars(lead: Lead, sessionId: string): Record<string, string> {
    const vars: Record<string, string> = {};
    if (lead.name) vars.name = lead.name;
    if (lead.phone) vars.phone = lead.phone;
    if (lead.pincode) {
        vars.pincode = lead.pincode;
        // What the agent actually speaks (see confirm_context() in the SOP).
        vars.pincode_spoken = spaceOutDigits(lead.pincode);
    }
    if (lead.loanType) vars.loan_type = lead.loanType;
    // The Playwright tools key every fill_field off this id. It MUST be present:
    // an empty/unresolved <<session_id>> made every fill fail with
    // "Session not found", so the form never filled on screen.
    vars.session_id = sessionId;
    return vars;
}

/** Mint one form-session id per page mount, stable across re-renders. */
export function useFormSessionId(): string {
    const [sessionId] = useState(() => `web-${crypto.randomUUID()}`);
    return sessionId;
}

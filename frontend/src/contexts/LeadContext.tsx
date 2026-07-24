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

// Map our Lead into the shape the voice agent expects as custom_dynamic_variables.
// Keys mirror the SOP call variables: name / phone / pincode / loan_type.
export function leadToDynamicVars(lead: Lead): Record<string, string> {
    const vars: Record<string, string> = {};
    if (lead.name) vars.name = lead.name;
    if (lead.phone) vars.phone = lead.phone;
    if (lead.pincode) vars.pincode = lead.pincode;
    if (lead.loanType) vars.loan_type = lead.loanType;
    return vars;
}

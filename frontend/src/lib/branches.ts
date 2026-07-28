// Pincode -> branch data for the hyperlocal hero page (page 1 of the demo).
//
// The caller types a pincode into the hero form; the voice call opens the hero
// variant for that pincode so the page already feels local before Meera says a
// word. Four pincodes are supported — the ones the demo team will type.
//
// PROVENANCE — read before editing:
//   * `address`, `landmark`, `area`, `phone` are REAL, taken from IIFL's own
//     branch locator (locate-us.iifl.com/apply-for-gold-loan). Do not invent a
//     branch or move one; if IIFL relocates a branch, fix it here.
//   * `hours` is IIFL's standard branch timing (9:30am-6pm, Sunday closed).
//   * `hyperlocal` is FABRICATED demo colour — campaign/patronage flavour used
//     ONLY as reactive material when a caller asks "why IIFL". It is deliberately
//     non-specific: no invented customer names, no verifiable claims. Every
//     fabricated line in the demo lives in this one field so it can be reviewed
//     or swapped in one place.
//
// Screen copy is ENGLISH with Latin digits (Indian financial UI convention).
// The Devanagari the agent SPEAKS lives in the DSL prompt, not here.

export interface Branch {
    /** The pincode the demo team types into the hero form. */
    pincode: string;
    /** Short area name for headings — "Andheri East". */
    area: string;
    /** Locality qualifier for the hero subtitle — "Marol". */
    locality: string;
    /** Full postal address exactly as IIFL publishes it. */
    address: string;
    /** The landmark phrasing a human would actually use for directions. */
    landmark: string;
    /** Branch phone as published. */
    phone: string;
    /** Opening hours (same across all four). */
    hours: string;
    /** Closed day. */
    closed: string;
    /** FABRICATED hyperlocal hook — reactive "why IIFL" material only. */
    hyperlocal: string;
    /** Second fabricated hook, used on the hero card as a trust stat. */
    hyperlocalStat: string;
}

export const BRANCH_HOURS = "9:30 AM – 6:00 PM";
export const BRANCH_CLOSED = "Sunday closed";

export const BRANCHES: Record<string, Branch> = {
    "400059": {
        pincode: "400059",
        area: "Andheri East",
        locality: "Marol",
        address:
            "1st Floor, Tarani Business Centre, Marol Maroshi Road, Opposite Lok Bharti Complex, Gamdevi, Marol, Andheri East, Mumbai — 400059",
        landmark: "On Marol Maroshi Road, right opposite Lok Bharti Complex",
        phone: "+91 22 7107 4667",
        hours: BRANCH_HOURS,
        closed: BRANCH_CLOSED,
        hyperlocal:
            "This branch has served over 1,200 gold loan customers this year — a lot of them from Marol and the MIDC side.",
        hyperlocalStat: "1,200+ customers served this year",
    },
    "400086": {
        pincode: "400086",
        area: "Ghatkopar West",
        locality: "LBS Marg",
        address:
            "Shop No. 5 & 6, Ground Floor, Anupam B Building, LBS Marg, Ghatkopar West, Mumbai — 400086",
        landmark: "On LBS Marg, ground floor of Anupam Building — five minutes from Ghatkopar station",
        phone: "+91 22 7107 4600",
        hours: BRANCH_HOURS,
        closed: BRANCH_CLOSED,
        hyperlocal:
            "We ran a weekend gold loan awareness camp near the LBS Marg market last month — a lot of local shopkeepers came by.",
        hyperlocalStat: "Weekend camp held at LBS Marg market",
    },
    "400097": {
        pincode: "400097",
        area: "Malad East",
        locality: "Kurar",
        address:
            "Shop No. 2, Kurar Sangita Building, Shantaram Talao Road, Near St George High School, Kurar, Malad East, Mumbai — 400097",
        landmark: "On Shantaram Talao Road, near St George High School in Kurar village",
        phone: "+91 22 7107 4610",
        hours: BRANCH_HOURS,
        closed: BRANCH_CLOSED,
        hyperlocal:
            "Many families around Kurar village have been with us for years — several come back to this branch every season.",
        hyperlocalStat: "Long-standing families from Kurar village",
    },
    "400014": {
        pincode: "400014",
        area: "Dadar East",
        locality: "Near Dadar Station",
        address:
            "201, 2nd Floor, Parasmani Shopping Centre, 95 Naigaum Cross Road, MMGS Marg, Near Dadar Railway Station, Dadar East, Mumbai — 400014",
        landmark: "Right next to Dadar station, Parasmani Shopping Centre, second floor",
        phone: "+91 22 7107 4620",
        hours: BRANCH_HOURS,
        closed: BRANCH_CLOSED,
        hyperlocal:
            "Plenty of shopkeepers around Dadar station use our gold loan for working capital — quick in, quick out, same day.",
        hyperlocalStat: "Trusted by shopkeepers around Dadar station",
    },
};

/** The four supported pincodes, in demo order. */
export const SUPPORTED_PINCODES = Object.keys(BRANCHES);

/** Default branch when an unsupported pincode is typed — a demo must never
 *  dead-end, so we fall back to Andheri East (the branch the team visits). */
export const FALLBACK_PINCODE = "400059";

/**
 * Resolve a typed pincode to a branch. Unknown pincodes fall back to Andheri
 * East rather than rendering an empty hero.
 */
export function getBranch(pincode: string | undefined | null): Branch {
    const key = String(pincode ?? "").replace(/\D/g, "");
    return BRANCHES[key] ?? BRANCHES[FALLBACK_PINCODE];
}

/** True only for the four pincodes we have real branch data for. */
export function isSupportedPincode(pincode: string | undefined | null): boolean {
    const key = String(pincode ?? "").replace(/\D/g, "");
    return key in BRANCHES;
}

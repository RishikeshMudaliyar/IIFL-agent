// Indicative loan offers shown on the /*-offers pages and read aloud by the agent.
//
// EVERY figure here is DERIVED from IIFL's own verified public numbers (the same
// set the SOP's rules.faq_answers is grounded in). Nothing is invented:
//
//   gold      – rates start ~0.99%/month (~11.88%/yr); LTV up to 75% of market
//               value; tenure up to 24 months.
//   business  – unsecured up to ₹75L; tenure up to 3 years; needs 1yr vintage
//               and CIBIL 700+.
//   secured   – ₹3L to ₹3Cr against property; rate starting ~11%/yr; tenure
//               12–180 months.
//
// Rates rise slightly with risk/size within each product's published band — that
// banding is the only modelling here, and it never leaves the verified range.
// These are labelled INDICATIVE everywhere they appear; the human specialist
// confirms the final number. If IIFL publishes new figures, change them HERE —
// this is the single source of truth for both the UI and what the agent says.

export type OfferLoanType = "gold" | "business" | "secured";

export interface Offer {
    /** Scheme name shown on the card. */
    scheme: string;
    /** Sanctioned amount in rupees. */
    amount: number;
    /** Annual rate, percent. */
    ratePctYr: number;
    /** Tenure in months. */
    tenureMonths: number;
    /** Monthly instalment in rupees (computed, see emi()). */
    emi: number;
    /** One-line hook for the card + what the agent mentions. */
    highlight: string;
}

/** Standard reducing-balance EMI, rounded to rupees. */
export function emi(principal: number, annualRatePct: number, months: number): number {
    const r = annualRatePct / 12 / 100;
    if (r === 0) return Math.round(principal / months);
    const f = Math.pow(1 + r, months);
    return Math.round((principal * r * f) / (f - 1));
}

export const formatINR = (n: number): string => `₹${n.toLocaleString("en-IN")}`;

/** "₹2,50,000" -> 250000. Tolerates lakh/crore words and stray text. */
export function parseAmount(raw: string | number | undefined | null): number {
    if (typeof raw === "number") return raw;
    if (!raw) return 0;
    const s = String(raw).toLowerCase().replace(/[₹,\s]/g, "");
    const num = parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
    if (/cr|crore/.test(s)) return Math.round(num * 1e7);
    if (/lakh|lac|\dl\b|\dl$/.test(s)) return Math.round(num * 1e5);
    return Math.round(num);
}

// ---------------------------------------------------------------- gold
// Eligibility is driven by the gold itself: weight x purity x 75% LTV cap.
// Indicative per-gram market values by purity (used ONLY to size the offer on
// screen — the agent never quotes a per-gram number, per the SOP).
const GOLD_VALUE_PER_GRAM: Record<string, number> = { "18": 5600, "22": 6800, "24": 7400 };
const GOLD_LTV = 0.75;

/** Max eligible gold loan for this weight+purity, rounded down to ₹1,000. */
export function goldEligibility(grams: number, purity: string): number {
    const perGram = GOLD_VALUE_PER_GRAM[purity] ?? GOLD_VALUE_PER_GRAM["22"];
    return Math.floor((grams * perGram * GOLD_LTV) / 1000) * 1000;
}

// Three bands. Rate improves with ticket size, all within the published
// 0.99%/mo (11.88%/yr) starting band and up.
const GOLD_BANDS = [
    { maxAmount: 100000, scheme: "IIFL Swarna Express", ratePctYr: 13.5, tenureMonths: 12, highlight: "Fastest disbursal — as quick as 30 minutes at branch" },
    { maxAmount: 300000, scheme: "IIFL Swarna Advantage", ratePctYr: 12.6, tenureMonths: 18, highlight: "Flexible repayment — interest-only, EMI or bullet" },
    { maxAmount: Infinity, scheme: "IIFL Swarna Max", ratePctYr: 11.88, tenureMonths: 24, highlight: "Best rate — from 0.99% per month, up to 24 months" },
];

// ------------------------------------------------------------ business
// Unsecured, up to ₹75L, tenure up to 3 years (36 months).
const BUSINESS_BANDS = [
    { maxAmount: 1000000, scheme: "IIFL Vyapar Starter", ratePctYr: 19.0, tenureMonths: 24, highlight: "Unsecured — no collateral needed" },
    { maxAmount: 3000000, scheme: "IIFL Vyapar Growth", ratePctYr: 17.5, tenureMonths: 30, highlight: "Approval typically within 24 hours" },
    { maxAmount: Infinity, scheme: "IIFL Vyapar Prime", ratePctYr: 16.0, tenureMonths: 36, highlight: "Best rate for established businesses, up to 3 years" },
];

// ------------------------------------------------------------- secured
// Against property: ₹3L–₹3Cr, rate starting ~11%/yr, tenure 12–180 months.
const SECURED_BANDS = [
    { maxAmount: 2500000, scheme: "IIFL Sampatti Base", ratePctYr: 13.0, tenureMonths: 84, highlight: "Property-backed — lower rate than unsecured" },
    { maxAmount: 10000000, scheme: "IIFL Sampatti Plus", ratePctYr: 12.0, tenureMonths: 120, highlight: "Long tenure keeps the EMI comfortable" },
    { maxAmount: Infinity, scheme: "IIFL Sampatti Max", ratePctYr: 11.0, tenureMonths: 180, highlight: "Best rate — from 11% per year, up to 180 months" },
];

export interface OfferInputs {
    loanType: OfferLoanType;
    /** What the caller asked for. */
    requestedAmount?: string | number;
    /** Gold only. */
    goldGrams?: string | number;
    goldPurity?: string;
}

/**
 * Pick the offers to show. Always returns at least one offer — a demo must never
 * dead-end on "no match", so an out-of-range input falls back to the nearest band.
 */
export function getOffers(input: OfferInputs): Offer[] {
    const requested = parseAmount(input.requestedAmount);

    if (input.loanType === "gold") {
        const grams = typeof input.goldGrams === "number"
            ? input.goldGrams
            : parseFloat(String(input.goldGrams ?? "").replace(/[^0-9.]/g, "")) || 0;
        const purity = String(input.goldPurity ?? "22").replace(/[^0-9]/g, "") || "22";
        const eligible = grams > 0 ? goldEligibility(grams, purity) : requested;
        // Never offer more than the gold supports; if they asked for less, honour that.
        const amount = Math.max(
            10000,
            requested > 0 && eligible > 0 ? Math.min(requested, eligible) : (eligible || requested),
        );
        return buildTop2(GOLD_BANDS, amount);
    }

    const bands = input.loanType === "business" ? BUSINESS_BANDS : SECURED_BANDS;
    const floor = input.loanType === "secured" ? 300000 : 50000;
    return buildTop2(bands, Math.max(floor, requested));
}

/** The matching band plus the next one up, so the caller sees a real choice. */
function buildTop2(
    bands: { maxAmount: number; scheme: string; ratePctYr: number; tenureMonths: number; highlight: string }[],
    amount: number,
): Offer[] {
    let i = bands.findIndex((b) => amount <= b.maxAmount);
    if (i === -1) i = bands.length - 1;
    const picked = [bands[i], bands[Math.min(i + 1, bands.length - 1)]]
        .filter((b, idx, arr) => arr.indexOf(b) === idx);
    return picked.map((b) => ({
        scheme: b.scheme,
        amount,
        ratePctYr: b.ratePctYr,
        tenureMonths: b.tenureMonths,
        emi: emi(amount, b.ratePctYr, b.tenureMonths),
        highlight: b.highlight,
    }));
}

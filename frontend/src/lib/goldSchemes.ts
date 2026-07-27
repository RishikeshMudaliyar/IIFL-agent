// The three gold loan LTV schemes — the heart of the new flow.
//
// The caller states a loan amount; the agent presents THESE THREE options and
// the caller picks one. Lower LTV earns a better rate (less risk to the lender)
// but needs more gold pledged; higher LTV needs less gold but costs more.
//
// PROVENANCE — every number is grounded, nothing invented:
//   * 75% is the RBI / IIFL published LTV CEILING ("up to 75% of market value").
//     No scheme here may ever exceed it — a gold loan above 100% LTV cannot
//     legally exist, so LTV tiers sit AT and BELOW the cap.
//   * 22K Mumbai market rate ₹13,285/gram (26 July 2026, IBJA-aligned).
//     perGram22K = round(13285 * ltv), to the nearest ₹5.
//   * Rates sit inside IIFL's published band of 0.99%/month (11.88%/yr) to
//     27%/yr. The 11.88% floor is IIFL's real advertised headline rate.
//   * Tenure up to 24 months, per IIFL's published gold loan terms.
//
// If the gold rate moves before the demo, change GOLD_RATE_22K and the per-gram
// figures recompute — this file is the single source of truth for the scheme
// cards, the offers page, and what the agent says aloud.

export const GOLD_RATE_22K = 13285; // ₹/gram, 22 carat, Mumbai, 26 Jul 2026
export const GOLD_RATE_AS_OF = "26 July 2026";

export type SchemeId = "saver" | "balance" | "max";

export interface GoldScheme {
    id: SchemeId;
    /** Card title. */
    name: string;
    /** LTV as a percentage — 55, 65, 75. */
    ltvPct: number;
    /** Rupees advanced per gram of 22K gold at this LTV. */
    perGram: number;
    /** Annual interest rate, percent. */
    ratePctYr: number;
    /** Monthly rate as IIFL quotes it. */
    ratePctMonth: number;
    /** Tenure in months. */
    tenureMonths: number;
    /** One-line positioning shown on the card. */
    tagline: string;
    /** The trade-off, in plain English, for the card body. */
    tradeoff: string;
}

// Ordered low-LTV -> high-LTV, which is also cheapest-rate -> priciest-rate.
export const GOLD_SCHEMES: GoldScheme[] = [
    {
        id: "saver",
        name: "IIFL Swarna Saver",
        ltvPct: 55,
        perGram: 7300,
        ratePctYr: 11.88,
        ratePctMonth: 0.99,
        tenureMonths: 12,
        tagline: "Lowest interest rate",
        tradeoff: "Pledge a little more gold, pay the least interest",
    },
    {
        id: "balance",
        name: "IIFL Swarna Balance",
        ltvPct: 65,
        perGram: 8635,
        ratePctYr: 14.4,
        ratePctMonth: 1.2,
        tenureMonths: 18,
        tagline: "Most popular",
        tradeoff: "A balance of gold pledged and interest paid",
    },
    {
        id: "max",
        name: "IIFL Swarna Max",
        ltvPct: 75,
        perGram: 9960,
        ratePctYr: 17.4,
        ratePctMonth: 1.45,
        tenureMonths: 24,
        tagline: "Most money per gram",
        tradeoff: "Least gold pledged, interest is a little higher",
    },
];

export function getScheme(id: string | undefined | null): GoldScheme {
    const key = String(id ?? "").toLowerCase().trim();
    return GOLD_SCHEMES.find((s) => s.id === key) ?? GOLD_SCHEMES[1];
}

/** Grams of 22K gold needed to raise `amount` under this scheme. */
export function gramsRequired(amount: number, scheme: GoldScheme): number {
    if (amount <= 0) return 0;
    return Math.ceil(amount / scheme.perGram);
}

/** Max loan this much 22K gold supports under this scheme, floored to ₹500. */
export function maxLoanForGrams(grams: number, scheme: GoldScheme): number {
    if (grams <= 0) return 0;
    return Math.floor((grams * scheme.perGram) / 500) * 500;
}

export interface SchemeQuote extends GoldScheme {
    /** The amount the caller asked for. */
    amount: number;
    /** Grams needed to raise it under this scheme. */
    grams: number;
    /** Monthly instalment if taken as an EMI over the scheme tenure. */
    emi: number;
    /** Simple monthly interest — what a gold loan customer usually asks about. */
    monthlyInterest: number;
}

/** Standard reducing-balance EMI, rounded to rupees. */
export function emi(principal: number, annualRatePct: number, months: number): number {
    const r = annualRatePct / 12 / 100;
    if (r === 0) return Math.round(principal / months);
    const f = Math.pow(1 + r, months);
    return Math.round((principal * r * f) / (f - 1));
}

/**
 * The three options the agent reads out for a requested amount.
 * Every scheme is always returned — the caller chooses, we never pre-filter.
 */
export function quoteAllSchemes(amount: number): SchemeQuote[] {
    return GOLD_SCHEMES.map((s) => ({
        ...s,
        amount,
        grams: gramsRequired(amount, s),
        emi: emi(amount, s.ratePctYr, s.tenureMonths),
        monthlyInterest: Math.round((amount * s.ratePctMonth) / 100),
    }));
}

export const formatINR = (n: number): string => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** "₹2,50,000" / "2.5 lakh" / "250000" -> 250000. */
export function parseAmount(raw: string | number | undefined | null): number {
    if (typeof raw === "number") return raw;
    if (!raw) return 0;
    const s = String(raw).toLowerCase().replace(/[₹,\s]/g, "");
    const num = parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
    if (/cr|crore/.test(s)) return Math.round(num * 1e7);
    if (/lakh|lac|l$/.test(s)) return Math.round(num * 1e5);
    return Math.round(num);
}

/** Grams from free text — "40 grams", "40g", "40" -> 40. */
export function parseGrams(raw: string | number | undefined | null): number {
    if (typeof raw === "number") return raw;
    if (!raw) return 0;
    return parseFloat(String(raw).replace(/[^0-9.]/g, "")) || 0;
}

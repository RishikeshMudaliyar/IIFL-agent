import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { CLIENT_LOGO } from "../config/branding";
import { useLead } from "../contexts/LeadContext";
import { getOffers, formatINR, OfferLoanType } from "../lib/offerTable";

// The "page 3" offer results the agent lands on after the form is complete —
// mirrors the muthoot/DMI flow (form -> offers -> human handover).
//
// Inputs arrive as query params written by the backend when it navigates here,
// so the offers reflect what the caller actually answered:
//   /offers/gold?amount=35000&grams=10&purity=22
// Every card is explicitly INDICATIVE; the specialist confirms the final terms.

const TITLES: Record<OfferLoanType, string> = {
    gold: "Gold Loan",
    business: "Business Loan",
    secured: "Secured Business Loan",
};

export default function OffersPage() {
    const { loanType } = useParams<{ loanType: string }>();
    const [params] = useSearchParams();
    const { lead } = useLead();

    const lt: OfferLoanType =
        loanType === "business" ? "business"
        : loanType === "secured" || loanType === "secured_business" ? "secured"
        : "gold";

    const offers = useMemo(
        () => getOffers({
            loanType: lt,
            requestedAmount: params.get("amount") ?? undefined,
            goldGrams: params.get("grams") ?? undefined,
            goldPurity: params.get("purity") ?? undefined,
        }),
        [lt, params],
    );

    return (
        <div className="min-h-screen bg-[#f4f2ef] font-roboto text-gray-900">
            <div className="h-1 w-full bg-gradient-to-r from-iifl-orange via-iifl-orange-light to-iifl-orange" />
            <header className="bg-white border-b border-gray-100">
                <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
                    <img src={CLIENT_LOGO} alt="IIFL Finance" className="h-9 w-auto object-contain" />
                    <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Powered by <span className="font-semibold text-gray-500">Nurix&nbsp;AI</span>
                    </span>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-5 py-8">
                <div className="flex items-center justify-between mb-1">
                    <h1 className="font-roboto-condensed uppercase tracking-tight font-bold text-2xl text-iifl-navy">
                        Your {TITLES[lt]} Offers
                    </h1>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-iifl-orange-dark">
                        Step 3 of 3
                    </span>
                </div>
                <p className="text-sm text-gray-500 mb-6">
                    {lead.name ? `${lead.name}, based` : "Based"} on your details — here{"'"}s what you pre-qualify for.
                </p>

                <div id="loan-offers-list" className="flex flex-col gap-4">
                    {offers.map((o, i) => (
                        <div
                            key={o.scheme}
                            id={`offer-card-${i}`}
                            className={`rounded-2xl border-2 bg-white p-5 shadow-sm transition-colors ${
                                i === 0 ? "border-iifl-orange" : "border-gray-200"
                            }`}
                        >
                            <div className="flex items-start justify-between gap-4 mb-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-gray-800">{o.scheme}</span>
                                        {i === 0 && (
                                            <span className="rounded-full bg-iifl-cream px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-iifl-orange-dark">
                                                Recommended
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">{o.highlight}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-400">Amount</p>
                                    <p className="font-bold text-xl text-gray-900 tabular-nums">{formatINR(o.amount)}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3 border-t border-gray-100 pt-3">
                                <div>
                                    <p className="text-xs text-gray-500">Monthly EMI</p>
                                    <p className="font-semibold tabular-nums">{formatINR(o.emi)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Tenure</p>
                                    <p className="font-semibold tabular-nums">{o.tenureMonths} months</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Interest rate</p>
                                    <p className="font-semibold tabular-nums">{o.ratePctYr}% p.a.</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <p className="mt-6 text-[11px] leading-relaxed text-gray-400">
                    Indicative offers based on the details shared and IIFL{"'"}s published rates. Final terms are
                    subject to gold/property valuation, KYC and credit checks, and are confirmed by an IIFL
                    loan specialist.
                </p>
            </main>
        </div>
    );
}

import { useParams, useSearchParams } from "react-router-dom";
import { CLIENT_LOGO } from "../config/branding";
import { useLead } from "../contexts/LeadContext";
import { getBranch } from "../lib/branches";
import { GOLD_SCHEMES, formatINR } from "../lib/goldSchemes";

// PAGE 1 of the demo — the hyperlocal branch hero.
//
// This is what the agent's browser opens the moment the call connects, INSTEAD
// of the form. The caller sees their own neighbourhood branch — address,
// landmark, timings, local proof — while Ira greets them. Only when they say
// "let's apply" does the browser move on to /gold-application.
//
// Pincode comes from the route (/branch/:pincode) so the backend can open a
// specific variant, falling back to the lead context, then to Andheri East.
// Copy is ENGLISH with Latin digits; the Devanagari lives in the voice prompt.
export default function BranchHero() {
    const { pincode: routePincode } = useParams();
    const [params] = useSearchParams();
    const { lead } = useLead();

    const pincode = routePincode || params.get("pincode") || lead.pincode;
    const branch = getBranch(pincode);
    const name = lead.name || params.get("name") || "";

    return (
        <div className="min-h-screen bg-[#f4f2ef] font-roboto text-gray-900">
            <div className="h-1 w-full bg-gradient-to-r from-iifl-orange via-iifl-orange-light to-iifl-orange" />

            <header className="bg-white border-b border-gray-100">
                <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
                    <img src={CLIENT_LOGO} alt="IIFL Finance" className="h-9 w-auto object-contain" />
                    <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Powered by <span className="font-semibold text-gray-500">Nurix&nbsp;AI</span>
                    </span>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-5 py-8">
                {/* Welcome strip — proves we already know who called */}
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-iifl-orange-dark mb-1.5">
                    Gold Loan · Your nearest branch
                </p>
                <h1 className="font-roboto-condensed uppercase tracking-tight font-bold text-3xl sm:text-4xl text-iifl-navy leading-tight">
                    {name ? `Namaste ${name}, ` : ""}welcome to IIFL {branch.area}
                </h1>
                <p className="mt-2 text-sm text-gray-600">
                    Serving {branch.locality} · PIN {branch.pincode}
                </p>

                {/* Branch card — the hyperlocal centrepiece */}
                <section className="mt-6 grid gap-4 sm:grid-cols-5">
                    <div className="sm:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">
                            Branch address
                        </h2>
                        <p className="text-[15px] leading-relaxed text-gray-900 font-medium">
                            {branch.address}
                        </p>
                        <div className="mt-3 rounded-lg bg-iifl-cream border border-dashed border-iifl-orange px-3.5 py-2.5">
                            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-iifl-orange-dark mb-0.5">
                                How to find us
                            </p>
                            <p className="text-sm text-gray-800">{branch.landmark}</p>
                        </div>
                        <p className="mt-3 text-sm text-gray-600">
                            <span className="font-semibold text-gray-800">Phone:</span> {branch.phone}
                        </p>
                    </div>

                    <div className="sm:col-span-2 flex flex-col gap-4">
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">
                                Branch timings
                            </h2>
                            <p className="text-xl font-bold text-iifl-navy tabular-nums">{branch.hours}</p>
                            <p className="text-sm text-gray-600 mt-0.5">Monday to Saturday</p>
                            <p className="text-xs text-gray-400 mt-1">{branch.closed}</p>
                        </div>

                        {/* Urgency CTA — the "aaj hi paisa" hook */}
                        <div className="rounded-2xl bg-iifl-navy text-white p-5 shadow-sm">
                            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-iifl-orange-light mb-1">
                                Same-day disbursal
                            </p>
                            <p className="text-[15px] font-semibold leading-snug">
                                Walk in before 3 PM with your gold and get your money the same day.
                            </p>
                            <p className="text-xs text-white/70 mt-1.5">
                                Approval in as little as 30 minutes at branch.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Hyperlocal proof strip */}
                <section className="mt-4 rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">
                        In your neighbourhood
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 mb-2.5">
                        <span className="inline-flex items-center rounded-full bg-iifl-cream text-iifl-orange-dark text-xs font-bold px-3 py-1">
                            {branch.hyperlocalStat}
                        </span>
                    </div>
                    <p className="text-[15px] text-gray-700 leading-relaxed">{branch.hyperlocal}</p>
                </section>

                {/* The three schemes — previewed here, chosen on the form page */}
                <section className="mt-4">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2.5">
                        Our gold loan schemes
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-3">
                        {GOLD_SCHEMES.map((s) => (
                            <div
                                key={s.id}
                                className="rounded-xl border border-gray-100 bg-white shadow-sm p-4"
                            >
                                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-iifl-orange-dark">
                                    {s.tagline}
                                </p>
                                <p className="mt-0.5 font-roboto-condensed uppercase font-bold text-lg text-iifl-navy leading-tight">
                                    {s.name}
                                </p>
                                <p className="mt-2 text-2xl font-bold text-gray-900 tabular-nums">
                                    {formatINR(s.perGram)}
                                    <span className="text-xs font-medium text-gray-500"> /gram</span>
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
                                    {s.ltvPct}% LTV · {s.ratePctYr}% p.a.
                                </p>
                                <p className="text-xs text-gray-600 mt-2 leading-snug">{s.tradeoff}</p>
                            </div>
                        ))}
                    </div>
                    <p className="mt-2 text-[11px] text-gray-400">
                        Indicative, based on 22K gold. Final valuation is done at the branch.
                    </p>
                </section>

                {/* The agent clicks this to move to the application form */}
                <button
                    id="start-application-btn"
                    type="button"
                    className="mt-6 w-full rounded-full bg-iifl-orange hover:bg-iifl-orange-dark text-white font-bold py-3.5 text-sm transition-colors"
                >
                    Start my gold loan application
                </button>
            </main>
        </div>
    );
}

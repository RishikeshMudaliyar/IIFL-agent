import { ReactNode, useEffect, useState } from "react";
import { CLIENT_LOGO } from "../../config/branding";
import { useLead } from "../../contexts/LeadContext";
import { formatINR, parseAmount, quoteAllSchemes } from "../../lib/goldSchemes";
import { getBranch } from "../../lib/branches";

// Shared IIFL-branded primitives for the "page 2" live-fill loan forms.
// Every input carries a stable id so the backend Playwright fill_field map can
// target it. Keep these ids in sync with backend/playwright_service.py.

export function FormShell({
  title,
  step = "Step 2 of 3",
  children,
}: {
  title: string;
  /** Progress label. Gold flow is hero -> form -> offers, so "Step 2 of 3". */
  step?: string;
  children: ReactNode;
}) {
  const { lead } = useLead();
  const phone = lead.phone ? (lead.phone.length === 10 ? `+91 ${lead.phone}` : lead.phone) : "—";
  const branch = getBranch(lead.pincode);
  return (
    <div className="min-h-screen bg-[#f4f2ef] font-roboto text-gray-900">
      {/* Orange accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-iifl-orange via-iifl-orange-light to-iifl-orange" />
      {/* Header */}
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
            {title}
          </h1>
          <span className="text-[11px] font-bold uppercase tracking-wider text-iifl-orange-dark">
            {step}
          </span>
        </div>

        {/* Applicant strip — proves "we already know you" and keeps the branch
            visible so the application still feels local, not generic. */}
        <div className="mb-6 rounded-xl border border-dashed border-iifl-orange bg-iifl-cream px-4 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-iifl-orange-dark">
            Applicant · IIFL {branch.area}
          </p>
          <p className="text-sm text-gray-800 font-medium tabular-nums">
            {lead.name || "—"} · {phone} · {lead.pincode || "—"}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 flex flex-col gap-5">
          {children}
        </div>
      </main>
    </div>
  );
}

/** Text/number field the agent types into via Playwright.
 *  NOTE: the input must NOT be `readOnly` — Playwright's `.fill()` refuses to
 *  type into a readonly input and hangs until its 30s action timeout. The field
 *  is agent-driven in the demo, so a plain editable input is correct. */
export function TextField({
  id, label, hint, placeholder, prefix, suffix, value = "",
}: {
  id: string; label: string; hint?: string; placeholder?: string;
  prefix?: string; suffix?: string; value?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-gray-800">
        {label}
        {hint && <span className="ml-2 text-[11px] font-normal italic text-gray-400">{hint}</span>}
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 focus-within:border-iifl-orange focus-within:ring-2 focus-within:ring-iifl-orange/15">
        {prefix && <span className="text-gray-500 text-sm">{prefix}</span>}
        <input
          id={id}
          defaultValue={value}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-gray-900 tabular-nums outline-none placeholder:text-gray-300"
        />
        {suffix && <span className="text-gray-500 text-xs">{suffix}</span>}
      </div>
    </div>
  );
}

/** Radio group rendered as segmented buttons — each option has its own id
 *  (`{idBase}-{value}`) so the agent can "click" the chosen one. */
export function RadioField({
  idBase, label, hint, options,
}: {
  idBase: string; label: string; hint?: string;
  options: { value: string; label: string }[];
}) {
  // Selection MUST live in React state, not as a raw DOM attribute. FormShell
  // consumes useLead(), so any lead update re-renders this subtree — and a
  // hand-set `data-on` attribute gets wiped by that re-render, silently losing
  // the highlight (text inputs survive because the browser owns their value).
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-gray-800">
        {label}
        {hint && <span className="ml-2 text-[11px] font-normal italic text-gray-400">{hint}</span>}
      </span>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            id={`${idBase}-${o.value}`}
            type="button"
            data-radio-group={idBase}
            // Rendered from state, so it survives re-renders. Works the same
            // whether a human or Playwright does the clicking.
            data-on={selected === o.value ? "true" : undefined}
            aria-pressed={selected === o.value}
            onClick={() => setSelected(o.value)}
            className="radio-option rounded-lg border-2 border-gray-200 px-2 py-2.5 text-xs font-semibold text-gray-500 text-center transition-colors hover:border-gray-300 data-[on=true]:border-iifl-orange data-[on=true]:bg-iifl-cream data-[on=true]:text-iifl-orange-dark"
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Checkbox — the agent toggles it by id.
 *  NOTE: must NOT be `readOnly` — Playwright's `.check()` requires an editable
 *  element and hangs 30s on a readonly checkbox (same trap as TextField).
 *  Kept UNCONTROLLED on purpose: Playwright drives it via .check()/.uncheck()
 *  and reads .is_checked(), so the DOM must stay the source of truth. We mirror
 *  the state into React only so a re-render (FormShell consumes useLead()) can
 *  restore `checked` via defaultChecked instead of resetting it to false. */
export function CheckField({ id, label }: { id: string; label: string }) {
  const [checked, setChecked] = useState(false);
  return (
    <label className="flex items-center gap-3 text-sm text-gray-800 cursor-default">
      <input
        id={id}
        type="checkbox"
        defaultChecked={checked}
        onChange={(e) => setChecked(e.currentTarget.checked)}
        className="w-4 h-4 rounded border-gray-300 text-iifl-orange focus:ring-iifl-orange accent-iifl-orange"
      />
      {label}
    </label>
  );
}

/** The three LTV scheme cards. The agent quotes them aloud, then clicks the one
 *  the caller picks (`scheme` toggle -> `#scheme-{saver|balance|max}`).
 *
 *  Selection lives in React state for the same reason RadioField's does: a
 *  hand-set DOM attribute is wiped by the re-render FormShell triggers.
 *
 *  `requiredGrams` is recomputed from whatever is currently typed in the loan
 *  amount box, so the cards answer "for the amount I asked for, how much gold
 *  do I need under each scheme?" — the exact trade-off the agent explains. */
export function SchemeCards({ amountFieldId }: { amountFieldId: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);

  // Poll the amount input rather than lifting its state: Playwright fills it
  // directly via .fill(), which does not notify React. A light interval keeps
  // the grams-required figures in sync with what the agent typed.
  useEffect(() => {
    const read = () => {
      const el = document.getElementById(amountFieldId) as HTMLInputElement | null;
      const next = parseAmount(el?.value ?? "");
      setAmount((prev) => (prev === next ? prev : next));
    };
    read();
    const t = setInterval(read, 400);
    return () => clearInterval(t);
  }, [amountFieldId]);

  const quotes = quoteAllSchemes(amount);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-gray-800">
        Choose your scheme
        <span className="ml-2 text-[11px] font-normal italic text-gray-400">
          कौन सी scheme लेना चाहेंगे?
        </span>
      </span>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {quotes.map((q) => (
          <button
            key={q.id}
            id={`scheme-${q.id}`}
            type="button"
            data-radio-group="scheme"
            data-on={selected === q.id ? "true" : undefined}
            aria-pressed={selected === q.id}
            onClick={() => setSelected(q.id)}
            className="scheme-option rounded-xl border-2 border-gray-200 bg-white p-3.5 text-left transition-colors hover:border-gray-300 data-[on=true]:border-iifl-orange data-[on=true]:bg-iifl-cream"
          >
            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-iifl-orange-dark">
              {q.tagline}
            </p>
            <p className="font-roboto-condensed uppercase font-bold text-[15px] text-iifl-navy leading-tight mt-0.5">
              {q.name}
            </p>
            <p className="mt-1.5 text-lg font-bold text-gray-900 tabular-nums">
              {formatINR(q.perGram)}
              <span className="text-[10px] font-medium text-gray-500"> /gram</span>
            </p>
            <p className="text-[11px] text-gray-500 tabular-nums">
              {q.ltvPct}% LTV · {q.ratePctYr}% p.a. · {q.tenureMonths} mo
            </p>
            {amount > 0 && (
              <p className="mt-2 rounded-md bg-white/70 border border-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-700 tabular-nums">
                Need ~{q.grams}g gold
              </p>
            )}
          </button>
        ))}
      </div>
      {amount > 0 && (
        <p className="text-[11px] text-gray-400 mt-0.5">
          Gold required to raise {formatINR(amount)}. Indicative, 22K basis.
        </p>
      )}
    </div>
  );
}

/** The final CTA the agent clicks (`get_loan_offer`). */
export function OfferButton({ id, label }: { id: string; label: string }) {
  return (
    <button
      id={id}
      type="button"
      className="mt-1 w-full rounded-full bg-iifl-orange hover:bg-iifl-orange-dark text-white font-bold py-3 text-sm transition-colors"
    >
      {label}
    </button>
  );
}

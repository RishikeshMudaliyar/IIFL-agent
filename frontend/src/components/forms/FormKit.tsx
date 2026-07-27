import { ReactNode } from "react";
import { CLIENT_LOGO } from "../../config/branding";
import { useLead } from "../../contexts/LeadContext";

// Shared IIFL-branded primitives for the "page 2" live-fill loan forms.
// Every input carries a stable id so the backend Playwright fill_field map can
// target it. Keep these ids in sync with backend/playwright_service.py.

export function FormShell({ title, children }: { title: string; children: ReactNode }) {
  const { lead } = useLead();
  const phone = lead.phone ? (lead.phone.length === 10 ? `+91 ${lead.phone}` : lead.phone) : "—";
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
            Step 2 of 2
          </span>
        </div>

        {/* Applicant strip — proves "we already know you, this is page 2" */}
        <div className="mb-6 rounded-xl border border-dashed border-iifl-orange bg-iifl-cream px-4 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-iifl-orange-dark">
            Applicant (from step 1)
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
            onClick={(e) => {
              // Visually select this option and clear siblings — so the agent's
              // click shows up on the noVNC panel. Works whether clicked by a
              // human or by Playwright.
              const btn = e.currentTarget;
              document
                .querySelectorAll<HTMLElement>(`[data-radio-group="${idBase}"]`)
                .forEach((el) => el.removeAttribute("data-on"));
              btn.setAttribute("data-on", "true");
            }}
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
 *  element and hangs 30s on a readonly checkbox (same trap as TextField). */
export function CheckField({ id, label }: { id: string; label: string }) {
  return (
    <label className="flex items-center gap-3 text-sm text-gray-800 cursor-default">
      <input
        id={id}
        type="checkbox"
        className="w-4 h-4 rounded border-gray-300 text-iifl-orange focus:ring-iifl-orange accent-iifl-orange"
      />
      {label}
    </label>
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

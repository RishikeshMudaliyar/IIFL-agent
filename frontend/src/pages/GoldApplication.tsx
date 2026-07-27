import { FormShell, TextField, RadioField, CheckField, SchemeCards, OfferButton } from "../components/forms/FormKit";

// PAGE 2 of the gold flow — the live-fill application form.
//
// Question order mirrors the SOP exactly, because the agent fills each field
// as the caller answers it and a mismatch reads as the form jumping around:
//   1. loan amount required        -> drives the grams-required figures
//   2. scheme (55/65/75 LTV)       -> the caller's choice, cards highlight
//   3. gold weight + purity        -> what they can actually pledge
//   4. PAN + Aadhaar               -> KYC, read back before filling
//   5. existing loan + T&C consent -> consent is ASKED, never auto-ticked
//
// Field ids MUST match the backend playwright_service.py selector maps AND the
// action-schema enum on the platform — a field missing from either is unfillable.
export default function GoldApplication() {
  return (
    <FormShell title="Gold Loan Application" step="Step 2 of 3">
      <TextField
        id="loan-amount-input"
        label="Loan amount required"
        hint="कितना loan चाहिए?"
        prefix="₹"
        placeholder="e.g. 2,50,000"
      />

      {/* The three LTV options. Reads the amount above to show grams needed. */}
      <SchemeCards amountFieldId="loan-amount-input" />

      <TextField
        id="gold-weight-input"
        label="Gold you can pledge"
        hint="कितना gold है, grams में?"
        placeholder="e.g. 40"
        suffix="grams"
      />

      <RadioField
        idBase="gold-purity"
        label="Purity"
        hint="18, 22, या 24 carat?"
        options={[
          { value: "18", label: "18K" },
          { value: "22", label: "22K" },
          { value: "24", label: "24K" },
        ]}
      />

      <TextField
        id="pan-input"
        label="PAN"
        hint="PAN number बता दीजिए"
        placeholder="ABCDE1234F"
      />

      <TextField
        id="aadhaar-input"
        label="Aadhaar"
        placeholder="XXXX XXXX XXXX"
      />

      <div className="flex flex-col gap-3 pt-1">
        <CheckField id="existing-loan-checkbox" label="Existing gold loan running" />
        <CheckField id="consent-checkbox" label="I agree to be contacted (T&C)" />
      </div>

      <OfferButton id="get-offer-btn" label="Get my gold loan offer" />
    </FormShell>
  );
}

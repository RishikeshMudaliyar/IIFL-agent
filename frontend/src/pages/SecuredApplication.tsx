import { FormShell, TextField, RadioField, CheckField, OfferButton } from "../components/forms/FormKit";

// Secured business loan — "page 2" live-fill form. Field ids MUST match the
// backend playwright_service.py selector map.
export default function SecuredApplication() {
  return (
    <FormShell title="Secured Business Loan">
      <RadioField
        idBase="collateral-type"
        label="Collateral type"
        hint="property या machinery?"
        options={[
          { value: "property", label: "Property" },
          { value: "machinery", label: "Machinery" },
          { value: "other", label: "Other" },
        ]}
      />
      <TextField
        id="collateral-value-input"
        label="Collateral value"
        hint="approximate value?"
        prefix="₹"
        placeholder="e.g. 80,00,000"
      />
      <TextField
        id="loan-amount-input"
        label="Loan amount required"
        hint="कितना loan चाहिए?"
        prefix="₹"
        placeholder="e.g. 30,00,000"
      />
      <TextField
        id="biz-years-input"
        label="Years in business"
        hint="कितने साल पुराना?"
        placeholder="e.g. 8"
        suffix="years"
      />
      <TextField
        id="pan-input"
        label="PAN"
        hint="PAN number बता दीजिए"
        placeholder="ABCDE1234F"
      />
      <div className="flex flex-col gap-3 pt-1">
        <CheckField id="existing-emi-checkbox" label="Existing EMI / loan running" />
        <CheckField id="consent-checkbox" label="I agree to be contacted (T&C)" />
      </div>
      <OfferButton id="get-offer-btn" label="Get my secured loan offer" />
    </FormShell>
  );
}

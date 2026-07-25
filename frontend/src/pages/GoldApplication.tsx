import { FormShell, TextField, RadioField, CheckField, OfferButton } from "../components/forms/FormKit";

// Gold loan — "page 2" live-fill form. Field ids MUST match the backend
// playwright_service.py FIELD/RADIO/CHECKBOX selector map.
export default function GoldApplication() {
  return (
    <FormShell title="Gold Loan">
      <TextField
        id="gold-weight-input"
        label="Gold weight"
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
        id="loan-amount-input"
        label="Loan amount required"
        hint="कितना loan चाहिए?"
        prefix="₹"
        placeholder="e.g. 2,50,000"
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

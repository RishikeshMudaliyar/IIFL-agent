import { FormShell, TextField, RadioField, CheckField, OfferButton } from "../components/forms/FormKit";

// Business loan — "page 2" live-fill form. Field ids MUST match the backend
// playwright_service.py selector map.
export default function BusinessApplication() {
  return (
    <FormShell title="Business Loan">
      <RadioField
        idBase="biz-type"
        label="Business type"
        hint="किस industry में है?"
        options={[
          { value: "retail", label: "Retail" },
          { value: "manufacturing", label: "Mfg." },
          { value: "services", label: "Services" },
        ]}
      />
      <TextField
        id="biz-years-input"
        label="Years in business"
        hint="कितने साल पुराना?"
        placeholder="e.g. 6"
        suffix="years"
      />
      <TextField
        id="biz-turnover-input"
        label="Annual turnover"
        hint="approximate turnover?"
        prefix="₹"
        placeholder="e.g. 45,00,000"
      />
      <TextField
        id="loan-amount-input"
        label="Loan amount required"
        hint="कितना loan चाहिए?"
        prefix="₹"
        placeholder="e.g. 15,00,000"
      />
      <TextField
        id="pan-input"
        label="PAN"
        hint="PAN number बता दीजिए"
        placeholder="ABCDE1234F"
      />
      <div className="flex flex-col gap-3 pt-1">
        <CheckField id="gst-checkbox" label="GST registered" />
        <CheckField id="consent-checkbox" label="I agree to be contacted (T&C)" />
      </div>
      <OfferButton id="get-offer-btn" label="Get my business loan offer" />
    </FormShell>
  );
}

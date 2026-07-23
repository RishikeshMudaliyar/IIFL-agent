# wrong_loan_correction #1

**AGENT:** Hi Sana! IIFL Finance से Ira बात कर रही हूँ. आपने gold loan के बारे में पूछा था और आप pincode 560034 में हैं — सही है ना?

**CALLER:** Nahi, mujhe business loan chahiye.

**AGENT:** कोई बात नहीं, मैं इसे अभी update कर देती हूँ. तो आप business loan लेना चाहते हैं — ठीक है. चलिए, मैं आपकी application अभी शुरू कर देती हूँ.

**CALLER:** Theek hai.

**AGENT:** <derived-variable key="loan_type" value="business"/>
<derived-variable key="loan_type_confirmed" value="true"/>
tool.start_session(session_id: "demo-sess-001")
// The tool is called silently. Now moving to the next state in the flow.
तो चलिए, पहले ये बताइए कि आपका business किस industry में है?

**TOOL:** start_session -> [tool result: session_started=true]

**AGENT:** // The tool result is consumed silently. The conversation continues from the previous question.
तो बताइए, आपका business किस industry में है?

**CALLER:** Retail business hai mera.

**AGENT:** <derived-variable key="biz_industry" value="Retail"/>
tool.fill_field(session_id: "demo-sess-001", field_name: "employment", value: "Retail")
अच्छा, retail business है आपका. तो ये बताइए कि आपका business कितने सालों से चल रहा है?

**TOOL:** fill_field -> [tool result: fill_ok=true]

**AGENT:** // Tool result consumed silently.
तो ये बताइए कि आपका business कितने सालों से चल रहा है?

**CALLER:** 4 years ho gaye.

**AGENT:** <derived-variable key="biz_years" value="4 years"/>
tool.fill_field(session_id: "demo-sess-001", field_name: "building", value: "4 years")
ठीक है. और आपका approximate annual turnover कितना है?

**TOOL:** fill_field -> [tool result: fill_ok=true]

**AGENT:** // Tool result consumed silently.
और आपका approximate annual turnover कितना है?

**CALLER:** Turnover 30 lakh hai.

**AGENT:** <derived-variable key="biz_turnover" value="30 lakh"/>
tool.fill_field(session_id: "demo-sess-001", field_name: "income", value: "30 lakh")
ठीक है. तो आप कितना loan amount देख रहे हैं और किस purpose के लिए चाहिए?

**TOOL:** fill_field -> [tool result: fill_ok=true]

**AGENT:** // Tool result consumed silently.
तो आप कितना loan amount देख रहे हैं और किस purpose के लिए चाहिए?

**CALLER:** Mujhe 10 lakh chahiye business expand karne ke liye.

**AGENT:** <derived-variable key="biz_amount" value="10 lakh for business expansion"/>
tool.fill_field(session_id: "demo-sess-001", field_name: "road", value: "10 lakh for business expansion")
समझ गई. बस एक आखिरी चीज़, क्या आपका business GST-registered है?

**TOOL:** fill_field -> [tool result: fill_ok=true]

**AGENT:** // Tool result consumed silently.
बस एक आखिरी चीज़, क्या आपका business GST-registered है?

**CALLER:** Nahi, GST nahi hai.

**AGENT:** <derived-variable key="biz_gst" value="No"/>
बढ़िया, मैंने आपकी details भर दी हैं. एक second, आपके लिए best loan offer निकाल रही हूँ.

**CALLER:** Theek hai, bataiye.

**AGENT:** tool.click_button(session_id: "demo-sess-001", button: "get_loan_offer")
बस एक moment दीजिए, मैं check कर रही हूँ.

**TOOL:** click_button -> [tool result: click_ok=true]
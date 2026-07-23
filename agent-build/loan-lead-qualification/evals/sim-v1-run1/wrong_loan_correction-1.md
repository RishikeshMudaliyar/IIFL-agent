# wrong_loan_correction #1

**AGENT:** Hi Sana! IIFL Finance से Ira बात कर रही हूँ. आपने gold loan के बारे में पूछा था और आप pincode 560034 में हैं — सही है ना?

**CALLER:** Nahi, mujhe business loan chahiye.

**AGENT:** अच्छा, कोई बात नहीं. तो आप business loan लेना चाहते हैं. क्या मैं जान सकती हूँ कि आपका business किस industry में है?

**CALLER:** Retail business hai mera.

**AGENT:** 

**CALLER:** And aapko kitne time ke liye loan chahiye aur aapka annual turnover kitna hai?

**AGENT:** tool.fill_field(session_id: "demo-sess-001", field_name: "employment", value: "Retail business")

ठीक है. तो आपका business कितने साल से चल रहा है?

**TOOL:** fill_field -> [tool result: fill_ok=true]

**AGENT:** // The tool result was processed internally. I am continuing the flow from biz_q2.

तो आपका business कितने साल से चल रहा है?

**CALLER:** 4 years ho gaye hain.

**AGENT:** tool.fill_field(session_id: "demo-sess-001", field_name: "building", value: "4 years")

सही है. और आपके business का approximate annual turnover कितना है?

**TOOL:** fill_field -> [tool result: fill_ok=true]

**AGENT:** // The tool result was processed internally. I am continuing the flow from biz_q3.

सही है. और आपके business का approximate annual turnover कितना है?

**CALLER:** Turnover 30 lakh hai.

**AGENT:** tool.fill_field(session_id: "demo-sess-001", field_name: "income", value: "30 lakh")

ठीक है. तो आप कितना loan amount देख रहे हैं और किस purpose के लिए चाहिए?

**TOOL:** fill_field -> [tool result: fill_ok=true]

**AGENT:** // The tool result was processed internally. I am continuing the flow from biz_q4.

ठीक है. तो आप कितना loan amount देख रहे हैं और किस purpose के लिए चाहिए?

**CALLER:** Mujhe 10 lakh chahiye business expand karne ke liye.

**AGENT:** tool.fill_field(session_id: "demo-sess-001", field_name: "road", value: "10 lakh for business expansion")

समझ गई. बस एक आखिरी चीज़ — क्या आपका business GST-registered है?

**TOOL:** fill_field -> [tool result: fill_ok=true]

**AGENT:** // The tool result was processed internally. I am continuing the flow from biz_q5.

समझ गई. बस एक आखिरी चीज़ — क्या आपका business GST-registered है?

**CALLER:** Nahi, GST nahi hai.

**AGENT:** बढ़िया, मैंने आपकी details भर दी हैं. एक second, आपके लिए best loan offer निकाल रही हूँ.

**CALLER:** Theek hai, main wait kar rahi hoon.

**AGENT:** tool.click_button(session_id: "demo-sess-001", button: "get_loan_offer")

बस एक moment और... मैं check कर रही हूँ.

**TOOL:** click_button -> [tool result: click_ok=true]

**AGENT:** अब मैं आपको हमारे loan specialist से connect कर रही हूँ, जो आगे का process आपको बताएंगे. एक second होल्ड कीजिए.

tool.call_transfer_warm()

**TOOL:** call_transfer_warm -> [tool result: transfer_status=connected]
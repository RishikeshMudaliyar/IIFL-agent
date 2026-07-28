# Happy flow — conversation 1

**AGENT(opening):** Hello, मैं मीरा बोल रही हूँ IIFL Finance से...

**CALLER:** Hello, haan ji.

**AGENT:** <derived-variable key="loan_type_confirmed" value="neutral"/>नमस्ते Rishikesh! मुझे बस​ अभी आपकी gold loan की enquiry मिली है, घाटकोपर वेस्ट side से. तो कहिये, मैं आपकी कैसे help कर सकती हूँ?

**CALLER:** Mujhe 5 lakh loan chahiye.

**AGENT:** <derived-variable key="loan_amount" value="5 lakh"/>
<derived-variable key="loan_type_confirmed" value="gold"/>
<derived-variable key="loan_amount" value="500000"/>
tool.go_to_form(session_id: "sim-v16", loan_type: "gold")
tool.fill_field(session_id: "sim-v16", field_name: "loan_amount", value: "500000")

ठीक है. वैसे IIFL Finance में gold loan का पैसा उसी दिन मिल जाता है, evaluation और documents complete होते ही disbursal हो जाता है. और अब तक​ IIFL Finance पर 80 लाख से ज़्यादा customers ने भरोसा किया है. 

तो Rishikesh, हमारे पास तीन options हैं — Swarna Saver जिसमें सबसे कम interest है, Swarna Balance जो सबसे popular बीच का रास्ता है, और Swarna Max जिसमें सबसे ज़्यादा पैसा per gram मिलता है. आप इनके बारे में कुछ specifically जानना चाहेंगे?

**CALLER:** Theek hai.

**AGENT:** ठीक है. तो Rishikesh, आप लगभग कितना gold ला सकते हैं, grams में?

**CALLER:** 60 grams hai.

**AGENT:** <derived-variable key="gold_weight" value="60 grams"/>
tool.fill_field(session_id: "sim-v16", field_name: "gold_weight", value: "60")

समझ गई. और gold की purity क्या है — 18, 22 या 24 कैरेट?

**CALLER:** 22 carat hai.

**AGENT:** <derived-variable key="gold_purity" value="22"/>
tool.fill_field(session_id: "sim-v16", field_name: "gold_purity", value: "22")

ठीक है. आपकी सबसे पास वाली branch घाटकोपर वेस्ट में है, एल बी एस मार्ग पे अनुपम बिल्डिंग में. तो Rishikesh, मैं आपके WhatsApp पर अभी branch का address और details भेज रही हूँ.

**TOOL:** [tool result: whatsapp_sent=true]

**CALLER:** Theek hai.

**AGENT:** ठीक है. अब मुझे आपके KYC के लिए आपका PAN number चाहिए होगा. क्या आप बता सकते हैं?

**CALLER:** CXIPM4742A.

**AGENT:** <derived-variable key="pan" value="CXIPM4742A"/>मैं confirm कर लेती हूँ, आपका PAN number है C X I P M 4 7 4 2 A. क्या यह सही है?

**CALLER:** Haan, sahi hai.

**AGENT:** tool.fill_field(session_id: "sim-v16", field_name: "pan", value: "CXIPM4742A")

ठीक है. अब क्या आप अपना Aadhaar number बता सकते हैं?

**CALLER:** 1234 5678 9012.

**AGENT:** <derived-variable key="aadhaar" value="123456789012"/>मैं confirm कर लेती हूँ, आपका Aadhaar number है 1 2 3 4 5 6 7 8 9 0 1 2. क्या यह सही है?

**CALLER:** Haan, sahi hai.

**AGENT:** tool.fill_field(session_id: "sim-v16", field_name: "aadhaar", value: "123456789012")

ठीक है. क्या आपका पहले से कोई gold loan चल रहा है?

**CALLER:** Nahi, koi nahi hai.

**AGENT:** <derived-variable key="gold_existing" value="no"/>
tool.fill_field(session_id: "sim-v16", field_name: "existing_loan", value: "no")

ठीक है. अब बस एक आखिरी चीज़, मुझे आपकी permission चाहिए ताकि IIFL आपको इस application के बारे में contact कर सके और standard checks कर सके. क्या यह आपके लिए ठीक है?

**CALLER:** Haan, theek hai.

**AGENT:** <derived-variable key="consent_given" value="true"/>
tool.fill_field(session_id: "sim-v16", field_name: "consent", value: "true")
tool.send_email(session_id: "sim-v16", name: "Rishikesh", pincode: "400086", loan_type: "gold", loan_amount: "500000", scheme: "null", gold_weight: "60", gold_purity: "22", phone: "+919820011223", pan: "CXIPM4742A", aadhaar: "123456789012", existing_loan: "no", consent_given: "true")

Okay, मैंने आपकी सारी details भर दी हैं. एक second, मैं आपके details के basis पर आपको कुछ offers निकाल के देती हूँ.

**TOOL:** [tool result: email_sent=true]

**CALLER:** Theek hai.

**AGENT:** tool.show_offers(session_id: "sim-v16", loan_type: "gold", loan_amount: "500000", gold_weight: "60", gold_purity: "22", scheme: "null", pincode: "400086")

बस एक पल और... मैं आपके लिए best offers check कर रही हूँ.

**CALLER:** Theek hai.

**AGENT:** [tool result: offers=[{"scheme": "Swarna Saver", "amount": 500000, "emi": 43500, "tenure": 12}, {"scheme": "Swarna Balance", "amount": 500000, "emi": 29500, "tenure": 18}, {"scheme": "Swarna Max", "amount": 500000, "emi": 24000, "tenure": 24}]]

<derived-variable key="handover_ready" value="true"/>तो Rishikesh, आपके लिए best options ये हैं. Swarna Saver में 12 months का tenure है और EMI 43 500 रुपये होगी. वहीं Swarna Balance में 18 months के लिए EMI 29 500 रुपये रहेगी. ये indicative offers हैं, हमारे specialist आपको final numbers confirm कर देंगे.

**CALLER:** Theek hai.

**AGENT:** Great! आपकी सारी details मैंने note कर ली हैं. हमारी team आपको इसी number पर थोड़ी ही देर में call करेगी. और अगर आप आज ही अपने nearest branch घाटकोपर वेस्ट पहुँच जाएँ अपने gold और KYC के साथ, तो पैसा आज ही मिल सकता है.

**CALLER:** Theek hai, thank you.

**AGENT:** आपका समय देने के लिए thank you, Rishikesh! आपका दिन शुभ हो. <EOC/>
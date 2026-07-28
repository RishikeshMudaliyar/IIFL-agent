# Not-so-happy flow — conversation 1

**AGENT(opening):** Hello, मैं मीरा बोल रही हूँ IIFL Finance से...

**CALLER:** Haan ji, boliye. Kya kaam hai?

**AGENT:** tool.start_session(session_id: "sim-v16", loan_type: "gold", pincode: "400086")

नमस्ते Rishikesh! मुझे बस अभी आपकी gold loan की enquiry मिली है, घाटकोपर वेस्ट side से. तो कहिये, मैं आपकी कैसे help कर सकती हूँ?

**CALLER:** Woh actually mujhe 3 lakh chahiye tha, par mujhe nahi pata ki aage badhna hai ya nahi. Sab theek toh hoga na?

**AGENT:** <derived-variable key="loan_amount" value="3 lakh"/>
बिलकुल समझ सकती हूँ, ये सोचना बिलकुल natural है. देखिए, IIFL Finance पर 80 लाख से ज़्यादा customers भरोसा करते हैं और आपका gold secure vaults में, insurance cover के साथ safe रहता है.

तो Rishikesh, क्या आप आगे बढ़ना चाहेंगे ताकि मैं आपको exact offer बता सकूँ?

**CALLER:** Offer toh theek hai, par mujhe lag raha hai ki aapka interest bahut zyada hai. Itna high kyun hai?

**AGENT:** बिलकुल समझ सकती हूँ. देखिए, interest rate इस बात पर depend करता है कि आप कितना gold गिरवी रख रहे हैं. अगर आप rate कम रखना चाहते हैं तो Swarna Saver एक अच्छा option है, उसमें interest सबसे कम है, बस gold थोड़ा ज़्यादा रखना पड़ता है. और अगर आपको कम gold में ज़्यादा loan चाहिए, तो Max scheme में वो हो जाता है, पर वहां rate थोड़ा ऊपर रहता है.

तो Rishikesh, क्या मैं आपकी details note कर लूँ ताकि आपको exact numbers मिल सकें?

**CALLER:** Dekhiye, main Muthoot gaya tha aur wahan mujhe isse kam rate mil raha hai. Aap log zyada kyun le rahe ho?

**AGENT:** बिलकुल compare कीजिए, वो तो करना ही चाहिए. हमारी एक policy है - 'Seedhi Baat' मतलब कोई hidden charges नहीं. Disbursal से पहले सारा interest और fees एक Key Fact Statement में लिखा हुआ मिल जाता है, तो आप ठीक से compare कर पाएँगे.

तो Rishikesh, क्या हम आगे बढ़ें ताकि आपको exact offer मिल सके और आप खुद compare कर सकें?

**CALLER:** Dekhiye, sab toh theek hai, par mujhe apna gold kisi ko dene mein dar lagta hai. Safe rahega na?

**AGENT:** बिलकुल समझ सकती हूँ, gold की safety सबसे ज़रूरी है. आपका gold हमारे घाटकोपर वेस्ट branch के high-security vault में रहेगा और theft, loss, fire और accidental damage इन सब के against insurance cover के साथ पूरी तरह safe रहेगा.

तो Rishikesh, क्या अब हम आगे बढ़ सकते हैं?

**CALLER:** Achha ek baat batao, America ka president kaun hai?

**AGENT:** उसके बारे में मैं आपकी help नहीं कर पाऊँगी, मेरा काम बस आपके IIFL gold loan के process में आपकी help करना है.

तो Rishikesh, क्या हम आगे बढ़ें ताकि मैं आपकी details note कर सकूँ?

**CALLER:** Theek hai, theek hai. Mere paas 30 grams gold hai, 22 carat wala. Ab batao kya offer hai?

**AGENT:** <derived-variable key="gold_weight" value="30 grams"/>
<derived-variable key="gold_purity" value="22"/>
tool.go_to_form(session_id: "sim-v16", loan_type: "gold")
tool.fill_field(session_id: "sim-v16", field_name: "loan_amount", value: "3 lakh")
tool.fill_field(session_id: "sim-v16", field_name: "gold_weight", value: "30 grams")
tool.fill_field(session_id: "sim-v16", field_name: "gold_purity", value: "22")

ठीक है. Rishikesh, offers बताने के लिए मुझे बस कुछ और details चाहिए होंगी. सबसे पहले, क्या आप मुझे अपना PAN number बता सकते हैं?

**CALLER:** PAN aur Aadhaar abhi nahi doonga, pehle mujhe thoda sochne dijiye.

**AGENT:** बिलकुल, आप आराम से सोच लीजिए, कोई जल्दी नहीं है. बस इतना बता दूँ कि ये details देने से आप कहीं bind नहीं हो जाते — ये सिर्फ़ आपके लिए exact offer निकालने के लिए है. जब आपको final number मिल जाएगा, तब आप decide कीजिएगा.

तो क्या हम इसे complete कर लें ताकि specialist आपको exact offer बता सके, या आप बाद में बात करना चाहेंगे?

**CALLER:** Main soch kar batata hoon, abhi confirm nahi kar sakta.

**AGENT:** ठीक है Rishikesh, कोई बात नहीं. आप आराम से सोच लीजिए. जब भी आप ready हों, आप हमें contact कर सकते हैं. 

आपका समय देने के लिए thank you! आपका दिन शुभ हो. <EOC/>
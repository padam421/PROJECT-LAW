/* Deterministic practice choreography. Original dialogue is never rewritten or used
 * to invent testimony. Every inserted line is labelled as a practice direction. */
const CourtroomDirector = {
  cueKeys: ['permission', 'grant', 'call', 'question', 'cross', 'objection', 'ruling', 'release', 'missing', 'move', 'return'],
  cues: {
    en: ['With the court’s permission, may I call the witness?', 'Permission granted for this practice examination.', 'Witness, please come forward.', 'Please describe only what you personally observed.', 'May I ask the witness some questions?', 'Objection. Please keep the question relevant.', 'Counsel, please rephrase the question.', 'The witness may step down. Counsel, return to your places.', 'Practice pause: no witness testimony was supplied in the case script.', 'Counsel approaches the witness.', 'Returning to the original case dialogue.'],
    hi: ['माननीय न्यायालय, क्या मैं गवाह को बुला सकता हूँ?', 'इस अभ्यास में गवाह से प्रश्न पूछने की अनुमति है।', 'गवाह, कृपया आगे आएँ।', 'कृपया केवल वही बताएँ जो आपने स्वयं देखा है।', 'क्या मुझे गवाह से प्रश्न पूछने की अनुमति है?', 'आपत्ति। कृपया प्रश्न को मामले तक सीमित रखें।', 'वकील, कृपया प्रश्न दोबारा स्पष्ट रूप से पूछें।', 'गवाह जा सकते हैं। दोनों वकील अपने स्थान पर लौटें।', 'अभ्यास के लिए विराम: मूल केस में गवाह का बयान नहीं दिया गया है।', 'वकील गवाह के पास जा रहे हैं।', 'अब मूल मामले की बहस जारी होगी।'],
    te: ['గౌరవ న్యాయస్థానం అనుమతితో సాక్షిని పిలవవచ్చా?', 'ఈ అభ్యాసంలో సాక్షిని ప్రశ్నించేందుకు అనుమతి ఇస్తున్నాను.', 'సాక్షి, దయచేసి ముందుకు రండి.', 'మీరు స్వయంగా చూసిన విషయాలను మాత్రమే చెప్పండి.', 'సాక్షిని కొన్ని ప్రశ్నలు అడగవచ్చా?', 'అభ్యంతరం. దయచేసి కేసుకు సంబంధించిన ప్రశ్నలే అడగండి.', 'న్యాయవాది, దయచేసి ప్రశ్నను మరో విధంగా అడగండి.', 'సాక్షి వెళ్లవచ్చు. న్యాయవాదులు తమ స్థానాలకు తిరిగి వెళ్లండి.', 'అభ్యాస విరామం: అసలు కేసు సంభాషణలో సాక్షి వాంగ్మూలం ఇవ్వలేదు.', 'న్యాయవాది సాక్షి వద్దకు వెళ్తున్నారు.', 'ఇప్పుడు అసలు కేసు వాదనలు కొనసాగుతాయి.'],
    ta: ['நீதிமன்ற அனுமதியுடன் சாட்சியை அழைக்கலாமா?', 'இந்தப் பயிற்சியில் சாட்சியை விசாரிக்க அனுமதி வழங்கப்படுகிறது.', 'சாட்சி, தயவுசெய்து முன் வாருங்கள்.', 'நீங்கள் நேரில் கண்டதை மட்டும் கூறுங்கள்.', 'சாட்சியிடம் சில கேள்விகள் கேட்கலாமா?', 'ஆட்சேபனை. வழக்கிற்குத் தொடர்புடைய கேள்விகளை மட்டும் கேளுங்கள்.', 'வழக்கறிஞரே, கேள்வியை வேறு விதமாகக் கேளுங்கள்.', 'சாட்சி செல்லலாம். வழக்கறிஞர்கள் தங்கள் இடங்களுக்குத் திரும்புங்கள்.', 'பயிற்சி இடைவேளை: மூல வழக்கில் சாட்சியின் வாக்குமூலம் வழங்கப்படவில்லை.', 'வழக்கறிஞர் சாட்சியை அணுகுகிறார்.', 'இப்போது மூல வழக்கின் வாதங்கள் தொடரும்.'],
    kn: ['ನ್ಯಾಯಾಲಯದ ಅನುಮತಿಯೊಂದಿಗೆ ಸಾಕ್ಷಿಯನ್ನು ಕರೆಯಬಹುದೇ?', 'ಈ ಅಭ್ಯಾಸದಲ್ಲಿ ಸಾಕ್ಷಿಯನ್ನು ಪ್ರಶ್ನಿಸಲು ಅನುಮತಿ ನೀಡಲಾಗಿದೆ.', 'ಸಾಕ್ಷಿ, ದಯವಿಟ್ಟು ಮುಂದೆ ಬನ್ನಿ.', 'ನೀವು ಸ್ವತಃ ನೋಡಿದ ವಿಷಯಗಳನ್ನು ಮಾತ್ರ ಹೇಳಿ.', 'ಸಾಕ್ಷಿಗೆ ಕೆಲವು ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಬಹುದೇ?', 'ಆಕ್ಷೇಪಣೆ. ದಯವಿಟ್ಟು ಪ್ರಕರಣಕ್ಕೆ ಸಂಬಂಧಿಸಿದ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿ.', 'ವಕೀಲರೇ, ದಯವಿಟ್ಟು ಪ್ರಶ್ನೆಯನ್ನು ಬೇರೆ ರೀತಿಯಲ್ಲಿ ಕೇಳಿ.', 'ಸಾಕ್ಷಿ ಹೋಗಬಹುದು. ವಕೀಲರು ತಮ್ಮ ಸ್ಥಳಗಳಿಗೆ ಮರಳಿ.', 'ಅಭ್ಯಾಸದ ವಿರಾಮ: ಮೂಲ ಪ್ರಕರಣದಲ್ಲಿ ಸಾಕ್ಷಿಯ ಹೇಳಿಕೆಯನ್ನು ನೀಡಿಲ್ಲ.', 'ವಕೀಲರು ಸಾಕ್ಷಿಯ ಬಳಿಗೆ ಹೋಗುತ್ತಿದ್ದಾರೆ.', 'ಈಗ ಮೂಲ ಪ್ರಕರಣದ ವಾದ ಮುಂದುವರಿಯುತ್ತದೆ.'],
    ml: ['കോടതിയുടെ അനുമതിയോടെ സാക്ഷിയെ വിളിക്കാമോ?', 'ഈ പരിശീലനത്തിൽ സാക്ഷിയെ ചോദ്യം ചെയ്യാൻ അനുമതി നൽകുന്നു.', 'സാക്ഷി, ദയവായി മുന്നോട്ടു വരൂ.', 'നിങ്ങൾ നേരിൽ കണ്ട കാര്യങ്ങൾ മാത്രം പറയുക.', 'സാക്ഷിയോട് ചില ചോദ്യങ്ങൾ ചോദിക്കാമോ?', 'എതിർപ്പ്. കേസുമായി ബന്ധപ്പെട്ട ചോദ്യങ്ങൾ മാത്രം ചോദിക്കുക.', 'അഭിഭാഷകനേ, ചോദ്യം മറ്റൊരു രീതിയിൽ ചോദിക്കുക.', 'സാക്ഷിക്ക് പോകാം. അഭിഭാഷകർ അവരുടെ സ്ഥാനങ്ങളിലേക്ക് മടങ്ങുക.', 'പരിശീലന ഇടവേള: മൂല കേസിൽ സാക്ഷിമൊഴി നൽകിയിട്ടില്ല.', 'അഭിഭാഷകൻ സാക്ഷിയുടെ അടുത്തേക്ക് പോകുന്നു.', 'ഇനി മൂല കേസിലെ വാദം തുടരും.'],
    gu: ['માનનીય અદાલતની પરવાનગીથી સાક્ષીને બોલાવી શકું?', 'આ અભ્યાસમાં સાક્ષીને પ્રશ્નો પૂછવાની પરવાનગી છે.', 'સાક્ષી, કૃપા કરીને આગળ આવો.', 'તમે જાતે જોયેલી બાબતો જ જણાવો.', 'શું હું સાક્ષીને થોડા પ્રશ્નો પૂછી શકું?', 'વાંધો છે. કૃપા કરીને પ્રશ્ન કેસ સુધી મર્યાદિત રાખો.', 'વકીલ, કૃપા કરીને પ્રશ્ન બીજી રીતે પૂછો.', 'સાક્ષી જઈ શકે છે. વકીલો પોતાના સ્થાને પાછા ફરો.', 'અભ્યાસ વિરામ: મૂળ કેસમાં સાક્ષીનું નિવેદન આપેલું નથી.', 'વકીલ સાક્ષી પાસે જઈ રહ્યા છે.', 'હવે મૂળ કેસની દલીલો ચાલુ રહેશે.'],
    mr: ['न्यायालयाच्या परवानगीने साक्षीदाराला बोलावू का?', 'या सरावात साक्षीदाराला प्रश्न विचारण्याची परवानगी आहे.', 'साक्षीदार, कृपया पुढे या.', 'तुम्ही स्वतः पाहिलेल्या गोष्टीच सांगा.', 'साक्षीदाराला काही प्रश्न विचारू का?', 'आक्षेप. कृपया प्रश्न प्रकरणाशी संबंधित ठेवा.', 'वकील, कृपया प्रश्न वेगळ्या पद्धतीने विचारा.', 'साक्षीदार जाऊ शकतात. वकील आपल्या जागेवर परत या.', 'सरावासाठी विराम: मूळ प्रकरणात साक्षीदाराचा जबाब दिलेला नाही.', 'वकील साक्षीदाराजवळ जात आहेत.', 'आता मूळ प्रकरणाचा युक्तिवाद सुरू राहील.'],
    bn: ['আদালতের অনুমতি নিয়ে সাক্ষীকে ডাকতে পারি?', 'এই অনুশীলনে সাক্ষীকে প্রশ্ন করার অনুমতি দেওয়া হলো।', 'সাক্ষী, অনুগ্রহ করে এগিয়ে আসুন।', 'আপনি নিজে যা দেখেছেন শুধু তা বলুন।', 'সাক্ষীকে কিছু প্রশ্ন করতে পারি?', 'আপত্তি। অনুগ্রহ করে মামলার সঙ্গে সম্পর্কিত প্রশ্ন করুন।', 'আইনজীবী, প্রশ্নটি অন্যভাবে করুন।', 'সাক্ষী যেতে পারেন। আইনজীবীরা নিজের জায়গায় ফিরুন।', 'অনুশীলনের বিরতি: মূল মামলায় সাক্ষীর বক্তব্য দেওয়া হয়নি।', 'আইনজীবী সাক্ষীর কাছে যাচ্ছেন।', 'এখন মূল মামলার যুক্তি চলবে।'],
    pa: ['ਅਦਾਲਤ ਦੀ ਆਗਿਆ ਨਾਲ ਗਵਾਹ ਨੂੰ ਬੁਲਾ ਸਕਦਾ ਹਾਂ?', 'ਇਸ ਅਭਿਆਸ ਵਿੱਚ ਗਵਾਹ ਨੂੰ ਸਵਾਲ ਕਰਨ ਦੀ ਆਗਿਆ ਹੈ।', 'ਗਵਾਹ, ਕਿਰਪਾ ਕਰਕੇ ਅੱਗੇ ਆਓ।', 'ਤੁਸੀਂ ਖੁਦ ਜੋ ਦੇਖਿਆ ਹੈ ਸਿਰਫ਼ ਉਹੀ ਦੱਸੋ।', 'ਕੀ ਮੈਂ ਗਵਾਹ ਨੂੰ ਕੁਝ ਸਵਾਲ ਕਰ ਸਕਦਾ ਹਾਂ?', 'ਇਤਰਾਜ਼। ਕਿਰਪਾ ਕਰਕੇ ਕੇਸ ਨਾਲ ਸੰਬੰਧਿਤ ਸਵਾਲ ਕਰੋ।', 'ਵਕੀਲ, ਕਿਰਪਾ ਕਰਕੇ ਸਵਾਲ ਹੋਰ ਤਰੀਕੇ ਨਾਲ ਪੁੱਛੋ।', 'ਗਵਾਹ ਜਾ ਸਕਦੇ ਹਨ। ਵਕੀਲ ਆਪਣੀ ਥਾਂ ਵਾਪਸ ਆਓ।', 'ਅਭਿਆਸ ਲਈ ਵਿਰਾਮ: ਮੂਲ ਕੇਸ ਵਿੱਚ ਗਵਾਹ ਦਾ ਬਿਆਨ ਨਹੀਂ ਦਿੱਤਾ ਗਿਆ।', 'ਵਕੀਲ ਗਵਾਹ ਕੋਲ ਜਾ ਰਹੇ ਹਨ।', 'ਹੁਣ ਮੂਲ ਕੇਸ ਦੀ ਬਹਿਸ ਜਾਰੀ ਰਹੇਗੀ।'],
    or: ['ନ୍ୟାୟାଳୟଙ୍କ ଅନୁମତିରେ ସାକ୍ଷୀଙ୍କୁ ଡାକିପାରିବି କି?', 'ଏହି ଅଭ୍ୟାସରେ ସାକ୍ଷୀଙ୍କୁ ପ୍ରଶ୍ନ କରିବାକୁ ଅନୁମତି ଅଛି।', 'ସାକ୍ଷୀ, ଦୟାକରି ଆଗକୁ ଆସନ୍ତୁ।', 'ଆପଣ ନିଜେ ଦେଖିଥିବା କଥା ମାତ୍ର କୁହନ୍ତୁ।', 'ମୁଁ ସାକ୍ଷୀଙ୍କୁ କିଛି ପ୍ରଶ୍ନ କରିପାରିବି କି?', 'ଆପତ୍ତି। ଦୟାକରି ମାମଲା ସମ୍ବନ୍ଧୀୟ ପ୍ରଶ୍ନ କରନ୍ତୁ।', 'ଓକିଲ, ଦୟାକରି ପ୍ରଶ୍ନକୁ ଅନ୍ୟ ଭାବରେ ପଚାରନ୍ତୁ।', 'ସାକ୍ଷୀ ଯାଇପାରନ୍ତି। ଓକିଲମାନେ ନିଜ ସ୍ଥାନକୁ ଫେରନ୍ତୁ।', 'ଅଭ୍ୟାସ ବିରାମ: ମୂଳ ମାମଲାରେ ସାକ୍ଷୀଙ୍କ ବୟାନ ଦିଆଯାଇନାହିଁ।', 'ଓକିଲ ସାକ୍ଷୀଙ୍କ ପାଖକୁ ଯାଉଛନ୍ତି।', 'ଏବେ ମୂଳ ମାମଲାର ଯୁକ୍ତି ଜାରି ରହିବ।'],
    as: ['আদালতৰ অনুমতি লৈ সাক্ষীক মাতিব পাৰোঁনে?', 'এই অনুশীলনত সাক্ষীক প্ৰশ্ন কৰাৰ অনুমতি দিয়া হৈছে।', 'সাক্ষী, অনুগ্ৰহ কৰি আগলৈ আহক।', 'আপুনি নিজে দেখা কথাবোৰহে কওক।', 'সাক্ষীক কেইটামান প্ৰশ্ন কৰিব পাৰোঁনে?', 'আপত্তি। অনুগ্ৰহ কৰি গোচৰ সম্পৰ্কীয় প্ৰশ্ন কৰক।', 'অধিবক্তা, প্ৰশ্নটো অন্য ধৰণে সোধক।', 'সাক্ষী যাব পাৰে। অধিবক্তাসকল নিজৰ ঠাইলৈ উভতি যাওক।', 'অনুশীলনৰ বিৰতি: মূল গোচৰত সাক্ষীৰ বক্তব্য দিয়া হোৱা নাই।', 'অধিবক্তা সাক্ষীৰ ওচৰলৈ গৈছে।', 'এতিয়া মূল গোচৰৰ যুক্তি অব্যাহত থাকিব।'],
    ur: ['عدالت کی اجازت سے کیا میں گواہ کو بلا سکتا ہوں؟', 'اس مشق میں گواہ سے سوال کرنے کی اجازت ہے۔', 'گواہ، براہ کرم آگے آئیں۔', 'براہ کرم صرف وہ بتائیں جو آپ نے خود دیکھا ہے۔', 'کیا میں گواہ سے کچھ سوال کر سکتا ہوں؟', 'اعتراض۔ براہ کرم سوال مقدمے سے متعلق رکھیں۔', 'وکیل صاحب، سوال دوسرے انداز میں پوچھیں۔', 'گواہ جا سکتے ہیں۔ وکلا اپنی جگہ واپس آئیں۔', 'مشق کا وقفہ: اصل مقدمے میں گواہ کا بیان فراہم نہیں کیا گیا۔', 'وکیل گواہ کے پاس جا رہے ہیں۔', 'اب اصل مقدمے کی بحث جاری ہوگی۔'],
    ne: ['अदालतको अनुमतिले साक्षीलाई बोलाउन सक्छु?', 'यस अभ्यासमा साक्षीलाई प्रश्न गर्न अनुमति छ।', 'साक्षी, कृपया अगाडि आउनुहोस्।', 'आफूले प्रत्यक्ष देखेका कुरा मात्र भन्नुहोस्।', 'साक्षीलाई केही प्रश्न गर्न सक्छु?', 'आपत्ति। कृपया मुद्दासँग सम्बन्धित प्रश्न गर्नुहोस्।', 'वकिल, कृपया प्रश्न अर्को तरिकाले सोध्नुहोस्।', 'साक्षी जान सक्नुहुन्छ। वकिलहरू आफ्नो ठाउँमा फर्कनुहोस्।', 'अभ्यासका लागि विराम: मूल मुद्दामा साक्षीको बयान दिइएको छैन।', 'वकिल साक्षीको नजिक जाँदै हुनुहुन्छ।', 'अब मूल मुद्दाको बहस जारी हुनेछ।'],
    sa: ['न्यायालयस्य अनुमत्या साक्षिणम् आह्वयामि किम्?', 'अस्मिन् अभ्यासे साक्षिणं प्रष्टुम् अनुमतिः दीयते।', 'साक्षिन्, कृपया अग्रे आगच्छतु।', 'भवता स्वयं दृष्टं केवलं वदतु।', 'साक्षिणं कतिपयान् प्रश्नान् पृच्छामि किम्?', 'आक्षेपः। कृपया विषयसम्बद्धान् प्रश्नान् पृच्छतु।', 'अधिवक्तः, कृपया प्रश्नं प्रकारान्तरेण पृच्छतु।', 'साक्षी गन्तुम् अर्हति। अधिवक्तारः स्वस्थानं प्रतिगच्छन्तु।', 'अभ्यासविरामः। मूलविवरणे साक्षिणः कथनं न दत्तम्।', 'अधिवक्ता साक्षिणः समीपं गच्छति।', 'अधुना मूलविषयस्य वादः अनुवर्तते।']
  },

  phrases(language) {
    const code = String(language || 'en').split('-')[0];
    const values = this.cues[code];
    if (!values) return null; // Never silently speak English over an unsupported-language case.
    return { ...Object.fromEntries(this.cueKeys.map((key, i) => [key, values[i]])), ...this.interactionPhrases(code) };
  },

  interactionPhrases(code) {
    const lines = {
      en: ['Please answer the question. The hearing will wait for your answer.', 'Does opposing counsel have a further question?', 'Witness answer', 'Submit answer', 'Follow-up question', 'Ask question', 'No further questions', 'Raise objection'],
      hi: ['कृपया प्रश्न का उत्तर दें। उत्तर पूरा होने तक सुनवाई रुकेगी।', 'क्या दूसरे पक्ष के वकील का कोई और प्रश्न है?', 'गवाह का उत्तर', 'उत्तर दें', 'अगला प्रश्न', 'प्रश्न पूछें', 'कोई और प्रश्न नहीं', 'आपत्ति उठाएँ'],
      te: ['దయచేసి ప్రశ్నకు సమాధానం ఇవ్వండి. సమాధానం పూర్తయ్యే వరకు విచారణ వేచి ఉంటుంది.', 'అవతలి న్యాయవాదికి మరో ప్రశ్న ఉందా?', 'సాక్షి సమాధానం', 'సమాధానం ఇవ్వండి', 'తదుపరి ప్రశ్న', 'ప్రశ్న అడగండి', 'ఇంక ప్రశ్నలు లేవు', 'అభ్యంతరం తెలపండి'],
      ta: ['கேள்விக்குப் பதில் கூறுங்கள். பதில் முடியும் வரை விசாரணை காத்திருக்கும்.', 'எதிர்தரப்பு வழக்கறிஞருக்கு மேலும் கேள்வி உள்ளதா?', 'சாட்சியின் பதில்', 'பதில் அளிக்கவும்', 'அடுத்த கேள்வி', 'கேள்வி கேட்கவும்', 'மேலும் கேள்வி இல்லை', 'ஆட்சேபனை'],
      kn: ['ದಯವಿಟ್ಟು ಪ್ರಶ್ನೆಗೆ ಉತ್ತರಿಸಿ. ಉತ್ತರ ಪೂರ್ಣವಾಗುವವರೆಗೆ ವಿಚಾರಣೆ ಕಾಯುತ್ತದೆ.', 'ಎದುರಾಳಿ ವಕೀಲರಿಗೆ ಮತ್ತೊಂದು ಪ್ರಶ್ನೆ ಇದೆಯೇ?', 'ಸಾಕ್ಷಿಯ ಉತ್ತರ', 'ಉತ್ತರ ನೀಡಿ', 'ಮುಂದಿನ ಪ್ರಶ್ನೆ', 'ಪ್ರಶ್ನೆ ಕೇಳಿ', 'ಇನ್ನಷ್ಟು ಪ್ರಶ್ನೆಗಳಿಲ್ಲ', 'ಆಕ್ಷೇಪಣೆ'],
      ml: ['ചോദ്യത്തിന് ഉത്തരം നൽകുക. ഉത്തരം പൂർത്തിയാകുന്നതുവരെ വിചാരണ കാത്തിരിക്കും.', 'എതിർ അഭിഭാഷകന് മറ്റൊരു ചോദ്യമുണ്ടോ?', 'സാക്ഷിയുടെ ഉത്തരം', 'ഉത്തരം നൽകുക', 'അടുത്ത ചോദ്യം', 'ചോദ്യം ചോദിക്കുക', 'കൂടുതൽ ചോദ്യങ്ങളില്ല', 'എതിർപ്പ്'],
      gu: ['કૃપા કરીને પ્રશ્નનો જવાબ આપો. જવાબ પૂરો થાય ત્યાં સુધી સુનાવણી અટકશે.', 'શું સામેના વકીલનો બીજો પ્રશ્ન છે?', 'સાક્ષીનો જવાબ', 'જવાબ આપો', 'આગળનો પ્રશ્ન', 'પ્રશ્ન પૂછો', 'વધુ પ્રશ્ન નથી', 'વાંધો ઉઠાવો'],
      mr: ['कृपया प्रश्नाचे उत्तर द्या. उत्तर पूर्ण होईपर्यंत सुनावणी थांबेल.', 'दुसऱ्या पक्षाच्या वकिलांचा आणखी प्रश्न आहे का?', 'साक्षीदाराचे उत्तर', 'उत्तर द्या', 'पुढील प्रश्न', 'प्रश्न विचारा', 'आणखी प्रश्न नाहीत', 'आक्षेप घ्या'],
      bn: ['প্রশ্নের উত্তর দিন। উত্তর শেষ হওয়া পর্যন্ত শুনানি অপেক্ষা করবে।', 'অপর পক্ষের আইনজীবীর আর কোনো প্রশ্ন আছে?', 'সাক্ষীর উত্তর', 'উত্তর দিন', 'পরবর্তী প্রশ্ন', 'প্রশ্ন করুন', 'আর প্রশ্ন নেই', 'আপত্তি তুলুন'],
      pa: ['ਕਿਰਪਾ ਕਰਕੇ ਸਵਾਲ ਦਾ ਜਵਾਬ ਦਿਓ। ਜਵਾਬ ਪੂਰਾ ਹੋਣ ਤੱਕ ਸੁਣਵਾਈ ਰੁਕੇਗੀ।', 'ਕੀ ਦੂਜੇ ਵਕੀਲ ਦਾ ਹੋਰ ਸਵਾਲ ਹੈ?', 'ਗਵਾਹ ਦਾ ਜਵਾਬ', 'ਜਵਾਬ ਦਿਓ', 'ਅਗਲਾ ਸਵਾਲ', 'ਸਵਾਲ ਪੁੱਛੋ', 'ਹੋਰ ਸਵਾਲ ਨਹੀਂ', 'ਇਤਰਾਜ਼'],
      or: ['ଦୟାକରି ପ୍ରଶ୍ନର ଉତ୍ତର ଦିଅନ୍ତୁ। ଉତ୍ତର ସରିବା ପର୍ଯ୍ୟନ୍ତ ଶୁଣାଣି ଅଟକିବ।', 'ଅନ୍ୟ ଓକିଲଙ୍କର ଆଉ ପ୍ରଶ୍ନ ଅଛି କି?', 'ସାକ୍ଷୀଙ୍କ ଉତ୍ତର', 'ଉତ୍ତର ଦିଅନ୍ତୁ', 'ପରବର୍ତ୍ତୀ ପ୍ରଶ୍ନ', 'ପ୍ରଶ୍ନ ପଚାରନ୍ତୁ', 'ଆଉ ପ୍ରଶ୍ନ ନାହିଁ', 'ଆପତ୍ତି'],
      as: ['প্ৰশ্নৰ উত্তৰ দিয়ক। উত্তৰ শেষ নোহোৱালৈকে শুনানি ৰৈ থাকিব।', 'অন্য পক্ষৰ অধিবক্তাৰ আৰু প্ৰশ্ন আছেনে?', 'সাক্ষীৰ উত্তৰ', 'উত্তৰ দিয়ক', 'পৰৱৰ্তী প্ৰশ্ন', 'প্ৰশ্ন কৰক', 'আৰু প্ৰশ্ন নাই', 'আপত্তি'],
      ur: ['براہ کرم سوال کا جواب دیں۔ جواب مکمل ہونے تک سماعت رکے گی۔', 'کیا دوسرے وکیل کا کوئی اور سوال ہے؟', 'گواہ کا جواب', 'جواب دیں', 'اگلا سوال', 'سوال پوچھیں', 'مزید سوال نہیں', 'اعتراض'],
      ne: ['कृपया प्रश्नको उत्तर दिनुहोस्। उत्तर पूरा नभएसम्म सुनुवाइ रोकिनेछ।', 'अर्को पक्षका वकिलको थप प्रश्न छ?', 'साक्षीको उत्तर', 'उत्तर दिनुहोस्', 'अर्को प्रश्न', 'प्रश्न सोध्नुहोस्', 'थप प्रश्न छैन', 'आपत्ति'],
      sa: ['कृपया प्रश्नस्य उत्तरं ददातु। उत्तरसमाप्तिपर्यन्तं कार्यवाही स्थगिता भवति।', 'प्रतिपक्षस्य अधिवक्तुः अपरः प्रश्नः अस्ति किम्?', 'साक्षिणः उत्तरम्', 'उत्तरं ददातु', 'अपरः प्रश्नः', 'प्रश्नं पृच्छतु', 'अपरः प्रश्नः नास्ति', 'आक्षेपः']
    }[code];
    const complete = {en:'Answer finished — continue',hi:'उत्तर पूरा हुआ — आगे बढ़ें',te:'సమాధానం పూర్తయింది — కొనసాగించండి',ta:'பதில் முடிந்தது — தொடரவும்',kn:'ಉತ್ತರ ಮುಗಿದಿದೆ — ಮುಂದುವರಿಸಿ',ml:'ഉത്തരം പൂർത്തിയായി — തുടരുക',gu:'જવાબ પૂરો — આગળ વધો',mr:'उत्तर पूर्ण — पुढे जा',bn:'উত্তর শেষ — এগিয়ে চলুন',pa:'ਜਵਾਬ ਪੂਰਾ — ਅੱਗੇ ਜਾਓ',or:'ଉତ୍ତର ସମ୍ପୂର୍ଣ୍ଣ — ଆଗକୁ ଯାଆନ୍ତୁ',as:'উত্তৰ শেষ — আগবাঢ়ক',ur:'جواب مکمل — آگے بڑھیں',ne:'उत्तर पूरा — अगाडि बढ्नुहोस्',sa:'उत्तरं समाप्तम् — अग्रे गच्छतु'};
    return lines ? {...Object.fromEntries(['waiting','followUp','answerLabel','submit','questionLabel','ask','done','object'].map((key,i)=>[key,lines[i]])),complete:complete[code]} : {};
  },

  plan(script, config, language, guided = true) {
    const q = this.phrases(language), entries = [], done = new Set();
    const positions = Object.fromEntries(Object.entries(config.actors).map(([key, p]) => [key, [p.x, p.y, p.z]]));
    const judges = Object.keys(config.actors).filter(k => k.startsWith('JUDGE'));
    let judgeIndex = 0;
    const nextJudge = () => judges[judgeIndex++ % judges.length];
    const clone = value => JSON.parse(JSON.stringify(value));
    const add = entry => {
      entry.positions = clone(positions); entry.duration = entry.duration || 0;
      entries.push(entry);
      if (entry.paths) Object.entries(entry.paths).forEach(([actor, points]) => { positions[actor] = points.at(-1).slice(); });
    };
    const practice = (actor, cue, extra = {}) => add({ kind: 'practice', actor, text: q[cue], cue, sourceIndex: -1, ...extra });
    const movement = (actor, points, cue, sourceIndex, camera) => {
      const path = [positions[actor].slice(), ...points];
      add({ kind: 'move', actor, text: q[cue], cue, sourceIndex, paths: { [actor]: path }, duration: this.pathLength(path) / 1.15, camera: 'WIDE', silent: true });
    };
    const witnessBlock = (side, sourceIndex, testimony) => {
      if (!q) return;
      const sign = side === 'DEFENSE' ? -1 : 1, other = side === 'DEFENSE' ? 'PROSECUTION' : 'DEFENSE';
      const witness = 'WITNESS_' + side, box = config.witnesses[side];
      const home = config.actors[side], otherHome = config.actors[other], witnessHome = config.actors[witness];
      const camera = side === 'DEFENSE' ? 'WITNESS' : 'WITNESS_OTHER';
      const entry = [box.x - sign * 0.85, 0, box.z];
      const counselSpot = [box.x - sign * 1.35, 0, box.z + 1.25];
      const mainKey = side + ':' + sourceIndex + ':main', crossKey = side + ':' + sourceIndex + ':cross';
      const releaseId = side + ':' + sourceIndex + ':release';
      const returnId = side + ':' + sourceIndex + ':return-counsel';
      practice(side, 'permission', { sourceIndex, camera: side, lookAt: 'JUDGE' });
      practice(nextJudge(), 'grant', { sourceIndex, camera: 'JUDGE' });
      practice(nextJudge(), 'call', { sourceIndex, camera });
      movement(witness, [[sign * 0.5, 0, 3.8], [sign * 0.5, 0, 1.6], [entry[0], 0, 1.6], entry, [box.x, 0, box.z]], 'call', sourceIndex, camera);
      movement(side, [[home.x, 0, 1.6], [entry[0], 0, 1.6], [entry[0], 0, counselSpot[2]], counselSpot], 'move', sourceIndex, camera);
      practice(side, 'question', { sourceIndex, camera, lookAt: witness });
      if (testimony) add({ ...testimony, actor: witness, kind: 'dialogue', sourceIndex, camera, lookAt: side });
      else add({ kind: 'await-answer', actor: witness, sourceIndex, text: q.waiting, cue: 'waiting', answerKey: mainKey, side, silent: true, camera, lookAt: side });
      movement(side, [[entry[0], 0, counselSpot[2]], [entry[0], 0, 1.6], [home.x, 0, 1.6], [home.x, home.y, home.z]], 'return', sourceIndex, camera);
      add({ kind: 'choice', actor: nextJudge(), sourceIndex, text: q.followUp, cue: 'followUp', questionKey: crossKey, exitId: releaseId, witness, side, silent: true, camera, other });
      practice(other, 'cross', { sourceIndex, camera: other, lookAt: 'JUDGE' });
      practice(nextJudge(), 'grant', { sourceIndex, camera: 'JUDGE' });
      movement(other, [[otherHome.x, 0, 1.8], [0, 0, 1.8], [entry[0], 0, 1.6], [entry[0], 0, counselSpot[2]], counselSpot], 'move', sourceIndex, camera);
      add({ kind: 'question', actor: other, sourceIndex, camera, lookAt: witness, questionKey: crossKey, text: q.question });
      add({ kind: 'await-answer', actor: witness, sourceIndex, text: q.waiting, cue: 'waiting', answerKey: crossKey, side, silent: true, camera, lookAt: other });
      add({ kind: 'choice', actor: nextJudge(), sourceIndex, text: q.followUp, cue: 'followUp', questionKey: crossKey + ':next', exitId: returnId, witness, side, silent: true, camera, other, repeat: true });
      movement(other, [[entry[0], 0, counselSpot[2]], [entry[0], 0, 1.6], [0, 0, 1.8], [otherHome.x, 0, 1.8], [otherHome.x, otherHome.y, otherHome.z]], 'return', sourceIndex, 'WIDE');
      entries[entries.length - 1].id = returnId;
      practice(nextJudge(), 'release', { id: releaseId, sourceIndex, camera: 'WIDE' });
      movement(witness, [entry, [entry[0], 0, 1.6], [sign * 0.5, 0, 1.6], [sign * 0.5, 0, 3.8], [witnessHome.x, 0, witnessHome.z]], 'return', sourceIndex, 'WIDE');
    };
    const explicitSides = new Set(script.filter(s => s.actor.startsWith('WITNESS_')).map(s => s.actor.replace('WITNESS_', '')));
    script.forEach((source, index) => {
      if (guided && q && source.actor.startsWith('WITNESS_')) {
        witnessBlock(source.actor.replace('WITNESS_', ''), index, source);
        return;
      }
      const actor = source.actor === 'JUDGE' ? nextJudge() : source.actor;
      add({ ...source, actor, kind: 'dialogue', sourceIndex: index, camera: actor.startsWith('JUDGE') ? 'JUDGE' : actor,
        gesture: /objection|आपत्ति|అభ్యంతరం/i.test(source.text) ? 'objection' : 'speaking' });
      if (guided && q && ['DEFENSE', 'PROSECUTION'].includes(source.actor) && !done.has(source.actor) && !explicitSides.has(source.actor)) {
        done.add(source.actor); witnessBlock(source.actor, index);
      }
    });
    return entries;
  },

  pathLength(points) {
    return points.slice(1).reduce((distance, p, i) => distance + Math.hypot(...p.map((v, k) => v - points[i][k])), 0);
  },
  pointOnPath(points, fraction) {
    const total = this.pathLength(points), distance = Math.max(0, Math.min(1, fraction)) * total;
    let walked = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], length = Math.hypot(...b.map((v, k) => v - a[k]));
      if (walked + length >= distance && length > 0) {
        const t = (distance - walked) / length;
        return { point: a.map((v, k) => v + (b[k] - v) * t), angle: Math.atan2(b[0] - a[0], b[2] - a[2]) };
      }
      walked += length;
    }
    return { point: points.at(-1).slice(), angle: 0 };
  }
};

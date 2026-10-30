# Nyay Setu: 120 likely hackathon/viva questions with honest answers

30 October 2026 code audit par based. Answers Hinglish mein hain, taaki tum directly explain kar sako. Questions exhaustive prediction nahi; yeh architecture, models, code, trade-offs, limitations aur demo ke likely follow-ups cover karte hain. Detailed explanation: [technical guide](hackathon-technical-guide-hinglish.md). Proof/file links: [code map](hackathon-code-map.md).

## Product aur architecture

### 1. Tumhara project exactly kya karta hai?

Nyay Setu citizen legal guidance, advocate workspace aur interactive courtroom practice ko combine karta hai. Real AI assistant and practice engine implemented hain; some secondary features prototype/demo state mein hain.

### 2. Target users kaun hain?

Citizens who need understandable legal information and preparation, advocates managing client/case workflow, aur verification desk admins. Real legal representation and professional decisions qualified advocates ke paas rehte hain.

### 3. Typical user journey kya hai?

Account/login → situation explain → contextual chat/follow-up → source/unknowns inspect → optional court practice → lawyer discovery/consultation request. Advocate request review and case/workspace manage karta hai.

### 4. Technical stack ek sentence mein?

Vanilla HTML/CSS/JS SPA, Express/Node API, Python/Flask AI service, Gemini generation, MiniLM+Chroma retrieval, MySQL with legacy JSON workspaces, Three.js3D and browser speech.

### 5. Frontend React mein hai?

Nahi. Custom JavaScript page renderers, hash router and simple stores hain. React/Vue migration possible hai; current implementation ko React bolna incorrect hoga.

### 6. Frontend/backend/AI separate kyun?

Browser UI/graphics owns, Express accounts/business APIs owns, Python retrieval/model workflow owns. Libraries and future scaling requirements differ; currently deployment local processes hai, elaborate distributed infrastructure nahi.

### 7. Ports kaunse hain?

Backend3000, AI5000, MySQL default3306. Production mein reverse proxy/HTTPS ke through public routing planned ho sakti hai; current code local assumptions contains.

### 8. Single-page application kya hai?

HTML shell once load hota hai; hash route ke according JS app container ka content change karta hai. Full-page reload har navigation par required nahi.

### 9. Hash router kyun?

`#/chat` etc server rewrite rules ke bina static-hosted routes work karte hain. Trade-off: URL semantics/SEO; server-rendered content or history routing different needs solve kar sakte hain.

### 10. App ka main execution entry point?

Server side `backend/src/server.js` → app/config/routes. AI `ai-service/src/app.py`. Each portal HTML loads scripts then portal `js/app.js` registers routes on DOMContentLoaded.

### 11. Old chat code aur actual active chat mein kya difference?

`assistant_chat.js` old chatbot methods replace karta hai. `assistant_threads.js` new storage owns. Final behaviour samajhne ke liye script order and overrides inspect karne padte hain.

### 12. Kya entire product finished hai?

Working prototype hai. AI chat/court and multiple business/data flows exist; payment gateway, real calls, universal document analysis, some save/intake flows and production authorization hardening incomplete hain.

## Models aur RAG

### 13. Kaunsa LLM use ho raha hai?

Primary configured Gemini3.1 Flash-Lite. Chat and court ke fallback lists different hain. Health response configured label batata hai, individual turn ka actual successful model nahi.

### 14. Court fallback kya hai?

Court transport eligible preferred model plus configured Gemini3.1 Flash-Lite /3.5 Flash-Lite candidates se maximum two attempts chooses. Availability/quota account-specific verify karna padta hai.

### 15. Gemini kyun choose kiya?

Multilingual text and structured outputs without maintaining own LLM server. Flash-Lite latency/cost-oriented starting point hai; better-than-all-models benchmark humne establish nahi kiya.

### 16. Kya apna model train kiya?

Nahi. Training/preprocessing/evaluation module placeholders empty hain. Hosted pretrained LLM + pretrained embedding model + retrieval/prompt orchestration use hota hai.

### 17. Fine-tuning aur RAG mein kya difference?

Fine-tuning model weights/task behaviour updates. RAG external passages inference context mein retrieves. Sources update/inspect karne ke liye RAG useful, but truth guarantee dono se automatically nahi aati.

### 18. Embedding model kaunsa hai?

Loaded corpus metadata `all-MiniLM-L6-v2` sentence-transformer on CPU specifies. Stored dimension384 hai. Yeh text generate nahi karta.

### 19. 384 dimensions ka kya matlab?

Each text/query384 numeric values se represent hota hai. Yeh384 legal categories/features ya accuracy points nahi hain; learned semantic representation ka size hai.

### 20. MiniLM kyun, Gemini embeddings kyun nahi?

Current corpus local MiniLM vectors se built hai; local query encoding per-query remote embedding API avoid karta hai. Different encoder choose karne par consistency, re-indexing, language/domain quality and cost evaluate karne honge.

### 21. Chroma kyun, MySQL mein search kyun nahi?

Chroma vector similarity and associated passages provides; MySQL identity/business relations handles. SQL full-text lexical matching useful alternative/complement hai, semantic retrieval ka identical substitute nahi.

### 22. Current vector count kya hai?

24,776. Ye retrieved corpus records/chunks hain, verified unique judgments ka count nahi.

### 23. Kaunse five categories configured hain?

Constitutional writs, murder/homicide, UAPA/terrorism, rape/POCSO, narcotics/NDPS. Current loaded runtime mein only narcotics collection populated hai.

### 24. Baaki four categories ki files toh hain?

Folders/SQLite files present hain but read-only check mein collection rows absent and embeddings zero mile. Folder existence populated searchable corpus prove nahi karta.

### 25. RAG ka actual flow kya hai?

Language/English query analysis → keyword category routing → query embedding/vector search → distance/relevance filter → source IDs/excerpts → LLM draft → consistency review → local checks → rendered answer.

### 26. Category router ML model hai?

Nahi, keyword scoring heuristic hai: matching keywords add score, top two matching categories selected. Unmatched query all configured categories try kar sakti hai.

### 27. Search similarity kaise measure hoti hai?

Loaded collection cosine distance uses, HNSW approximate nearest-neighbor search ke saath. Lower distance semantically closer; legal equivalence/correctness prove nahi hoti.

### 28. Threshold0.58 ka matlab58% accuracy hai?

Nahi. Distance<0.58 relevance filter hai. Accuracy evaluate karne ke liye labeled test queries and relevance judgments chahiye.

### 29. top_k kitna hai?

Chat grounding6 asks, but each queried collection maximum5 candidates returns. Since one collection loaded hai, actual retrieved count5 ya less ho sakta hai.

### 30. HNSW kyun use ho raha hai?

Chroma single-node index high-dimensional vectors ko approximate graph search se finds. Speed/recall trade-off hai; every query ka exact exhaustive distance scan claim nahi.

### 31. Chunking kya hai?

Long document smaller passages mein divide karna. Repository Supreme Court ingestion script1200-character chunks with150-character overlap specifies; active prebuilt corpus ka entire creation history is script se proven nahi.

### 32. Overlap kyun?

Boundary par relevant condition lose hone ka risk reduce karta hai. More duplicate text/storage/prompt tokens ka trade-off hai.

### 33. Ingestion script run karke runtime database ready ho jayega?

Directly all five nahi. Script destinations/collection names active category runtime se different hain. Reproducible pipeline wiring and missing LangChain dependency correct karni hai.

### 34. Kya model har question par entire DB read karta hai?

Nahi. Vector retrieval selected small passages returns; unhi excerpts plus user context model ko bheje jate hain. Entire corpus context mein upload nahi hota.

### 35. Relevant source na mile toh?

Conditional practical guidance with coverage note, missing facts/questions and no fabricated exact statutory numbers. Strong unsupported claims persist karein to fallback/error available hai.

### 36. Tenancy query par NDPS judgments kyun nahi dikhate?

Extra domain guard non-drug query se narcotics matches removes. Generic “recovery” or “witness” semantic/keyword overlap irrelevant authority create na kare.

### 37. Sources S1/S2 kaise verify hote hain?

IDs retrieved excerpts ko bind karte hain. Unknown IDs strip; only used sources return. ID validity passage ki interpretation/current applicability ka complete verification nahi.

### 38. Language support kitni hai?

Core conversation/practice dictionary15 languages contains, including English. Some comments say22, but audited dictionary/voice support ko exact distinguish karna chahiye.

### 39. Hindi query English kyun translate hoti hai?

Stored corpus/search terms predominantly English hain. Output selected language mein rehta hai. Translation legal facts distort kar sakti hai, so original words factual authority hain.

### 40. Ek chat mein kitni LLM calls?

Normally detection + draft + review =3 logical calls, optional repair makes4. Provider retries/fallbacks add attempts; fixed one-call architecture nahi.

### 41. Review independent legal verification hai?

Nahi. Separate prompt/model call context consistency checks karta hai; same provider family errors correlate ho sakte hain. Human professional/current-law verification replace nahi hoti.

### 42. Temperature0.2 kyun?

Output variation control karne ke liye relatively conservative setting. Zero/low temperature bhi wrong facts produce kar sakta hai; correctness safeguards separate hain.

### 43. JSON output kyun?

Machine-readable fields UI and court controls ko reliable structure dete hain. Schema/normalization wrong actors, missing questions and incomplete turns reject kar sakte hain; truth still separate issue.

### 44. Conversation memory unlimited hai?

Nahi. Chat up to20 messages, otherwise first4+last16, per-message and total character caps. Court completed transcript retains more, but body/model limits still apply.

### 45. Kya response streaming hai?

Nahi. Current fetch full JSON waits, phir answer renders. Streaming future design option hai; reviewed final text safely stream karne ki policy chahiye.

### 46. PDF/image automatically analyze hote hain?

Current chat text/CSV reads. Nontext attachment mostly metadata, explicitly asks user for relevant text. Court statutory PDF extractor separate fixed-source review feature hai.

### 47. Feedback se model learn karta hai?

No weight updates. Feedback stored and retry original request ko better answer ke instructions ke saath sends. Fine-tuning/RL pipeline absent.

### 48. Zero hallucination guarantee de sakte ho?

Nahi. Retrieval, second review, source filters and fallbacks reduce risks. No measured zero-error legal benchmark established.

## Court simulation aur graphics

### 49. Court simulation ka AI part kya hai?

Accepted case record se next structured dialogue/question/AI witness answer generate hota hai. Procedural controls/rendering deterministic JavaScript owns.

### 50. Three.js kyun?

Browser-based3D existing JS app mein integrate hoti hai. Scene, camera, avatar animation and GPU rendering handle karta hai; Unity export ya Babylon different tooling trade-offs hain.

### 51. 3D model aur AI model same hain?

Nahi. GLB has geometry/materials/skeleton/animation; MiniLM/Gemini neural text-processing models hain. Talking avatar file is not trained legal reasoning model.

### 52. Frame loop kaise work karta hai?

requestAnimationFrame → time delta → animation mixers/stage motion/camera update → WebGL render. Server every frame stream/render nahi karta.

### 53. Actual courtroom replicas hain?

Representative practice layouts hain: Supreme3, High2, District1 judge. Exact institution geometry or universal real-procedure replica claim nahi.

### 54. Chat answer directly replay hota hai?

New live flow separate hearing user-authored brief se creates. AI advice itself ko witness fact turn mein copy nahi karta; older parser paths compatibility/demo ke liye exist hain.

### 55. Next court turn ka context kya hai?

Brief, completed transcript, court type, language, action, latest input, active witness identity/side/direct-cross stage/questioner. Pending drafts proven testimony nahi.

### 56. Manual witness aur AI witness control?

Defense-side manual default, explicit AI assistance allowed. Opposing-side witness AI. Backend validates active scope and manual/AI control for defense answer request.

### 57. Direct aur cross-examination ka technical distinction?

Direct mein presenting side questions its witness; cross mein opposite side. Context fields side/questioningSide/examinationStage and witnessId enforce identity through follow-ups.

### 58. DEFENSE/PROSECUTION civil case mein kyun?

Internal generic names user-side/opposing-side denote karte hain. Real civil posture-specific role mapping future improvement hai; opposing counsel always public prosecutor nahi.

### 59. User answer ko AI correct karta hai?

Human witness testimony verbatim retained. Later questions can explore inconsistency. Counsel/judge review ko original testimony silently rewrite karne ki permission nahi.

### 60. AI witness factually verified hota hai?

No. It is role/fact-constrained simulation, can include consistent nondecisive hypothetical detail under prompt constraints. It must not be treated as real evidence or certified witness reconstruction.

### 61. Objection ka flow?

Objection → bench practice/ruling turn → question edit/rephrase → reviewed replacement → witness answer gate. Objection legal merits of actual litigation decide nahi karta.

### 62. “No further questions” ka effect?

Current questioning branch ends and timeline moves toward release/return. It does not invent answer or force final case disposal.

### 63. Next button unanswered question skip kar sakta hai?

Answer gate prevents that. Answer complete/speech finish or explicit manual completion required; controls cannot silently fabricate submission.

### 64. Judge clarification kaise distinguish hoti hai?

Returned actor/question_actor retains judge identity, while witness ownership and presenting/cross counsel context remain stable. A judge direction itself witness testimony nahi.

### 65. Court API actions kaunse?

Opening, continue, react, cross_question, rephrase, witness_answer, review_question, review_turn. Each action allowed roles/output constraints has.

### 66. Court speech review ordinary chat se kaise different?

Court counsel/bench review uses bounded budget, stricter checks, exact actor/question constraints and optional fixed official PDF authority audit. Witness answer separate action/review policy follows.

### 67. Official PDFs kaunse fetch hote hain?

Fixed allowlisted India Code documents for NDPS/BNS/BNSS/BSA, when relevant. No arbitrary browser URL crawling or complete all-law research engine implemented.

### 68. Latest legal position automatically verified hai?

Nahi. Retrieved PDF may be older consolidation; date, commencement, amendments and jurisdiction remain important. Code explicitly does not confirm universal current consolidation.

### 69. Review cache safe kaise re-use hota hai?

Text/context/session/court/language/stage and record epoch bind approval; five-minute window expires. New testimony or judge changes invalidate earlier approval. Markers are internal state, not legal certification.

### 70. Court API fail ho toh progress lost?

Accepted record/drafts/snapshots retained, retry/manual controls remain. Retryable brief pause automatic retry once ho sakti hai; quota/outage still wait require kar sakta hai.

### 71. Time budgets kya hain?

Generation34s, <=16s per eligible attempt; review up to20s within overall58s action bound; proxy70s, browser75s. Automatic second request can extend total user wait.

### 72. Stale reply wrong hearing mein kaise nahi aata?

AbortController, requestId, scene generation, active stage and owner checks. Late response if room/account/record/draft changed is rejected or not applied.

### 73. Saved session mein Three.js scene save hoti hai?

No. Plain JSON brief/script/transcript/room progress/drafts/camera snapshot saves. On resume scene reconstructs; GPU objects aren't serialized.

### 74. Chat delete karne se court session delete hota hai?

Current shared persistence messages tombstone karta hai, court prep retains. Separate court session delete available; user can resume retained prep library.

### 75. Accurate lip sync hai?

Existing body animation plus procedural head/gaze/gesture motion hai. Phoneme facial blend-shape lip-sync pipeline verified/implemented nahi.

### 76. 3D performance optimize kaise ki?

Buffers cached, support figures instanced, pixel budget capped, reduced-motion handling and resources disposed. Actual FPS/device benchmarks separately measure karne hain.

### 77. 4K ka matlab photorealism?

Nahi, render resolution target subject to viewport/scaling caps. Asset detail, lighting and performance separate factors hain.

### 78. WebGL/model unavailable ho toh?

WebGL error retry UI; avatar load timeout18s after simple fallback figures. Captions/manual interactions preserve useful practice where supported.

## Authentication, storage aur account isolation

### 79. Login security flow kya hai?

Password bcrypt compare → six-digit email OTP → JWT cookie + server session → strict middleware every protected operation. Frontend demo fallback is separate/incomplete authentication behaviour.

### 80. Password encryption use hoti hai?

Password bcrypt hash use hota hai, reversible encryption nahi. Server provided password ko stored hash against compares.

### 81. OTP kaise generate/store hota hai?

crypto.randomInt, bcrypt hash, five-minute expiry, single-use flag, maxfive wrong attempts. Raw code normal API response mein return nahi hota.

### 82. Resend cooldown60s hai?

Current code default30s, not stale README60s. Default sends20/15min development and5 production; environment overrides possible hain.

### 83. JWT kyun aur session table bhi kyun?

JWT signature/expiry authenticity checks; session row revocation/device lifecycle allows. Purely stateless JWT expiry se pehle logout enforce karna difficult hota without revocation state.

### 84. HttpOnly se app completely XSS-safe hai?

No. Cookie JS-readable nahi, but malicious JS authenticated requests/DOM data still affect kar sakta hai. Escaping/CSP/dependency/authorization controls remain essential.

### 85. Token JS ko kabhi nahi milta?

Current OTP response JSON also includes token, so blanket claim false. Intended browser flow uses cookie; response contract should be cleaned if cookie-only security intended hai.

### 86. Authorization ka main issue kya hai?

Some business routes optionalAuth use and supplied IDs/fixed fallbacks accept karti hain. Strict middleware and per-record ownership should be consistent; parameterized SQL alone enough nahi.

### 87. Google login fully integrated hai?

Not securely end-to-end. Browser token payload decode/local profile writes; server Google credential verification and authenticated cookie/account-link flow absent.

### 88. Offline login fallback safe hai?

It can show synthetic local signed-in UI on network failure. Strict APIs still need real cookie, but this UX cannot be presented as genuine verified login. Demo mode isolate/fail closed needed.

### 89. Logout kya karta hai?

Current server session revoke + cookie clear; frontend snapshot/pending challenge clear and login navigation. Network failure and optionalAuth paths mean universal revocation guarantees incomplete.

### 90. Account switching supported kaise hai?

Logout/login journey; dedicated multi-account switcher absent. Shared cookie/UI key means portals/tabs not independently logged into unlimited accounts. Assistant owner scoping stronger and tested.

### 91. Browser data isolation mein gap?

Advocate cache global key, cleanup references window.Store while Store is top-level const, pending sync timers not cleared. Scope by owner and cancel work on change; tests for assistant don't certify whole app isolation.

### 92. Server user response credential leak risk?

publicUser strips camelCase passwordHash while MySQL adapter also includes password_hash. Allowlisted public DTO needed so alias cannot accidentally serialize; audit found this statically, no live secret dump done.

### 93. Database MySQL hai ya PostgreSQL?

Current runtime MySQL connectivity8.0.45 verified; JSON layer also active. PostgreSQL SQL mirror/docs exist but runtime driver mysql2 hai.

### 94. JSON file kyun abhi bhi hai?

Legacy local workspaces/security/fallback persistence. Simple demo benefit, but mixed dual writes and concurrency limitations. Production canonical DB migration needed.

### 95. Atomic file rename transaction hota hai?

Nahi. It reduces partial-file risk, but multiple entities/processes ke commit/rollback, constraints or isolation provide nahi karta.

### 96. AI chat server par kaise save hota hai?

ai_conversation_threads with owner_id/thread id composite primary key, revision and LONGTEXT JSON payload. Local copies cache changes while MySQL sync unavailable.

### 97. Same chat two tabs edit kare toh?

Expected revision conditional UPDATE; stale tab gets409 and retains local copy. Automatic merge nahi, avoiding silent overwrite is the implemented guarantee.

### 98. localStorage secure encrypted database hai?

No. It is browser persistent JS-readable storage. UI/cache convenience; sensitive data policies, access control and at-rest encryption are separate requirements.

### 99. Forgot/reset flow complete verified hai?

Random single-use30-minute hashed reset token and session revocation logic exist. Reset link citizen route parity and logger missing-request bug need correction/integration verification.

### 100. Admin aur advocate permissions same hain?

Admin queue/decide routes require admin role; ordinary authenticated users should not gain them. Public signup allowed-role validation and every business endpoint still need consistent hardening.

## Integrations, limitations, evidence aur future work

### 101. Advocate verification official registry se hoti hai?

No live official Bar Council integration in code. Format/internal duplicate checks plus manual desk review, clearly labeled simulation/submission stages.

### 102. Liveness/fake document detection model kaunsa?

None attached. Identity flags and uploaded files await manual review. No OCR/biometric authenticity score should be claimed.

### 103. Upload actual hai ya demo?

Advocate credential/exhibit uploads actual Multer disk files + metadata, type/size and owner checks. Citizen chat PDF content analysis separate and incomplete hai.

### 104. Files encrypted end-to-end hain?

No demonstrated end-to-end crypto protocol/key management in current code. Local disk storage/access controls are not E2EE. UI confidentiality claims need correction.

### 105. Real payment gateway kaunsa?

None. Payment-style screen books consultation; ledger/CSV exist. No verified charge/capture/webhook/payout integration found.

### 106. Video consultation real call hai?

Not currently. Local preview controls/timer/chat; WebRTC signaling/media transport absent.3D practice rendering is a different real browser feature.

### 107. Lawyer matching ka AI model?

No trained matcher implemented; placeholder empty. Keyword/specialization filtering and list presentation exist;98% badge static, not evaluated prediction.

### 108. Dashboard AI insights kis model se?

Date/request/document status rules. Separate real conversational assistant uses Gemini; same “AI” wording across UI should not conflate them.

### 109. Tell-us analysis live AI hai?

That older screen currently canned property classification after timeout. Real model flow is shared chat; tell-us create handler also lacks actual insertion.

### 110. Notifications real time kaise?

Database records + fetch/polling; advocate dashboard12s interval. No WebSocket event push or guaranteed background mobile notification infrastructure.

### 111. Demo data production se separate hai?

Incomplete: backend seed flag false and citizen demo false, advocate DEMO_ACTIVE true. Explain displayed synthetic records and unify demo isolation before real usage.

### 112. Speech model kaunsa?

Chat input browser SpeechRecognition; output browser/OS synthesis. Custom Flask fallback uses Google Translate TTS, not Gemini speech model. Availability/privacy browser-dependent.

### 113. User ka data cloud ko jata hai?

Case text/history and selected excerpts Gemini generation/review requests mein send hote hain. Browser STT/speech provider can be remote. Current court fallback only fixed cues sends by client policy; full offline/privacy guarantee inappropriate.

### 114. Tests kitne pass hain aur kis type ke?

Audit mein80 JS and83 Python regression tests pass. Mostly deterministic fixtures/mocked provider transport, state/control/render escaping/API contract checks. They aren't legal-accuracy or full production penetration tests.

### 115. Accuracy kitni hai?

No defensible percentage measured. Need labeled legal QA/retrieval/factuality tasks, source relevance/faithfulness, abstention, expert review and temporal/jurisdiction coverage. Number invent nahi karna.

### 116. API cost kitni per user?

Not measured. Sum input/output tokens across detection/draft/review/repair/retries times current model rates, plus hosting/email/storage. Usage logging and benchmark traffic needed for reliable per-user estimates.

### 117.1000 users aayen toh kya change karoge?

Canonical SQL persistence, shared sessions/rate limits, bounded AI worker concurrency, queues, production server/reverse proxy, private object storage, monitoring and load tests. Current JSON/memory layer multi-worker safe assume nahi karenge.

### 118. First improvements kya honge?

Fix server auth/ownership and credential serialization; isolate demo data; repair case/save/reset flows; unify data layer; add missing legal corpus/evaluation. Then gateway/WebRTC/streaming and UI modularization as requirements justify.

### 119. Judges bolein “ChatGPT wrapper hai” toh?

Hosted LLM is one component. Engineering includes routed local legal retrieval, constrained/reviewed responses, owner-scoped durable chat/revision control, incremental witness/cross-examination state machine,3D execution, cancellation and resumable preparation. Also accept gaps honestly; differentiate implementation without claiming unique research absent evidence.

### 120. Project ka strongest defensible final statement?

“We have a working multilingual conversational and courtroom-practice prototype with visible source limits, recoverable state and tested workflow controls. We can demonstrate its current behaviour and explain its implementation. Production security, broader verified legal coverage and real payment/media integrations are the next concrete milestones.”

## 10 answers jo turant yaad hone chahiye

1. LLM = Gemini; embedding = MiniLM 384d; 3D asset = GLB.
2. Custom training/fine-tuning nahi; inference-time retrieval hai.
3. 24,776 vectors, not 24,776 proven unique judgments.
4. Five configured categories, one currently populated/loaded.
5. Ordinary chat normally3 logical LLM calls, optional repair adds one.
6. Three.js animation renders; model next dialogue generates.
7. JWT cookie + server session; current token-body/serialization gaps acknowledged.
8. MySQL business records + JSON legacy workspaces + Chroma passages + browser cache.
9. Payment/video/98% match/static analysis ko implemented AI integration mat bolo.
10. 80+83 tests pass; zero hallucinations/100% security/guaranteed outcomes claim nahi.

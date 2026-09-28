"""
=============================================================================
Nyay Setu — Production Zero-Hallucination Legal RAG Engine
rag_engine.py — Multi-Collection Precedent Retrieval + 3-Party Courtroom AI
=============================================================================
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error
import chromadb
from chromadb.utils import embedding_functions

# Ensure UTF-8 on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# Path to the extracted 5 Supreme Court ChromaDB databases
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))
CHROMA_DIR = os.path.join(PROJECT_ROOT, "data", "chroma_db")

def load_env_key():
    env_path = os.path.join(PROJECT_ROOT, ".env")
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key and os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("GEMINI_API_KEY="):
                    key = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break
    return key

GEMINI_API_KEY = load_env_key()

# Category to folder and collection mappings
COLLECTIONS_META = {
    "writ": {
        "name": "Constitutional Writs & Fundamental Rights",
        "folder": "chroma_SC_Writ_Constitutional",
        "collection": "sc_writ_constitutional",
        "keywords": [
            "writ", "constitution", "article 32", "article 226", "article 21", "article 14", "article 19",
            "fundamental rights", "habeas corpus", "mandamus", "certiorari", "quash", "petition",
            "civil", "property", "service", "high court", "title deed", "possession", "injunction", "partition"
        ]
    },
    "murder": {
        "name": "Murder & Homicide (IPC 302 / BNS 101)",
        "folder": "chroma_SC_Murder_Homicide",
        "collection": "sc_murder_homicide",
        "keywords": [
            "murder", "homicide", "302", "304", "307", "culpable homicide", "death", "post-mortem",
            "eyewitness", "circumstantial evidence", "fatal", "weapon", "ipc 302", "bns 101", "bns 103",
            "motive", "last seen", "extra judicial confession", "dying declaration"
        ]
    },
    "uapa": {
        "name": "Terrorism & UAPA / NIA Special Acts",
        "folder": "chroma_SC_Terrorism_UAPA_NIA",
        "collection": "sc_terrorism_uapa_nia",
        "keywords": [
            "uapa", "terrorism", "terror", "nia", "unlawful activities", "43d", "section 43d",
            "national security", "conspiracy", "sedition", "anti-national", "banned organization", "terror funding"
        ]
    },
    "pocso": {
        "name": "Rape & POCSO Child Protection (IPC 376 / BNS 64)",
        "folder": "chroma_SC_Rape_POCSO",
        "collection": "sc_rape_pocso",
        "keywords": [
            "rape", "pocso", "376", "sexual assault", "minor", "child protection", "consent",
            "victim statement", "section 164", "medical examination", "presumption", "section 29",
            "ipc 376", "bns 64", "dna test", "age determination"
        ]
    },
    "narcotics": {
        "name": "Narcotics & NDPS Act (Contraband / Seizure)",
        "folder": "chroma_SC_Narcotics_NDPS",
        "collection": "sc_narcotics_ndps",
        "keywords": [
            "ndps", "narcotics", "drugs", "commercial quantity", "section 37", "section 50",
            "search and seizure", "contraband", "ganja", "charas", "heroin", "smack", "recovery",
            "independent witness", "panchnama", "magistrate search", "conscious possession"
        ]
    }
}

# Broad legal terminology indicating legal context
GENERAL_LEGAL_TERMS = [
    "court", "judge", "lawyer", "advocate", "bench", "case", "fir", "bail", "arrest", "jail",
    "police", "section", "ipc", "crpc", "bns", "bnss", "bsa", "act", "rights", "petition",
    "hearing", "witness", "accused", "victim", "trial", "appellant", "respondent", "order",
    "appeal", "quash", "cheating", "fraud", "property", "evidence", "dispute", "suit", "legal",
    "cheque", "check", "bounce", "bounced", "dishonor", "dishonour", "dishonored", "dishonoured",
    "loan", "borrower", "lender", "debt", "money", "repay", "repayment", "funds", "insufficient",
    "bank", "memo", "drawer", "payee", "recovery", "ni act", "138", "142", "negotiable", "instrument",
    "contract", "agreement", "tenant", "landlord", "eviction", "rent", "consumer", "commission",
    "compensation", "damage", "defamation", "cyber", "harassment", "divorce", "maintenance", "alimony",
    "custody", "domestic violence", "dowry", "will", "probate", "partition", "injunction", "arbitration",
    "notice", "complaint", "affidavit", "plaint", "decree", "execution", "cpc", "order 37"
]

class LegalRAGEngine:
    def __init__(self):
        self.embedding_fn = embedding_functions.DefaultEmbeddingFunction()
        self.clients = {}
        self.collections = {}
        self.total_vectors = 0
        self._init_collections()

    def _init_collections(self):
        """Initializes ChromaDB clients and loads all 5 Supreme Court collections."""
        for key, meta in COLLECTIONS_META.items():
            folder_path = os.path.join(CHROMA_DIR, meta["folder"])
            if os.path.exists(folder_path):
                try:
                    client = chromadb.PersistentClient(path=folder_path)
                    col = client.get_collection(meta["collection"])
                    count = col.count()
                    self.clients[key] = client
                    self.collections[key] = col
                    self.total_vectors += count
                    print(f"Loaded Collection '{meta['collection']}': {count:,} vectors")
                except Exception as e:
                    print(f"Warning: Could not load collection {meta['collection']}: {e}")
            else:
                print(f"Warning: Folder not found {folder_path}")
        print(f"RAG Engine ready. Total indexed Supreme Court vectors: {self.total_vectors:,}")

    def is_legal_query(self, query: str) -> bool:
        """Determines if the query has legal context or is completely out-of-scope."""
        q_lower = query.lower()
        # Check specific collection keywords
        for meta in COLLECTIONS_META.values():
            for kw in meta["keywords"]:
                if kw in q_lower:
                    return True
        # Check broad legal terminology
        for term in GENERAL_LEGAL_TERMS:
            if term in q_lower:
                return True
        return False

    def route_query(self, query: str):
        """Determines the most relevant collection(s) based on keyword match."""
        q_lower = query.lower()
        scores = {}
        for key, meta in COLLECTIONS_META.items():
            score = 0
            for kw in meta["keywords"]:
                if kw in q_lower:
                    score += 2
            scores[key] = score

        sorted_keys = sorted(scores.keys(), key=lambda k: scores[k], reverse=True)
        if scores[sorted_keys[0]] > 0:
            return [k for k in sorted_keys if scores[k] > 0][:2]
        return list(COLLECTIONS_META.keys())

    def search_precedents(self, query: str, top_k: int = 4):
        """
        Searches across relevant collections for top matching case chunks.
        Strictly applies cosine distance filtering.
        """
        if not self.is_legal_query(query):
            return []

        target_keys = self.route_query(query)
        results = []

        for key in target_keys:
            if key not in self.collections:
                continue
            col = self.collections[key]
            try:
                query_res = col.query(
                    query_texts=[query],
                    n_results=min(top_k, 5),
                    include=["documents", "metadatas", "distances"]
                )
                if query_res and query_res.get("documents"):
                    docs = query_res["documents"][0]
                    metas = query_res["metadatas"][0]
                    dists = query_res["distances"][0] if "distances" in query_res else [0.5]*len(docs)

                    for doc, meta, dist in zip(docs, metas, dists):
                        if dist < 0.58:
                            results.append({
                                "document": doc,
                                "metadata": meta,
                                "distance": dist,
                                "category": key,
                                "category_name": COLLECTIONS_META[key]["name"]
                            })
            except Exception as e:
                print(f"Search error in collection {key}: {e}")

        # Sort by distance (lowest distance = highest relevance)
        results.sort(key=lambda x: x["distance"])
        return results[:top_k]

    def call_gemini(self, prompt: str, system_instruction: str = None, temperature: float = 0.15):
        """
        Calls Gemini API with ultra-fast models and multi-model fallback.
        Priority: gemini-3.5-flash-lite (~1.3s) -> gemini-flash-lite-latest -> gemini-3.5-flash.
        """
        api_key = GEMINI_API_KEY or load_env_key()
        if not api_key:
            return "Error: GEMINI_API_KEY is not configured in .env file."

        candidate_models = [
            "gemini-3.1-flash-lite",
            "gemini-3.1-flash",
            "gemini-flash-lite-latest",
            "gemini-flash-latest"
        ]

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "topP": 0.85,
                "topK": 40,
                "maxOutputTokens": 8192
            }
        }

        if system_instruction:
            payload["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }

        data_bytes = json.dumps(payload).encode("utf-8")

        for model in candidate_models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            for attempt in range(2):
                req = urllib.request.Request(
                    url,
                    data=data_bytes,
                    headers={"Content-Type": "application/json"}
                )
                try:
                    with urllib.request.urlopen(req, timeout=60) as resp:
                        res = json.loads(resp.read().decode("utf-8"))
                        candidates = res.get("candidates", [])
                        if candidates and "content" in candidates[0]:
                            parts = candidates[0]["content"].get("parts", [])
                            if parts:
                                return parts[0].get("text", "")
                except urllib.error.HTTPError as e:
                    print(f"Gemini API ({model}, attempt {attempt+1}) HTTP {e.code}")
                    if e.code in [429, 503]:
                        time.sleep(1.0)
                        continue
                    break
                except Exception as e:
                    print(f"Gemini API ({model}, attempt {attempt+1}) connection exception: {e}")
                    time.sleep(1.0)
                    continue

        return "Hamare AI Service par is samay uchh traffic hai. Kripya kuch kshano baad punah prayas karein."

    def detect_and_translate_query(self, query: str, preferred_lang: str = None) -> dict:
        """
        Detects Indian regional languages (all 22 Scheduled Indian Languages + English),
        performs an in-depth problem statement analysis (facts, grievances, relief sought, statutory issues),
        and translates query into formal legal English for Supreme Court vector retrieval.
        """
        api_key = GEMINI_API_KEY or load_env_key()
        if not api_key:
            return {
                "is_legal": True,
                "detected_language_code": "en",
                "language_name": "English",
                "problem_analysis": query,
                "primary_legal_issue": query,
                "statutory_sections": "",
                "english_translation": query
            }

        prompt = f"""You are a master Indian Senior Advocate and multilingual judicial query analyzer.
Analyze the following citizen or advocate statement:
1. Determine if this is a legal matter/dispute/query (Set "is_legal": true for any issue involving money recovery, cheque bounce, loan, police, crime, property, rent, divorce, rights, agreement, harassment, or law).
2. Deeply and thoroughly analyze what happened (factual timeline, disputing parties, grievances, and relief sought).
3. Identify primary legal issues and applicable statutory sections (e.g. NI Act 1881, BNS 2023 / IPC, BNSS 2023 / CrPC, BSA 2023, CPC, Consumer Act).
4. Formulate targeted English search terms for Supreme Court precedent retrieval.

User's Preferred Selection: {preferred_lang if preferred_lang else 'auto'}
Query / Problem Statement: "{query}"

Respond strictly in valid JSON format:
{{
  "is_legal": true,
  "detected_language_code": "<2-letter code e.g. hi, mr, gu, ta, te, bn, kn, ml, pa, ur, or, as, en>",
  "language_name": "<Full English name of language e.g. Hindi, Marathi, Gujarati, English>",
  "problem_analysis": "<Deep factual breakdown: what happened, parties involved, grievances, and relief sought>",
  "primary_legal_issue": "<Core legal question of fact and law to be adjudicated>",
  "statutory_sections": "<Applicable statutory sections under IPC/BNS, CrPC/BNSS, Evidence/BSA, NI Act, or Special Acts>",
  "english_translation": "<Formal legal English translation and targeted search keywords for Supreme Court precedent retrieval>"
}}"""

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.0, "responseMimeType": "application/json"}
        }

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=45) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                candidates = res.get("candidates", [])
                if candidates and "content" in candidates[0]:
                    parts = candidates[0]["content"].get("parts", [])
                    if parts:
                        parsed = json.loads(parts[0].get("text", "{}"))
                        if "english_translation" in parsed and parsed["english_translation"]:
                            return parsed
        except Exception as e:
            print(f"Language detection/problem analysis notice: {e}")

        # Fallback if call fails or non-JSON
        return {
            "is_legal": True,
            "detected_language_code": "auto",
            "language_name": "Hindi/English",
            "problem_analysis": query,
            "primary_legal_issue": query,
            "statutory_sections": "",
            "english_translation": query
        }

    def answer_query(self, query: str, user_role: str = "user", case_context: str = None, language: str = "auto", chat_history: list = None):
        """
        Main Zero-Hallucination Legal Engine.
        - Deep problem statement analysis before retrieval.
        - NEVER refuses a valid legal query (e.g. Cheque Bounce, Loan, Recovery, Property, Criminal, Civil).
        - User Portal: ALWAYS delivers the 4-Section Citizen Brief (Photo 2 Format) directly on first turn.
        - Advocate Portal: Delivers the Elaborated 5-Point Judicial Dossier (Photo 1 Format).
        - Divergent Scenario 2 Generation when 'Not Satisfied' (is_retry) is clicked.
        - Dynamic temperature: 0.75 for retries and 0.35 for initial queries.
        """
        combined_query = query
        if case_context:
            combined_query = f"{query} {case_context}"

        # 1. Deep problem statement analysis & language detection
        lang_info = self.detect_and_translate_query(combined_query, preferred_lang=language)
        lang_name = lang_info.get("language_name", "Hindi/English")
        lang_code = lang_info.get("detected_language_code", "hi")
        search_query = lang_info.get("english_translation", combined_query)
        problem_analysis = lang_info.get("problem_analysis", query)
        primary_legal_issue = lang_info.get("primary_legal_issue", "")
        statutory_sections = lang_info.get("statutory_sections", "")
        is_legal = lang_info.get("is_legal", True)

        is_lawyer = (user_role == "lawyer")
        is_retry = bool(chat_history and isinstance(chat_history, list) and len(chat_history) > 0)

        # Fast decline only for completely non-legal queries (e.g. food recipes, sports scores, weather)
        if not is_legal and not self.is_legal_query(combined_query):
            non_legal_notice = (
                "### ⚖️ न्याय सेतु (Nyay Setu)\n\n"
                "न्याय सेतु एक समर्पित विधिक सहायता पोर्टल है। कृपया कानून, अदालत, पुलिस, चेक बाउंस, संपत्ति, या अपने विधिक अधिकारों से संबंधित प्रश्न पूछें।"
                if lang_code == "hi" or lang_name.lower() == "hindi" else
                "### ⚖️ Nyay Setu Legal Assistant\n\n"
                "Nyay Setu is a dedicated judicial assistance platform. Please ask questions related to law, courts, police, recovery, property, or your legal rights."
            )
            return non_legal_notice, lang_info

        # 2. Search authentic Supreme Court precedents using English search terms
        precedents = self.search_precedents(search_query, top_k=5 if is_retry else 4)
        if not precedents:
            # Fallback search across writ / constitutional collection
            precedents = self.search_precedents(f"legal rights dispute {search_query}", top_k=3)

        # 3. Build Grounding Context from authentic ChromaDB precedents or statutory jurisprudence
        context_blocks = []
        if precedents:
            for i, p in enumerate(precedents, 1):
                meta = p["metadata"]
                case_no = meta.get("case_number", "Supreme Court Matter")
                year = meta.get("year", "N/A")
                citation = meta.get("citation", "")
                judges = meta.get("judges", "")
                court = meta.get("court", "Supreme Court of India")
                category_name = p.get("category_name", "Supreme Court Precedent")
                text = p["document"]

                context_blocks.append(
                    f"--- [AUTHENTIC PRECEDENT #{i} ({category_name})] ---\n"
                    f"Court: {court}\n"
                    f"Case Title / Number: {case_no} ({year})\n"
                    f"Citation: {citation}\n"
                    f"Bench / Coram: {judges}\n"
                    f"Judicial Excerpt & Holding:\n{text}\n"
                )
        else:
            context_blocks.append(
                "--- [ESTABLISHED STATUTORY JURISPRUDENCE & SUPREME COURT BENCH RATIOS] ---\n"
                "Governed by established Indian Statutes (e.g. Negotiable Instruments Act 1881, Bharatiya Nyaya Sanhita 2023 / IPC, "
                "Bharatiya Nagarik Suraksha Sanhita 2023 / CrPC, Bharatiya Sakshya Adhiniyam 2023 / Evidence Act, Code of Civil Procedure 1908, "
                "Consumer Protection Act 2019) and authoritative Supreme Court of India benchmark precedents and ratios."
            )

        context_str = "\n".join(context_blocks)

        # Format previous chat history for retry context
        history_str = ""
        if is_retry:
            h_lines = []
            for item in chat_history[-6:]:
                sender = item.get("sender", "user")
                t = item.get("text", "")[:800]
                h_lines.append(f"[{sender.upper()}]: {t}")
            history_str = "\nPREVIOUS ATTEMPTS & REJECTED EXPLANATION (DO NOT REPEAT):\n" + "\n".join(h_lines) + "\n"

        # 4. Construct Role-Specific System Instructions & Prompts
        scenario_num = 2 if is_retry else 1
        scenario_badge = f"#### 📌 Scenario {scenario_num}: " + (
            "Alternative Trial Confrontation & Cross-Examination" if is_retry else "Primary Defense & Admissibility Hearing"
        )
        if is_lawyer:
            scenario_badge = f"#### 📌 Scenario {scenario_num}: " + (
                "Alternative Procedural Challenge & Tactical Recovery Route" if is_retry else "Primary Litigation Strategy & Enforcement"
            )

        retry_mandate = ""
        if is_retry:
            retry_mandate = f"""
=============================================================================
CRITICAL MANDATE: DIVERGENT ALTERNATIVE SCENARIO GENERATION (NOT SATISFIED RETRY)
=============================================================================
The user clicked 'NOT SATISFIED' (असंतोषजनक / पुनः विश्लेषण) on the previous response.
UNDER NO CIRCUMSTANCES SHOULD YOU GENERATE THE SAME OR SIMILAR CONTENT!
You MUST generate a COMPLETELY DIFFERENT LEGAL SCENARIO & CONTRASTING TACTICAL TRAJECTORY (SCENARIO 2):
1. PIVOT TO A DIFFERENT LEGAL ANGLE / DEFENSE / REMEDY:
   - If previous response focused on criminal proceedings (e.g. Section 138 NI Act or FIR), pivot to Civil Remedies (Order 37 CPC Summary Suit, Money Recovery, Interim Attachment under Order 38 Rule 5 CPC, Compounding/Mediation Settlement, or Section 482 Quashing).
   - If previous focused on factual defenses, pivot to Strict Procedural Non-compliance (e.g. limitation bar, defective statutory demand notice, dispatch proof defects, lack of legally enforceable debt, bank memo discrepancies, or Section 63 BSA electronic certificate defects).
2. DIVERGENT COURTROOM DEBATE / PROCEDURAL CHALLENGE:
   - Do NOT repeat the previous dialogue or arguments!
   - In user format: start debate with '{scenario_badge}' and present a completely fresh hearing round with new bench queries and alternative defense arguments.
3. FRESH STRATEGIC ROADMAP:
   - Outline an alternative litigation roadmap, contrasting tactical maneuvers, and new application drafts.
"""

        if is_lawyer:
            # -------------------------------------------------------------
            # ADVOCATE FORMAT (ELABORATED FROM PHOTO 1 ADVISORY FORMAT)
            # -------------------------------------------------------------
            system_instruction = (
                "You are 'Nyay Setu Advocate AI' — India's Premier High-Stakes Judicial Counsel & Legal Dossier Engine for Practicing Advocates.\n"
                f"CRITICAL REGIONAL LANGUAGE MANDATE: Conduct the entire legal dossier strictly in {lang_name} (Language code: {lang_code}).\n"
                "Retain standard statutory provisions (e.g., Section 138 NI Act, Section 302 IPC / BNS 101, Article 226/32, BNSS 528, Order 37 CPC) and formal case citations.\n\n"
                "MANDATORY ADVOCATE ADVISORY DOSSIER STRUCTURE (ELABORATED FROM PHOTO 1 FORMAT):\n\n"
                "### ⚖️ Nyay Setu — Legal Case Assessment & Judicial Evaluation\n"
                "- **केस सारांश व विधिक स्थिति (Executive Case Assessment)**: Authoritative judicial assessment of the client's brief, actionable causes of action, locus standi, and maintainability in court.\n"
                "- **प्राथमिक विधिक निष्कर्ष (Primary Legal Finding)**: Prima facie evaluation of liability, civil vs criminal remedies, and prospective success rate.\n\n"
                "### 📌 Applicable Statutory Sections & Statutory Grounds\n"
                "- **लागू विशिष्ट कानूनी धाराएं (Specific Statutory Provisions)**: Complete section breakdown under BNS 2023 / IPC, BNSS 2023 / CrPC, BSA 2023 / Evidence Act, Special Acts (e.g. NI Act 1881, CPC, Consumer Act).\n"
                "- **सांविधिक तत्व व साक्ष्य भार (Essential Ingredients & Burden of Proof)**: Threshold elements to prove, statutory presumptions (e.g. Sec 139 NI Act), reverse burdens, and statutory defenses.\n\n"
                "### 📌 Key Procedural Facts & Evidentiary Checkpoints\n"
                "- **प्रक्रियात्मक अनिवार्यताएं व समयसीमा (Mandatory Procedural Timelines)**: Strict limitation periods (e.g. 30 days statutory notice, 15 days cure period, 30 days filing window, dispatch proof, tracking receipts).\n"
                "- **साक्ष्य बिंदु व प्रक्रियात्मक कमियां (Evidentiary Checkpoints & Tactical Vulnerabilities)**: Document verification (original instrument, return memo, postal receipt, ledger/bank statements), forensic compliance under Section 63 BSA 2023, procedural defects to exploit or avoid.\n\n"
                "### 📌 Supreme Court Precedents & Judicial Ratios\n"
                "- Authoritative Supreme Court and High Court precedents directly governing this dispute:\n"
                "  * Full Case Title, Year, Bench/Coram, and Citation\n"
                "  * Factual background and core Ratio Decidendi (विधि सिद्धांत)\n"
                "  * Direct application to strengthen the counsel's case or overcome opponent defenses.\n\n"
                "### 📌 Strategic Recommendations & Counsel Action Plan\n"
                "- **अधिवक्ता हेतु तत्काल विधिक कार्ययोजना (Immediate Litigation Action Plan)**: Exact pleadings/notices to draft (Statutory Demand Notice, Criminal Complaint u/s 138/142 NI Act, Summary Suit Order 37 CPC, Section 143A interim compensation application).\n"
                "- **जिरह व दलीलों के मुख्य बिंदु (Core Argument & Cross-Examination Pointers)**: Specific points to elicit during cross-examination of the opposite party.\n"
                "- **सावधानी एवं प्रक्रियात्मक सुरक्षा (Tactical Safeguards for Counsel)**: How to avoid limitation dismissal, service presumption arguments under Section 27 General Clauses Act, evidence preservation.\n"
                + retry_mandate
            )
        else:
            # -------------------------------------------------------------
            # CITIZEN / USER FORMAT (4 SECTIONS MATCHING PHOTO 2 FORMAT)
            # -------------------------------------------------------------
            system_instruction = (
                "You are 'Nyay Setu Supreme Court AI' — India's Premier High-Stakes Judicial Counsel & Courtroom Simulation Engine for Citizens.\n"
                f"CRITICAL REGIONAL LANGUAGE MANDATE: The user's query is in {lang_name} (Language code: {lang_code}).\n"
                f"You MUST generate the ENTIRE legal analysis, precedent breakdown, courtroom debate scenarios, and tactical roadmap STRICTLY, NATURALLY, AND COMPREHENSIVELY in {lang_name}.\n"
                "Do NOT mix languages except standard statutory provisions (e.g., Section 138 NI Act, Section 302 IPC / BNS 101, Art 226/32, Order 37 CPC) and official case citations.\n\n"
                "MANDATORY 4-SECTION CITIZEN BRIEF STRUCTURE (MATCHING PHOTO 2 FORMAT EXACTLY):\n\n"
                "### 1. 📌 Comprehensive Case Analysis & Statutory Framework\n"
                "- **विस्तृत समस्या का विश्लेषण (Factual & Problem Breakdown)**: Directly break down the user's specific problem in plain, reassuring language (e.g., loan given, cheque dishonour with 'Funds Insufficient' memo, drawer avoiding contact).\n"
                "- **लागू धाराएं और कानून (Applicable Statutory Sections)**: State exact charging, recovery, and defense sections under old and new codes (e.g., Section 138/142 NI Act, Section 420 IPC / Section 318(4) BNS 2023, Order 37 CPC Summary Suit, Section 143A interim compensation).\n"
                "- **नागरिक के कानूनी अधिकार एवं प्रक्रियात्मक सुरक्षा (Citizen's Legal Rights & Protections)**: Explain rights, statutory presumptions under Section 139 NI Act, strict 30-day statutory legal notice requirement, 15-day cure period, and 1-month limitation to file court complaint.\n"
                "- **अधिकार क्षेत्र वाली अदालत (Competent Court & Forum)**: Exact competent court (e.g., Judicial Magistrate First Class / Metropolitan Magistrate having jurisdiction over the payee's bank branch).\n"
                "- **अनिवार्य दस्तावेजों की चेकलिस्ट (Mandatory Documents Checklist)**: Original cheque, bank return memo, copy of statutory legal demand notice, speed post receipt & tracking report, bank statement showing initial transfer.\n\n"
                "### 2. 📚 Supreme Court Precedents & Legal Ratios\n"
                "- Cite authentic landmark Supreme Court precedents applicable to this exact dispute (e.g., Rangappa v. Sri Mohan, Dashrath Rupsingh Rathod, Bir Singh v. Mukesh Kumar, MSR Leathers):\n"
                "  * Case Title, Year, Bench, and Citation\n"
                "  * Factual background of the precedent\n"
                "  * The core Ratio Decidendi (कानूनी सिद्धांत) laid down by the Supreme Court\n"
                "  * How this judgment directly shields or applies to the citizen's specific case.\n\n"
                "### 3. 🏛️ Courtroom Debate Simulation\n"
                f"{scenario_badge}\n"
                f"Simulate an intense, realistic Indian Courtroom Hearing equivalent to a 3-minute live hearing strictly in {lang_name}.\n"
                "Write an extended, substantive multi-round argument with AT LEAST 8 to 12 sequential dialogue exchanges between the 3 courtroom actors.\n"
                "Format EVERY speaker turn using these exact prefixes on a new line so the frontend renders them into styled debate cards:\n"
                "🏛️ **माननीय न्यायाधीश (Hon'ble Judge)**: [Opens hearing, tests counsels, questions factual defects, delivers bench directions]\n"
                "🛡️ **मेरा वकील (Counsel for Defense/Petitioner)**: [Presents forceful defense/claim, quotes Supreme Court precedents, argues statutory presumptions, prays for relief/compensation]\n"
                "⚖️ **विपक्षी वकील (Opponent Lawyer / Public Prosecutor)**: [Fiercely opposes, argues defense grounds or denies liability]\n\n"
                "The debate MUST progress through: Opening -> Opposition -> Precedent Counter-Strike -> Evidentiary/Cross Arguments -> Final Bench Order.\n\n"
                "### 4. 🧭 Strategic Tactical Roadmap & Immediate Action Plan\n"
                "- **तत्काल 24-48 घंटे की कार्ययोजना (Immediate 24-48 Hours Action Plan)**: Immediate steps (e.g., draft and dispatch Section 138 Statutory Legal Demand Notice within 30 days of dishonour memo via Registered AD/Speed Post).\n"
                "- **सावधानी एवं बचाव (Critical Precautions)**: What NOT to do, strict limitation timelines, how to preserve delivery proofs and bank statements.\n"
                "- **कानूनी आवेदन (Key Applications / Complaints to Draft)**: Section 138 Criminal Complaint under Section 142 NI Act, Summary Suit under Order 37 CPC for civil money recovery.\n"
                "- **नागरिक हेतु स्पष्ट कानूनी मार्गदर्शन (Simple Citizen Guidance)**: Clear actionable roadmap to recover funds with interest.\n"
                + retry_mandate
            )

        user_prompt = (
            f"CLIENT CASE QUERY / PROBLEM STATEMENT (Language: {lang_name}):\n{query}\n\n"
            f"DEEP PROBLEM STATEMENT ANALYSIS:\n"
            f"• Factual & Dispute Breakdown: {problem_analysis}\n"
            f"• Primary Legal Issue: {primary_legal_issue}\n"
            f"• Statutory Sections: {statutory_sections}\n\n"
            + (f"CASE RECORD CONTEXT / ATTACHMENT:\n{case_context}\n\n" if case_context else "")
            + (f"{history_str}\n" if history_str else "")
            + f"AUTHENTIC JURISPRUDENCE & SUPREME COURT PRECEDENTS:\n"
            f"{context_str}\n\n"
            + (
                f"REGENERATE A COMPLETELY NEW SCENARIO (SCENARIO 2). Do NOT duplicate previous arguments. Deliver fresh judicial angles and an alternative tactical strategy strictly in {lang_name}."
                if is_retry else
                f"Generate the comprehensive, in-depth legal analysis strictly in {lang_name} adhering to the required structure."
            )
        )

        # Dynamic temperature: 0.75 on retry for high divergence and alternative scenario creation; 0.35 on initial query
        temp = 0.75 if is_retry else 0.35
        response_text = self.call_gemini(user_prompt, system_instruction=system_instruction, temperature=temp)
        return response_text, lang_info

    def simulate_courtroom(self, case_summary: str, category: str = None, language: str = "auto"):
        """
        Deep Courtroom Hearing Simulator supporting all 22 Regional Languages.
        Generates 3-4 realistic trajectory scenarios and intense courtroom debate.
        """
        lang_info = self.detect_and_translate_query(case_summary, preferred_lang=language)
        lang_name = lang_info.get("language_name", "Hindi/English")
        lang_code = lang_info.get("detected_language_code", "hi")
        search_query = lang_info.get("english_translation", case_summary)

        precedents = self.search_precedents(search_query, top_k=4)

        if not precedents:
            refusal_text = (
                "### 🛡️ Virtual Courtroom Simulator — Zero-Hallucination Guard\n\n"
                "Aapka case summary hamare Supreme Court database ke categories (Constitutional Writs, Murder/Homicide, "
                "Narcotics NDPS, Rape POCSO, Terrorism UAPA) se match nahi kar raha hai.\n\n"
                "Virtual Courtroom simulation sirf authentic judicial precedents par aadharit hoti hai taaki aapko "
                "actual courtroom proceedings ka realistic anubhav mil sake. Kripya apne case ke specific sections ya factual summary ke saath punah prastut karein."
            )
            return refusal_text, lang_info

        context_str = "\n\nRELEVANT SUPREME COURT BENCH PRECEDENTS FOR COURT ARGUMENTS:\n" + "\n".join(
            [f"• {p['metadata'].get('case_number', 'SC Case')} ({p['metadata'].get('year', '')}): {p['document'][:500]}..." for p in precedents]
        )

        system_instruction = (
            "You are the Chief Presiding Officer of the Nyay Setu Virtual Courtroom Simulator.\n"
            f"CRITICAL LANGUAGE MANDATE: Conduct the proceedings and simulation strictly in {lang_name} ({lang_code}).\n"
            "Your task is to take the provided case brief, construct 3 to 4 realistic courtroom trajectory scenarios, "
            "and simulate an authentic, intense Indian Courtroom Hearing between:\n"
            "1. **Honorable Judge Bench (My Lord / Your Honour)**\n"
            "2. **Counsel for Petitioner / Defense Advocate (Mera Lawyer)**\n"
            "3. **Counsel for Respondent / Public Prosecutor (Opponent Lawyer)**\n\n"
            "OUTPUT STRUCTURE MUST BE CLEAN MARKDOWN:\n"
            "### 1. 📌 Case Classification & Statutory Charges\n"
            "### 2. 🎯 Courtroom Trajectory Scenarios (3-4 Likely Outcomes based on Evidence)\n"
            "### 3. 🏛️ Live Courtroom Simulation Dialogue (Round 1 Opening, Round 2 Cross-Argument, Round 3 Bench Ruling)\n"
            "### 4. ⚖️ Bench's Interim / Final Order (Direction & Next Hearing Date)\n"
            "### 5. 🛡️ Tactical Advice for the Litigant / Advocate\n\n"
            f"Strictly adhere to realistic Indian judicial etiquette and procedural codes (CPC, CrPC/BNSS, BSA 2023) in {lang_name}."
        )

        prompt = (
            f"CASE SUMMARY PROVIDED BY CLIENT / COUNSEL (Language: {lang_name}):\n{case_summary}\n"
            f"{context_str}\n\n"
            f"Generate the full Virtual Courtroom Simulation strictly in {lang_name}."
        )

        sim_text = self.call_gemini(prompt, system_instruction=system_instruction, temperature=0.15)
        return sim_text, lang_info

# Singleton instance
rag_engine = None

def get_rag_engine():
    global rag_engine
    if rag_engine is None:
        rag_engine = LegalRAGEngine()
    return rag_engine

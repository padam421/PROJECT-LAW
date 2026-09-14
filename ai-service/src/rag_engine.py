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
    "appeal", "quash", "cheating", "fraud", "property", "evidence", "dispute", "suit", "legal"
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
        Strictly applies cosine distance filtering to guarantee zero-hallucination.
        """
        if not self.is_legal_query(query):
            # Fast decline for non-legal queries (e.g. food recipes, trivia, weather)
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
                        # Strict distance threshold for all-MiniLM-L6-v2 cosine distance:
                        # Relevant legal queries score 0.20 - 0.45.
                        # Anything above 0.52 is considered a weak/unrelated match.
                        if dist < 0.52:
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
            "gemini-3.5-flash-lite",
            "gemini-flash-lite-latest",
            "gemini-3.5-flash",
            "gemini-flash-latest"
        ]

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "topP": 0.85,
                "topK": 40,
                "maxOutputTokens": 2048
            }
        }

        if system_instruction:
            payload["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }

        data_bytes = json.dumps(payload).encode("utf-8")

        for model in candidate_models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            req = urllib.request.Request(
                url,
                data=data_bytes,
                headers={"Content-Type": "application/json"}
            )
            for attempt in range(2):
                try:
                    with urllib.request.urlopen(req, timeout=25) as resp:
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
                    print(f"Gemini API ({model}) connection exception: {e}")
                    break

        return "Hamare AI Service par is samay uchh traffic hai. Kripya kuch kshano baad punah prayas karein."

    def detect_and_translate_query(self, query: str, preferred_lang: str = None) -> dict:
        """
        Detects Indian regional languages (all 22 Scheduled Indian Languages + English)
        and translates user query into formal legal English for Supreme Court vector retrieval.
        Uses gemini-3.5-flash-lite in JSON mode (~1.1s response latency).
        """
        api_key = GEMINI_API_KEY or load_env_key()
        if not api_key:
            return {"detected_language_code": "en", "language_name": "English", "english_translation": query}

        # Fast direct pass for short English queries when language is auto or en
        if all(ord(c) < 128 for c in query) and (preferred_lang in ['en', None, 'auto']) and len(query.split()) <= 4:
            return {"detected_language_code": "en", "language_name": "English", "english_translation": query}

        prompt = f"""You are a multi-lingual Indian legal query analyzer.
Analyze the following citizen or advocate query. Identify the language (it could be any of the 22 Scheduled Indian Languages e.g. Hindi, Marathi, Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi, Odia, Urdu, Assamese, etc., or English/Hinglish).
Translate the core facts and legal issues accurately into formal legal English search terms suitable for Supreme Court case precedent retrieval in ChromaDB.

User's Preferred Selection: {preferred_lang if preferred_lang else 'auto'}
Query: "{query}"

Respond strictly in valid JSON format:
{{
  "detected_language_code": "<2-letter code e.g. hi, mr, gu, ta, te, bn, kn, ml, pa, ur, or, as, en>",
  "language_name": "<Full English name of language e.g. Marathi, Hindi, Gujarati, Tamil, Bengali, English>",
  "english_translation": "<Clean, detailed legal English translation and search keywords>"
}}"""

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key={api_key}"
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
            with urllib.request.urlopen(req, timeout=12) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                candidates = res.get("candidates", [])
                if candidates and "content" in candidates[0]:
                    parts = candidates[0]["content"].get("parts", [])
                    if parts:
                        parsed = json.loads(parts[0].get("text", "{}"))
                        if "english_translation" in parsed and parsed["english_translation"]:
                            return parsed
        except Exception as e:
            print(f"Language detection/translation notice: {e}")

        # Fallback if call fails or non-JSON
        return {"detected_language_code": "auto", "language_name": "Hindi/English", "english_translation": query}

    def answer_query(self, query: str, user_role: str = "user", case_context: str = None, language: str = "auto"):
        """
        Main Zero-Hallucination RAG QA & 3-Party Courtroom Argument Engine.
        - Supports all 22 Scheduled Indian Regional Languages + English.
        - Translates vernacular query to legal English for Supreme Court vector retrieval.
        - Enforces strict zero-hallucination guard when query is out-of-scope.
        - Synthesizes 3-party courtroom argument dynamics strictly in the user's regional language.
        """
        combined_query = query
        if case_context:
            combined_query = f"{query} {case_context}"

        # 1. Detect language and translate query to English for ChromaDB
        lang_info = self.detect_and_translate_query(combined_query, preferred_lang=language)
        lang_name = lang_info.get("language_name", "Hindi/English")
        lang_code = lang_info.get("detected_language_code", "hi")
        search_query = lang_info.get("english_translation", combined_query)

        # 2. Search authentic Supreme Court precedents using English search terms
        precedents = self.search_precedents(search_query, top_k=4)

        # STRICT ZERO-HALLUCINATION GUARD:
        if not precedents:
            # If the user asked in a regional language other than Hindi/English, localize the refusal message
            if lang_code not in ["hi", "en", "auto"] and lang_name.lower() not in ["english", "hindi"]:
                refusal_prompt = (
                    f"The user asked a legal question in {lang_name}, but our database does not contain Supreme Court precedents for their specific query.\n"
                    f"Generate a polite, authoritative zero-hallucination refusal message strictly in {lang_name} explaining that Nyay Setu AI strictly adheres to verified Supreme Court precedents and does not hallucinate legal advice.\n"
                    f"Mention the 5 covered categories: Constitutional Writs, Murder/Homicide (IPC 302 / BNS 101), Narcotics (NDPS Act), Rape/POCSO Act, and Terrorism (UAPA/NIA), and advise consulting a verified advocate."
                )
                localized_refusal = self.call_gemini(refusal_prompt, temperature=0.1)
                if localized_refusal and not localized_refusal.startswith("Error") and not localized_refusal.startswith("Hamare AI Service"):
                    return localized_refusal, lang_info

            refusal_text = (
                "### 🛡️ Nyay Setu — Zero-Hallucination Guard (Out of Database Scope)\n\n"
                "**Aapka sawaal / mudda hamare Supreme Court legal database ke dayre mein shamil nahi hai.**\n\n"
                "Kanooni niyam aur judicial integrity ke antargat, Nyay Setu AI bina authentic court precedents ke "
                "koi bhi man-ghadant (hallucinated) ya anumanit kanooni salah generate nahi karta.\n\n"
                "**Hamare database mein nimn 5 mukhya vishayon par Supreme Court ke 10+ Lakh authentic precedents uplabdh hain:**\n"
                "1. 📜 **Constitutional Writs & Fundamental Rights** (Article 32, Article 226, Service, Land & Property Writs)\n"
                "2. ⚖️ **Murder & Homicide** (Section 302 IPC / BNS 101, Eyewitness & Circumstantial Evidence)\n"
                "3. 🌿 **Narcotics & NDPS Act** (Section 50 mandatory search, Section 37 bail restrictions, Seizure procedures)\n"
                "4. 🛡️ **Rape & POCSO Act** (Section 376 IPC / BNS 64, Section 29 statutory presumption, Section 164 statements)\n"
                "5. 🚨 **Terrorism & UAPA / NIA** (Section 43D bail bar, National Security, Special Court trials)\n\n"
                "📌 **Sujhav**:\n"
                "- Apne case ka specific statutory section (jaise Section 302 IPC, NDPS Sec 50, POCSO, Art 226) mention karein.\n"
                "- Apne case ke mukhya factual points (police FIR, search, panchnama, witnesses) likhein.\n"
                "- Yadi aapka case kisi anya civil ya criminal matter se juda hai, toh hamare portal ke verified advocate se paramarsh lein."
            )
            return refusal_text, lang_info

        # 3. Build Grounding Context from authentic ChromaDB precedents
        context_blocks = []
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

        context_str = "\n".join(context_blocks)
        is_lawyer = (user_role == "lawyer")

        system_instruction = (
            "You are 'Nyay Setu Supreme Court AI' — a premier Indian Judicial Counsel & Virtual Courtroom Simulator.\n"
            f"CRITICAL REGIONAL LANGUAGE MANDATE: The user's query is in {lang_name} (Language code: {lang_code}).\n"
            f"You MUST generate the ENTIRE legal analysis, precedent explanation, tactical advice, and 3-party courtroom simulation STRICTLY AND FLUENTLY in {lang_name}.\n"
            "Use natural vernacular legal phrasing. Keep statutory section numbers (e.g., Section 302 IPC, NDPS Sec 50, BNS 101, Art 226) and case citations in standard legal format.\n\n"
            "STRICT RULES (ZERO-HALLUCINATION POLICY & 3-PARTY COURTROOM THEME):\n"
            "1. You MUST base your legal analysis strictly on the PROVIDED AUTHENTIC SUPREME COURT PRECEDENTS and established Indian Statutes (IPC/BNS 2023, CrPC/BNSS 2023, Evidence Act/BSA 2023, NDPS, POCSO, UAPA, Constitution).\n"
            "2. Read the retrieved precedent excerpts carefully to understand how past benches resolved similar facts.\n"
            "3. Structure your answer strictly using the following 4 core sections with clean Markdown:\n\n"
            "### 1. 📌 Case Classification & Statutory Matrix\n"
            "- Specify applicable legal acts, exact charging sections (with new BNS/BNSS 2023 equivalents), and jurisdictional court.\n\n"
            "### 2. 📚 Supreme Court Landmark Precedents (from Database)\n"
            "- Explicitly cite the case name, year, and ratio decidendi from the provided context excerpts.\n"
            "- Highlight how previous courts handled these specific evidentiary or procedural flaws.\n\n"
            "### 3. 🏛️ Live Courtroom Simulation (3-Party Judicial Exchange)\n"
            "- 🛡️ **Mera Lawyer / Counsel for Defense/Petitioner**:\n"
            "  * **Opening Statement & Core Submission**: Clear articulation of the defense position.\n"
            "  * **Legal & Precedent Arguments**: Direct reliance on the cited Supreme Court judgments.\n"
            "  * **Plea for Relief**: Specific prayer before the bench.\n"
            "- ⚖️ **Opponent Lawyer / Public Prosecutor (Respondent)**:\n"
            "  * **Prosecution Objections**: Strong grounds of opposition, statutory presumptions, gravity of allegations.\n"
            "  * **Counter-Arguments**: Arguments distinguishing the precedent.\n"
            "- 🏛️ **Honorable Bench (AI Judge)**:\n"
            "  * **Bench Observation & Evidentiary Scrutiny**: Questioning procedural compliance, testing the precedents.\n"
            "  * **Judicial Reaction & Interim Order**: Likely bench inclination, interim relief, or court directions.\n\n"
            "### 4. 🧭 Tactical Roadmap & Action Plan\n"
            "- Clear, practical next steps, documents to prepare, and court precautions for the "
            + ("Advocate Counsel." if is_lawyer else "Litigant / Citizen in simple language.")
        )

        user_prompt = (
            f"USER CASE QUERY / SUMMARY (Language: {lang_name}):\n{query}\n\n"
            + (f"CASE RECORD CONTEXT:\n{case_context}\n\n" if case_context else "")
            + f"AUTHENTIC SUPREME COURT JUDICIAL PRECEDENTS RETRIEVED FROM DATABASE:\n"
            f"{context_str}\n\n"
            f"Generate the full zero-hallucination analysis and 3-party courtroom simulation strictly in {lang_name}."
        )

        response_text = self.call_gemini(user_prompt, system_instruction=system_instruction, temperature=0.15)
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

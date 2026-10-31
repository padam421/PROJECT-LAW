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
        self.clients = {}
        self.collections = {}
        self.total_vectors = 0
        self.retrieval_backend = os.environ.get('RAG_BACKEND', 'chroma')
        self.portable = None
        if self.retrieval_backend == 'sqlite':
            from portable_search import PortableSearch
            self.portable = PortableSearch(os.environ.get('SEARCH_INDEX_DIR', os.path.join(PROJECT_ROOT, 'data', 'search')))
            self.total_vectors = self.portable.total
        elif self.retrieval_backend == 'chroma':
            from chromadb.utils import embedding_functions
            self.embedding_fn = embedding_functions.DefaultEmbeddingFunction()
            self._init_collections()
        else:
            raise RuntimeError('RAG_BACKEND must be chroma or sqlite')

    def _init_collections(self):
        """Initializes ChromaDB clients and loads all 5 Supreme Court collections."""
        import chromadb
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
        if getattr(self, 'portable', None):
            matches = self.portable.search(query, target_keys, top_k)
            for match in matches:
                match['category_name'] = COLLECTIONS_META[match['category']]['name']
            return matches
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

    def call_court_model(self, prompt, system_instruction=None, temperature=0.2, json_output=True, deadline=None):
        try:context=json.loads(prompt)
        except (ValueError,TypeError):context={}
        scope=context.get('active_examination') or {}
        if context.get('action')=='witness_answer' and scope.get('witness') in ('WITNESS_DEFENSE','WITNESS_PROSECUTION'):
            actors=[scope['witness']]
        elif scope.get('questioningSide') in ('DEFENSE','PROSECUTION'):
            actors=['JUDGE',scope['questioningSide']]
        else:actors=['JUDGE','DEFENSE','PROSECUTION']
        # Constrain speaker identities during decoding rather than accepting a random role then retrying.
        schema={'type':'object','properties':{
            'turns':{'type':'array','maxItems':4,'items':{'type':'object','properties':{
                'actor':{'type':'string','enum':actors},'text':{'type':'string'},'name':{'type':'string'}},
                'required':['actor','text']}},
            'needs_answer':{'type':'boolean'},'question':{'type':'string'},
            'question_actor':{'type':'string','enum':actors},
            'witness_side':{'type':'string','enum':[scope['side']] if scope.get('side') in ('DEFENSE','PROSECUTION') else ['DEFENSE','PROSECUTION']}},
            'required':['turns','needs_answer','question']}
        if context.get('action')=='opening':
            schema['properties']['needs_answer']={'type':'boolean','enum':[False]}
            schema['properties']['question']={'type':'string','enum':['']}
        return self.call_gemini(prompt, system_instruction, temperature, json_output, profile='court',response_schema=schema,deadline=deadline)

    def review_court_model(self, prompt, system_instruction, deadline):
        try:context=json.loads(prompt)
        except (ValueError,TypeError):context={}
        scope=context.get('active_examination') or {}
        actors=['JUDGE',scope['questioningSide']] if scope.get('questioningSide') in ('DEFENSE','PROSECUTION') else ['JUDGE','DEFENSE','PROSECUTION']
        if context.get('action')=='review_turn':
            actors=list(dict.fromkeys(t['actor'] for t in context.get('proposal',{}).get('turns',[])
                                     if t.get('actor') in ('JUDGE','DEFENSE','PROSECUTION'))) or actors
        response={'type':'object','properties':{
            'turns':{'type':'array','maxItems':4,'items':{'type':'object','properties':{
                'actor':{'type':'string','enum':actors},'text':{'type':'string'}},'required':['actor','text']}},
            'needs_answer':{'type':'boolean'},'question':{'type':'string'},
            'question_actor':{'type':'string','enum':actors},
            'witness_side':{'type':'string','enum':[scope['side']] if scope.get('side') in ('DEFENSE','PROSECUTION') else ['DEFENSE','PROSECUTION']}},
            'required':['turns','needs_answer','question']}
        if context.get('action')=='opening':
            response['properties']['needs_answer']={'type':'boolean','enum':[False]}
            response['properties']['question']={'type':'string','enum':['']}
        schema={'type':'object','properties':{'response':response,
            'checks':{'type':'object','properties':{key:{'type':'boolean'} for key in ('facts','law','procedure','roles','clarity')},
                      'required':['facts','law','procedure','roles','clarity']},
            'legal_claims':{'type':'array','items':{'type':'object','properties':{
                'text':{'type':'string'},'kind':{'type':'string','enum':['law','reported','inquiry']},
                'source_ids':{'type':'array','items':{'type':'string'}},'support_quote':{'type':'string'}},
                'required':['text','kind','source_ids','support_quote']}}},
            'required':['response','checks','legal_claims']}
        return self.call_gemini(prompt,system_instruction,0.0,True,profile='court_review',response_schema=schema,deadline=deadline)

    def call_gemini(self, prompt: str, system_instruction: str = None, temperature: float = 0.15, json_output: bool = False, profile=None, response_schema=None, deadline=None):
        """
        Calls Gemini with the existing chat fallback or a bounded court profile.
        """
        court=profile in ('court','court_review')
        api_key = GEMINI_API_KEY or load_env_key()
        if not api_key:
            if court:
                error=RuntimeError('The courtroom AI provider is not configured. Your hearing is saved.')
                error.status_code=503;error.retryable=False;error.retry_after=0
                raise error
            return "Error: GEMINI_API_KEY is not configured in .env file."

        candidate_models = [
            "gemini-3.1-flash-lite",
            "gemini-3.1-flash",
            "gemini-flash-lite-latest",
            "gemini-flash-latest"
        ]
        deadline = deadline if deadline is not None else time.monotonic() + (34 if court else 55)
        if court:
            # Review and testimony have different latency/payloads. A review timeout must
            # never open the circuit for the next witness answer. Use a fixed fallback
            # model rather than a latest alias that can resolve to the failing primary.
            cooldown_attr='_court_review_model_cooldown' if profile=='court_review' else '_court_model_cooldown'
            preferred_attr='_court_review_preferred_model' if profile=='court_review' else '_court_preferred_model'
            cooldown=getattr(self,cooldown_attr,{})
            preferred=getattr(self,preferred_attr,'gemini-3.1-flash-lite')
            candidates=list(dict.fromkeys([preferred,'gemini-3.1-flash-lite','gemini-3.5-flash-lite']))
            rate_cooldown=getattr(self,'_court_rate_cooldown',{})
            candidate_models=[model for model in candidates if max(cooldown.get(model,0),rate_cooldown.get(model,0))<=time.monotonic()][:2]

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "topP": 0.85,
                "topK": 40,
                "maxOutputTokens": 2048 if court else 16384 if profile == 'advocate' else 8192
            }
        }

        if system_instruction:
            payload["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }
        if json_output:
            payload['generationConfig']['responseMimeType'] = 'application/json'
            if response_schema:payload['generationConfig']['responseJsonSchema']=response_schema

        attempted=[]
        for model in candidate_models:
            if court:
                payload['generationConfig']['thinkingConfig']=({'thinkingBudget':0} if model.startswith('gemini-2.5-') else {'thinkingLevel':'minimal'})
            data_bytes = json.dumps(payload).encode("utf-8")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            for attempt in range(1 if court else 2):
                remaining=deadline-time.monotonic()
                if remaining<=0:break
                attempted.append(model)
                req = urllib.request.Request(
                    url,
                    data=data_bytes,
                    headers={"Content-Type": "application/json"}
                )
                try:
                    with urllib.request.urlopen(req, timeout=min(10 if profile=='court_review' else 16,remaining) if court else min(20, remaining)) as resp:
                        res = json.loads(resp.read().decode("utf-8"))
                        response_candidates = res.get("candidates", [])
                        if response_candidates and "content" in response_candidates[0]:
                            parts = response_candidates[0]["content"].get("parts", [])
                            text=''.join(part.get('text','') for part in parts if not part.get('thought'))
                            if text:
                                if court:
                                    # Do not pass truncated/invalid JSON into the hearing.
                                    # Trying the other model stays inside this request's budget.
                                    parsed=json.loads(text) if json_output else text
                                    if json_output and (not isinstance(parsed,dict) or response_candidates[0].get('finishReason')=='MAX_TOKENS'):
                                        raise ValueError('Incomplete structured response')
                                    setattr(self,preferred_attr,model)
                                    cooldown.pop(model,None)
                                return text
                        if court:raise ValueError('Empty structured response')
                except urllib.error.HTTPError as e:
                    print(f"Gemini API ({model}, attempt {attempt+1}) HTTP {e.code}")
                    if court:
                        delay=30 if e.code==429 else 10 if e.code>=500 else 300
                        if e.code==429:
                            try:delay=max(1,min(120,int(e.headers.get('Retry-After',delay))))
                            except (TypeError,ValueError,AttributeError):pass
                            # Quotas apply to the provider model across both request types.
                            # Only timeouts remain isolated between review and generation.
                            rate_cooldown[model]=time.monotonic()+delay;self._court_rate_cooldown=rate_cooldown
                        cooldown[model]=time.monotonic()+delay;setattr(self,cooldown_attr,cooldown)
                        break
                    if e.code in [429, 503]:
                        time.sleep(1.0)
                        continue
                    break
                except Exception as e:
                    # Exception text can contain the provider URL/API key; log only its type.
                    print(f"Gemini API ({model}, attempt {attempt+1}) connection exception: {type(e).__name__}")
                    if court:
                        cooldown[model]=time.monotonic()+5;setattr(self,cooldown_attr,cooldown)
                        break
                    time.sleep(1.0)
                    continue

        if court:
            # The first timeout's short cooldown can expire while trying the fallback.
            # Give all failed attempts a brief recovery window measured from completion.
            for model in attempted:cooldown[model]=max(cooldown.get(model,0),time.monotonic()+5)
            setattr(self,cooldown_attr,cooldown)
            remaining_cooldowns=[max(cooldown.get(model,0),rate_cooldown.get(model,0))-time.monotonic() for model in candidates
                                 if max(cooldown.get(model,0),rate_cooldown.get(model,0))>time.monotonic()]
            retry_after=max(1,int(min(remaining_cooldowns,default=5))+1)
            error=RuntimeError(f'AI is temporarily unavailable. Your hearing is saved; retry in {retry_after} seconds.')
            error.status_code=503;error.retryable=True;error.retry_after=retry_after
            raise error
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

    def answer_query(self, query, user_role="user", case_context=None, language="auto", chat_history=None, retry=False):
        from conversation_engine import answer
        return answer(self, query, user_role, case_context, language, chat_history, retry)

    def simulate_courtroom(self, case_summary, category=None, language="auto", chat_history=None, court_type="DISTRICT", action="opening", user_input="", role="user", examination=None):
        from conversation_engine import court_turn
        return court_turn(self, case_summary, chat_history, language, court_type, action, user_input, role, examination)

# Singleton instance
rag_engine = None

def get_rag_engine():
    global rag_engine
    if rag_engine is None:
        rag_engine = LegalRAGEngine()
    return rag_engine

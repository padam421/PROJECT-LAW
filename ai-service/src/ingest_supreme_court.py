"""
========================================================================================
LEGALCONNECT — SUPREME COURT SPECIALIZED RAG INGESTION ENGINE
File: ai-service/src/ingest_supreme_court.py
Description: Specially tailored for Court_Cases_Data/Supreme_Court JSON dataset.
             Scans all categories (Writ_Constitutional, Murder_Homicide, Cybercrime, etc.),
             extracts 'hearings' -> 'full_text', splits into 1200-char semantic chunks,
             enriches chunks with case metadata (Case ID, Judges, Citation, Year),
             and builds a high-performance local ChromaDB vector database.
========================================================================================
"""

import os
import json
import glob
from pathlib import Path
from langchain.text_splitter import RecursiveCharacterTextSplitter

# Import ChromaDB & Local Free Embedding Function
try:
    import chromadb
    from chromadb.utils import embedding_functions
except ImportError:
    print("\n❌ Missing required libraries! Please run:")
    print("👉 pip install chromadb sentence-transformers langchain\n")
    exit(1)

# Paths Configuration
BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent

# Check potential directories where Supreme_Court data might reside
POSSIBLE_DATA_DIRS = [
    PROJECT_ROOT / "data" / "raw_data" / "Supreme_Court",
    PROJECT_ROOT / "data" / "raw_data",
    BASE_DIR / "data" / "raw" / "Supreme_Court",
    BASE_DIR / "data" / "raw"
]

DB_DEST_DIR = BASE_DIR / "data" / "processed" / "chroma_db_supreme_court"

def find_data_directory():
    for p in POSSIBLE_DATA_DIRS:
        if p.exists() and any(p.glob("**/*.json")):
            return p
    return POSSIBLE_DATA_DIRS[0]

def parse_supreme_court_json(file_path):
    """
    Parses a single Supreme Court case JSON file matching the user's exact format:
    {
      "case_id": "...",
      "case_number": "...",
      "court_name": "Supreme Court of India",
      "category": "Writ_Constitutional",
      "case_status": "...",
      "hearings": [
         { "year": "...", "full_text": "...", "judges": [...], "citation": "..." }
      ]
    }
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"⚠️ Error reading {file_path.name}: {e}")
        return []

    if not isinstance(data, dict):
        return []

    case_id = data.get("case_id") or file_path.stem
    case_number = data.get("case_number") or ""
    court_name = data.get("court_name") or "Supreme Court of India"
    category = data.get("category") or file_path.parent.name or "Supreme_Court_Case"
    case_status = data.get("case_status") or "CLOSED"

    hearings = data.get("hearings") or []
    extracted_items = []

    for h_idx, hearing in enumerate(hearings):
        full_text = hearing.get("full_text") or ""
        if not full_text or len(full_text.strip()) < 50:
            continue

        year = hearing.get("year") or ""
        citation = hearing.get("citation") or ""
        judges = hearing.get("judges") or []
        judges_str = ", ".join(judges) if isinstance(judges, list) else str(judges)
        decision_date = hearing.get("decision_date") or ""
        title = hearing.get("title") or ""
        petitioner = hearing.get("petitioner") or ""
        respondent = hearing.get("respondent") or ""

        extracted_items.append({
            "case_id": str(case_id),
            "case_number": str(case_number),
            "court_name": str(court_name),
            "category": str(category),
            "case_status": str(case_status),
            "hearing_index": h_idx + 1,
            "year": str(year),
            "citation": str(citation),
            "judges": str(judges_str)[:200],
            "decision_date": str(decision_date),
            "title": str(title),
            "parties": f"{petitioner} vs {respondent}".strip(" vs "),
            "full_text": full_text
        })

    return extracted_items

def build_supreme_court_rag():
    print("=" * 75)
    print("  LEGALCONNECT — SUPREME COURT CHUNKING & RAG INGESTION ENGINE")
    print("=" * 75)

    data_dir = find_data_directory()
    print(f"📂 Scanning Directory: {data_dir}")

    json_files = list(data_dir.glob("**/*.json"))
    if not json_files:
        print("\n❌ No JSON files found in data directory!")
        print(f"👉 Please place your Supreme_Court folder inside: {PROJECT_ROOT / 'data' / 'raw_data' / 'Supreme_Court'}")
        return

    print(f"📄 Found {len(json_files)} Supreme Court case JSON files across categories.\n")

    # Semantic Text Splitter: 1200 characters (~200 words) with 150 char overlap
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1200,
        chunk_overlap=150,
        separators=["\n\n", "\n", ". ", " ", ""]
    )

    documents = []
    metadatas = []
    ids = []

    total_chunks = 0

    for f_idx, jf in enumerate(json_files):
        cases = parse_supreme_court_json(jf)
        for case in cases:
            raw_text = case["full_text"]
            chunks = text_splitter.split_text(raw_text)

            for c_idx, chunk in enumerate(chunks):
                # Header context injection so Gemini always knows the exact case background
                enriched_chunk = (
                    f"[Case: {case['case_number'] or case['case_id']} | "
                    f"Court: Supreme Court of India | Category: {case['category']} | Year: {case['year']}]\n"
                    f"{chunk}"
                )

                chunk_id = f"{case['case_id']}_h{case['hearing_index']}_c{c_idx}"
                
                meta = {
                    "case_id": case["case_id"][:100],
                    "case_number": case["case_number"][:100],
                    "category": case["category"][:80],
                    "court_name": "Supreme Court of India",
                    "year": case["year"][:10],
                    "citation": case["citation"][:100],
                    "judges": case["judges"][:150],
                    "chunk_idx": c_idx
                }

                documents.append(enriched_chunk)
                metadatas.append(meta)
                ids.append(chunk_id)
                total_chunks += 1

        if (f_idx + 1) % 50 == 0 or (f_idx + 1) == len(json_files):
            print(f"  ✓ Processed {f_idx + 1}/{len(json_files)} case files (Created {total_chunks} chunks)...")

    print(f"\n🧠 Initializing Local Free Embedding Model (all-MiniLM-L6-v2)...")
    embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )

    os.makedirs(DB_DEST_DIR, exist_ok=True)
    client = chromadb.PersistentClient(path=str(DB_DEST_DIR))

    collection = client.get_or_create_collection(
        name="supreme_court_judgments",
        embedding_function=embedding_fn
    )

    print(f"💾 Saving {len(documents)} chunks to ChromaDB at: {DB_DEST_DIR}...")
    batch_size = 150
    for i in range(0, len(documents), batch_size):
        end_idx = min(i + batch_size, len(documents))
        collection.upsert(
            documents=documents[i:end_idx],
            metadatas=metadatas[i:end_idx],
            ids=ids[i:end_idx]
        )
        print(f"  ➜ Stored batch {i + 1} to {end_idx} of {len(documents)}")

    print("\n" + "=" * 75)
    print("✅ SUPREME COURT RAG VECTOR DATABASE SUCCESSFULLY CREATED!")
    print(f"📁 ChromaDB Destination: {DB_DEST_DIR}")
    print("=" * 75)

    # Verification Test Query
    print("\n🔍 Running Verification Test on Supreme Court Database:")
    print("   Query: 'Writ petition fundamental rights motor vehicles act transport'")
    results = collection.query(
        query_texts=["Writ petition fundamental rights motor vehicles act transport undertaking scheme"],
        n_results=min(2, len(documents))
    )

    if results and results.get("documents") and len(results["documents"][0]) > 0:
        print("\n🎯 Top Matching Supreme Court Precedent:")
        print("─" * 60)
        print(results["documents"][0][0][:400] + "...")
        print("─" * 60)
        print("Metadata:", results["metadatas"][0][0])
        print("\n🎉 Everything is 100% WORKING and ready for Gemini Chatbot & Virtual Court!")

if __name__ == "__main__":
    build_supreme_court_rag()

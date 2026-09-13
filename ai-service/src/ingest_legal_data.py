"""
========================================================================
LEGALCONNECT — RAG DATA INGESTION ENGINE
File: ai-service/src/ingest_legal_data.py
Description: Reads court data from the dedicated root-level folder:
             --> PROJECT-LAW/data/raw_data/
             Vectorizes the JSON records and stores them in ChromaDB.
========================================================================
"""

import os
import json
from pathlib import Path

try:
    import chromadb
    from chromadb.utils import embedding_functions
except ImportError:
    print("\n❌ Error: Missing required AI packages!")
    print("👉 Run in terminal: pip install chromadb sentence-transformers\n")
    exit(1)

# Root of PROJECT-LAW
AI_SERVICE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = AI_SERVICE_DIR.parent

# Primary dedicated data folder
PRIMARY_DATA_DIR = PROJECT_ROOT / "data" / "raw_data"
PROCESSED_DB_DIR = AI_SERVICE_DIR / "data" / "processed" / "chroma_db"

# Search folders list
SEARCH_FOLDERS = [
    PRIMARY_DATA_DIR,
    AI_SERVICE_DIR / "data" / "raw_court_database",
    AI_SERVICE_DIR / "data" / "raw",
]

def load_all_json_records():
    """Scans PROJECT-LAW/data/raw_data/ for all JSON files and extracts records."""
    all_records = []
    scanned_files = set()

    print(f"🔍 Checking primary data folder: {PRIMARY_DATA_DIR}")

    for folder in SEARCH_FOLDERS:
        if not folder.exists():
            continue
        
        # Recursively scan all .json files in this folder
        for json_path in folder.glob("**/*.json"):
            if json_path in scanned_files:
                continue
            scanned_files.add(json_path)

            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    content = json.load(f)
                    file_records = []

                    if isinstance(content, list):
                        file_records = content
                    elif isinstance(content, dict):
                        found_list = False
                        for k, v in content.items():
                            if isinstance(v, list):
                                file_records.extend(v)
                                found_list = True
                        if not found_list:
                            file_records.append(content)
                    
                    if file_records:
                        print(f"✓ Found {len(file_records)} records in: {json_path.name}")
                        all_records.extend(file_records)
            except Exception as e:
                print(f"⚠️ Notice for {json_path.name}: {e}")

    return all_records

def format_record_to_text(item, index):
    """Turns any flexible legal JSON record into a comprehensive searchable text chunk."""
    if isinstance(item, str):
        return item, f"Record_{index}", {}
        
    title = (
        item.get("case_title")
        or item.get("title")
        or item.get("section")
        or item.get("act")
        or item.get("name")
        or f"Case_{index + 1}"
    )
    
    court = item.get("court") or item.get("source") or "Indian Judiciary"
    category = item.get("category") or item.get("law_type") or "General Law"
    sections = item.get("sections") or item.get("acts") or ""
    
    text_body = (
        item.get("judgment_summary")
        or item.get("summary")
        or item.get("judgment")
        or item.get("text")
        or item.get("content")
        or item.get("facts")
        or item.get("description")
        or str(item)
    )
    
    key_principle = item.get("key_principle") or item.get("ratio_decidendi") or ""

    full_chunk = f"Title: {title}\nCourt: {court}\nCategory: {category}\nSections: {sections}\nContent: {text_body}"
    if key_principle:
        full_chunk += f"\nKey Principle: {key_principle}"

    metadata = {
        "title": str(title)[:120],
        "court": str(court)[:80],
        "category": str(category)[:80],
        "record_id": str(item.get("id") or f"doc_{index + 1}")
    }

    return full_chunk, str(title), metadata

def ingest_data_to_chroma():
    """Main pipeline: Reads JSON from data/raw_data/ -> Vectorizes -> Saves to ChromaDB."""
    print("=" * 65)
    print("  LEGALCONNECT — INGESTING LEGAL DATA INTO RAG (ChromaDB)")
    print("=" * 65)

    records = load_all_json_records()
    if not records:
        print("\n❌ No data records found yet!")
        print(f"👉 Please paste your Google Drive JSON data into:")
        print(f"   {PRIMARY_DATA_DIR / 'legal_court_data.json'}")
        return

    print(f"\n📊 Total records found to vectorize: {len(records)}")

    # 1. Initialize local embedding function (100% Free, runs locally on laptop CPU)
    print("\n🧠 Loading local embedding model (all-MiniLM-L6-v2)...")
    embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )

    # 2. Setup ChromaDB persistent directory
    os.makedirs(PROCESSED_DB_DIR, exist_ok=True)
    client = chromadb.PersistentClient(path=str(PROCESSED_DB_DIR))

    # 3. Create or get collection
    collection = client.get_or_create_collection(
        name="legalconnect_laws",
        embedding_function=embedding_fn
    )

    documents = []
    metadatas = []
    ids = []

    for idx, record in enumerate(records):
        chunk_text, doc_id_name, meta = format_record_to_text(record, idx)
        doc_unique_id = f"case_{idx}_{record.get('id', idx)}"
        documents.append(chunk_text)
        metadatas.append(meta)
        ids.append(doc_unique_id)

    print(f"📦 Storing {len(documents)} vectorized chunks in ChromaDB...")
    
    batch_size = 100
    for i in range(0, len(documents), batch_size):
        end_idx = min(i + batch_size, len(documents))
        collection.upsert(
            documents=documents[i:end_idx],
            metadatas=metadatas[i:end_idx],
            ids=ids[i:end_idx]
        )
        print(f"  ✓ Processed batch {i + 1} to {end_idx} of {len(documents)}")

    print("\n" + "=" * 65)
    print("✅ SUCCESS! All legal data has been vectorized and stored in ChromaDB.")
    print(f"📁 ChromaDB Location: {PROCESSED_DB_DIR}")
    print("=" * 65)

    # 4. Instant verification test query
    print("\n🔍 Running test search on your legal database...")
    results = collection.query(
        query_texts=["property dispute stay order injunction zameen kabza"],
        n_results=min(2, len(documents))
    )
    
    if results and results.get("documents") and len(results["documents"][0]) > 0:
        print("\n🎯 Top Match Result from your data:")
        print("─" * 50)
        print(results["documents"][0][0][:350] + "...")
        print("─" * 50)
        print("🎉 RAG Search is 100% READY!")

if __name__ == "__main__":
    ingest_data_to_chroma()

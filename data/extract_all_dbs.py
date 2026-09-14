import os
import zipfile
import glob
import time
import sys

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

RAW_DATA_DIR = os.path.join(os.path.dirname(__file__), "raw_data")
OUTPUT_BASE_DIR = os.path.join(os.path.dirname(__file__), "chroma_db")

os.makedirs(OUTPUT_BASE_DIR, exist_ok=True)

zip_files = glob.glob(os.path.join(RAW_DATA_DIR, "chroma_SC_*.zip"))
print(f"Found {len(zip_files)} ChromaDB zip files to extract.\n")

for zpath in zip_files:
    filename = os.path.basename(zpath)
    folder_name = filename.replace(".zip", "")
    target_dir = os.path.join(OUTPUT_BASE_DIR, folder_name)
    
    # Check if already extracted
    sqlite_file = os.path.join(target_dir, "chroma.sqlite3")
    if os.path.exists(sqlite_file) and os.path.getsize(sqlite_file) > 1000000:
        size_mb = os.path.getsize(sqlite_file) / (1024 * 1024)
        print(f"[SKIP] {folder_name} already extracted (chroma.sqlite3: {size_mb:.1f} MB)")
        continue
    
    print(f"[EXTRACTING] {filename} -> {target_dir}...")
    start_time = time.time()
    os.makedirs(target_dir, exist_ok=True)
    with zipfile.ZipFile(zpath, 'r') as zip_ref:
        zip_ref.extractall(target_dir)
    elapsed = time.time() - start_time
    print(f"[DONE] Extracted {folder_name} in {elapsed:.1f}s!\n")

print("All ChromaDB databases successfully extracted and ready!")

"""Export every available Chroma document to a small, portable SQLite FTS index.

No embedding model, Chroma process or source database is needed at runtime.
The local Chroma retrieval mode remains available for desktop development.
"""
import gzip
import hashlib
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'data' / 'search'
CATEGORIES = {'writ': 'Writ_Constitutional', 'murder': 'Murder_Homicide',
              'uapa': 'Terrorism_UAPA_NIA', 'pocso': 'Rape_POCSO', 'narcotics': 'Narcotics_NDPS'}


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    target = OUTPUT / 'precedents.sqlite3'
    if target.exists():
        target.unlink()
    counts = {}
    with sqlite3.connect(target) as dest:
        dest.execute('CREATE TABLE documents(id INTEGER PRIMARY KEY, category TEXT, document TEXT, metadata TEXT)')
        dest.execute("CREATE VIRTUAL TABLE search USING fts5(document, content='documents', content_rowid='id', tokenize='porter unicode61')")
        for category, suffix in CATEGORIES.items():
            source = ROOT / 'data' / 'chroma_db' / ('chroma_SC_' + suffix) / 'chroma.sqlite3'
            if not source.exists():
                counts[category] = 0
                continue
            with sqlite3.connect(source.as_uri() + '?mode=ro', uri=True) as original:
                rows = original.execute('SELECT id,key,string_value,int_value,float_value,bool_value FROM embedding_metadata ORDER BY id')
                current, document, metadata, count = None, '', {}, 0
                def insert():
                    nonlocal count
                    if document:
                        dest.execute('INSERT INTO documents(category,document,metadata) VALUES(?,?,?)',
                                     (category, document, json.dumps(metadata, ensure_ascii=False)))
                        count += 1
                for identifier, key, string, integer, floating, boolean in rows:
                    if identifier != current:
                        insert()
                        current, document, metadata = identifier, '', {}
                    if key == 'chroma:document':
                        document = string or ''
                    else:
                        metadata[key] = next((v for v in (string, integer, floating, boolean) if v is not None), None)
                insert()
                counts[category] = count
        dest.execute("INSERT INTO search(search) VALUES('rebuild')")
        dest.commit()
        dest.execute('VACUUM')
    packed = target.with_suffix('.sqlite3.gz')
    with target.open('rb') as source, packed.open('wb') as raw:
        with gzip.GzipFile(filename='', mode='wb', fileobj=raw, mtime=0) as output:
            while chunk := source.read(1024 * 1024):
                output.write(chunk)
    manifest = {'format': 1, 'retrieval': 'sqlite-fts5-bm25', 'collections': counts,
                'documents': sum(counts.values()), 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}
    (OUTPUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({**manifest, 'compressed_bytes': packed.stat().st_size}, indent=2))


if __name__ == '__main__':
    main()

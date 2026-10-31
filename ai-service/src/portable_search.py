"""Read-only, bounded-memory search of the packaged precedent corpus."""
import gzip
import hashlib
import json
import re
import shutil
import sqlite3
import threading
from pathlib import Path

STOP = set('a an and are as at be been by can case could for from had has have i if in is it its me my of on or our should that the their them there these they this to was we were what when where which who will with would you your'.split())


class PortableSearch:
    def __init__(self, directory):
        directory = Path(directory)
        manifest = json.loads((directory / 'manifest.json').read_text(encoding='utf-8'))
        self.path = directory / 'precedents.sqlite3'
        if not self.path.exists():
            temporary = self.path.with_suffix('.tmp')
            with gzip.open(str(self.path) + '.gz', 'rb') as source, temporary.open('wb') as target:
                shutil.copyfileobj(source, target)
            temporary.replace(self.path)
        with self.path.open('rb') as source:
            digest = hashlib.file_digest(source, 'sha256').hexdigest()
        if digest != manifest['sha256']:
            raise RuntimeError('The packaged precedent index failed its checksum.')
        self.counts = manifest['collections']
        self.total = manifest['documents']
        if not self.total:
            raise RuntimeError('The packaged precedent index is empty.')
        self.local = threading.local()

    def connection(self):
        if not hasattr(self.local, 'db'):
            self.local.db = sqlite3.connect(self.path.as_uri() + '?mode=ro', uri=True)
            self.local.db.execute('PRAGMA cache_size=-2048')
            self.local.db.execute('PRAGMA query_only=ON')
        return self.local.db

    def search(self, query, categories, limit=4):
        # Only word tokens become FTS expressions; callers cannot inject SQL or FTS syntax.
        words = list(dict.fromkeys(w.lower() for w in re.findall(r'[^\W_]+', query, re.UNICODE)
                                  if len(w) > 2 and w.lower() not in STOP))[:32]
        if not words or not categories:
            return []
        expression = ' OR '.join('"' + word + '"' for word in words)
        placeholders = ','.join('?' for _ in categories)
        rows = self.connection().execute(
            f'SELECT d.document,d.metadata,d.category FROM search JOIN documents d ON d.id=search.rowid '
            f'WHERE search MATCH ? AND d.category IN ({placeholders}) ORDER BY bm25(search) LIMIT ?',
            [expression, *categories, min(max(int(limit), 1), 8)]).fetchall()
        return [{'document': document, 'metadata': json.loads(metadata), 'category': category,
                 'retrieval_method': 'sqlite-fts5-bm25', 'distance': None}
                for document, metadata, category in rows]

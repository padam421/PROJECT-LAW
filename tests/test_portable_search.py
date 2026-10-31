"""Exercise the actual packaged corpus, not a mocked retrieval implementation."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'ai-service' / 'src'))
from portable_search import PortableSearch


class PortableSearchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.index = PortableSearch(ROOT / 'data' / 'search')

    @classmethod
    def tearDownClass(cls):
        cls.index.connection().close()

    def test_every_exported_document_is_present_and_manifest_is_truthful(self):
        count = self.index.connection().execute('SELECT count(*) FROM documents').fetchone()[0]
        self.assertEqual(count, self.index.total)
        self.assertEqual(count, sum(self.index.counts.values()))
        self.assertGreater(count, 0)

    def test_ndps_retrieval_has_original_passage_and_case_metadata(self):
        matches = self.index.search('NDPS commercial quantity bail section 37', ['narcotics'])
        self.assertTrue(matches)
        self.assertTrue(all(m['category'] == 'narcotics' for m in matches))
        self.assertTrue(any(m['metadata'].get('case_id') for m in matches))
        self.assertTrue(all(m['document'] for m in matches))
        self.assertEqual(self.index.search('NDPS bail', ['murder']), [])

    def test_untrusted_search_syntax_cannot_execute_fts_or_sql(self):
        for query in ('" OR * NOT NEAR(', "'; DROP TABLE documents; --", '\x00', 'the and of'):
            self.index.search(query, ['narcotics'])
        self.assertEqual(self.index.connection().execute('SELECT count(*) FROM documents').fetchone()[0], self.index.total)

    def test_advocate_path_also_retrieves_packaged_precedents(self):
        from advocate_engine import precedent_sources
        class Engine:
            collections = {}
            portable = self.index
        result = precedent_sources(Engine(), 'NDPS commercial quantity bail custody')
        self.assertTrue(result)
        self.assertTrue(all(s['kind'] == 'precedent' and s['text'] for s in result))


if __name__ == '__main__':
    unittest.main()

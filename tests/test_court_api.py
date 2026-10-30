"""Verify witness context crosses the actual Flask route and engine wrapper."""
import ast
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / 'ai-service' / 'src'
sys.path.insert(0, str(SOURCE))
from conversation_engine import court_turn


class CourtApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Compile the real wrapper without importing heavyweight retrieval/provider dependencies.
        tree = ast.parse((SOURCE / 'rag_engine.py').read_text(encoding='utf-8'))
        engine_class = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == 'LegalRAGEngine')
        wrapper = next(node for node in engine_class.body if isinstance(node, ast.FunctionDef) and node.name == 'simulate_courtroom')
        namespace = {}
        exec(compile(ast.Module(body=[wrapper], type_ignores=[]), 'rag_engine.py', 'exec'), namespace)

        class Engine:
            simulate_courtroom = namespace['simulate_courtroom']

            def detect_and_translate_query(self, query, preferred_lang=None):
                return {'detected_language_code': 'en', 'language_name': 'English'}

            def search_precedents(self, *args, **kwargs):
                return []

            def call_gemini(self, prompt, *args):
                import json
                self.payload = json.loads(prompt)
                witness = self.payload['active_examination']['witness']
                return json.dumps({'turns': [{'actor': witness, 'text': 'I heard a knock from inside.'}], 'needs_answer': False})

        cls.engine = Engine()
        stub = types.ModuleType('rag_engine')
        stub.get_rag_engine = lambda: cls.engine
        spec = importlib.util.spec_from_file_location('court_api_test_app', SOURCE / 'app.py')
        cls.module = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {'rag_engine': stub}):
            spec.loader.exec_module(cls.module)
        cls.client = cls.module.app.test_client()

    def test_ai_answer_preserves_witness_context_across_http_route_and_wrapper(self):
        for side in ('DEFENSE', 'PROSECUTION'):
            for stage in ('direct', 'cross'):
                with self.subTest(side=side, stage=stage):
                    scope = {'witnessId': side + ':test', 'witness': 'WITNESS_' + side, 'side': side,
                             'questioningSide': side if stage == 'direct' else ('DEFENSE' if side == 'PROSECUTION' else 'PROSECUTION'),
                             'examinationStage': stage, 'question': 'What did you hear?',
                             'answerStatus': 'pending', 'answerMode': 'ai'}
                    result = self.client.post('/api/ai/court', json={
                        'summary': 'Synthetic test: the witness was inside a shop.', 'language': 'en',
                        'action': 'witness_answer', 'examination': scope, 'history': []})
                    self.assertEqual(result.status_code, 200, result.get_json())
                    self.assertTrue(result.get_json()['ok'])
                    self.assertEqual(result.get_json()['turns'][0]['actor'], scope['witness'])
                    self.assertEqual(self.engine.payload['active_examination']['witnessId'], scope['witnessId'])
                    self.assertEqual(self.engine.payload['active_examination']['question'], scope['question'])

    def test_invalid_requests_are_client_errors_instead_of_server_crashes(self):
        for body in ([], 'text', None, {'summary': {}}, {'summary': 123},
                     {'summary': 'case', 'history': ['not a turn']},
                     {'summary': 'case', 'language': []}, {'summary': 'case', 'courtType': 'unknown'},
                     {'summary': 'case', 'examination': 'wrong'}, {'summary': 'case', 'input': {}},
                     {'summary': 'case', 'action': 'unknown'}, {'summary': 'case', 'action': 'witness_answer'}):
            with self.subTest(body=body):
                response = self.client.post('/api/ai/court', json=body)
                self.assertEqual(response.status_code, 400)
                self.assertFalse(response.get_json()['ok'])

    def test_temporary_provider_failure_exposes_retry_delay_without_losing_request_context(self):
        error = RuntimeError('AI unavailable. Your hearing is saved; retry in 6 seconds.')
        error.status_code = 503; error.retryable = True; error.retry_after = 6
        with patch.object(self.engine, 'simulate_courtroom', side_effect=error):
            response = self.client.post('/api/ai/court', json={'summary': 'Synthetic case.'})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.headers['Retry-After'], '6')
        self.assertEqual(response.get_json()['retry_after'], 6)
        self.assertTrue(response.get_json()['retryable'])

    def test_unexpected_internal_error_does_not_expose_provider_urls_or_credentials(self):
        with patch.object(self.engine, 'simulate_courtroom', side_effect=OSError('https://example.invalid?key=private')):
            response = self.client.post('/api/ai/court', json={'summary': 'Synthetic case.'})
        self.assertEqual(response.status_code, 500)
        self.assertNotIn('private', response.get_json()['error'])


if __name__ == '__main__':
    unittest.main()

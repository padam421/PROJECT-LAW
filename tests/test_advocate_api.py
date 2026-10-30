import importlib.util
import io
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / 'ai-service/src'
sys.path.insert(0, str(SOURCE))


class AdvocateApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        stub = types.ModuleType('rag_engine')
        cls.engine = types.SimpleNamespace(answer_query=lambda **kwargs: ('Existing citizen answer', {}))
        stub.get_rag_engine = lambda: cls.engine
        spec = importlib.util.spec_from_file_location('advocate_api_test_app', SOURCE / 'app.py')
        cls.module = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {'rag_engine': stub}): spec.loader.exec_module(cls.module)
        cls.client = cls.module.app.test_client()

    def test_separate_advocate_route_does_not_change_citizen_response(self):
        with patch('advocate_engine.answer', return_value=('Detailed counsel analysis', {'sources': [], 'sections': [], 'validation': {}})) as generate:
            response = self.client.post('/api/ai/advocate/chat', json={'message':'NDPS facts','caseContext':'Extracted seizure memo','chatHistory':[{'sender':'user','text':'Prior facts'}]})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['mode'], 'advocate-ndps')
        self.assertIn('Extracted seizure memo', generate.call_args.args)
        citizen = self.client.post('/api/ai/chat', json={'message':'Existing citizen question'})
        self.assertEqual(citizen.json['message'], 'Existing citizen answer')

    def test_invalid_research_and_hearing_requests_are_rejected(self):
        for data in ([], {'message': None}, {'message':'case','chatHistory':'wrong'}, {'message':'case','caseContext':{}}, {'message':'case','language':[]}):
            self.assertEqual(self.client.post('/api/ai/advocate/chat', json=data).status_code, 400)
        for data in ([], {'record':{}}, {'stage':'unknown','record':{'facts':'NDPS'}}):
            self.assertEqual(self.client.post('/api/ai/advocate/rehearsal', json=data).status_code, 400)

    def test_document_route_extracts_text_instead_of_just_metadata(self):
        response = self.client.post('/api/ai/advocate/documents', data={'file':(io.BytesIO(b'Synthetic FIR text: disputed bag ownership.'), 'case.txt')})
        self.assertEqual(response.status_code, 200)
        self.assertIn('disputed bag ownership', response.json['document']['text'])

    def test_upload_limit_is_larger_only_for_document_route(self):
        response = self.client.post('/api/ai/advocate/documents', data={'file':(io.BytesIO(b'x' * (2 * 1024 * 1024 + 10)), 'large.txt')})
        self.assertEqual(response.status_code, 400)  # Extraction text limit, not Flask's 2 MB rejection.
        self.assertIn('100,000', response.json['error'])
        self.assertEqual(self.client.post('/api/ai/chat', data=b'x' * (2 * 1024 * 1024 + 10), content_type='application/json').status_code, 413)


if __name__ == '__main__': unittest.main()

"""Exercise the real provider transport with simulated slow/unavailable models."""
import ast
import json
import time
import types
import unittest
import urllib.request
import urllib.error
from pathlib import Path
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / 'ai-service/src/rag_engine.py'


def engine_fixture():
    tree = ast.parse(SOURCE.read_text(encoding='utf-8'))
    engine = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == 'LegalRAGEngine')
    methods = [node for node in engine.body if isinstance(node, ast.FunctionDef) and node.name in ('call_gemini', 'call_court_model','review_court_model')]
    clock = types.SimpleNamespace(monotonic=lambda: 100.0, sleep=lambda _: None)
    namespace = {'json': json, 'urllib': urllib, 'time': clock, 'GEMINI_API_KEY': 'synthetic-test-key'}
    exec(compile(ast.Module(body=methods, type_ignores=[]), str(SOURCE), 'exec'), namespace)
    return type('Engine', (), {name: namespace[name] for name in ('call_gemini', 'call_court_model','review_court_model')})(), clock


class Reply:
    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def read(self):
        return json.dumps({'candidates': [{'content': {'parts': [{'text': '{"turns":[]}'}]}}]}).encode()


class CourtLatencyTests(unittest.TestCase):
    def test_independent_review_respects_remaining_twenty_second_budget_without_retries(self):
        engine,clock=engine_fixture();requests=[]
        with patch.object(urllib.request,'urlopen',side_effect=lambda request,timeout:requests.append(timeout) or Reply()):
            engine.review_court_model('review','check',clock.monotonic()+7)
        self.assertEqual(requests,[7])
    def test_independent_review_schema_requires_hidden_checks_and_audit_with_correct_speakers(self):
        engine,clock=engine_fixture();requests=[]
        with patch.object(urllib.request,'urlopen',side_effect=lambda request,timeout:requests.append(request) or Reply()):
            engine.review_court_model(json.dumps({'active_examination':{'side':'PROSECUTION','questioningSide':'DEFENSE'}}),'review',clock.monotonic()+20)
        schema=json.loads(requests[0].data)['generationConfig']['responseJsonSchema']
        self.assertEqual(schema['required'],['response','checks','legal_claims'])
        self.assertEqual(schema['properties']['response']['properties']['turns']['items']['properties']['actor']['enum'],['JUDGE','DEFENSE'])
        self.assertIn('inquiry',schema['properties']['legal_claims']['items']['properties']['kind']['enum'])
    def test_unavailable_primary_falls_back_once_without_sleep_and_remembers_working_model(self):
        engine, clock = engine_fixture()
        requests = []
        clock.sleep = lambda _: self.fail('Court fallback must not add an artificial delay')

        def respond(request, timeout):
            requests.append((request, timeout))
            if len(requests) == 1:
                raise urllib.error.HTTPError('https://test.invalid', 503, 'unavailable', {}, None)
            return Reply()

        with patch.object(urllib.request, 'urlopen', side_effect=respond):
            self.assertEqual(engine.call_court_model('synthetic'), '{"turns":[]}')
            engine.call_court_model('next synthetic turn')
        self.assertEqual(len(requests), 3)
        self.assertIn('gemini-3.5-flash-lite', requests[1][0].full_url)
        self.assertIn('gemini-3.5-flash-lite', requests[2][0].full_url)
        self.assertTrue(all(timeout <= 16 for _, timeout in requests))

    def test_slow_models_do_not_start_a_long_chain_of_retries(self):
        engine, clock = engine_fixture()
        requests = []
        elapsed = [100.0]
        clock.monotonic = lambda: elapsed[0]
        clock.sleep = lambda _: self.fail('No delay between court retries')

        def timeout(request, timeout):
            requests.append(timeout)
            elapsed[0] += timeout
            raise TimeoutError('synthetic timeout')

        with patch.object(urllib.request, 'urlopen', side_effect=timeout):
            with self.assertRaisesRegex(RuntimeError, 'Your hearing is saved'):
                engine.call_court_model('synthetic')
            # A second click does not immediately hammer the same unavailable models.
            with self.assertRaises(RuntimeError):
                engine.call_court_model('retry')
        self.assertEqual(len(requests), 2)
        self.assertLessEqual(sum(requests), 34)

    def test_slow_success_gets_more_than_the_old_ten_second_cutoff(self):
        engine, _ = engine_fixture()
        requests = []
        def respond(request, timeout):
            requests.append(timeout)
            if timeout <= 10:
                raise TimeoutError('A valid answer needs twelve seconds')
            return Reply()
        with patch.object(urllib.request, 'urlopen', side_effect=respond):
            self.assertEqual(engine.call_court_model('synthetic'), '{"turns":[]}')
        self.assertEqual(requests, [16])

    def test_failed_review_does_not_disable_witness_generation(self):
        engine, clock = engine_fixture()
        with patch.object(urllib.request, 'urlopen', side_effect=TimeoutError('review timeout')):
            with self.assertRaises(RuntimeError):
                engine.review_court_model('review', 'check', clock.monotonic()+20)
        with patch.object(urllib.request, 'urlopen', return_value=Reply()) as request:
            self.assertEqual(engine.call_court_model('witness'), '{"turns":[]}')
        self.assertIn('gemini-3.1-flash-lite', request.call_args.args[0].full_url)

    def test_cooling_models_report_retry_delay_and_recover_after_it(self):
        engine, clock = engine_fixture()
        now = [100.0]
        clock.monotonic = lambda: now[0]
        with patch.object(urllib.request, 'urlopen', side_effect=TimeoutError('timeout')):
            with self.assertRaises(RuntimeError) as caught:
                engine.call_court_model('synthetic')
        error = caught.exception
        self.assertEqual(error.status_code, 503)
        self.assertTrue(error.retryable)
        self.assertGreaterEqual(error.retry_after, 1)
        self.assertLessEqual(error.retry_after, 10)
        now[0] += error.retry_after
        with patch.object(urllib.request, 'urlopen', return_value=Reply()):
            self.assertEqual(engine.call_court_model('retry'), '{"turns":[]}')

    def test_truncated_or_empty_provider_json_is_retried_before_returning(self):
        engine, _ = engine_fixture()
        class Truncated(Reply):
            def read(self):
                return json.dumps({'candidates':[{'finishReason':'MAX_TOKENS',
                    'content':{'parts':[{'text':'{"turns":['}]}}]}).encode()
        with patch.object(urllib.request, 'urlopen', side_effect=[Truncated(), Reply()]) as requests:
            self.assertEqual(engine.call_court_model('synthetic'), '{"turns":[]}')
        self.assertEqual(requests.call_count, 2)

    def test_two_incomplete_success_responses_still_produce_a_recoverable_provider_error(self):
        engine, _ = engine_fixture()
        class Incomplete(Reply):
            def read(self):
                return json.dumps({'candidates':[{'content':{'parts':[{'text':'{"turns":['}]}}]}).encode()
        with patch.object(urllib.request,'urlopen',return_value=Incomplete()) as requests:
            with self.assertRaises(RuntimeError) as caught:
                engine.call_court_model('synthetic')
        self.assertEqual(requests.call_count,2)
        self.assertEqual(caught.exception.status_code,503)
        self.assertTrue(caught.exception.retryable)

    def test_structured_court_requests_limit_thinking_without_changing_chat(self):
        engine, _ = engine_fixture()
        requests = []
        def respond(request, timeout):
            requests.append(json.loads(request.data))
            if len(requests) == 1:
                raise urllib.error.HTTPError('https://test.invalid', 503, 'unavailable', {}, None)
            return Reply()
        with patch.object(urllib.request, 'urlopen', side_effect=respond):
            engine.call_court_model('synthetic')
            engine.call_gemini('chat')
        self.assertEqual(requests[0]['generationConfig']['thinkingConfig'], {'thinkingLevel':'minimal'})
        self.assertEqual(requests[1]['generationConfig']['thinkingConfig'], {'thinkingLevel':'minimal'})
        self.assertNotIn('thinkingConfig', requests[2]['generationConfig'])

    def test_court_and_chat_have_separate_bounded_provider_budgets(self):
        engine, _ = engine_fixture()
        requests = []
        with patch.object(urllib.request, 'urlopen', side_effect=lambda request, timeout: requests.append((request, timeout)) or Reply()):
            engine.call_court_model('court')
            engine.call_gemini('chat')
        self.assertEqual(json.loads(requests[0][0].data)['generationConfig']['maxOutputTokens'], 2048)
        self.assertEqual(json.loads(requests[1][0].data)['generationConfig']['maxOutputTokens'], 8192)
        self.assertEqual(requests[1][1], 20)
        self.assertNotIn('responseJsonSchema',json.loads(requests[1][0].data)['generationConfig'])

    def test_rate_limit_is_respected_by_generation_and_review_without_sharing_timeout_circuits(self):
        engine, clock = engine_fixture();requests=[]
        def respond(request, timeout):
            requests.append(request)
            if len(requests)==1:
                raise urllib.error.HTTPError('https://test.invalid',429,'rate limited',{'Retry-After':'17'},None)
            return Reply()
        with patch.object(urllib.request,'urlopen',side_effect=respond):
            engine.call_court_model('synthetic')
            engine.review_court_model('review','check',clock.monotonic()+20)
        self.assertEqual(engine._court_rate_cooldown['gemini-3.1-flash-lite'],117)
        self.assertIn('gemini-3.5-flash-lite',requests[-1].full_url)

    def test_opening_schema_cannot_request_testimony_before_a_witness_is_called(self):
        engine, clock=engine_fixture();requests=[]
        with patch.object(urllib.request,'urlopen',side_effect=lambda request,timeout:requests.append(request) or Reply()):
            engine.call_court_model(json.dumps({'action':'opening'}))
            engine.review_court_model(json.dumps({'action':'opening'}),'review',clock.monotonic()+20)
        generation=json.loads(requests[0].data)['generationConfig']['responseJsonSchema']
        review=json.loads(requests[1].data)['generationConfig']['responseJsonSchema']['properties']['response']
        for schema in (generation,review):
            self.assertEqual(schema['properties']['needs_answer']['enum'],[False])
            self.assertEqual(schema['properties']['question']['enum'],[''])

    def test_provider_schema_constrains_question_speakers_and_witness_ownership(self):
        engine,_=engine_fixture()
        for side in ('DEFENSE','PROSECUTION'):
            for action in ('cross_question','witness_answer'):
                scope={'side':side,'witness':'WITNESS_'+side,'questioningSide':'PROSECUTION' if side=='DEFENSE' else 'DEFENSE'}
                requests=[]
                with patch.object(urllib.request,'urlopen',side_effect=lambda request,timeout:requests.append(request) or Reply()):
                    engine.call_court_model(json.dumps({'action':action,'active_examination':scope}))
                config=json.loads(requests[0].data)['generationConfig'];schema=config['responseJsonSchema']
                actors=schema['properties']['turns']['items']['properties']['actor']['enum']
                self.assertEqual(actors,[scope['witness']] if action=='witness_answer' else ['JUDGE',scope['questioningSide']])
                self.assertEqual(schema['properties']['witness_side']['enum'],[side])


if __name__ == '__main__':
    unittest.main()

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'ai-service/src'))
from conversation_engine import answer, language_info
from response_language import input_language


class Engine:
    def __init__(self, code='hi', replies=None):
        self.code = code
        self.samples = []
        self.calls = []
        self.lookups = []
        self.replies = iter(replies or [{'message': 'draft'}, {'message': 'Keep copies of your records.'}])

    def detect_and_translate_query(self, query, preferred_lang=None):
        self.samples.append((query, preferred_lang))
        return {'detected_language_code': self.code, 'english_translation': query, 'is_legal': True}

    def search_precedents(self, query, top_k):
        self.lookups.append(query)
        return []

    def call_gemini(self, prompt, system, temperature, json_output):
        self.calls.append((json.loads(prompt), system))
        return json.dumps(next(self.replies), ensure_ascii=False)


class UserLanguageTests(unittest.TestCase):
    def test_english_turn_overrides_hindi_preference_and_history(self):
        engine = Engine('hi')
        query = 'What documents should I keep?'
        message, info = answer(engine, query, language='hi', chat_history=[
            {'sender': 'user', 'text': 'पुरानी बात: किराये का विवाद है।'},
            {'sender': 'ai', 'text': 'यह पुराना हिंदी उत्तर है।'}])
        self.assertEqual(info['detected_language_code'], 'en')
        self.assertEqual(engine.samples, [(query, 'auto')])
        self.assertIn('general guidance', message)
        self.assertNotIn('यह आपकी', message)
        self.assertIn('पुरानी बात', engine.lookups[0])
        for payload, instruction in engine.calls:
            self.assertEqual(payload['language_reference'], query)
            self.assertIn('in English', instruction)
            self.assertIn('must not override this turn', instruction)

    def test_each_new_turn_can_switch_english_hindi_and_back(self):
        history = []
        for query, code, reply in [
            ('Explain the next step.', 'en', 'Keep the original records.'),
            ('कौनसे दस्तावेज़ संभालकर रखूँ?', 'hi', 'अपने कागज़ों की प्रतियाँ सुरक्षित रखें।'),
            ('How should I organise the documents?', 'en', 'Arrange copies by date.')]:
            engine = Engine('en', [{'message': 'draft'}, {'message': reply}])
            message, info = answer(engine, query, language='hi', chat_history=history)
            self.assertEqual(info['detected_language_code'], code)
            self.assertEqual(engine.samples, [(query, 'auto')])
            self.assertTrue(message.startswith(reply))
            history.extend([{'sender': 'user', 'text': query}, {'sender': 'ai', 'text': message}])

    def test_hinglish_keeps_latin_script_in_prompt_and_source_note(self):
        query = 'Mujhe batao kaunse kagaz rakhne chahiye?'
        engine = Engine('en', [{'message': 'draft'}, {'message': 'Apne kagazaat ki copies sambhal kar rakhein.'}])
        message, info = answer(engine, query, language='en')
        self.assertEqual(info['detected_language_code'], 'hi-Latn')
        self.assertNotRegex(message, r'[\u0900-\u097f]')
        self.assertIn('aam margdarshan', message)
        self.assertNotIn('This is general guidance', message)
        for _, instruction in engine.calls:
            self.assertIn('Hinglish stays in Latin letters', instruction)

    def test_other_native_scripts_and_marathi_keep_their_language(self):
        for query, detected, expected in [('મને આ સમજાવો', 'en', 'gu'),
                                          ('దీని గురించి వివరించండి', 'en', 'te'),
                                          ('இதனை விளக்குங்கள்', 'en', 'ta'),
                                          ('मला हे समजावून सांगा', 'mr', 'mr')]:
            with self.subTest(expected=expected):
                self.assertEqual(input_language(Engine(detected), query)['detected_language_code'], expected)

    def test_short_english_followup_is_not_classified_from_old_hindi(self):
        query = 'Why?'
        engine = Engine('en')
        _, info = answer(engine, query, chat_history=[{'sender': 'user', 'text': 'लंबा पुराना हिंदी सवाल'}])
        self.assertEqual(info['language_name'], 'English')
        self.assertEqual(engine.samples, [(query, 'auto')])

    def test_english_survives_detector_outage_or_a_short_quoted_hindi_term(self):
        for detected, query in [('auto', 'What documents should I keep?'),
                                ('hi', 'Please explain which documents prove जमानत in this case.')]:
            self.assertEqual(input_language(Engine(detected), query)['language_name'], 'English')

    def test_repair_pass_receives_the_same_current_language(self):
        engine = Engine('hi', [{'message': 'draft'},
                              {'message': 'First attempt', 'checks': {'language_matches': False}},
                              {'message': 'Keep the dated records.', 'checks': {'language_matches': True}}])
        _, info = answer(engine, 'Which documents do I need?', language='hi')
        self.assertEqual(info['detected_language_code'], 'en')
        self.assertEqual(len(engine.calls), 3)
        for payload, instruction in engine.calls:
            self.assertEqual(payload['language_reference'], 'Which documents do I need?')
            self.assertIn('in English', instruction)

    def test_case_language_selection_for_court_still_works(self):
        engine = Engine('hi')
        self.assertEqual(language_info(engine, 'A case brief', 'en', [])['language_name'], 'English')


if __name__ == '__main__':
    unittest.main()

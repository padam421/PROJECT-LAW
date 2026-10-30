"""Language follows the latest lawyer input, independently of retrieval/history."""
import copy
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'ai-service/src'))
import advocate_engine as research
from test_advocate_engine import Engine, result, audited


class Detector(Engine):
    def __init__(self, code='en', replies=()):
        super().__init__(replies)
        self.code = code
        self.samples = []

    def detect_and_translate_query(self, query, preferred_lang=None):
        self.samples.append((query, preferred_lang))
        return {'detected_language_code': self.code, 'english_translation': query}


class AdvocateLanguageTests(unittest.TestCase):
    def test_script_and_hinglish_survive_detector_english_fallback(self):
        for text, code in [('Mujhe batao bail kaise milegi?', 'hi-Latn'),
                           ('मुझे ज़मानत के बारे में बताइए', 'hi'),
                           ('મને જામીન વિશે સમજાવો', 'gu'),
                           ('జామీను గురించి వివరించండి', 'te'),
                           ('ஜாமீன் பற்றி விளக்கவும்', 'ta'),
                           ('Explain the missing evidence.', 'en')]:
            with self.subTest(code=code):
                self.assertEqual(research.input_language(Detector(), text)['detected_language_code'], code)

    def test_marathi_is_not_misclassified_as_hindi(self):
        self.assertEqual(research.input_language(Detector('mr'), 'मला जामिनाबद्दल सांगा')['language_name'], 'Marathi')

    def test_english_question_with_short_hindi_quote_stays_english(self):
        self.assertEqual(research.input_language(Detector(), 'Explain what जमानत means in this case and list the missing documents.')['language_name'], 'English')

    def test_detected_romanized_language_preserves_script(self):
        self.assertEqual(research.input_language(Detector('ta'), 'Enakku indha vazhakku patri sollungal')['language_name'], 'Tamil in Latin script')

    def test_chat_switches_language_despite_history_attachment_and_old_preference(self):
        for query, code in [('What evidence is missing?', 'en'), ('Mujhe agla step batao', 'hi-Latn'), ('क्या दस्तावेज चाहिए?', 'hi')]:
            engine = Detector()
            with patch.object(research, 'generate', return_value=result()) as generate, patch.object(research, 'evidence', return_value=[]) as evidence:
                _, info = research.answer(engine, query, 'ENGLISH NDPS DOCUMENT', 'gu',
                    [{'sender': 'user', 'text': 'पुराना NDPS मामला'}, {'sender': 'ai', 'text': 'Gujarati AI reply'}])
            self.assertEqual(info['detected_language_code'], code)
            self.assertEqual(engine.samples, [(query, 'auto')])
            self.assertEqual(generate.call_args.args[1]['language_reference'], query)
            self.assertIn('ENGLISH NDPS DOCUMENT', evidence.call_args.args[1])
            self.assertIn('पुराना NDPS मामला', evidence.call_args.args[1])

    def test_document_only_uses_previous_human_input_or_document(self):
        for history, expected in [([], 'हिंदी NDPS दस्तावेज'),
                                  ([{'sender': 'user', 'text': 'Mujhe samjhao'}], 'Mujhe samjhao'),
                                  ([{'sender': 'user', 'text': 'Analyse the attached NDPS case papers in detail.', 'documentOnly': True}], 'हिंदी NDPS दस्तावेज')]:
            engine = Detector()
            with patch.object(research, 'generate', return_value=result()), patch.object(research, 'evidence', return_value=[]):
                research.answer(engine, '', 'हिंदी NDPS दस्तावेज', chat_history=history)
            self.assertEqual(engine.samples[0][0], expected)

    def test_court_uses_latest_submission_then_counsel_then_saved_sample(self):
        structured = {'sections': [{'key': k, 'title': k, 'paragraphs': result()['sections'][0]['paragraphs']}
                                  for k in ('opponent', 'bench', 'coaching', 'next_step')], 'checks': {k: True for k in research.CHECKS}}
        for submission, transcript, expected in [
            ('Mujhe bench ka sawal samjhao', [{'actor': 'COUNSEL', 'text': 'Earlier English'}], 'Mujhe bench ka sawal samjhao'),
            ('Explain this objection.', [{'actor': 'COUNSEL', 'text': 'पहले हिंदी'}], 'Explain this objection.'),
            ('', [{'actor': 'COUNSEL', 'text': 'मेरा तर्क'}, {'actor': 'PRACTICE', 'text': 'English AI reply'}], 'मेरा तर्क'),
            ('', [], 'Mujhe case samjhao')]:
            engine = Detector()
            with patch.object(research, 'generate', return_value=copy.deepcopy(structured)) as generate, patch.object(research, 'evidence', return_value=[]):
                research.rehearse(engine, {'record': {'facts': 'English NDPS case', 'languageSample': 'Mujhe case samjhao'},
                                           'language': 'gu', 'submission': submission, 'transcript': transcript})
            self.assertEqual(engine.samples, [(expected, 'auto')])
            self.assertEqual(generate.call_args.args[1]['language_reference'], expected)

    def test_generation_and_independent_review_both_receive_language_rule(self):
        draft = result('Mool documents ko sambhal kar rakhein.')
        engine = Detector('hi', [draft, audited(draft)])
        with patch.object(research, 'evidence', return_value=[]):
            research.answer(engine, 'Mujhe agla step batao')
        for _, system in engine.calls:
            self.assertIn('Hinglish', system)
            self.assertIn('ALL section titles', system)
            self.assertIn('do not convert it to Devanagari', system)

    def test_withheld_proposition_does_not_insert_english_into_hinglish(self):
        bad = result('Section 999 guarantees release.', kind='law')
        safe = research.retain_supported_analysis(bad, [], {}, 'Hinglish (Hindi in Latin script, with natural English legal terms)')
        text = research.render(safe, [])[0]
        self.assertIn('verify nahi hua', text)
        self.assertNotIn('A proposition', text)
        self.assertNotIn('999', text)


if __name__ == '__main__':
    unittest.main()

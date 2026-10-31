import copy
import io
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'ai-service/src'))
import advocate_engine as research
from advocate_documents import extract


def result(text='Preserve the original seizure record and record the dates independently.', key='next_steps', citations=None, kind='analysis'):
    return {'sections': [{'key': key, 'title': 'Preparation', 'paragraphs': [
        {'text': text, 'kind': kind, 'citations': citations or []}]}],
        'checks': {key: True for key in research.CHECKS}}


def audited(draft):
    return {'paragraph_reviews': [{'id':f'{si}:{pi}', 'paragraph':p,
        'facts_match':True, 'evidence_supported':True} for si,s in enumerate(draft['sections'])
        for pi,p in enumerate(s['paragraphs'])], 'checks': draft['checks']}


class Engine:
    collections = {}
    def __init__(self, replies):
        self.replies = iter(replies)
        self.calls = []
    def call_gemini(self, prompt, system, *args, **kwargs):
        self.calls.append((json.loads(prompt), system))
        return json.dumps(next(self.replies))
    def detect_and_translate_query(self, query, preferred_lang=None):
        return {'english_translation': query, 'detected_language_code': preferred_lang or 'en', 'is_legal': True}


class AdvocateResearchTests(unittest.TestCase):
    def test_failed_source_review_returns_record_preparation_without_releasing_rejected_law(self):
        class Detector(Engine):
            def detect_and_translate_query(self, query, preferred_lang=None):
                return {'english_translation': query, 'detected_language_code': 'en'}
        unsafe = result('The client is guaranteed bail under Section 999.', kind='law')
        rejected = audited(unsafe)
        rejected['checks'] = {key: False for key in research.CHECKS}
        for row in rejected['paragraph_reviews']:
            row['evidence_supported'] = False
        source = {'id': 'A1', 'kind': 'statute', 'title': 'Synthetic source',
                  'text': 'A complete synthetic source passage used only to test immutable quotation binding.'}
        for query, expected in [('Which records should I obtain?', 'en'),
                                ('Mujhe batao ab kaunse documents chahiye?', 'hi-Latn'),
                                ('मुझे कौन से दस्तावेज़ चाहिए?', 'hi')]:
            with self.subTest(language=expected):
                engine = Detector([unsafe, rejected, rejected])
                with patch.object(research, 'evidence', return_value=[source]):
                    message, info = research.answer(engine, query, chat_history=[{'sender': 'user', 'text': 'Synthetic NDPS bag case'}])
                self.assertNotIn('999', message)
                self.assertNotIn('guaranteed bail', message)
                self.assertEqual(info['detected_language_code'], expected)
                self.assertEqual(info['validation']['mode'], 'preparation_only')
                self.assertFalse(info['validation']['reviewed'])
                self.assertTrue(info['validation']['limited_analysis'])
                self.assertTrue(all(value is False for value in info['validation']['checks'].values()))
                self.assertIn(source['text'], message)
                self.assertEqual([s['id'] for s in info['sources']], ['A1'])
                for section in info['sections']:
                    for paragraph in section['paragraphs']:
                        for citation in paragraph['citations']:
                            self.assertIn(citation['quote'], source['text'])
                if expected != 'hi':
                    self.assertNotRegex(message, r'[\u0900-\u097f]')

    def test_incomplete_independent_audit_cannot_release_a_draft_but_preserves_preparation(self):
        class Detector(Engine):
            def detect_and_translate_query(self, query, preferred_lang=None):
                return {'english_translation': query, 'detected_language_code': 'en'}
        draft = result('DO NOT RELEASE THIS UNREVIEWED DRAFT')
        audit = {'paragraph_reviews': [], 'checks': {key: True for key in research.CHECKS}}
        with patch.object(research, 'evidence', return_value=[]):
            message, info = research.answer(Detector([draft, audit, audit]), 'Which records are needed?',
                chat_history=[{'sender': 'user', 'text': 'Synthetic NDPS case'}])
        self.assertNotIn('DO NOT RELEASE', message)
        self.assertIn('original case papers', message)
        self.assertFalse(info['validation']['reviewed'])
        self.assertEqual(info['sources'], [])

    def test_recovery_preserves_other_native_languages_and_does_not_invent_a_romanized_translation(self):
        fallback = research.preparation_only([], 'Marathi')
        self.assertIn('अपुष्ट', research.render(fallback, [])[0])
        self.assertIsNone(research.preparation_only([], 'Tamil in Latin script'))

    def test_entire_record_retains_middle_turn_corrections_and_documents(self):
        turns = [{'sender': 'user', 'text': 'Fact ' + str(i), 'caseContext': 'Document ' + str(i)} for i in range(40)]
        payload, facts = research.case_record('What about the disputed ownership?', None, turns)
        self.assertIn('Document 21', facts)
        self.assertEqual(len(payload['conversation']), 40)
        self.assertIn('Fact 0', facts)
        self.assertIn('Fact 39', facts)

    def test_context_limit_is_explicit_instead_of_silent_truncation(self):
        with self.assertRaisesRegex(ValueError, 'history has not been removed'):
            research.case_record('case', 'x' * 270000, [])

    def test_cited_but_overstated_bail_and_invented_facts_are_rejected(self):
        payload = {'latest_request':'NDPS bag seizure; FSL and weight unknown.'}
        self.assertTrue(research.record_checks(result('Without a confirmed quantity and FSL report, the prosecution cannot invoke Section 37.'), payload))
        self.assertTrue(research.record_checks(result('The accused is not a flight risk and is at the pre-charge stage.'), payload))
        self.assertFalse(research.record_checks(result('Confirm whether the matter is at the pre-charge stage; the supplied record does not establish it.'), payload))

    def test_each_legal_paragraph_requires_an_exact_supporting_passage(self):
        source = {'id': 'A1', 'text': 'The Public Prosecutor has been given an opportunity to oppose the application.'}
        good = result('Section 37 describes an opportunity for the prosecutor to oppose release.', kind='law',
                      citations=[{'source_id': 'A1', 'quote': source['text']}])
        self.assertEqual(research.validate(good, [source]), [])
        bad = copy.deepcopy(good)
        bad['sections'][0]['paragraphs'][0]['citations'][0]['quote'] = 'An invented exception which does not appear in this source.'
        self.assertIn('Citation quote does not match the supplied source.', research.validate(bad, [source]))
        bad['sections'][0]['paragraphs'][0]['citations'] = []
        self.assertIn('A legal proposition lacks supporting authority.', research.validate(bad, [source]))

    def test_fabricated_source_ids_and_incomplete_reviews_are_rejected(self):
        bad = result('Section 999 applies.', kind='law', citations=[{'source_id': 'A99', 'quote': 'A fabricated statutory source quotation.'}])
        self.assertTrue(research.validate(bad, []))
        bad = result(); bad['checks'] = []
        self.assertIn('Independent legal/factual checks were incomplete.', research.validate(bad, []))

    def test_failed_review_is_repaired_or_fails_without_publishing_the_draft(self):
        unsupported = result('Section 999 guarantees release.', kind='law')
        engine = Engine([result(), audited(unsupported), audited(result())])
        final = research.generate(engine, {'case': 'NDPS'}, [], 'English', 'Explain the issue.')
        self.assertNotIn('999', research.render(final, [])[0])
        self.assertEqual(len(engine.calls), 3)
        engine = Engine([unsupported, audited(unsupported), audited(unsupported)])
        safe = research.generate(engine, {}, [], 'English', 'Explain.')
        self.assertNotIn('999', research.render(safe, [])[0])
        self.assertIn('withheld', research.render(safe, [])[0])
        self.assertTrue(safe['limited_analysis'])

    def test_full_report_requires_all_requested_topics_and_substantial_detail(self):
        self.assertIn('Missing required case-analysis topics.', research.validate(result(), [], full=True))
        full = {'sections': [{'key': k, 'title': k, 'paragraphs': [{'text': 'record ' * 100, 'kind': 'analysis', 'citations': []}]} for k in research.REPORT_PARTS], 'checks': {k: True for k in research.CHECKS}}
        self.assertEqual(research.validate(full, [], full=True), [])

    def test_official_snapshot_includes_body_provisos_across_page_footnotes(self):
        sources = research.official_sources(None, 'NDPS bail bag search section 37 section 52A')
        by_title = {s['title'].split('section ')[-1]: s for s in sources}
        self.assertIn('37', by_title)
        self.assertIn('52A', by_title)
        self.assertIn('not guilty', by_title['37']['text'])
        self.assertIn('while on bail', by_title['37']['text'])
        self.assertFalse(by_title['37']['current_consolidation_confirmed'])

    def test_only_ndps_collection_is_queried_and_bad_ocr_and_pre_act_cases_are_removed(self):
        class Collection:
            def count(self): return 12
            def query(self, **kwargs):
                return {'documents': [['NDPS judgment body ' * 20, 'raw_html form-select ' * 30, 'old judgment ' * 30]],
                        'metadatas': [[{'case_id':'case1','year':'2020'}, {'case_id':'junk','year':'2020'}, {'case_id':'old','year':'1959'}]],
                        'distances': [[.2, .1, .1]]}
        engine = Engine([]); engine.collections = {'narcotics': Collection(), 'writ': object()}
        sources = research.precedent_sources(engine, 'NDPS bag search')
        self.assertEqual([s['case_id'] for s in sources], ['case1'])
        self.assertFalse(sources[0]['metadata_complete'])

    def test_unrelated_matter_never_gets_ndps_sources(self):
        engine = Engine([])
        with patch.object(research, 'official_sources', side_effect=AssertionError('Must not query NDPS')):
            self.assertEqual(research.evidence(engine, 'A tenancy deposit dispute', {'english_translation':'A tenancy deposit dispute'}), [])

    def test_rehearsal_keeps_counsel_side_stage_submission_and_prior_transcript(self):
        structured = {'sections': [{'key': k, 'title': k, 'paragraphs': result()['sections'][0]['paragraphs']} for k in ('opponent','bench','coaching','next_step')], 'checks': {k:True for k in research.CHECKS}}
        engine = Engine([structured, audited(structured)])
        with patch.object(research, 'evidence', return_value=[]):
            response = research.rehearse(engine, {'record':{'facts':'Synthetic NDPS incident','research':'untrusted analysis'}, 'stage':'cross', 'side':'prosecution', 'submission':'Who kept the seal?', 'language':'en', 'transcript':[{'actor':'COUNSEL','text':'Earlier submission'}]})
        self.assertTrue(response['practice_only'])
        self.assertEqual(engine.calls[0][0]['counsel_side'], 'prosecution')
        self.assertEqual(engine.calls[0][0]['stage'], 'cross')
        self.assertIn('Earlier submission', json.dumps(engine.calls[0][0]))
        self.assertIn('not proved facts', engine.calls[0][1])

    def test_missing_or_duplicate_paragraph_reviews_cannot_release_a_draft(self):
        draft = result()
        self.assertTrue(research.validate(research.assemble_review(draft, {'paragraph_reviews':[], 'checks':draft['checks']}), []))
        review = audited(draft); review['paragraph_reviews'] *= 2
        self.assertTrue(research.validate(research.assemble_review(draft, review), []))

    def test_passage_ids_bind_to_immutable_source_text_and_reject_invented_ids(self):
        sources = research.with_passages([{'id':'A1','text':'A complete actual supporting statutory passage from the official document.'}])
        draft = result('Section 37 contains a condition.', kind='law', citations=[{'source_id':'A1','passage_id':'P1'}])
        self.assertEqual(research.validate(research.bind_citations(draft,sources),sources), [])
        draft['sections'][0]['paragraphs'][0]['citations'][0]['passage_id']='P999'
        self.assertTrue(research.validate(research.bind_citations(draft,sources),sources))


class DocumentTests(unittest.TestCase):
    def test_text_and_docx_extract_real_content(self):
        self.assertIn('Synthetic FIR', extract('case.txt', b'Synthetic FIR; disputed search.')['text'])
        data = io.BytesIO()
        with zipfile.ZipFile(data, 'w') as archive:
            archive.writestr('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Actual case paper</w:t></w:r></w:p></w:body></w:document>')
        self.assertEqual(extract('case.docx', data.getvalue())['text'], 'Actual case paper')

    def test_scanned_pdf_and_unsupported_formats_are_not_claimed_read(self):
        from pypdf import PdfWriter
        writer = PdfWriter(); writer.add_blank_page(width=100, height=100)
        data = io.BytesIO(); writer.write(data)
        with self.assertRaisesRegex(ValueError, 'OCR'):
            extract('scan.pdf', data.getvalue())
        with self.assertRaisesRegex(ValueError, 'OCR/text'):
            extract('photo.jpg', b'image')

    def test_large_text_is_not_silently_truncated(self):
        with self.assertRaisesRegex(ValueError, 'nothing was silently truncated'):
            extract('large.txt', b'x' * 100001)


if __name__ == '__main__': unittest.main()

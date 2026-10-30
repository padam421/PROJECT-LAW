import copy,json,sys,time,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'ai-service/src'))
from conversation_engine import court_turn
from court_review import authorities, fetch_document, OfficialRedirectHandler, review_response
import urllib.request


CHECKS={key:True for key in ('facts','law','procedure','roles','clarity')}
def question(text,actor='DEFENSE'):
    return {'turns':[{'actor':actor,'text':text}], 'needs_answer':True,'question':text,'question_actor':actor}

class Engine:
    def __init__(self,draft,review=None):
        self.draft=draft;self.review=review;self.generations=[];self.reviews=[]
    def search_precedents(self,*args,**kwargs):return []
    def detect_and_translate_query(self,*args,**kwargs):return {'detected_language_code':'en','language_name':'English'}
    def call_gemini(self,*args,**kwargs):return self.call_court_model(*args,**kwargs)
    def call_court_model(self,prompt,*args,**kwargs):
        self.generations.append(json.loads(prompt));return json.dumps(self.draft)
    def review_court_model(self,prompt,system,deadline):
        payload=json.loads(prompt);self.reviews.append((payload,system,deadline))
        if isinstance(self.review,Exception):raise self.review
        return json.dumps(self.review if self.review is not None else {'response':payload['proposal'],'checks':CHECKS,'legal_claims':[]})

class CourtReviewTests(unittest.TestCase):
    def setUp(self):
        self.authorities=patch('court_review.authorities',return_value=[])
        self.lookup=self.authorities.start();self.addCleanup(self.authorities.stop)
        self.scope={'witnessId':'DEFENSE:1','witness':'WITNESS_DEFENSE','side':'DEFENSE','questioningSide':'DEFENSE',
                    'examinationStage':'direct','question':'What happened?','answerMode':'manual','answerStatus':'submitted'}
    def run_turn(self,engine,action='react',history=None,**kwargs):
        return court_turn(engine,'Synthetic shop dispute. The witness was indoors.',history or [],language='en',
                          action=action,examination=self.scope,**kwargs)
    def test_opening_review_failure_keeps_both_sides_available_for_witness_practice(self):
        for language in ('en','hi'):
            engine=Engine({'turns':[{'actor':'JUDGE','text':'Unchecked draft.'}],
                           'needs_answer':False},RuntimeError('Temporary review timeout'))
            result=court_turn(engine,'Synthetic case.',language=language,action='opening')
            self.assertEqual([turn['actor'] for turn in result['turns']],['JUDGE','DEFENSE','PROSECUTION'])
            self.assertNotIn('Unchecked draft',json.dumps(result))
            self.assertFalse(result['needs_answer'])
    def test_every_generated_bench_and_counsel_turn_is_reviewed_before_return(self):
        draft={'turns':[{'actor':actor,'text':text} for actor,text in (
            ('JUDGE','Counsel, identify the disputed facts.'),('DEFENSE','The delivery is disputed.'),('PROSECUTION','The courier identity remains unknown.'))],
               'needs_answer':False,'question':''}
        engine=Engine(draft);result=court_turn(engine,'Synthetic delivery dispute.',language='en')
        self.assertEqual(len(engine.reviews),1);self.assertEqual(len(engine.reviews[0][0]['proposal']['turns']),3)
        self.assertTrue(all(turn['_courtReviewed'] for turn in result['turns']))
        self.assertTrue(all(key not in result for key in ('checks','legal_claims','official_authorities','validation')))
    def test_review_repairs_an_unfounded_factual_premise(self):
        corrected=question('Could you see the courier from where you were?')
        engine=Engine(question('You could not see through the closed door, correct?'),{'response':corrected,'checks':CHECKS,'legal_claims':[]})
        result=self.run_turn(engine)
        self.assertEqual(result['question'],corrected['question']);self.assertNotIn('closed door',json.dumps(result))
    def test_manual_witness_testimony_is_passed_verbatim_and_not_treated_as_legal_authority(self):
        answer='FIR section 999 means I am guaranteed to win. This is my own answer.'
        history=[{'actor':'WITNESS_DEFENSE','kind':'answer','text':answer,'witnessId':'DEFENSE:1'}]
        engine=Engine(question('What is the incident date?'));self.run_turn(engine,history=history)
        self.assertEqual(engine.reviews[0][0]['transcript'][0]['text'],answer)
        self.assertEqual(history[0]['text'],answer)
        self.assertIn('do not judge, reject, rewrite',engine.reviews[0][1])
    def test_new_review_is_not_applied_to_ai_witness_answers_on_either_side(self):
        for side in ('DEFENSE','PROSECUTION'):
            engine=Engine({'turns':[{'actor':'WITNESS_'+side,'text':'I heard a knock.'}], 'needs_answer':False})
            scope={**self.scope,'side':side,'witness':'WITNESS_'+side,'questioningSide':side,'answerMode':'ai'}
            result=court_turn(engine,'Synthetic dispute.',language='en',action='witness_answer',examination=scope)
            self.assertEqual(len(engine.reviews),0);self.assertEqual(result['turns'][0]['text'],'I heard a knock.')
    def test_unsupported_law_is_not_displayed_even_if_review_claims_all_checks_passed(self):
        engine=Engine(question('Section 999 guarantees your acquittal.'))
        result=self.run_turn(engine)
        self.assertNotIn('999',json.dumps(result));self.assertNotIn('guarantees',json.dumps(result))
        self.assertEqual(result['turns'][0]['actor'],'DEFENSE')
    def test_fabricated_source_id_or_quote_cannot_support_a_legal_claim(self):
        for sid,quote in [('A99','Actual official words.'),('A1','An invented quotation.')]:
            self.lookup.return_value=[{'id':'A1','text':'Actual official words.','url':'https://www.indiacode.nic.in/test.pdf'}]
            text='Section 50 creates an unconditional entitlement.'
            engine=Engine(question(text),{'response':question(text),'checks':CHECKS,
                'legal_claims':[{'text':text,'kind':'law','source_ids':[sid],'support_quote':quote}]})
            self.assertNotIn('unconditional',json.dumps(self.run_turn(engine)))
    def test_reported_section_cannot_be_disguised_as_a_proven_legal_conclusion(self):
        text='FIR section 999 proves guilt.'
        engine=Engine(question(text),{'response':question(text),'checks':CHECKS,
            'legal_claims':[{'text':text,'kind':'reported','source_ids':[]}]})
        result=self.run_turn(engine,history=[{'actor':'WITNESS_DEFENSE','kind':'answer','text':'Section 999 is written in the FIR.'}])
        self.assertNotIn('proves guilt',json.dumps(result))
    def test_reported_fir_detail_can_be_queried_without_endorsing_its_legal_correctness(self):
        text='You mentioned section 999 in the FIR. What is the incident date?'
        engine=Engine(question(text),{'response':question(text),'checks':CHECKS,
            'legal_claims':[{'text':text,'kind':'reported','source_ids':[]}]})
        result=self.run_turn(engine,history=[{'actor':'WITNESS_DEFENSE','kind':'answer','text':'FIR section 999 is written.'}])
        self.assertEqual(result['question'],text)
    def test_neutral_fir_inquiry_is_retained_without_asserting_a_legal_proposition(self):
        text='Which sections are actually listed in the FIR?'
        engine=Engine(question(text),{'response':question(text),'checks':CHECKS,
            'legal_claims':[{'text':text,'kind':'inquiry','source_ids':[],'support_quote':''}]})
        self.assertEqual(self.run_turn(engine)['question'],text)
    def test_inquiry_cannot_disguise_a_rule_or_invent_a_numbered_section(self):
        for text in ('Does section 999 apply?', 'Does the FIR prove guilt?', 'Must the FIR be filed within three days?'):
            engine=Engine(question(text),{'response':question(text),'checks':CHECKS,
                'legal_claims':[{'text':text,'kind':'inquiry','source_ids':[],'support_quote':''}]})
            self.assertNotEqual(self.run_turn(engine)['question'],text)
    def test_each_legal_sentence_requires_its_own_support(self):
        inquiry='Which sections are actually listed in the FIR?'
        text='Section 999 applies automatically. '+inquiry
        engine=Engine(question(text),{'response':question(text),'checks':CHECKS,
            'legal_claims':[{'text':inquiry,'kind':'inquiry','source_ids':[],'support_quote':''}]})
        self.assertNotIn('999',json.dumps(self.run_turn(engine)))
    def test_question_field_cannot_replace_the_reviewed_spoken_text(self):
        response={**question('What happened?'),'question':'Section 999 guarantees acquittal.'}
        engine=Engine(question('What happened?'),{'response':response,'checks':CHECKS,'legal_claims':[]})
        self.assertNotIn('999',json.dumps(self.run_turn(engine)))
    def test_source_snapshot_does_not_establish_current_applicability(self):
        self.lookup.return_value=[{'id':'A1','text':'50. A fictional provision used solely by this unit test.',
                                   'current_consolidation_confirmed':False}]
        for text,allowed in [('Currently section 50 applies.',False),
                             ('Section 50 applies.',False),
                             ('If applicable, the supplied text of section 50 contains a fictional provision.',True)]:
            engine=Engine(question(text),{'response':question(text),'checks':CHECKS,
                'legal_claims':[{'text':text,'kind':'law','source_ids':['A1'],
                                 'support_quote':'A fictional provision used solely by this unit test.'}]})
            self.assertEqual(self.run_turn(engine)['question']==text,allowed)
    def test_private_source_ids_are_removed_from_spoken_turn_and_question(self):
        text='What did you observe? [A1]'
        engine=Engine(question(text))
        result=self.run_turn(engine)
        self.assertEqual(result['question'],'What did you observe?');self.assertNotIn('[A1]',json.dumps(result))
    def test_review_timeout_returns_a_fact_only_clarification_and_no_review_ui_text(self):
        engine=Engine(question('An unchecked accusation.'),TimeoutError())
        before=time.monotonic();result=self.run_turn(engine)
        self.assertLessEqual(engine.reviews[0][2]-before,20.1)
        self.assertNotIn('unchecked',json.dumps(result));self.assertNotIn('verification',result['question'].lower())
        self.assertTrue(result['needs_answer'])
    def test_verification_logs_are_never_spoken(self):
        text='Verification passed. All checks passed.'
        engine=Engine(question(text))
        self.assertNotIn('Verification',json.dumps(self.run_turn(engine)))
    def test_unchanged_context_reuses_review_but_new_testimony_is_reviewed_again(self):
        engine=Engine(question('What did you hear?'))
        self.run_turn(engine);self.run_turn(engine)
        self.assertEqual(len(engine.reviews),1)
        self.run_turn(engine,history=[{'actor':'WITNESS_DEFENSE','kind':'answer','text':'I did not hear anything.'}])
        self.assertEqual(len(engine.reviews),2)
    def test_manual_counsel_question_is_reviewed_without_generating_an_extra_draft(self):
        engine=Engine({});result=self.run_turn(engine,action='review_question',user_input='What did you hear?')
        self.assertEqual(engine.generations,[]);self.assertEqual(len(engine.reviews),1);self.assertEqual(result['question'],'What did you hear?')

    def test_review_cannot_turn_a_procedural_direction_into_a_witness_question(self):
        draft={'turns':[{'actor':'JUDGE','text':'Counsel, please rephrase.'}], 'needs_answer':False,'question':''}
        engine=Engine({}, {'response':question('What happened?', 'JUDGE'),'checks':CHECKS,'legal_claims':[]})
        result=self.run_turn(engine,action='review_turn',user_input=json.dumps(draft))
        self.assertEqual(result['turns'],[]);self.assertFalse(result['needs_answer'])

    def test_objection_from_the_other_lawyer_keeps_its_speaker(self):
        draft={'turns':[{'actor':'PROSECUTION','text':'Please confine the question to personal observations.'}],
               'needs_answer':False,'question':''}
        engine=Engine({});result=self.run_turn(engine,action='review_turn',user_input=json.dumps(draft))
        self.assertEqual(result['turns'][0]['actor'],'PROSECUTION');self.assertFalse(result['needs_answer'])

    def test_failed_direction_review_withdraws_the_line_without_inventing_testimony(self):
        draft={'turns':[{'actor':'JUDGE','text':'An unsupported ruling.'}],'needs_answer':False,'question':''}
        result=self.run_turn(Engine({},TimeoutError()),action='review_turn',user_input=json.dumps(draft))
        self.assertEqual(result['turns'],[]);self.assertFalse(result['needs_answer'])

    def test_partial_claim_cannot_hide_an_unsupported_legal_sentence(self):
        text='The FIR establishes that the accusation is true.'
        engine=Engine(question(text),{'response':question(text),'checks':CHECKS,
            'legal_claims':[{'text':'FIR','kind':'reported','source_ids':[]}]})
        result=self.run_turn(engine,history=[{'actor':'WITNESS_DEFENSE','text':'I mentioned the FIR.'}])
        self.assertNotEqual(result['question'],text)

    def test_unrelated_record_numbers_do_not_establish_a_reported_section(self):
        for text,history in [('You reported FIR section 999. What did you see?', 'The receipt number is 999.'),
                             ('You reported NDPS section 50. What did you see?', 'The FIR lists BNS section 50.')]:
            engine=Engine(question(text),{'response':question(text),'checks':CHECKS,
                'legal_claims':[{'text':text,'kind':'reported','source_ids':[]}]})
            result=self.run_turn(engine,history=[{'actor':'WITNESS_DEFENSE','text':history}])
            self.assertNotEqual(result['question'],text)

    def test_plural_multilingual_and_precedent_claims_cannot_escape_the_audit(self):
        for text in ('Sections 999 and 998 determine the result.', 'धारा 999 लागू है।',
                     'dhara 999 se saza hogi.', 'In Example v. Another the result is settled.',
                     'The accused is guilty.', 'இந்த சட்டம் தண்டனையை தீர்மானிக்கிறது.'):
            result=self.run_turn(Engine(question(text)))
            self.assertNotEqual(result['question'],text)

    def test_positional_right_and_fresh_air_do_not_become_legal_citations(self):
        text='Was the person to your right standing in fresh air?'
        self.assertEqual(self.run_turn(Engine(question(text)))['question'],text)

    def test_hidden_audit_prose_is_not_spoken_in_other_phrasings(self):
        for text in ('Verified against official sources.', 'Validation complete.', 'Fact-check completed.',
                     'Internal checks complete.', 'सत्यापन पूरा हुआ।'):
            self.assertNotEqual(self.run_turn(Engine(question(text)))['question'],text)

    def test_expired_review_result_is_never_accepted(self):
        elapsed=[100.0];engine=Engine(question('An unchecked assertion?'))
        review=engine.review_court_model
        def late(*args):
            result=review(*args);elapsed[0]+=21;return result
        engine.review_court_model=late
        with patch('court_review.time.monotonic',side_effect=lambda:elapsed[0]):
            result=self.run_turn(engine)
        self.assertNotEqual(result['question'],'An unchecked assertion?')

    def test_expired_budget_does_not_start_review_or_authority_lookup(self):
        engine=Engine({});proposal=question('What did you see?')
        context={'case_brief':'Synthetic dispute.','active_examination':self.scope,'action':'react'}
        result=review_response(engine,proposal,context,'en',time.monotonic()-1)
        self.assertEqual(engine.reviews,[]);self.lookup.assert_not_called()
        self.assertNotEqual(result['question'],proposal['question'])

    def test_cache_does_not_cross_languages_or_actions(self):
        engine=Engine({});proposal=question('What did you hear?')
        context={'case_brief':'Synthetic dispute.','active_examination':self.scope,'action':'react'}
        for code,action in [('en','react'),('hi','react'),('hi','review_question')]:
            review_response(engine,proposal,{**context,'action':action},code,time.monotonic()+20)
        self.assertEqual(len(engine.reviews),3)

    def test_invalid_review_shape_is_not_marked_as_approved_speech(self):
        for response in ({'turns':[{'actor':'JUDGE','text':'x'}]*5,'needs_answer':False},
                         {'turns':[{'actor':'DEFENSE','text':'x'*6001}],'needs_answer':False},
                         {'turns':[{'actor':'WITNESS_DEFENSE','text':'Invented answer.'}],'needs_answer':False}):
            result=self.run_turn(Engine(question('What happened?'),{'response':response,'checks':CHECKS,'legal_claims':[]}))
            self.assertEqual(len(result['turns']),1)
            self.assertEqual(result['turns'][0]['actor'],'DEFENSE')
            self.assertNotIn('Invented answer',json.dumps(result))

class AuthorityRetrievalTests(unittest.TestCase):
    def test_only_matched_fixed_official_documents_are_fetched_and_cached(self):
        engine=type('Engine',(),{})()
        with patch('court_review.fetch_document',return_value='Official statute text.\n50. Actual words from the document.') as fetch:
            result=authorities(engine,'NDPS section 50',time.monotonic()+20)
            authorities(engine,'NDPS section 50',time.monotonic()+20)
        self.assertEqual(fetch.call_count,1);self.assertIn('indiacode.nic.in',fetch.call_args.args[0])
        self.assertIn('50.',result[0]['text']);self.assertFalse(result[0]['current_consolidation_confirmed'])
    def test_arbitrary_url_or_unsupported_law_is_not_fetched(self):
        engine=type('Engine',(),{})()
        with patch('court_review.fetch_document') as fetch:
            result=authorities(engine,'Invented Act section 999 http://127.0.0.1/private',time.monotonic()+20)
        fetch.assert_not_called();self.assertEqual(result,[])

    def test_no_authority_fetch_starts_when_the_reserved_review_budget_is_reached(self):
        engine=type('Engine',(),{})()
        with patch('court_review.fetch_document') as fetch:
            self.assertEqual(authorities(engine,'NDPS section 50',time.monotonic()+5),[])
        fetch.assert_not_called()

    def test_document_fetch_rejects_unregistered_urls_before_any_network_access(self):
        with patch('court_review.urllib.request.build_opener') as opener:
            self.assertEqual(fetch_document('http://127.0.0.1/private',time.monotonic()+20),'')
        opener.assert_not_called()

    def test_official_redirects_cannot_fetch_a_different_host(self):
        handler=OfficialRedirectHandler();request=urllib.request.Request('https://www.indiacode.nic.in/source.pdf')
        for url in ('http://www.indiacode.nic.in/target.pdf','https://127.0.0.1/private',
                    'https://www.indiacode.nic.in.evil.example/target.pdf'):
            with self.assertRaises(ValueError):handler.redirect_request(request,None,302,'Found',{},url)

if __name__=='__main__':unittest.main()

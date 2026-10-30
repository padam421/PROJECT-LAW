import json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'ai-service/src'))
from conversation_engine import answer,court_turn,history_context,grounding

class FakeEngine:
    def __init__(self,responses):self.responses=iter(responses);self.calls=[]
    def review_court_model(self,prompt,system,deadline):
        data=json.loads(prompt)
        return json.dumps({'response':data['proposal'],'checks':{k:True for k in ('facts','law','procedure','roles','clarity')},'legal_claims':[]})
    def detect_and_translate_query(self,query,preferred_lang=None):return {'detected_language_code':'hi','language_name':'Hindi','is_legal':True,'english_translation':'tenancy eviction Jaipur'}
    def search_precedents(self,query,top_k=4):return [{'document':'An unrelated drug seizure','category':'narcotics','metadata':{},'category_name':'NDPS'}]
    def call_gemini(self,prompt,system,temperature,json_output):self.calls.append((prompt,system));return json.dumps(next(self.responses),ensure_ascii=False)

class ConversationTests(unittest.TestCase):
    def test_unsupported_citations_removed_and_missing_coverage_is_explicit(self):
        engine=FakeEngine([{'message':'draft','source_ids':[]},{'message':'उत्तर [S99]','source_ids':['S99'],'visual':None}])
        message,info=answer(engine,'किरायेदारी विवाद',language='hi',chat_history=[{'sender':'user','text':'Earlier facts'}])
        self.assertNotIn('[S99]',message);self.assertIn('संग्रह',message);self.assertEqual(info['sources'],[]);self.assertTrue(info['validation']['reviewed'])
        self.assertTrue(message.startswith('उत्तर'));self.assertFalse(message.startswith('अभी उपलब्ध'))
        self.assertIn('Earlier facts',engine.calls[0][0]);self.assertEqual(len(engine.calls),2)
    def test_reply_structure_has_no_mandatory_courtroom_report(self):
        engine=FakeEngine([{'message':'draft'},{'message':'Focused answer','source_ids':[]}]);answer(engine,'follow-up',language='en')
        instruction=engine.calls[0][1];self.assertIn('NO fixed headings',instruction);self.assertIn('not rejected attempts',instruction);self.assertNotIn('MANDATORY 4-SECTION',instruction)
    def test_visual_is_bounded_and_structured(self):
        engine=FakeEngine([{'message':'draft'},{'message':'answer','visual':{'title':'Flow','nodes':[{'title':'x','detail':'y'}]*20}}]);_,info=answer(engine,'draw a flow',language='en');self.assertEqual(len(info['visual']['nodes']),8)
    def test_court_reacts_to_actual_answer_and_validates_actor(self):
        engine=FakeEngine([{'turns':[{'actor':'INVALID','text':'bad'},{'actor':'JUDGE','text':'Explain the date.'}],'needs_answer':True,'question':'What date did you hear the threat?','witness_side':'DEFENSE'}])
        result=court_turn(engine,'Tenancy issue',[{'sender':'user','text':'WITNESS: I heard it yesterday, not last month.'}],language='hi',action='react',user_input='I heard it yesterday.')
        self.assertEqual(len(result['turns']),1);self.assertIn('yesterday',engine.calls[0][0]);self.assertEqual(result['turns'][-1]['text'],result['question']);self.assertEqual(result['sources'],[])
    def test_bad_ai_json_fails_explicitly(self):
        engine=FakeEngine([{'turns':[]}]);self.assertRaises(ValueError,court_turn,engine,'case')
    def test_opening_does_not_replace_opposing_counsel_with_an_unrelated_question(self):
        engine=FakeEngine([{'turns':[{'actor':'JUDGE','text':'Please outline the disputed facts.'},
            {'actor':'DEFENSE','text':'Delivery is disputed.'},{'actor':'PROSECUTION','text':'We dispute receipt.'}],
            'needs_answer':True,'question':'Unrelated question to counsel?'}])
        result=court_turn(engine,'Synthetic delivery dispute.',language='en',action='opening')
        self.assertFalse(result['needs_answer']);self.assertEqual(result['question'],'')
        self.assertEqual(result['turns'][-1]['text'],'We dispute receipt.')
    def court_scope(self,side='PROSECUTION',stage='cross',mode='ai'):
        return {'witnessId':side+':w1','witness':'WITNESS_'+side,'witnessName':'Courier', 'side':side,
                'questioningSide':side if stage=='direct' else ('DEFENSE' if side=='PROSECUTION' else 'PROSECUTION'),
                'examinationStage':stage,'question':'Could you see the door?','answerMode':mode,'answerStatus':'pending'}
    def test_opposing_witness_owns_the_answer_in_direct_and_cross(self):
        for stage in ('direct','cross'):
            engine=FakeEngine([{'turns':[{'actor':'WITNESS_PROSECUTION','text':'No. I was inside and could only hear it.'}]}])
            result=court_turn(engine,'A delivery dispute',language='en',action='witness_answer',examination=self.court_scope(stage=stage))
            self.assertEqual(result['turns'][0]['actor'],'WITNESS_PROSECUTION');self.assertEqual(result['witness_side'],'PROSECUTION')
            prompt=json.loads(engine.calls[0][0]);self.assertEqual(prompt['active_examination']['examinationStage'],stage)
            self.assertIn('not automatically agree',engine.calls[0][1]);self.assertIn('four focused checks',engine.calls[0][1])
    def test_our_manual_choice_cannot_generate_an_unrequested_answer(self):
        engine=FakeEngine([])
        with self.assertRaisesRegex(ValueError,'AI assistance must be selected'):
            court_turn(engine,'case',language='en',action='witness_answer',examination=self.court_scope(side='DEFENSE',mode='manual'))
        self.assertEqual(len(engine.calls),0)
    def test_judge_or_other_witness_cannot_supply_the_pending_answer(self):
        for actor in ('JUDGE','WITNESS_DEFENSE','DEFENSE'):
            engine=FakeEngine([{'turns':[{'actor':actor,'text':'Yes.'}]}])
            with self.assertRaisesRegex(ValueError,'active witness'):
                court_turn(engine,'case',language='en',action='witness_answer',examination=self.court_scope())
    def test_cross_question_cannot_change_questioners_or_answer_for_a_witness(self):
        for actor in ('PROSECUTION','WITNESS_PROSECUTION'):
            engine=FakeEngine([{'turns':[{'actor':actor,'text':'Did you see it?'}],'needs_answer':True,'question':'Did you see it?'}])
            with self.assertRaisesRegex(ValueError,'changed the witness or questioning lawyer'):
                court_turn(engine,'case',language='en',action='cross_question',examination=self.court_scope())
    def test_declining_cross_requires_no_invented_dialogue(self):
        engine=FakeEngine([{'turns':[],'needs_answer':False}])
        result=court_turn(engine,'case',language='en',action='cross_question',examination=self.court_scope())
        self.assertEqual(result['turns'],[]);self.assertFalse(result['needs_answer'])
    def test_one_question_at_a_time(self):
        for turns in ([{'actor':'DEFENSE','text':'First?'},{'actor':'DEFENSE','text':'Second?'}],
                      [{'actor':'JUDGE','text':'First ruling.'},{'actor':'JUDGE','text':'Second ruling.'}]):
            engine=FakeEngine([{'turns':turns,'needs_answer':True,'question':'Second?'}])
            self.assertRaises(ValueError,court_turn,engine,'case',language='en',action='cross_question',examination=self.court_scope())
    def test_judge_clarification_keeps_the_judge_and_the_same_active_witness(self):
        engine=FakeEngine([{'turns':[{'actor':'JUDGE','text':'Where is the original recording stored?'}],
                           'needs_answer':True,'question':'Where is the original recording stored?'}])
        result=court_turn(engine,'Synthetic delivery dispute',language='en',action='react',examination=self.court_scope(side='DEFENSE',stage='direct'))
        self.assertEqual(result['question_actor'],'JUDGE');self.assertEqual(len(result['turns']),1)
        self.assertEqual(result['turns'][0]['actor'],'JUDGE');self.assertEqual(result['witness_side'],'DEFENSE')
    def test_separate_question_after_a_judicial_direction_uses_the_active_lawyer(self):
        engine=FakeEngine([{'turns':[{'actor':'JUDGE','text':'Keep the original recording available.'}],
                           'needs_answer':True,'question':'Who made that recording?'}])
        result=court_turn(engine,'Synthetic delivery dispute',language='en',action='react',examination=self.court_scope(side='DEFENSE',stage='direct'))
        self.assertEqual([t['actor'] for t in result['turns']],['JUDGE','DEFENSE'])
        self.assertEqual(result['turns'][0]['text'],'Keep the original recording available.')
        self.assertEqual(result['turns'][1]['text'],'Who made that recording?');self.assertEqual(result['question_actor'],'DEFENSE')
    def test_judicial_direction_can_precede_an_already_supplied_counsel_question(self):
        engine=FakeEngine([{'turns':[{'actor':'DEFENSE','text':'Who made it?'},{'actor':'JUDGE','text':'Do not assume who made the recording.'}],
                           'needs_answer':True,'question':'Who made it?'}])
        result=court_turn(engine,'Synthetic delivery dispute',language='en',action='cross_question',examination=self.court_scope())
        self.assertEqual([t['actor'] for t in result['turns']],['JUDGE','DEFENSE'])
    def test_long_examinations_keep_earlier_testimony_and_rulings_with_witness_identity(self):
        history=[{'actor':'WITNESS_PROSECUTION','kind':'answer','text':'Detail '+str(i),'witnessId':'PROSECUTION:w1'}for i in range(100)]
        history.insert(50,{'actor':'JUDGE_0','kind':'practice','cue':'ruling','text':'Rephrase the question.','witnessId':'PROSECUTION:w1'})
        engine=FakeEngine([{'turns':[{'actor':'DEFENSE','text':'Was the room lit?'}],'question':'Was the room lit?','needs_answer':True}])
        court_turn(engine,'case',history,language='en',action='cross_question',examination=self.court_scope())
        payload=json.loads(engine.calls[0][0]);self.assertEqual(len(payload['transcript']),101)
        self.assertEqual(payload['transcript'][17]['text'],'Detail 17');self.assertEqual(payload['transcript'][50]['cue'],'ruling')
        self.assertEqual(payload['active_examination']['witnessName'],'Courier')
    def test_duplicate_questions_finish_the_line_instead_of_creating_a_retry_loop(self):
        history=[{'actor':'DEFENSE','kind':'question','text':'Could you see the door?','witnessId':'PROSECUTION:w1'}]
        engine=FakeEngine([{'turns':[{'actor':'DEFENSE','text':'Could you see the door?'}],'needs_answer':True,'question':'Could you see the door?'}])
        result=court_turn(engine,'case',history,language='en',action='cross_question',examination=self.court_scope())
        self.assertFalse(result['needs_answer']);self.assertEqual(result['turns'],[]);self.assertEqual(result['question'],'')
    def test_unchanged_brief_reuses_grounding_and_selected_language(self):
        engine=FakeEngine([{'turns':[],'needs_answer':False}]*2);lookups=[]
        engine.detect_and_translate_query=lambda *args,**kwargs:self.fail('Selected language should not be redetected')
        engine.search_precedents=lambda *args,**kwargs:lookups.append(args) or []
        for _ in range(2):court_turn(engine,'case',language='en',action='cross_question',examination=self.court_scope())
        self.assertEqual(len(lookups),0);self.assertEqual(len(engine.calls),2)
    def test_witness_turn_does_not_load_embedding_model_or_retrieve_precedents(self):
        engine=FakeEngine([{'turns':[{'actor':'WITNESS_PROSECUTION','text':'I heard a knock.'}]}])
        engine.search_precedents=lambda *args,**kwargs:self.fail('A witness answer needs the case record, not another legal search')
        court_turn(engine,'Synthetic shop dispute',language='en',action='witness_answer',examination=self.court_scope())
    def test_continuing_hearing_cannot_invent_our_witness_testimony(self):
        engine=FakeEngine([{'turns':[{'actor':'WITNESS_DEFENSE','text':'An unsolicited admission.'}]}])
        with self.assertRaisesRegex(ValueError,'own answer action'):
            court_turn(engine,'case',language='en',action='continue')
    def test_history_retains_opening_facts_and_recent_answer(self):
        history=[{'sender':'user','text':'Fact '+str(i)}for i in range(100)]
        context=history_context(history);self.assertIn('Fact 0',context);self.assertIn('Fact 99',context)
    def test_unverified_act_year_triggers_repair_before_display(self):
        engine=FakeEngine([{'message':'draft'},{'message':'Rajasthan Rent Control Act, 2014 applies.'},
                           {'message':'Keep the rent agreement and payment evidence; ask a local lawyer to verify the applicable provisions.','source_ids':[]}])
        message,info=answer(engine,'A tenancy question',language='en')
        self.assertNotIn('2014',message);self.assertEqual(len(engine.calls),3)
    def test_still_unsupported_repair_fails_instead_of_displaying_wrong_law(self):
        engine=FakeEngine([{'message':'draft'},{'message':'Section 999 applies.'},{'message':'Section 998 applies.'}])
        self.assertRaises(ValueError,answer,engine,'A tenancy question',language='en')
    def test_generic_ndps_label_in_hidden_notes_does_not_block_a_helpful_answer(self):
        engine=FakeEngine([{'message':'draft'},{'message':'कागज़ों की प्रति लें और अज्ञात वजन की पुष्टि करवाएँ।','unknowns':['NDPS section not known']}])
        message,info=answer(engine,'NDPS का मामला है',language='hi')
        self.assertIn('प्रति लें',message);self.assertEqual(len(engine.calls),2)
    def test_grouped_citations_keep_only_supplied_sources(self):
        engine=FakeEngine([{'message':'draft'},{'message':'Check the supplied excerpt [S1, S99].'}])
        engine.detect_and_translate_query=lambda *args,**kwargs:{'english_translation':'NDPS bag search','is_legal':True}
        message,info=answer(engine,'NDPS question',language='en')
        self.assertIn('[S1]',message);self.assertNotIn('S99',message);self.assertEqual(info['sources'][0]['id'],'S1')
    def test_retrieval_analysis_is_not_promoted_to_user_facts(self):
        engine=FakeEngine([{'message':'draft'},{'message':'Check the actual documents.'}])
        engine.detect_and_translate_query=lambda *args,**kwargs:{'english_translation':'NDPS bag search','problem_analysis':'Invented coercion allegation','is_legal':True}
        answer(engine,'I signed papers; copies not given.',language='en')
        self.assertNotIn('Invented coercion',engine.calls[0][0]);self.assertIn('I signed papers',engine.calls[1][0])
    def test_substantive_question_gets_a_detail_repair_and_attachments_are_reviewed(self):
        useful=' '.join(['प्रासंगिक विवरण और व्यावहारिक कदम।']*90)
        engine=FakeEngine([{'message':'draft'},{'message':'बहुत छोटा उत्तर।'},{'message':useful,'checks':{'answers_question':True,'facts_match':True,'balanced_detail':True}}])
        message,info=answer(engine,'एक विस्तृत घटना। '*30,language='hi',case_context='Attached agreement says four months remain.')
        self.assertEqual(len(engine.calls),3);self.assertIn('four months remain',engine.calls[1][0]);self.assertTrue(info['validation']['checks']['facts_match'])
        self.assertIn('450–650 words',engine.calls[0][1]);self.assertGreaterEqual(len(message.split()),350)
    def test_substantial_answer_that_is_still_too_brief_is_expanded_by_review(self):
        brief=' '.join(['मामले की जानकारी जाँचें।']*65)
        detailed=' '.join(['परिवार दस्तावेज़ जुटाए और आवश्यक तथ्यों की पुष्टि कराए।']*55)
        engine=FakeEngine([{'message':'draft'},{'message':brief},{'message':detailed}])
        message,_=answer(engine,'काल्पनिक मामले का विस्तृत प्रश्न। '*20,language='hi')
        self.assertEqual(len(engine.calls),3);self.assertGreaterEqual(len(message.split()),350)
    def test_hindi_repeated_unsupported_claim_still_yields_practical_guidance(self):
        engine=FakeEngine([{'message':'draft'},{'message':'धारा 999 लगती है।'},{'message':'धारा 998 लगती है।'}])
        message,info=answer(engine,'मुझे मेरे कागज़ नहीं मिले।',language='hi')
        self.assertNotIn('धारा 998',message);self.assertIn('कागज़',message);self.assertIn('कदम',message);self.assertTrue(info['validation']['limited_fallback'])

if __name__=='__main__':unittest.main()

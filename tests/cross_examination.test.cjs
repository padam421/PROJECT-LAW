// Exercise the real director, simulator controls and live hearing together, without accounts/network/3D.
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(setImmediate);};
function fixture(respond=()=>({turns:[],needs_answer:false}),review=null){
  let counter=0,owner='account',clockNow=Date.now();const requests=[],notices=[],elements=new Map();
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const element=id=>{
    if(!elements.has(id)){
      const el={hidden:false,value:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},toggleAttribute(){},remove(){elements.delete(id);},reportValidity(){return !!this.value.trim();},querySelector(){return this;},replaceChildren(){this.innerHTML='';}};
      let html='';Object.defineProperty(el,'innerHTML',{get:()=>html,set:value=>{
        html=value;
        if(id==='v3-interaction'){
          elements.delete('v3-witness-input');elements.delete('v3-question-input');
          const match=value.match(/<textarea id="([^"]+)"[^>]*>(.*?)<\/textarea>/s);
          if(match)element(match[1]).value=match[2].replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
        }
      }});el.insertAdjacentHTML=(_,value)=>{html+=value;};elements.set(id,el);
    }
    return elements.get(id);
  };
  const session={id:'session',title:'Property hearing',summary:'A and B dispute who observed the delivery.',language:'en',transcript:[],rooms:{}};
  const thread={id:'chat',courtSessions:{session},messages:[]};
  const context=vm.createContext({console,Intl,URL,Date:class extends Date{static now(){return clockNow;}},AbortController,setTimeout,clearTimeout,cancelAnimationFrame(){},
    sessionStorage:{getItem(){},setItem(){}},Utils:{escapeHtml:escape},Router:{navigate(){}},
    document:{getElementById:id=>['v3-witness-input','v3-question-input'].includes(id)?elements.get(id)||null:element(id),
      querySelector:selector=>selector.includes('v3-answer-actions')&&element('v3-interaction').innerHTML.includes('v3-answer-actions')?element('v3-interaction'):null,
      querySelectorAll:()=>[],addEventListener(){},removeEventListener(){}},
    window:{addEventListener(){},removeEventListener(){},speechSynthesis:{cancel(){}}},
    AssistantThreads:{owner:()=>owner,id:prefix=>prefix+'_'+ ++counter,getForCourt:()=>thread,active:()=>thread,
      changeCourt(id,fn){fn(thread);},notify(message){notices.push(message);},async api(path,body,options){
        body._testSignal=options?.signal;
        requests.push(body);
        if(review&&['review_question','review_turn'].includes(body.action)){
          const result=await review(body);return {...result,turns:(result.turns||[]).map(t=>({...t,_courtReviewed:true}))};
        }
        if(body.action==='review_question')return {needs_answer:true,question:body.input,turns:[{actor:body.examination.questioningSide,text:body.input,_courtReviewed:true}]};
        if(body.action==='review_turn')return {...JSON.parse(body.input),turns:JSON.parse(body.input).turns.map(t=>({...t,_courtReviewed:true}))};
        const result=await respond(body);return {...result,turns:(result.turns||[]).map(t=>({...t,_courtReviewed:!t.actor.startsWith('WITNESS')}))};
      }}
  });
  for(const [file,name] of [['frontend/shared/js/indian_courtroom.js','IndianCourtroom'],['frontend/shared/js/courtroom_director.js','CourtroomDirector'],['frontend/user/js/court_simulator.js','VirtualCourtSimulator']]){
    vm.runInContext(fs.readFileSync(file,'utf8')+'\nthis.'+name+'='+name+';',context);
  }
  const sim=context.VirtualCourtSimulator;sim._script=[{actor:'DEFENSE',text:'Presenting our case.',_courtReviewed:true,_courtReviewEpoch:0},{actor:'PROSECUTION',text:'Presenting the opposing case.',_courtReviewed:true,_courtReviewEpoch:0}];
  session.script=sim._script;
  sim._activeLanguage='en';sim._configureCourt();sim._courtType='DISTRICT';sim._courtConfig=context.IndianCourtroom.layout('DISTRICT');sim.SPEAKER_COORDS=sim._courtConfig.actors;
  sim._timeline=context.CourtroomDirector.plan(sim._script,sim._courtConfig,'en');
  sim._isPlaying=true;sim._playingCaseKey=sim._sessionCaseKey;sim._ready=true;sim._isPaused=false;sim._reducedMotion=true;sim._avatarModels={};sim._actions={};
  sim._frameStage=()=>{};sim._cancelStreamAudio=()=>{};sim._speakText=(_,pitch,rate,done)=>done();
  vm.runInContext(fs.readFileSync('frontend/shared/js/live_court.js','utf8')+'\nthis.live=LiveCourt;',context);
  const live=context.live;live.context={owner:'account',threadId:'chat',sessionId:'session'};
  // These initial generated submissions have already been reviewed by the API.
  for(const node of sim._timeline.filter(t=>t.kind==='dialogue'))node._courtReviewKey=live.reviewKey(node);
  function go(predicate){const index=typeof predicate==='number'?predicate:sim._timeline.findIndex(predicate);assert.ok(index>=0);sim._timelineIndex=index;sim._runStage(true);return sim._activeStage;}
  function advance(){sim._stageElapsed=1000;sim._updateStageMotion();}
  const gate=(side,stage)=>go(t=>t.kind==='await-answer'&&t.side===side&&t.examinationStage===stage);
  return {sim,live,session,element,elements,requests,notices,go,gate,advance,setOwner:value=>owner=value,advanceClock:ms=>clockNow+=ms};
}
test('our direct and cross answers wait for manual submission and are accepted exactly once',async()=>{
  for(const stage of ['direct','cross']){
    const f=fixture();f.gate('DEFENSE',stage);
    assert.match(f.element('v3-interaction').innerHTML,/nyay-ai-witness/);
    f.element('v3-witness-input').value='I saw the delivery on Tuesday.';f.sim.saveInteractionDraft(f.element('v3-witness-input').value);
    for(let i=0;i<5;i++)f.advance();
    assert.equal(f.requests.length,0);assert.equal(f.session.transcript.length,0);assert.equal(f.sim._awaiting,true);
    f.sim.submitWitnessAnswer();f.sim.submitWitnessAnswer();
    assert.equal(f.sim._activeStage.kind,'answer');assert.equal(f.session.transcript.length,1);
    assert.equal(f.session.transcript[0].answerMode,'manual');assert.equal(f.session.transcript[0].examinationStage,stage);
    assert.equal(f.session.transcript[0].text,'I saw the delivery on Tuesday.');
  }
});
test('our existing AI action submits its answer in direct and cross without extra confirmation',async()=>{
  for(const stage of ['direct','cross']){
    const f=fixture(body=>({turns:[{actor:body.examination.witness,text:'I cannot identify the courier.'}],needs_answer:false}));
    f.gate('DEFENSE',stage);assert.equal(f.requests.length,0);await f.live.witnessAnswer();
    assert.equal(f.sim._activeStage.kind,'answer');assert.equal(f.session.transcript.length,1);
    assert.equal(f.session.transcript[0].answerMode,'ai');assert.equal(f.requests[0].examination.examinationStage,stage);
  }
});
test('opposing witness answers automatically on direct and on our typed cross question',async()=>{
  const f=fixture(body=>({turns:[{actor:body.examination.witness,text:'I was inside; I did not see the handover.'}],needs_answer:false}));
  f.gate('PROSECUTION','direct');assert.doesNotMatch(f.element('v3-interaction').innerHTML,/<textarea/);await flush();
  assert.equal(f.sim._activeStage.kind,'answer');assert.equal(f.session.transcript[0].actor,'WITNESS_PROSECUTION');
  f.go(t=>t.kind==='choice'&&t.side==='PROSECUTION'&&!t.repeat);
  assert.ok(f.elements.has('v3-question-input'));assert.ok(!f.elements.has('v3-witness-input'));
  f.element('v3-question-input').value='Could you see the doorway from inside?';await f.sim.resolveFollowUp(true);
  f.gate('PROSECUTION','cross');await flush();
  assert.equal(f.requests.at(-1).examination.question,'Could you see the doorway from inside?');
  assert.equal(f.requests.at(-1).examination.questioningSide,'DEFENSE');
  assert.equal(f.session.transcript.at(-1).actor,'WITNESS_PROSECUTION');assert.equal(f.session.transcript.at(-1).examinationStage,'cross');
});
test('opposing counsel asks one adaptive question then may decline further cross',async()=>{
  let count=0;const f=fixture(body=>{
    assert.equal(body.action,'cross_question');
    if(++count===1)return {needs_answer:true,question:'You heard the delivery but did not see it?',turns:[{actor:'PROSECUTION',text:'You heard the delivery but did not see it?'}]};
    assert.ok(body.history.some(t=>t.text==='I heard it; I was in the next room.'&&t.kind==='answer'));
    return {needs_answer:false,turns:[]};
  });
  f.go(t=>t.kind==='choice'&&t.side==='DEFENSE'&&!t.repeat);await flush();
  assert.equal(f.requests.length,1);assert.equal(f.sim._interactions['DEFENSE:0:cross'].question,'You heard the delivery but did not see it?');
  f.gate('DEFENSE','cross');f.element('v3-witness-input').value='I heard it; I was in the next room.';f.sim.submitWitnessAnswer();
  f.go(t=>t.kind==='choice'&&t.side==='DEFENSE'&&t.repeat);await flush();
  assert.equal(f.sim._activeStage.id,'DEFENSE:0:return-counsel');assert.equal(f.requests.length,2);
});
test('either side can decline the first cross opportunity without opening another answer gate',async()=>{
  const f=fixture();f.go(t=>t.kind==='choice'&&t.side==='DEFENSE'&&!t.repeat);await flush();
  assert.equal(f.sim._activeStage.cue,'release');
  f.go(t=>t.kind==='choice'&&t.side==='PROSECUTION'&&!t.repeat);const before=f.requests.length;f.sim.resolveFollowUp(false);
  assert.equal(f.sim._activeStage.cue,'release');assert.equal(f.requests.length,before);
});
test('direct follow-ups use the actual answer and keep the presenting lawyer and witness',async()=>{
  const f=fixture(body=>{
    assert.equal(body.action,'react');assert.equal(body.examination.questioningSide,'DEFENSE');
    assert.ok(body.history.some(t=>t.kind==='answer'&&t.text==='The voice was unfamiliar.'));
    return {needs_answer:true,question:'What could you hear clearly?',turns:[{actor:'DEFENSE',text:'What could you hear clearly?'}]};
  });
  f.gate('DEFENSE','direct');f.element('v3-witness-input').value='The voice was unfamiliar.';f.sim.submitWitnessAnswer();f.advance();await flush();
  assert.equal(f.sim._activeStage.actor,'DEFENSE');assert.equal(f.sim._activeStage.kind,'question');assert.equal(f.sim._activeStage.examinationStage,'direct');
  f.advance();assert.equal(f.sim._activeStage.kind,'await-answer');assert.equal(f.sim._activeStage.actor,'WITNESS_DEFENSE');assert.equal(f.requests.length,1);
});
test('a judge clarification remains a judge question and preserves both witness answer options',async()=>{
  const f=fixture(()=>({needs_answer:true,question_actor:'JUDGE',question:'Where is the original recording stored?',
    turns:[{actor:'JUDGE',text:'Where is the original recording stored?'}]}));
  f.gate('DEFENSE','direct');f.element('v3-witness-input').value='I have a recording.';f.sim.submitWitnessAnswer();f.advance();await flush();
  assert.equal(f.sim._activeStage.kind,'question');assert.match(f.sim._activeStage.actor,/JUDGE/);
  assert.equal(f.sim._activeStage.text,'Where is the original recording stored?');f.advance();
  assert.equal(f.sim._activeStage.actor,'WITNESS_DEFENSE');assert.equal(f.live.examination().questionActor,'JUDGE');
  assert.equal(f.live.examination().questioningSide,'DEFENSE');assert.equal(f.sim._awaiting,true);
  assert.ok(f.elements.has('v3-witness-input'));assert.match(f.element('v3-interaction').innerHTML,/nyay-ai-witness/);
  assert.equal(f.session.transcript.filter(t=>t.kind==='answer').length,1);
});

test('an objection to a judge clarification preserves a valid counsel and witness context',async()=>{
  const f=fixture(()=>({needs_answer:true,question_actor:'JUDGE',question:'Where was the recording stored?',
    turns:[{actor:'JUDGE',text:'Where was the recording stored?'}]}));
  f.gate('DEFENSE','direct');f.element('v3-witness-input').value='I made a recording.';
  f.sim.submitWitnessAnswer();f.advance();await flush();f.advance();
  assert.equal(f.sim._activeStage.kind,'await-answer');
  f.sim.raiseObjection();
  assert.equal(f.live.examination(f.sim._activeStage).questioningSide,'DEFENSE');
  assert.equal(f.sim._activeStage.actor,'PROSECUTION');
  f.advance();f.advance();
  assert.equal(f.sim._activeStage.kind,'edit-question');
  assert.equal(f.live.examination().questioningSide,'DEFENSE');
});

test('leaving a hearing aborts the actual request and rejects the late answer',async()=>{
  let finish;const f=fixture(()=>new Promise(resolve=>{finish=resolve;}));
  f.gate('DEFENSE','direct');const pending=f.live.witnessAnswer();
  const signal=f.requests[0]._testSignal;assert.ok(signal);assert.equal(signal.aborted,false);
  f.live.detach();assert.equal(signal.aborted,true);assert.equal(f.live.busy,false);
  finish({turns:[{actor:'WITNESS_DEFENSE',text:'Late testimony.'}],needs_answer:false});await pending;
  assert.equal(f.session.transcript.length,0);
});

test('a restored answer request keeps its typed draft and one retry action after failure',async()=>{
  let failed=true;const f=fixture(()=>{
    if(failed)throw Error('Provider temporarily unavailable; retry in 5 seconds.');
    return {turns:[{actor:'WITNESS_DEFENSE',text:'The agreement states thirty days.'}],needs_answer:false};
  });
  f.gate('DEFENSE','direct');const text='My unfinished answer';f.element('v3-witness-input').value=text;f.sim.saveInteractionDraft(text);
  await f.live.witnessAnswer();assert.equal(f.sim._awaiting,true);assert.equal(f.live.busy,false);
  assert.equal(f.element('v3-witness-input').value,text);assert.equal(f.session.transcript.length,0);
  assert.match(f.element('v3-interaction').innerHTML,/nyay-ai-witness/);
  failed=false;await f.live.witnessAnswer();
  assert.equal(f.sim._activeStage.kind,'answer');assert.equal(f.session.transcript.length,1);
});

test('continue hearing cannot replace an unanswered manual witness gate',async()=>{
  const f=fixture();f.gate('DEFENSE','direct');
  f.element('v3-witness-input').value='Unfinished';f.sim.saveInteractionDraft('Unfinished');
  await f.live.continueHearing();assert.equal(f.requests.length,0);
  assert.equal(f.sim._activeStage.kind,'await-answer');assert.equal(f.element('v3-witness-input').value,'Unfinished');
});

test('a temporary provider limit retries once with the same witness, question and actual testimony',async()=>{
  let count=0;const f=fixture(()=>{
    if(++count===1)throw Object.assign(new Error('Rate limited'),{retryable:true,retryAfter:1});
    return {turns:[{actor:'WITNESS_DEFENSE',text:'Thirty days.'}],needs_answer:false};
  });
  const waits=[];f.live.waitForRetry=async seconds=>{waits.push(seconds);};
  f.gate('DEFENSE','direct');await f.live.witnessAnswer();
  assert.deepEqual(waits,[1]);assert.equal(f.requests.length,2);
  assert.equal(f.requests[0].examination.witnessId,f.requests[1].examination.witnessId);
  assert.equal(f.requests[0].examination.question,f.requests[1].examination.question);
  assert.equal(f.session.transcript.length,1);assert.equal(f.sim._activeStage.kind,'answer');
});

test('leaving during rate-limit recovery cancels its timer and never sends the retry',async()=>{
  const f=fixture(()=>{throw Object.assign(new Error('Rate limited'),{retryable:true,retryAfter:30});});
  f.gate('DEFENSE','direct');const pending=f.live.witnessAnswer();await flush();
  assert.equal(f.live.busy,true);assert.equal(f.requests.length,1);
  f.live.detach();await pending;
  assert.equal(f.requests.length,1);assert.equal(f.session.transcript.length,0);assert.equal(f.live.busy,false);
});
test('continuing manually during a slow reaction keeps testimony and discards the late response',async()=>{
  let finish;const f=fixture(()=>new Promise(resolve=>{finish=resolve;}));
  f.gate('DEFENSE','direct');f.element('v3-witness-input').value='I heard a knock.';f.sim.submitWitnessAnswer();f.advance();
  assert.match(f.element('v3-interaction').innerHTML,/v3-answer-actions/);assert.match(f.element('v3-interaction').innerHTML,/Continue manually/);
  f.live.skipReaction();const length=f.sim._timeline.length;
  finish({needs_answer:true,question:'A late question?',turns:[{actor:'DEFENSE',text:'A late question?'}]});await flush();
  assert.equal(f.sim._timeline.length,length);assert.equal(f.session.transcript.filter(t=>t.kind==='answer').length,1);
  assert.equal(f.session.transcript.find(t=>t.kind==='answer').text,'I heard a knock.');assert.equal(f.live.busy,false);
});
test('editing or manually submitting while AI is pending preserves our actual response',async()=>{
  for(const submit of [false,true]){
    let finish;const f=fixture(()=>new Promise(resolve=>{finish=resolve;}));f.gate('DEFENSE','direct');const pending=f.live.witnessAnswer();
    f.element('v3-witness-input').value='My newly typed answer.';f.sim.saveInteractionDraft('My newly typed answer.');
    if(submit)f.sim.submitWitnessAnswer();
    finish({turns:[{actor:'WITNESS_DEFENSE',text:'A stale AI answer.'}]});await pending;
    if(submit){assert.equal(f.session.transcript.length,1);assert.equal(f.session.transcript[0].text,'My newly typed answer.');}
    else{assert.equal(f.element('v3-witness-input').value,'My newly typed answer.');assert.equal(f.session.transcript.length,0);}
  }
});
test('objection preserves answer drafts and testimony, and question rephrasing uses a separate field/key',async()=>{
  const f=fixture();f.gate('DEFENSE','direct');f.element('v3-witness-input').value='Unsubmitted answer.';f.sim.saveInteractionDraft('Unsubmitted answer.');
  const answerKey=f.sim._activeStage.answerKey;f.sim.raiseObjection();
  assert.equal(f.sim._interactions[answerKey].status,'disallowed');
  f.advance();assert.equal(f.sim._activeStage.cue,'ruling');f.advance();
  assert.equal(f.sim._activeStage.kind,'edit-question');assert.notEqual(f.sim._activeStage.questionKey,answerKey);
  assert.equal(f.element('v3-question-input').value,'');assert.ok(f.session.transcript.some(t=>t.cue==='ruling'&&t.witnessId==='DEFENSE:0'));
  f.element('v3-question-input').value='What did you personally hear?';await f.sim.resolveFollowUp(true);f.advance();
  assert.equal(f.sim._activeStage.kind,'await-answer');assert.equal(f.element('v3-witness-input').value,'Unsubmitted answer.');
  assert.equal(f.live.examination().question,'What did you personally hear?');assert.ok(!f.session.transcript.some(t=>t.kind==='answer'));
});
test('a disallowed pending opposing answer is discarded and the presenting lawyer can rephrase',async()=>{
  let finish;const f=fixture(body=>body.action==='witness_answer'?new Promise(resolve=>{finish=resolve;}):
    ({needs_answer:true,question:'What did you hear from inside?',turns:[{actor:'PROSECUTION',text:'What did you hear from inside?'}]}));
  f.gate('PROSECUTION','direct');f.sim.raiseObjection();
  finish({turns:[{actor:'WITNESS_PROSECUTION',text:'An answer to the disallowed question.'}]});await flush();
  assert.ok(!f.session.transcript.some(t=>t.kind==='answer'));
  f.advance();f.advance();await flush();
  assert.equal(f.requests.at(-1).action,'rephrase');assert.ok(f.requests.at(-1).history.some(t=>t.cue==='ruling'));
  assert.equal(f.sim._activeStage.kind,'question');assert.equal(f.sim._activeStage.text,'What did you hear from inside?');
});
test('AI counsel drafts a question without submitting it or replacing a concurrent edit',async()=>{
  let finish;const f=fixture(()=>new Promise(resolve=>{finish=resolve;}));
  f.go(t=>t.kind==='choice'&&t.side==='PROSECUTION'&&!t.repeat);const pending=f.live.question();
  f.element('v3-question-input').value='My own question.';f.sim.saveInteractionDraft('My own question.');
  finish({needs_answer:true,question:'Generated question?',turns:[{actor:'DEFENSE',text:'Generated question?'}]});await pending;
  assert.equal(f.element('v3-question-input').value,'My own question.');assert.equal(f.sim._activeStage.kind,'choice');
});
test('saved progress retains pending drafts, stage, ownership and the accepted transcript',()=>{
  const f=fixture();f.gate('DEFENSE','cross');f.element('v3-witness-input').value='A pending cross answer.';f.sim.saveInteractionDraft('A pending cross answer.');
  const saved=JSON.parse(JSON.stringify(f.session.rooms.DISTRICT));assert.equal(saved.plan[saved.timeline].examinationStage,'cross');
  assert.equal(saved.interactions[f.sim._activeStage.answerKey].status,'drafted');assert.equal(f.session.transcript.length,0);
  f.sim._interactions=saved.interactions;f.sim._timeline=saved.plan;f.go(saved.timeline);
  assert.equal(f.element('v3-witness-input').value,'A pending cross answer.');assert.equal(f.requests.length,0);
});
test('replaying a submitted answer after reload does not record the testimony twice',async()=>{
  const f=fixture();f.gate('DEFENSE','direct');f.element('v3-witness-input').value='Already submitted testimony.';f.sim.submitWitnessAnswer();
  const saved=JSON.parse(JSON.stringify(f.session.rooms.DISTRICT));
  f.sim._timeline=saved.plan;f.sim._interactions=saved.interactions;f.go(saved.timeline);f.advance();await flush();
  assert.equal(f.session.transcript.filter(t=>t.kind==='answer').length,1);
});
test('a late answer cannot enter another account or another witness gate',async()=>{
  for(const account of [true,false]){
    let finish;const f=fixture(()=>new Promise(resolve=>{finish=resolve;}));f.gate('DEFENSE','direct');const pending=f.live.witnessAnswer();
    if(account)f.setOwner('other');else f.gate('DEFENSE','cross');
    finish({turns:[{actor:'WITNESS_DEFENSE',text:'Late answer.'}]});await pending;
    assert.equal(f.session.transcript.length,0);assert.equal(f.sim._activeStage.kind,'await-answer');
  }
});
test('a generated judicial clarification is heard and recorded before the cross question',async()=>{
  const f=fixture(()=>({needs_answer:true,question:'Could you see the doorway?',turns:[
    {actor:'JUDGE',text:'Limit the question to this witness’s own observations.'},
    {actor:'PROSECUTION',text:'Could you see the doorway?'}]}));
  f.go(t=>t.kind==='choice'&&t.side==='DEFENSE'&&!t.repeat);await flush();
  assert.match(f.sim._activeStage.actor,/JUDGE/);assert.equal(f.sim._activeStage.text,'Limit the question to this witness’s own observations.');
  f.advance();assert.equal(f.requests.length,1);assert.ok(f.session.transcript.some(t=>t.actor.startsWith('JUDGE')&&t.witnessId==='DEFENSE:0'));
  assert.equal(f.sim._interactions['DEFENSE:0:cross'].question,'Could you see the doorway?');
  assert.ok(!f.session.transcript.some(t=>t.actor.startsWith('WITNESS')));
});
test('continuing into a witness question retains direct, cross and release with fresh identities',async()=>{
  const f=fixture(()=>({needs_answer:true,witness_side:'DEFENSE',question:'What could you hear?',turns:[{actor:'DEFENSE',text:'What could you hear?'}]}));
  const length=f.sim._timeline.length;f.sim._timelineIndex=length;f.sim._activeStage=null;await f.live.continueHearing();
  const appended=f.sim._timeline.slice(length),gate=appended.find(t=>t.kind==='await-answer');
  assert.equal(gate.side,'DEFENSE');assert.equal(gate.examinationStage,'direct');assert.notEqual(gate.answerKey,'DEFENSE:0:main');
  assert.ok(appended.some(t=>t.kind==='choice'&&t.examinationStage==='cross'));assert.ok(appended.some(t=>t.cue==='release'));
  assert.equal(appended.find(t=>t.cue==='question').text,'What could you hear?');assert.equal(f.requests.length,1);
});
test('older saved plans gain witness ownership and stages without losing answers or changing order',()=>{
  const f=fixture(),plan=JSON.parse(JSON.stringify(f.sim._timeline));
  for(const stage of plan)for(const key of ['witnessId','examinationStage','questioningSide'])delete stage[key];
  f.session.rooms={DISTRICT:{timeline:8,plan,interactions:{'DEFENSE:0:main':{answer:'Original testimony.'}}}};
  f.live.activate(f.session);
  const restored=f.sim._courtSessions.DISTRICT;
  assert.equal(restored.plan.length,plan.length);assert.equal(restored.interactions['DEFENSE:0:main'].answer,'Original testimony.');
  for(const stage of restored.plan.filter(t=>t.kind==='await-answer')){
    assert.ok(stage.witnessId);assert.ok(['direct','cross'].includes(stage.examinationStage));
    assert.equal(stage.questioningSide,stage.examinationStage==='direct'?stage.side:stage.side==='DEFENSE'?'PROSECUTION':'DEFENSE');
  }
});
test('an invalid opposing answer waits for retry without asking the user for testimony',async()=>{
  const f=fixture(()=>({turns:[{actor:'JUDGE',text:'A procedural direction.'}]}));f.gate('PROSECUTION','direct');await flush();
  assert.equal(f.sim._activeStage.kind,'await-answer');assert.equal(f.session.transcript.length,0);
  assert.match(f.element('v3-interaction').innerHTML,/Retry AI/);assert.doesNotMatch(f.element('v3-interaction').innerHTML,/<textarea/);
});
test('a failed opposing cross question has styled retry and skip controls and preserves testimony',async()=>{
  for(const repeat of [false,true]){
    const f=fixture(()=>{throw Error('A generated question used the wrong role.');});
    f.session.transcript.push({id:'accepted',actor:'WITNESS_DEFENSE',kind:'answer',text:'My accepted testimony.'});
    f.go(t=>t.kind==='choice'&&t.side==='DEFENSE'&&!!t.repeat===repeat);await flush();
    assert.match(f.element('v3-interaction').innerHTML,/v3-answer-actions/);
    assert.match(f.element('v3-interaction').innerHTML,/Retry AI/);
    assert.match(f.element('v3-interaction').innerHTML,/Skip this practice cross-examination/);
    assert.match(f.element('v3-interaction').innerHTML,/wrong role/);
    assert.equal(f.sim._activeStage.kind,'choice');f.live.skipQuestion();
    assert.equal(repeat?f.sim._activeStage.id:f.sim._activeStage.cue,repeat?'DEFENSE:0:return-counsel':'release');
    assert.equal(f.session.transcript.find(t=>t.id==='accepted').text,'My accepted testimony.');assert.equal(f.requests.length,1);
  }
});
test('skipping a failed rephrase withdraws only that question and preserves its unsubmitted draft',async()=>{
  const f=fixture(()=>{throw Error('Temporary provider failure.');});
  f.gate('DEFENSE','cross');f.element('v3-witness-input').value='An unsubmitted draft.';f.sim.saveInteractionDraft('An unsubmitted draft.');
  const key=f.sim._activeStage.answerKey;f.sim.raiseObjection();f.advance();f.advance();await flush();
  assert.equal(f.sim._activeStage.kind,'edit-question');assert.match(f.element('v3-interaction').innerHTML,/Withdraw this question and continue/);
  f.live.skipQuestion();await flush();
  assert.notEqual(f.sim._activeStage.kind,'await-answer');assert.equal(f.sim._interactions[key].draft,'An unsubmitted draft.');
  assert.ok(!f.session.transcript.some(t=>t.kind==='answer'));
});
test('skip cross recovery cannot bypass a pending manual witness answer',()=>{
  const f=fixture();const stage=f.gate('DEFENSE','cross');f.live.skipQuestion();
  assert.equal(f.sim._activeStage,stage);assert.equal(f.sim._awaiting,true);assert.equal(f.session.transcript.length,0);
});
test('manual counsel questions wait for internal review while their editable draft remains visible',async()=>{
  let finish;const f=fixture(undefined,()=>new Promise(resolve=>{finish=resolve;}));
  f.go(t=>t.kind==='choice'&&t.side==='PROSECUTION'&&!t.repeat);
  f.element('v3-question-input').value='What did you hear?';const pending=f.sim.resolveFollowUp(true);
  assert.equal(f.sim._activeStage.kind,'choice');assert.equal(f.element('v3-question-input').value,'What did you hear?');
  assert.equal(f.requests.at(-1).action,'review_question');assert.doesNotMatch(f.element('v3-interaction').innerHTML,/verification|validation|checks/i);
  finish({turns:[{actor:'DEFENSE',text:'What did you hear?'}],question:'What did you hear?',needs_answer:true});await pending;
  assert.equal(f.sim._interactions['PROSECUTION:1:cross'].question,'What did you hear?');
  assert.equal(f.requests.length,1);
});
test('an edit during question review is preserved and not automatically submitted',async()=>{
  let finish;const f=fixture(undefined,()=>new Promise(resolve=>{finish=resolve;}));
  f.go(t=>t.kind==='choice'&&t.side==='PROSECUTION'&&!t.repeat);
  f.element('v3-question-input').value='Initial question?';const pending=f.sim.resolveFollowUp(true);
  f.element('v3-question-input').value='My edited question?';f.sim.saveInteractionDraft('My edited question?');
  finish({turns:[{actor:'DEFENSE',text:'Initial question?'}],question:'Initial question?',needs_answer:true});await pending;
  assert.equal(f.sim._activeStage.kind,'choice');assert.equal(f.element('v3-question-input').value,'My edited question?');assert.equal(f.live.busy,false);
});
test('unreviewed saved dialogue is held before captions/speech and is checked again after new testimony',async()=>{
  let finish;const f=fixture(undefined,body=>new Promise(resolve=>{finish=resolve;}));
  const node=f.sim._timeline.find(t=>t.kind==='dialogue'&&t.actor==='PROSECUTION');delete node._courtReviewed;
  const index=f.sim._timeline.indexOf(node);f.go(index);assert.equal(f.sim._activeStage.kind,'response-hold');
  assert.notEqual(f.element('v3-subtitle-text').innerHTML,node.text);
  f.sim._runStage(false);assert.equal(f.requests.length,1);
  finish({turns:[{actor:'PROSECUTION',text:'Please clarify the disputed facts.'}],needs_answer:false});await flush();
  assert.equal(f.sim._activeStage.text,'Please clarify the disputed facts.');assert.equal(node._courtReviewed,true);
  f.gate('DEFENSE','direct');f.element('v3-witness-input').value='A new material detail.';f.sim.submitWitnessAnswer();
  f.go(index);assert.equal(f.sim._activeStage.kind,'response-hold');assert.equal(f.requests.at(-1).action,'review_turn');
  finish({turns:[{actor:'PROSECUTION',text:'Which parts did you personally observe?'}],needs_answer:false});await flush();
  assert.equal(f.sim._activeStage.text,'Which parts did you personally observe?');
});
test('manual witness answers containing any claimed law bypass the new verification layer unchanged',()=>{
  const f=fixture();f.gate('DEFENSE','cross');const answer='My own answer: section 999 applies and I disagree.';
  f.element('v3-witness-input').value=answer;f.sim.submitWitnessAnswer();
  assert.equal(f.requests.length,0);assert.equal(f.session.transcript[0].text,answer);assert.equal(f.sim._activeStage.kind,'answer');
});

test('saved primary examination questions are held before speech just like adaptive questions',async()=>{
  let finish;const f=fixture(undefined,()=>new Promise(resolve=>{finish=resolve;}));
  f.go(t=>t.kind==='practice'&&t.cue==='question'&&t.side==='DEFENSE');
  assert.equal(f.sim._activeStage.kind,'response-hold');assert.equal(f.requests.length,1);
  const proposed=JSON.parse(f.requests[0].input);assert.equal(proposed.needs_answer,true);
  finish({turns:[{actor:'DEFENSE',text:'What did you personally hear?'}],needs_answer:true,question:'What did you personally hear?'});await flush();
  assert.equal(f.sim._activeStage.text,'What did you personally hear?');assert.equal(f.requests.length,1);
});

test('a necessary judge direction from manual question review plays before the corrected question',async()=>{
  const f=fixture(undefined,()=>({turns:[{actor:'JUDGE',text:'Confine the question to personal observations.',_courtReviewed:true},
    {actor:'DEFENSE',text:'What did you observe?',_courtReviewed:true}],needs_answer:true,question:'What did you observe?'}));
  f.go(t=>t.kind==='choice'&&t.side==='PROSECUTION'&&!t.repeat);
  f.element('v3-question-input').value='My proposed question?';await f.sim.resolveFollowUp(true);
  assert.match(f.sim._activeStage.actor,/JUDGE/);assert.equal(f.sim._activeStage.text,'Confine the question to personal observations.');
  f.advance();assert.equal(f.sim._interactions['PROSECUTION:1:cross'].question,'What did you observe?');
  assert.equal(f.requests.length,1);
});

test('fixed procedural directions are checked locally, and edited directions wait for server review',async()=>{
  let finish;const f=fixture(undefined,()=>new Promise(resolve=>{finish=resolve;}));
  const node=f.sim._timeline.find(t=>t.cue==='grant'&&t.side==='DEFENSE');
  f.go(f.sim._timeline.indexOf(node));assert.equal(f.requests.length,0);assert.equal(node._courtReviewed,true);
  node.text='Section 999 makes this compulsory.';f.go(f.sim._timeline.indexOf(node));
  assert.equal(f.sim._activeStage.kind,'response-hold');assert.equal(f.requests.length,1);
  assert.doesNotMatch(f.element('v3-subtitle-text').innerHTML,/999/);
  finish({turns:[{actor:'JUDGE',text:'Counsel, please clarify the request.'}],needs_answer:false});await flush();
  assert.equal(f.sim._activeStage.text,'Counsel, please clarify the request.');
  assert.doesNotMatch(f.element('v3-interaction').innerHTML,/verification|validation|checks/i);
});

test('editing reviewed dialogue invalidates its old approval before speech',async()=>{
  let finish;const f=fixture(undefined,()=>new Promise(resolve=>{finish=resolve;}));
  const node=f.sim._timeline.find(t=>t.kind==='dialogue'&&t.actor==='DEFENSE');
  node.text='An edited legal conclusion.';f.go(f.sim._timeline.indexOf(node));
  assert.equal(f.sim._activeStage.kind,'response-hold');assert.equal(f.requests.length,1);
  finish({turns:[{actor:'DEFENSE',text:'Which facts do you dispute?'}],needs_answer:false});await flush();
  assert.equal(f.sim._activeStage.text,'Which facts do you dispute?');
});

test('switching the courtroom invalidates a saved dialogue review',async()=>{
  let finish;const f=fixture(undefined,()=>new Promise(resolve=>{finish=resolve;}));
  const node=f.sim._timeline.find(t=>t.kind==='dialogue'&&t.actor==='DEFENSE');
  f.sim._courtType='HIGH';f.go(f.sim._timeline.indexOf(node));
  assert.equal(f.sim._activeStage.kind,'response-hold');assert.equal(f.requests.at(-1).courtType,'HIGH');
  finish({turns:[{actor:'DEFENSE',text:'Which matters remain disputed?'}],needs_answer:false});await flush();
  assert.equal(f.sim._activeStage.text,'Which matters remain disputed?');
});

test('a failed procedural review holds the hearing and never plays the original line',async()=>{
  const f=fixture(undefined,()=>{throw Error('Synthetic outage');});
  const node=f.sim._timeline.find(t=>t.cue==='grant'&&t.side==='DEFENSE');node.text='An unsupported direction.';
  f.go(f.sim._timeline.indexOf(node));await flush();
  assert.equal(f.sim._activeStage.kind,'response-hold');assert.equal(f.sim._awaiting,true);
  assert.doesNotMatch(f.element('v3-subtitle-text').innerHTML,/unsupported/);
  assert.match(f.element('v3-interaction').innerHTML,/Retry/);
});

test('a response reviewed before new testimony cannot be accepted into the changed record',async()=>{
  let finish;const f=fixture(undefined,()=>new Promise(resolve=>{finish=resolve;}));
  const node=f.sim._timeline.find(t=>t.kind==='dialogue'&&t.actor==='DEFENSE');delete node._courtReviewKey;
  f.go(f.sim._timeline.indexOf(node));
  f.live.completed({actor:'WITNESS_DEFENSE',kind:'answer',text:'A newly accepted fact.',witnessId:'DEFENSE:0'});
  finish({turns:[{actor:'DEFENSE',text:'A stale reply.'}],needs_answer:false});await flush();
  assert.equal(f.sim._activeStage.kind,'response-hold');
  assert.doesNotMatch(f.element('v3-subtitle-text').innerHTML,/stale reply/);
  assert.equal(f.session.transcript[0].text,'A newly accepted fact.');
});

test('script-only legacy dialogue cannot bypass review when no saved case record is active',()=>{
  const f=fixture();f.live.detach();f.session.script=null;
  f.sim._script=[{actor:'JUDGE',text:'Section 999 guarantees the result.',_isDynamic:true}];
  f.sim.loadActiveScript();assert.equal(f.live.session(),null);
  assert.equal(f.sim._activeCaseTitle,'Demonstration hearing');
  assert.doesNotMatch(JSON.stringify(f.sim._script),/999|constitutional safeguards|prima facie/);
});

test('saved speech approvals expire even when the testimony and courtroom are unchanged',async()=>{
  let finish;const f=fixture(undefined,()=>new Promise(resolve=>{finish=resolve;}));
  const node=f.sim._timeline.find(t=>t.kind==='dialogue'&&t.actor==='DEFENSE');
  f.advanceClock(300001);f.go(f.sim._timeline.indexOf(node));
  assert.equal(f.sim._activeStage.kind,'response-hold');assert.equal(f.requests.length,1);
  finish({turns:[{actor:'DEFENSE',text:'Which facts remain disputed?'}],needs_answer:false});await flush();
  assert.equal(f.sim._activeStage.text,'Which facts remain disputed?');
});

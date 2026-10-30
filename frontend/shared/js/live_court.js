/* Persisted court sessions tied to a specific chat. AI turns are requested incrementally. */
const LiveCourt = {
  context:null,busy:false,requestId:0,
  cancelRequests(){
    ++this.requestId;this._requestController?.abort();this._requestController=null;
    this.busy=false;this._stageReview=null;this._questionReviewStage=null;
  },
  detach(){VirtualCourtSimulator.stopSimulation();this.context=null;VirtualCourtSimulator._script=[];VirtualCourtSimulator._courtSessions={};VirtualCourtSimulator._loadedLiveKey=null;},
  async launch(messageId){
    const thread=AssistantThreads.active(),owner=AssistantThreads.owner();if(!thread)return;
    VirtualCourtSimulator.stopSimulation();
    let session=Object.values(thread.courtSessions||{}).find(s=>s.messageId===messageId);
    if(!session){
      const index=messageId?thread.messages.findIndex(m=>m.id===messageId):thread.messages.length-1;
      const messages=thread.messages.slice(0,index<0?undefined:index+1);
      const summary=messages.filter(m=>m.sender==='user').map(m=>m.text+(m.caseContext?'\n'+m.caseContext:'')).join('\n\n');
      if(!summary){AssistantThreads.notify('Describe your case first, then open Virtual Court.','info');return;}
      session={id:AssistantThreads.id('court'),messageId,title:thread.title,summary,language:messages.at(-1)?.lang||thread.language||'auto',
        transcript:[],rooms:{},createdAt:new Date().toISOString(),role:AssistantChat.role()};
      AssistantThreads.change(thread.id,t=>{t.courtSessions[session.id]=session;});
    }
    this.context={owner,threadId:thread.id,sessionId:session.id};this.busy=true;
    const launchId=++this.requestId;
    try{
      if(!session.script){
        AssistantThreads.notify('Preparing a separate hearing from this conversation…','info');
        const data=await this.request('opening','',session);
        if(launchId!==this.requestId||AssistantThreads.owner()!==owner||AssistantThreads.active(false)?.id!==thread.id)return;
        session.script=data.turns.map(t=>({...t,_isDynamic:true}));session.language=data.detected_language?.detected_language_code||session.language;
        session.openingQuestion=data.needs_answer?data.question:null;
        AssistantThreads.change(thread.id,t=>{t.courtSessions[session.id]=session;});
      }
      if(launchId!==this.requestId||AssistantThreads.active(false)?.id!==thread.id)return;
      this.activate(session);Router.navigate('/court/simulate');
    }catch(error){if(launchId===this.requestId&&error.name!=='AbortError')AssistantThreads.notify(error.message,'error');}
    finally{if(launchId===this.requestId)this.busy=false;}
  },
  session(){const c=this.context;if(!c||AssistantThreads.owner()!==c.owner)return null;return AssistantThreads.getForCourt(c.threadId)?.courtSessions?.[c.sessionId];},
  activate(session){
    const sim=VirtualCourtSimulator;sim._script=session.script;sim._activeCaseTitle=session.title;sim._activeLanguage=session.language;
    sim._sessionCaseKey=null;sim._loadedLiveKey=null;sim._configureCourt();
    this.persist();
  },
  persist(){
    const session=this.session();if(!session)return;
    const sim=VirtualCourtSimulator,c=this.context;
    // Keep plain snapshots only; Three.js scene objects never enter storage.
    if(sim._isPlaying&&sim._playingCaseKey===sim._sessionCaseKey)sim._saveCourtProgress();
    session.rooms=JSON.parse(JSON.stringify(sim._courtSessions));
    session.updatedAt=new Date().toISOString();
    AssistantThreads.changeCourt(c.threadId,t=>{t.courtSessions[c.sessionId]=session;});
  },
  examination(stage=VirtualCourtSimulator._activeStage){
    if(!stage)return null;
    const sim=VirtualCourtSimulator,witness=stage.witness||(stage.actor?.startsWith('WITNESS_')?stage.actor:null);
    if(!witness)return null;
    const side=stage.side||witness.replace('WITNESS_',''),key=stage.answerKey||stage.questionKey;
    const examinationStage=stage.examinationStage||(key?.includes(':main')?'direct':'cross');
    const questioningSide=stage.questioningSide||(['DEFENSE','PROSECUTION'].includes(stage.lookAt)?stage.lookAt:
      examinationStage==='direct'?side:side==='DEFENSE'?'PROSECUTION':'DEFENSE');
    const previous=sim._timeline.slice(0,sim._timelineIndex+1).reverse().find(t=>
      (t.kind==='question'||t.cue==='question')&&t.sourceIndex===stage.sourceIndex);
    const interaction=sim._interactions?.[key]||{};
    return {witnessId:stage.witnessId||side+':'+stage.sourceIndex,witness,witnessName:stage.witnessName||'',side,questioningSide,examinationStage,
      question:interaction.question||sim._interactions?.[previous?.questionKey]?.question||previous?.text||'',
      questionActor:stage.questionActor||(previous?.actor?.startsWith('JUDGE')?'JUDGE':previous?.actor)||questioningSide,
      answerStatus:interaction.status||(interaction.answer?'submitted':interaction.draft?'drafted':'pending'),
      answerMode:side==='PROSECUTION'?'ai':interaction.answerMode||'manual'};
  },
  reviewKey(turn,examination=this.examination(turn),state=null){
    const session=this.session(),sim=VirtualCourtSimulator;if(!session)return '';
    state ||= {sessionId:session.id,epoch:session.reviewEpoch||0,courtType:sim._courtType,window:Math.floor(Date.now()/300000),
      language:sim._detectIndianLanguage?.(session.summary,session.language)?.shortCode||session.language};
    return JSON.stringify([3,state.sessionId,state.epoch,state.courtType,state.language,state.window,
      examination?.witnessId||'',examination?.questioningSide||'',examination?.examinationStage||'',
      turn.actor.startsWith('JUDGE')?'JUDGE':turn.actor,turn.text]);
  },
  reviewPractice(node){
    // These fixed lines contain no case facts or propositions of law. Validate exact
    // wording, language and procedural speaker locally on every playback. Edited
    // directions, questions and substantive dialogue always go through server review.
    if(node.kind!=='practice'||typeof CourtroomDirector==='undefined')return false;
    const sim=VirtualCourtSimulator,language=sim._detectIndianLanguage?.('',sim._activeLanguage)?.shortCode||sim._activeLanguage;
    const phrases=CourtroomDirector.phrases(language),scope=this.examination(node);
    if(!phrases||!scope||node.text!==phrases[node.cue])return false;
    const judge=node.actor.startsWith('JUDGE');
    if(['grant','call','ruling','release'].includes(node.cue))return judge;
    if(['permission','cross'].includes(node.cue))return node.actor===scope.questioningSide;
    return node.cue==='objection'&&node.actor===(scope.questioningSide==='DEFENSE'?'PROSECUTION':'DEFENSE');
  },
  waitForRetry(seconds,signal){
    return new Promise((resolve,reject)=>{
      const cancel=()=>{clearTimeout(timer);const error=new Error('The courtroom request was cancelled.');error.name='AbortError';reject(error);};
      const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},seconds*1000);
      signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();
    });
  },
  async request(action,input,session=this.session(),examination=this.examination()){
    if(!session)throw Error('Select a saved court session first.');
    const language=VirtualCourtSimulator._detectIndianLanguage?.(session.summary,session.language)?.shortCode||session.language;
    const epoch=session.reviewEpoch||0;
    const state={sessionId:session.id,epoch,courtType:VirtualCourtSimulator._courtType,language,window:Math.floor(Date.now()/300000)};
    const controller=new AbortController();this._requestController?.abort();this._requestController=controller;
    const payload={summary:session.summary,language,courtType:VirtualCourtSimulator._courtType,
      action,input,role:session.role,examination,history:session.transcript.map(m=>({...m,sender:m.actor.startsWith('WITNESS')?'user':'ai'}))};
    let result;
    try{
      for(let attempt=0;attempt<2;attempt++){
        try{result=await AssistantThreads.api('court',payload,{signal:controller.signal});break;}
        catch(error){
          if(attempt||!error.retryable||!error.retryAfter||error.retryAfter>30||controller.signal.aborted)throw error;
          const panel=document.getElementById('v3-interaction');
          document.getElementById('nyay-request-retry')?.remove();
          panel?.insertAdjacentHTML('beforeend','<p id="nyay-request-retry" role="status">The AI needs a short pause. Retrying in '+Number(error.retryAfter)+' seconds. Your hearing and draft are saved.</p>');
          await this.waitForRetry(error.retryAfter,controller.signal);
          if(!this.session()||(session.reviewEpoch||0)!==epoch)throw Error('The hearing has moved forward. Please retry the next response.');
        }
      }
    }finally{if(this._requestController===controller){this._requestController=null;document.getElementById('nyay-request-retry')?.remove();}}
    if(controller.signal.aborted){const error=new Error('The courtroom request was cancelled.');error.name='AbortError';throw error;}
    if((session.reviewEpoch||0)!==epoch)throw Error('The hearing has moved forward. Please retry the next response.');
    if((result.turns||[]).some(turn=>!turn.actor.startsWith('WITNESS')&&!turn._courtReviewed))
      throw Error('The next response is unavailable. Please retry.');
    for(const turn of result.turns||[])if(turn._courtReviewed){
      turn._courtReviewEpoch=epoch;turn._courtReviewKey=this.reviewKey(turn,examination,state);
    }
    return result;
  },
  completed(stage){
    const session=this.session();if(!session)return;
    if(stage.silent||['move','choice','await-answer','edit-question'].includes(stage.kind))return;
    const original=stage.kind==='answer'?VirtualCourtSimulator._timeline.find(t=>t.answerKey===stage.answerKey&&t.actor===stage.actor):null;
    const key=stage._liveId||original?._liveId||AssistantThreads.id('turn');
    stage._liveId=key;if(original)original._liveId=key;
    if(session.transcript.some(t=>t.id===key))return;
    const examination=this.examination(stage);
    session.transcript.push({id:key,actor:stage.actor,name:stage.name||'',text:stage.text,kind:stage.kind,cue:stage.cue,...examination,
      // Keep the speaker identity separate from the witness whose examination this concerns.
      time:new Date().toISOString()});
    if(stage.actor.startsWith('WITNESS')||stage.actor.startsWith('JUDGE')||stage.cue==='ruling')session.reviewEpoch=(session.reviewEpoch||0)+1;
  },
  capture(){const s=this.session();if(s)this.persist();},
  reactionStages(result,stage){
    const sim=VirtualCourtSimulator,positions=JSON.parse(JSON.stringify(stage.positions));
    for(const [key,model]of Object.entries(sim._avatarModels))positions[key]=[model.position.x,model.position.y,model.position.z];
    const judges=Object.keys(sim.SPEAKER_COORDS).filter(k=>k.startsWith('JUDGE'));let count=0;
    const turns=result.turns.map(t=>({...t,actor:t.actor==='JUDGE'?judges[(sim._timelineIndex+count++)%judges.length]:t.actor,
      kind:'live',positions:JSON.parse(JSON.stringify(positions)),duration:0,sourceIndex:stage.sourceIndex,camera:t.actor==='JUDGE'?'JUDGE':t.actor,lookAt:stage.actor}));
    if(result.needs_answer){
      const actor=stage.actor.startsWith('WITNESS')?stage.actor:'WITNESS_'+result.witness_side;
      const side=actor.replace('WITNESS_',''),camera=side==='DEFENSE'?'WITNESS':'WITNESS_OTHER',key=AssistantThreads.id('answer');
      const examination=this.examination(stage),asker=result.question_actor==='JUDGE'
        ?turns.at(-1)?.actor||judges[0]:examination?.questioningSide||turns.at(-1)?.actor||'DEFENSE';
      const question=result.question?.trim();
      if(!question)throw Error('No valid question was returned. Please retry.');
      if(!turns.length)turns.push({actor:asker,text:question,kind:'question',positions,duration:0,sourceIndex:stage.sourceIndex});
      if(turns.length){turns.at(-1).text=result.question||turns.at(-1).text;turns.at(-1).camera=camera;turns.at(-1).lookAt=actor;}
      Object.assign(turns.at(-1),{kind:'question',actor:asker,questionKey:key,...examination,questionActor:result.question_actor||asker});
      turns.push({kind:'await-answer',actor,text:sim._interactionWords().waiting,answerKey:key,positions,duration:0,sourceIndex:stage.sourceIndex,
        ...examination,questionActor:result.question_actor||asker,witness:actor,side,silent:true,camera,lookAt:asker});
    }
    const examination=this.examination(stage);
    if(examination)turns.forEach(t=>Object.assign(t,{witnessId:examination.witnessId,witness:examination.witness,
      witnessName:examination.witnessName,side:examination.side,questioningSide:examination.questioningSide,examinationStage:examination.examinationStage}));
    return turns;
  },
  async react(stage){
    if(this.busy)return;const sim=VirtualCourtSimulator,session=this.session();if(!session)return;
    this.busy=true;sim._awaiting=true;const generation=sim._sceneGeneration,id=++this.requestId;
    const panel=document.getElementById('v3-interaction');panel.hidden=false;panel.innerHTML='<p role="status">Preparing the next question…</p><div class="v3-answer-actions"><button onclick="LiveCourt.skipReaction()">Continue manually</button></div>';
    try{
      this.completed(stage);this.persist();
      const result=await this.request('react',stage.text);
      if(id!==this.requestId||generation!==sim._sceneGeneration||!this.session()||sim._activeStage!==stage)return;
      const next=this.reactionStages(result,stage);sim._timeline.splice(sim._timelineIndex+1,0,...next);
      stage._reacted=true;sim._timeline[sim._timelineIndex]._reacted=true;sim._awaiting=false;sim._timelineIndex++;sim._stageElapsed=0;this.busy=false;
      sim._runStage(true);this.persist();
    }catch(error){
      if(id!==this.requestId||generation!==sim._sceneGeneration)return;
      this.busy=false;sim._awaiting=true;
      panel.innerHTML='<p>'+Utils.escapeHtml(error.message)+'</p><div class="v3-answer-actions"><button class="v3-answer-submit" onclick="LiveCourt.retryReaction()">Retry AI reaction</button><button onclick="LiveCourt.skipReaction()">Continue manually</button></div>';
    }finally{if(id===this.requestId)this.busy=false;}
  },
  retryReaction(){this.react(VirtualCourtSimulator._activeStage);},
  skipReaction(){
    const sim=VirtualCourtSimulator;if(!this.session()||!sim._activeStage||!sim._awaiting)return;
    this.cancelRequests();sim._activeStage._reacted=true;sim._timeline[sim._timelineIndex]._reacted=true;
    sim._awaiting=false;sim._timelineIndex++;sim._stageElapsed=0;sim._runStage(true);this.persist();
  },
  async witnessAnswer(){
    const sim=VirtualCourtSimulator,stage=sim._activeStage;if(stage?.kind!=='await-answer'||this.busy)return;
    this.busy=true;const generation=sim._sceneGeneration,id=++this.requestId,session=this.session(),index=sim._timelineIndex;
    const input=document.getElementById('v3-witness-input'),draft=input?.value;
    const record=sim._interactions[stage.answerKey] ||= {status:'pending'};
    const initialDraft=record.draft;
    record.answerMode='ai';this.persist();
    const button=document.getElementById('nyay-ai-witness');if(button)button.disabled=true;
    try{
      const result=await this.request('witness_answer','Answer only the active question as this witness.',session,{...this.examination(stage),answerMode:'ai'});
      if(id!==this.requestId||generation!==sim._sceneGeneration||!this.session()||sim._activeStage!==stage||sim._timelineIndex!==index)return;
      if(record.answer||record.draft!==initialDraft||stage.side!=='PROSECUTION'&&input?.value!==draft){
        AssistantThreads.notify('Your edited answer is preserved. Submit it or request AI assistance again.','info');return;
      }
      const response=result.turns.find(t=>t.actor===stage.actor);
      if(!response?.text?.trim())throw Error('The AI did not answer as the active witness. Please retry.');
      sim.submitWitnessAnswer(response.text,'ai');
    }catch(error){
      if(id===this.requestId&&generation===sim._sceneGeneration&&sim._activeStage===stage){
        AssistantThreads.notify(error.message,'error');
        if(this.examination(stage)?.side==='PROSECUTION')this.waitPanel('The witness could not answer. Your question is saved.','LiveCourt.witnessAnswer()',true);
        else if(button){
          button.textContent='Retry AI answer';
          const old=document.getElementById('nyay-witness-error');old?.remove();
          document.getElementById('v3-interaction')?.insertAdjacentHTML('beforeend','<p id="nyay-witness-error" role="status">'+Utils.escapeHtml(error.message)+'</p>');
        }
      }
    }finally{if(id===this.requestId)this.busy=false;if(button)button.disabled=false;}
  },
  waitPanel(message,retry,objection=false,skip=false){
    const panel=document.getElementById('v3-interaction');panel.hidden=false;
    panel.innerHTML='<p role="status">'+Utils.escapeHtml(message)+'</p><div class="v3-answer-actions">'
      +(retry?'<button class="v3-answer-submit" onclick="'+retry+'">Retry AI</button>':'')
      +(objection?'<button onclick="VirtualCourtSimulator.raiseObjection()">'+Utils.escapeHtml(VirtualCourtSimulator._interactionWords().object)+'</button>':'')
      +(skip?'<button onclick="LiveCourt.skipQuestion()">'+(VirtualCourtSimulator._activeStage?.kind==='edit-question'?'Withdraw this question and continue':'Skip this practice cross-examination')+'</button>':'')+'</div>';
  },
  skipQuestion(){
    const sim=VirtualCourtSimulator,stage=sim._activeStage;
    if(!this.session()||!['choice','edit-question'].includes(stage?.kind))return;
    this.cancelRequests();
    this.applyQuestion({turns:[],needs_answer:false},stage,true);this.persist();
  },
  async reviewStage(node){
    const sim=VirtualCourtSimulator,index=sim._timelineIndex,generation=sim._sceneGeneration,id=++this.requestId;
    this.busy=true;this._stageReview={node,id};sim._awaiting=true;
    sim._activeStage={...node,kind:'response-hold',silent:true};
    ++sim._speechGeneration;window.speechSynthesis?.cancel();sim._cancelStreamAudio?.();
    this.waitPanel('Preparing the next response…',null);
    const isQuestion=node.kind==='question'||node.cue==='question';
    const text=isQuestion?sim._interactions[node.questionKey]?.question||node.text:node.text;
    const actor=node.actor.startsWith('JUDGE')?'JUDGE':node.actor;
    try{
      const result=await this.request('review_turn',JSON.stringify({turns:[{actor,text,name:node.name||''}],
        needs_answer:isQuestion,question:isQuestion?text:'',question_actor:actor}),this.session(),this.examination(node));
      if(id!==this.requestId||generation!==sim._sceneGeneration||index!==sim._timelineIndex||!this.session())return;
      const currentText=isQuestion?sim._interactions[node.questionKey]?.question||node.text:node.text;
      if(currentText!==text){
        this.busy=false;this._stageReview=null;sim._awaiting=false;sim._runStage(true);return;
      }
      const turn=result.turns.find(t=>t.actor===actor);
      if(turn){
        if(!turn._courtReviewed||!turn._courtReviewKey)throw Error('The next response is unavailable. Please retry.');
        node._courtReviewed=true;node._courtReviewEpoch=turn._courtReviewEpoch;node._courtReviewKey=turn._courtReviewKey;
        node.text=turn.text;node.name=turn.name||'';if(node.questionKey&&sim._interactions[node.questionKey]?.question)sim._interactions[node.questionKey].question=turn.text;
      }
      else{
        const gate=isQuestion?sim._timeline.findIndex((t,i)=>i>index&&t.answerKey===node.questionKey):-1;
        sim._timelineIndex=gate>=0?gate+1:index+1;
      }
      this.busy=false;this._stageReview=null;sim._awaiting=false;sim._runStage(true);this.persist();
    }catch(error){
      if(id===this.requestId&&generation===sim._sceneGeneration){
        this.busy=false;this._stageReview=null;
        this.waitPanel('The next response is unavailable. Please retry.','VirtualCourtSimulator._runStage(true)');
      }
    }
  },
  applyQuestion(result,stage,automatic){
    const sim=VirtualCourtSimulator,judges=(result.turns||[]).filter(t=>t.actor==='JUDGE');
    if(judges.length){
      stage._pendingDecision={...result,turns:result.turns.filter(t=>t.actor!=='JUDGE'),automatic};
      sim._timeline.splice(sim._timelineIndex,0,...this.reactionStages({turns:judges,needs_answer:false},stage));
      sim._stageElapsed=0;sim._runStage(true);return;
    }
    if(automatic){
      if(result.needs_answer&&result.question?.trim())sim.resolveFollowUp(true,result.question,true);
      else if(stage.kind==='choice')sim.resolveFollowUp(false);
      else{
        const gate=sim._timeline.findIndex((t,i)=>i>sim._timelineIndex&&t.answerKey===(stage.replacesAnswerKey||stage.questionKey));
        if(gate<0)throw Error('The question awaiting rephrasing could not be found.');
        sim._timelineIndex=gate+1;sim._stageElapsed=0;sim._runStage(true);
      }
    }else{
      const input=document.getElementById('v3-question-input');
      if(input&&result.needs_answer&&result.question?.trim()){
        input.value=result.question;sim.saveInteractionDraft(result.question);this.persist();
      }else AssistantThreads.notify('Your counsel has no further relevant question. You can decline or ask your own question.','info');
    }
  },
  async question(automatic=false){
    const sim=VirtualCourtSimulator,stage=sim._activeStage;
    if(!['choice','edit-question'].includes(stage?.kind)||this.busy)return;
    const examination=this.examination(stage);if(!examination)return;
    const input=document.getElementById('v3-question-input'),draft=input?.value;
    this.busy=true;const generation=sim._sceneGeneration,id=++this.requestId;
    if(automatic)this.waitPanel('Preparing the next question…',null);
    try{
      const result=await this.request(stage.kind==='edit-question'?'rephrase':'cross_question',
        stage.kind==='edit-question'?'Apply the recorded ruling. Rephrase or withdraw the disallowed question.':'Ask one useful next question or decline further cross-examination.');
      if(id!==this.requestId||generation!==sim._sceneGeneration||sim._activeStage!==stage||!this.session())return;
      if(automatic||input&&input.value===draft)this.applyQuestion(result,stage,automatic);
    }catch(error){
      if(id===this.requestId&&generation===sim._sceneGeneration&&sim._activeStage===stage){
        AssistantThreads.notify(error.message,'error');
        if(automatic)this.waitPanel('The next question could not be prepared. '+error.message,'LiveCourt.question(true)',false,true);
      }
    }finally{if(id===this.requestId)this.busy=false;}
  },
  async continueHearing(){
    if(this.busy)return;const sim=VirtualCourtSimulator;
    // Continuing is never consent to replace the user's pending testimony with AI.
    if(sim._activeStage?.kind==='await-answer'&&sim._awaiting){
      if(this.examination()?.side==='PROSECUTION')return this.witnessAnswer();
      return;
    }
    if(sim._timelineIndex<sim._timeline.length)return;
    this.busy=true;const generation=sim._sceneGeneration,id=++this.requestId;
    try{
      const result=await this.request('continue','Continue this hearing; no predetermined ending.',this.session(),null);
      if(id!==this.requestId||generation!==sim._sceneGeneration||!this.session())return;
      const base={positions:Object.fromEntries(Object.entries(sim._avatarModels).map(([k,m])=>[k,[m.position.x,m.position.y,m.position.z]])),actor:'JUDGE',sourceIndex:sim._currentStep};
      let entries;
      if(result.needs_answer){
        const side=result.witness_side,prefix=AssistantThreads.id('examination')+':';
        const language=sim._detectIndianLanguage(result.question,sim._activeLanguage).shortCode;
        const plan=CourtroomDirector.plan([{actor:side,text:''}],sim._courtConfig,language,true).filter(t=>t.kind!=='dialogue');
        for(const stage of plan){
          for(const key of ['answerKey','questionKey','id','exitId'])if(stage[key])stage[key]=prefix+stage[key];
          stage.witnessId=prefix+side;stage.sourceIndex=base.sourceIndex;
          if(stage.cue==='question')stage.text=result.question;
        }
        entries=[...this.reactionStages({...result,needs_answer:false,turns:result.turns.slice(0,-1)},base),...plan];
      }else entries=this.reactionStages(result,base);
      sim._timeline.push(...entries);sim._timelineIndex=sim._timeline.length-entries.length;sim._stageElapsed=0;sim._isPaused=false;sim._runStage(true);this.persist();
    }catch(error){AssistantThreads.notify(error.message,'error');}finally{if(id===this.requestId)this.busy=false;}
  },
  install(){
    const sim=VirtualCourtSimulator;
    const configure=sim._configureCourt.bind(sim);sim._configureCourt=()=>{
      configure();const session=this.session(),key=this.context?.owner+'/'+session?.id;
      if(session&&sim._loadedLiveKey!==key){
        sim._courtSessions=JSON.parse(JSON.stringify(session.rooms||{}));sim._loadedLiveKey=key;
        // Older saved plans predate explicit ownership/stage metadata. Add it without rebuilding their timeline.
        for(const room of Object.values(sim._courtSessions)){
          let scope=null;
          for(const stage of room.plan||[]){
            if(stage.cue==='permission'&&['DEFENSE','PROSECUTION'].includes(stage.actor))scope={side:stage.actor,
              witness:'WITNESS_'+stage.actor,witnessId:stage.actor+':'+stage.sourceIndex,examinationStage:'direct',questioningSide:stage.actor};
            if(scope&&stage.kind==='choice')scope={...scope,examinationStage:'cross',questioningSide:scope.side==='DEFENSE'?'PROSECUTION':'DEFENSE'};
            if(scope&&!stage.witnessId)Object.assign(stage,scope);
            if(stage.cue==='release')scope=null;
          }
        }
      }
    };
    sim.launchFromChat=id=>this.launch(id);
    sim.loadActiveScript=()=>{
      let s=this.session();
      if(!s){const thread=AssistantThreads.active(false),saved=Object.values(thread?.courtSessions||{}).filter(s=>s.script).at(-1);
        if(saved){this.context={owner:AssistantThreads.owner(),threadId:thread.id,sessionId:saved.id};s=saved;sim._sessionCaseKey=null;sim._loadedLiveKey=null;}
      }
      if(s){sim._script=s.script;sim._activeCaseTitle=s.title;sim._activeLanguage=s.language;}
      // Legacy script-only caches have no accepted case/testimony record for review.
      // Keep them stored, but launch substantive hearings from their case chat.
      else {sim._script=sim._getDefaultFallbackScript();sim._activeCaseTitle='Demonstration hearing';sim._activeLanguage='en';}
    };
    const run=sim._runStage.bind(sim);sim._runStage=restore=>{
      const node=sim._timeline[sim._timelineIndex];
      if(this.busy&&this._stageReview?.id===this.requestId&&this._stageReview.node===node)return;
      // Replaying, navigating or rephrasing invalidates any in-flight generation.
      if(this.busy)this.cancelRequests();
      const spokenText=node?.questionKey&&(node.kind==='question'||node.cue==='question')
        ?sim._interactions[node.questionKey]?.question||node.text:node?.text;
      if(this.session()&&node&&this.reviewPractice(node)){
        node._courtReviewed=true;node._courtReviewEpoch=this.session().reviewEpoch||0;node._courtReviewKey=this.reviewKey(node);
      }
      if(sim._ready&&this.session()&&node&&!node.silent&&['JUDGE','DEFENSE','PROSECUTION'].includes(node.actor.startsWith('JUDGE')?'JUDGE':node.actor)&&
        (!node._courtReviewed||node._courtReviewKey!==this.reviewKey({...node,text:spokenText}))){
        this.reviewStage(node);return;
      }
      run(restore);
      if(this.session()){
        if(sim._activeStage?.kind==='live'){
          const label=document.getElementById('v3-stage-label'),speaker=document.getElementById('v3-speaker-text');
          if(label)label.textContent='LIVE AI HEARING · '+(sim._timelineIndex+1)+' / '+sim._timeline.length;
          if(speaker&&sim._activeStage.name)speaker.textContent=sim._activeStage.name;
        }
        this.persist();
        const stage=sim._activeStage;
        if(!sim._isPaused&&stage){
          const examination=this.examination(stage);
          if(stage.kind==='await-answer'&&examination?.side==='PROSECUTION')this.witnessAnswer();
          else if(['choice','edit-question'].includes(stage.kind)){
            if(stage._pendingDecision){const result=stage._pendingDecision;delete stage._pendingDecision;this.applyQuestion(result,stage,result.automatic);}
            else if(examination?.questioningSide==='PROSECUTION')this.question(true);
          }
        }
      }
    };
    const start=sim.startSimulation.bind(sim);sim.startSimulation=()=>{
      start();const session=this.session();
      if(session?.openingQuestion){
        const question=sim._timeline.find(stage=>stage.kind==='practice'&&stage.cue==='question');
        if(question)question.text=session.openingQuestion;
      }
    };
    const update=sim._updateStageMotion.bind(sim);sim._updateStageMotion=()=>{
      const stage=sim._activeStage;
      if(stage&&sim._timeline[sim._timelineIndex]){
        stage._liveId ||= sim._timeline[sim._timelineIndex]._liveId||AssistantThreads.id('turn');
        sim._timeline[sim._timelineIndex]._liveId=stage._liveId;
      }
      if(this.session()&&stage&&!sim._isPaused&&sim._speechDone&&!sim._awaiting&&
        (stage.kind==='answer'||stage.kind==='dialogue'&&stage.actor.startsWith('WITNESS'))&&
        this.examination(stage)?.examinationStage==='direct'&&!stage._reacted){this.react(stage);return;}
      if(this.session()&&stage&&!sim._isPaused&&!sim._awaiting&&sim._speechDone&&sim._stageElapsed>=Math.max(stage.duration,.65))this.completed(stage);
      const before=sim._timelineIndex;update();if(this.session()&&stage&&sim._timelineIndex!==before){this.completed(stage);this.persist();}
    };
    const render=sim._renderInteraction.bind(sim);sim._renderInteraction=stage=>{
      const examination=this.examination(stage);
      if(this.session()&&(stage.kind==='await-answer'&&examination?.side==='PROSECUTION'||
        ['choice','edit-question'].includes(stage.kind)&&examination?.questioningSide==='PROSECUTION')){
        sim._awaiting=true;
        this.waitPanel(stage.kind==='await-answer'?'The opposing witness is preparing an answer…':'Opposing counsel is considering cross-examination…',null,stage.kind==='await-answer');
        return;
      }
      render(stage);if(this.session()&&stage.kind==='await-answer'){
        const actions=document.querySelector('#v3-interaction .v3-answer-actions');
        if(actions)actions.insertAdjacentHTML('beforeend','<button id="nyay-ai-witness" onclick="LiveCourt.witnessAnswer()">AI witness: answer from case facts</button>');
      }
      if(this.session()&&['choice','edit-question'].includes(stage.kind)){
        const actions=document.querySelector('#v3-interaction .v3-answer-actions');
        if(actions)actions.insertAdjacentHTML('beforeend','<button onclick="LiveCourt.question()">AI counsel: draft a question</button>');
      }
    };
    const draft=sim.saveInteractionDraft.bind(sim);sim.saveInteractionDraft=value=>{draft(value);if(this.session())this.persist();};
    const resolve=sim.resolveFollowUp.bind(sim);sim.resolveFollowUp=async(ask,question=null,reviewed=false)=>{
      const stage=sim._activeStage;
      if(!this.session()||!ask||reviewed)return resolve(ask,question,reviewed,this.session()?.reviewEpoch||0,
        reviewed&&this.session()?this.reviewKey({actor:this.examination(stage)?.questioningSide||stage.other,text:question},this.examination(stage)):null);
      if(!['choice','edit-question'].includes(stage?.kind)||this._questionReviewStage===stage)return;
      const input=document.getElementById('v3-question-input'),text=question===null?input?.value:question;
      if(!text?.trim()||question===null&&!input.reportValidity())return;
      const generation=sim._sceneGeneration,id=++this.requestId;
      this.busy=true;this._questionReviewStage=stage;
      const button=document.querySelector('#v3-interaction .v3-answer-submit');if(button)button.disabled=true;
      try{
        const result=await this.request('review_question',text.trim());
        if(id!==this.requestId||generation!==sim._sceneGeneration||sim._activeStage!==stage||!this.session()||question===null&&input.value!==text)return;
        if(result.needs_answer&&result.question?.trim()){
          sim._interactions[stage.questionKey] ||= {};sim._interactions[stage.questionKey].proposedQuestion=text;
          this.busy=false;this.applyQuestion(result,stage,true);
        }else{this.busy=false;this.skipQuestion();}
      }catch(error){if(id===this.requestId)AssistantThreads.notify('The question could not be prepared. Your draft is saved; please retry.','error');}
      finally{
        if(id===this.requestId)this.busy=false;
        if(this._questionReviewStage===stage)this._questionReviewStage=null;
        if(button)button.disabled=false;
      }
    };
    const submit=sim.submitWitnessAnswer.bind(sim);sim.submitWitnessAnswer=(value=null,mode='manual')=>{
      submit(value,mode);
      if(this.session()&&sim._activeStage?.kind==='answer'){this.completed(sim._activeStage);this.persist();}
    };
    const objection=sim.raiseObjection.bind(sim);sim.raiseObjection=()=>{
      const stage=sim._activeStage;if(stage?.kind!=='await-answer')return;
      if(this.busy)this.cancelRequests();
      const record=sim._interactions[stage.answerKey] ||= {};
      record.status='disallowed';record.disallowedQuestion=this.examination(stage)?.question;
      objection();this.persist();
    };
    const stop=sim.stopSimulation.bind(sim);sim.stopSimulation=()=>{if(this.session())this.persist();this.cancelRequests();stop();};
    const end=sim._endSimulation.bind(sim);sim._endSimulation=()=>{
      end();if(this.session()){
        const panel=document.getElementById('v3-interaction');panel.hidden=false;panel.innerHTML='<p>This round is saved. Continue the hearing when you are ready.</p><button class="v3-answer-submit" onclick="LiveCourt.continueHearing()">Continue hearing</button>';
        this.persist();
      }
    };
    window.addEventListener('pagehide',()=>this.capture());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.capture();});
  }
};
LiveCourt.install();

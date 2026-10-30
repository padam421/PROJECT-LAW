const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(){
 let owner='a',counter=0;const thread={id:'chat1',messages:[],courtSessions:{s1:{id:'s1',title:'Specific case',summary:'Original case facts',language:'en',script:[{actor:'JUDGE',text:'Case opening',_isDynamic:true}],transcript:[],rooms:{DISTRICT:{timeline:9,elapsed:2}}}}};
 const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{hidden:true,innerHTML:'',value:'',insertAdjacentHTML(){}});return elements.get(id);};
 const sim={_script:[],_timeline:[],_timelineIndex:0,_interactions:{},_courtSessions:{},_courtType:'DISTRICT',_isPlaying:false,_actorRigs:{},_avatarModels:{},_currentStep:1,_sceneGeneration:1,
   SPEAKER_COORDS:{JUDGE:{},JUDGE_0:{},DEFENSE:{},PROSECUTION:{},WITNESS_DEFENSE:{}},
   _configureCourt(){this._sessionCaseKey='case';this._courtSessions={};},_saveCourtProgress(){this._courtSessions[this._courtType]={timeline:this._timelineIndex};},
   startSimulation(){},_runStage(){},_updateStageMotion(){},_renderInteraction(){},saveInteractionDraft(){},resolveFollowUp(){},submitWitnessAnswer(){},raiseObjection(){},stopSimulation(){this._isPlaying=false;},loadActiveScript(){},_endSimulation(){},_interactionWords(){return {waiting:'Please answer'};},_getDefaultFallbackScript(){return [{actor:'JUDGE',text:'demo'}];}};
 const ctx=vm.createContext({console,AbortController,VirtualCourtSimulator:sim,AssistantThreads:{owner:()=>owner,active:()=>thread,get:id=>id===thread.id?thread:null,id:prefix=>prefix+'_'+ ++counter,change(id,fn){fn(thread);},api:async()=>({turns:[]}),notify(){}},
   AssistantChat:{role:()=> 'user'},Router:{navigate(){}},Utils:{escapeHtml:s=>s},window:{addEventListener(){}},document:{getElementById:el,querySelector:()=>null,addEventListener(){}}});
 ctx.AssistantThreads.getForCourt=ctx.AssistantThreads.get;
 ctx.AssistantThreads.changeCourt=ctx.AssistantThreads.change;
 vm.runInContext(fs.readFileSync('frontend/shared/js/live_court.js','utf8')+'\nthis.live=LiveCourt;',ctx);ctx.live.context={owner:'a',threadId:'chat1',sessionId:'s1'};
 return {live:ctx.live,sim,thread,el,owner:v=>owner=v};
}
test('saved live court timeline is restored after the simulator configures its case',()=>{
 const {sim,live,thread}=fixture();live.activate(thread.courtSessions.s1);assert.equal(sim._courtSessions.DISTRICT.timeline,9);assert.equal(sim._script[0].text,'Case opening');
});
test('recording a completed response is idempotent and preserves its exact words',()=>{
 const {live}=fixture(),stage={actor:'WITNESS_DEFENSE',text:'I did NOT see the signature.',kind:'answer'};live.completed(stage);live.completed(stage);assert.equal(live.session().transcript.length,1);assert.equal(live.session().transcript[0].text,stage.text);
});
test('AI follow-up is generated as a new question followed by an answer gate',()=>{
 const {live}=fixture();const entries=live.reactionStages({turns:[{actor:'JUDGE',text:'Acknowledge answer'},{actor:'PROSECUTION',text:'Which date?'}],needs_answer:true,question:'Which date did you see it?',witness_side:'DEFENSE'},
   {actor:'WITNESS_DEFENSE',positions:{WITNESS_DEFENSE:[-4,0,-2]},sourceIndex:2});
 assert.equal(entries.at(-1).kind,'await-answer');assert.equal(entries.at(-1).actor,'WITNESS_DEFENSE');assert.equal(entries.at(-2).text,'Which date did you see it?');assert.equal(entries.at(-2).lookAt,'WITNESS_DEFENSE');
});
test('switching account detaches access to another account’s live session',()=>{
 const {live,owner}=fixture();assert.ok(live.session());owner('b');assert.equal(live.session(),null);
});
test('starting a new chat detaches the old court without deleting its saved record',()=>{
 const {live,thread,sim}=fixture();live.detach();assert.equal(live.context,null);assert.ok(thread.courtSessions.s1);assert.equal(sim._script.length,0);
});

test('returning to a chat restores its saved courtroom after detaching',()=>{
 const {live,thread,sim}=fixture();live.activate(thread.courtSessions.s1);live.detach();
 sim.loadActiveScript();sim._configureCourt();assert.equal(sim._courtSessions.DISTRICT.timeline,9);
});

// node --test tests/courtrooms.test.cjs — no accounts, network, server or dependencies.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function setup() {
  const timers=new Map(),spoken=[],storage=new Map(),elements=new Map();let serial=0;
  const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',innerText:'',innerHTML:'',style:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},querySelector(){return this;}});return elements.get(id);};
  const context=vm.createContext({console,URL,Map,Intl,AbortController,setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id),cancelAnimationFrame(){},
    sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
    document:{getElementById:id=>id==='v3-wrapper'?null:element(id),querySelectorAll:()=>[],removeEventListener(){}},
    window:{speechSynthesis:{getVoices:()=>[{name:'English',lang:'en-US'}],cancel(){},speak:u=>spoken.push(u)},removeEventListener(){}},
    SpeechSynthesisUtterance:function(text){this.text=text;},
    Utils:{escapeHtml:value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))},UserStore:{get:()=>[]},Router:{navigate(){}}
  });
  for(const [file,name] of [['frontend/shared/js/indian_courtroom.js','IndianCourtroom'],['frontend/shared/js/courtroom_director.js','CourtroomDirector'],['frontend/user/js/court_simulator.js','VirtualCourtSimulator']])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8')+'\nthis.'+name+'='+name+';',context);
  return {context,room:context.IndianCourtroom,director:context.CourtroomDirector,sim:context.VirtualCourtSimulator,timers,spoken,element};
}
const json=v=>JSON.parse(JSON.stringify(v));
const script=[{actor:'JUDGE',text:'The court is in session.'},{actor:'DEFENSE',text:'The first original submission.'},{actor:'PROSECUTION',text:'The opposing original submission.'},{actor:'JUDGE',text:'The hearing has concluded.'}];

test('three rooms retain distinct benches, cameras, and witness stations inside room bounds',()=>{
  const {room}=setup();
  for(const [type,count] of Object.entries({SUPREME:3,HIGH:2,DISTRICT:1})){
    const c=room.layout(type);assert.equal(Object.keys(c.actors).filter(k=>k.startsWith('JUDGE')).length,count);
    assert.ok(c.cameras.WITNESS&&c.cameras.WITNESS_OTHER);
    for(const cam of Object.values(c.cameras)){assert.ok([...cam.pos,...cam.target].every(Number.isFinite));assert.ok(Math.abs(cam.pos[0])<c.width/2&&cam.pos[1]>0&&cam.pos[1]<c.height&&cam.pos[2]>c.back&&cam.pos[2]<c.front);}
    assert.ok(c.witnesses.DEFENSE.x<0&&c.witnesses.PROSECUTION.x>0);
  }
  assert.equal(new Set(Object.values(room.types).map(c=>c.wood)).size,3);
});

test('practice preserves every original line exactly once and includes both parties in each court',()=>{
  const {room,director}=setup();
  for(const type of Object.keys(room.types)){
    const plan=director.plan(script,room.layout(type),'en',true);
    assert.deepEqual(json(plan.filter(s=>s.kind==='dialogue').map(s=>s.text)),script.map(s=>s.text));
    assert.equal(plan.filter(s=>s.cue==='permission').length,2);
    assert.equal(plan.filter(s=>s.cue==='objection').length,0);
    assert.equal(plan.filter(s=>s.kind==='await-answer').length,4);
    assert.ok(plan.some(s=>s.kind==='choice'));
    const judges=new Set(plan.filter(s=>s.actor.startsWith('JUDGE')).map(s=>s.actor));assert.equal(judges.size,room.types[type].judges.length);
  }
});

test('permission precedes witness movement and every participant returns home',()=>{
  const {room,director}=setup(),c=room.layout('DISTRICT'),plan=director.plan(script,c,'en');
  for(const side of ['DEFENSE','PROSECUTION']){
    const request=plan.findIndex(s=>s.cue==='permission'&&s.actor===side);
    const walk=plan.findIndex(s=>s.kind==='move'&&s.actor==='WITNESS_'+side);
    assert.ok(request<walk);assert.equal(plan[request+1].cue,'grant');
  }
  const final=plan.at(-1).positions;
  for(const key of ['DEFENSE','PROSECUTION','WITNESS_DEFENSE','WITNESS_PROSECUTION'])assert.deepEqual(json(final[key]),Object.values(c.actors[key]));
});

test('walking paths remain inside each room and avoid counsel desks and the bar',()=>{
  const {room,director}=setup();
  for(const type of Object.keys(room.types)){
    const c=room.layout(type),plan=director.plan(script,c,'en');
    for(const stage of plan.filter(s=>s.paths))for(const points of Object.values(stage.paths))for(let i=0;i<=100;i++){
      const {point:p,angle}=director.pointOnPath(points,i/100);
      assert.ok(p.every(Number.isFinite)&&Number.isFinite(angle));assert.ok(Math.abs(p[0])<c.width/2-.25&&p[2]>c.back&&p[2]<c.front);
      for(const x of [-2.45,2.45])assert.ok(!(Math.abs(p[0]-x)<1.2&&p[2]>-.8&&p[2]<.2),'path crosses counsel desk');
      if(Math.abs(p[2]-3.2)<.15)assert.ok(Math.abs(p[0])<1,'path crosses gallery railing');
    }
  }
});

test('explicit testimony is preserved without extra invented testimony or duplicate witness blocks',()=>{
  const {room,director}=setup();const source=[...script.slice(0,2),{actor:'WITNESS_DEFENSE',name:'Witness A',text:'A supplied witness statement.'},...script.slice(2)];
  const plan=director.plan(source,room.layout('HIGH'),'hi');
  assert.deepEqual(json(plan.filter(s=>s.kind==='dialogue').map(s=>s.text)),source.map(s=>s.text));
  assert.equal(plan.filter(s=>s.cue==='permission'&&s.actor==='DEFENSE').length,1);
  assert.equal(plan.filter(s=>s.kind==='await-answer'&&s.answerKey.endsWith(':main')).length,1);
});

test('all supported languages have complete prompts; unsupported languages never get English inserts',()=>{
  const {room,director}=setup();
  for(const [code,values]of Object.entries(director.cues)){
    assert.equal(values.length,director.cueKeys.length);assert.ok(values.every(s=>typeof s==='string'&&s.length>5));
    const plan=director.plan(script,room.layout('SUPREME'),code);
    const phrases=Object.values(director.phrases(code));
    assert.ok(plan.filter(s=>s.kind!=='dialogue').every(s=>phrases.includes(s.text)));
  }
  assert.equal(director.plan(script,room.layout('SUPREME'),'fr').length,script.length);
  assert.equal(director.plan(script,room.layout('SUPREME'),'en',false).length,script.length);
});

test('case and courtroom progress are isolated',()=>{
  const {sim}=setup();sim.loadActiveScript();sim._configureCourt();sim._playingCaseKey=sim._sessionCaseKey;sim._isPlaying=true;
  sim._currentStep=2;sim._timelineIndex=12;sim._stageElapsed=1.4;sim._cameraMode='JUDGE';sim._saveCourtProgress();
  sim._courtType='DISTRICT';sim._timelineIndex=1;sim._saveCourtProgress();
  assert.equal(sim._courtSessions.SUPREME.timeline,12);assert.equal(sim._courtSessions.DISTRICT.timeline,1);
  sim._activeCaseTitle='A different case';sim._configureCourt();sim._saveCourtProgress();assert.equal(Object.keys(sim._courtSessions).length,0);
});

test('stale speech and caption callbacks cannot advance a switched or stopped hearing',()=>{
  const {sim,spoken,timers}=setup();let advanced=0;sim._isPlaying=true;sim._isPaused=false;sim._activeSpeakerId='JUDGE';
  sim._speakText('The court is in session.',1,1,()=>advanced++);assert.equal(spoken.length,1);
  sim._sceneGeneration++;sim._speechGeneration++;spoken[0].onend();spoken[0].onerror({error:'interrupted'});assert.equal(advanced,0);
  sim._voiceEnabled=false;sim._speakText('Caption only.',1,1,()=>advanced++);const pending=[...timers.values()].at(-1);
  sim.stopSimulation();pending();assert.equal(advanced,0);
});

test('private dialogue never enters the external practice speech fallback',()=>{
  const {sim,timers}=setup();let requests=0;sim._isPlaying=true;sim._isPaused=false;sim._activeSpeakerId='DEFENSE';sim._activeLanguage='hi';
  sim._speakPracticePrompt=()=>requests++;
  sim._activeStage={kind:'dialogue'};sim._speakText('मेरा निजी मामला है।',1,1,()=>{});assert.equal(requests,0);assert.ok(timers.size>0);
  sim._activeStage={kind:'practice'};sim._speakText('मेरा निजी मामला है।',1,1,()=>{});assert.equal(requests,0);
});

test('case titles are escaped, witness parsing works, and English is not mistaken for Hinglish',()=>{
  const {sim}=setup();assert.equal(sim._detectIndianLanguage('The court is in session.').code,'en-IN');
  const parsed=sim.parseDebateFromText('👤 Prosecution witness: A supplied statement.');assert.equal(parsed[0].actor,'WITNESS_PROSECUTION');
  sim._script=[{actor:'JUDGE',text:'Test.',_isDynamic:true}];sim._activeCaseTitle='<img src=x onerror=alert(1)>';
  const html=sim.render();assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('Toggle fullscreen'));
});

test('both portal entrypoints load the room and director before the simulator',()=>{
  const {sim}=setup();for(const portal of ['user','lawyer']){
    const html=fs.readFileSync(path.join(root,'frontend',portal,'index.html'),'utf8');
    assert.ok(html.indexOf('indian_courtroom.js')<html.indexOf('court_simulator.js'));assert.ok(html.indexOf('courtroom_director.js')<html.indexOf('court_simulator.js'));
    for(const asset of Object.values(sim.AVATAR_FILES))assert.ok(fs.existsSync(path.resolve(root,'frontend',portal,asset)));
  }
});

test('a missing answer blocks automatic progression for any duration; a spoken answer waits for completion',()=>{
  const {sim}=setup();let advanced=0;
  sim._ready=true;sim._isPaused=false;sim._reducedMotion=true;sim._activeStage={kind:'await-answer',actor:'WITNESS_DEFENSE',duration:0};
  sim._stageElapsed=999999;sim._speechDone=true;sim._awaiting=true;sim._runStage=()=>advanced++;
  sim._updateStageMotion();assert.equal(advanced,0);
  sim._activeStage={kind:'answer',actor:'WITNESS_DEFENSE',duration:0};sim._awaiting=false;sim._speechDone=false;
  sim._updateStageMotion();assert.equal(advanced,0);
  sim._speechDone=true;sim._updateStageMotion();assert.equal(advanced,1);
});

test('no further questions bypasses cross-examination while both lawyers remain at their desks',()=>{
  const {sim,room,director}=setup(),c=room.layout('DISTRICT');sim._timeline=director.plan(script,c,'en');
  const index=sim._timeline.findIndex(s=>s.kind==='choice');sim._activeStage=sim._timeline[index];sim._timelineIndex=index;sim._runStage=()=>{};
  sim.resolveFollowUp(false);
  const target=sim._timeline[sim._timelineIndex];assert.equal(target.cue,'release');
  for(const key of ['DEFENSE','PROSECUTION'])assert.deepEqual(json(target.positions[key]),Object.values(c.actors[key]));
});

test('caption answer completion works after pausing without calling a stale speech callback',()=>{
  const {sim}=setup();let staleCalled=false;
  sim._isPlaying=true;sim._isPaused=true;sim._awaiting=true;sim._speechDone=false;
  sim._captionCompletion=()=>{staleCalled=true;};sim.completeCaptionAnswer();
  assert.equal(sim._isPaused,false);assert.equal(sim._awaiting,false);assert.equal(sim._speechDone,true);assert.equal(staleCalled,false);
});

test('duplicate skin-proxy joints do not compound head and limb movement',()=>{
  const {sim}=setup();
  const neck={name:'mixamorigNeck',isBone:true,userData:{},parent:null};
  const head={name:'mixamorigHead_8',isBone:true,userData:{originalName:'mixamorig:Head'},parent:neck};
  const proxy={name:'mixamorigHead_7',isBone:true,userData:{originalName:'mixamorig:Head'},parent:head};
  assert.equal(sim._isPrimaryJoint(head),true);assert.equal(sim._isPrimaryJoint(proxy),false);
  const arm={name:'mixamorigLeftArm',isBone:true,userData:{},parent:neck};
  const armProxy={name:'mixamorigLeftArm_1',isBone:true,userData:{},parent:arm};
  assert.equal(sim._isPrimaryJoint(arm),true);assert.equal(sim._isPrimaryJoint(armProxy),false);
});

const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const elements=new Map(),recognitions=[],observers=[],windowEvents=new Map(),documentEvents=new Map(),warnings=[];let owner='one',thread='case-one';
 class Element {
  constructor(id,value=''){this.id=id;this.value=value;this.maxLength=60000;this.selectionStart=this.selectionEnd=value.length;this.isConnected=true;this.listeners=new Map();this.attributes=new Map();this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};this.children=[];this.textContent='';}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  dispatchEvent(event){event.target=this;for(const fn of this.listeners.get(event.type)||[])fn(event);}
  setAttribute(name,value){this.attributes.set(name,value);}
  appendChild(el){this.children.push(el);elements.set(el.id,el);}
 }
 class Recognition {constructor(){recognitions.push(this);}start(){this.started=true;}abort(){this.aborted=true;this.onend?.();}}
 class Observer {constructor(fn){this.callback=fn;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}}
 const input=new Element('chat-input','Existing text');elements.set(input.id,input);
 for(const id of ['voice-mic-chat-input','voice-status-chat-input','voice-language-chat-input','app'])elements.set(id,new Element(id,id.startsWith('voice-language')?'hi':''));
 const context=vm.createContext({console,Map,Set,Event:class{constructor(type){this.type=type;}},MutationObserver:Observer,
  AuthManager:{getSession:()=>({id:owner})},AssistantThreads:{active:()=>({id:thread})},Utils:{showToast:message=>warnings.push(message)},
  window:{SpeechRecognition:Recognition,speechSynthesis:{cancel(){}},addEventListener:(name,fn)=>windowEvents.set(name,fn)},
  document:{getElementById:id=>elements.get(id)||null,createElement:()=>new Element(''),body:new Element('body'),addEventListener:(name,fn)=>documentEvents.set(name,fn)}});
 vm.runInContext(fs.readFileSync('frontend/shared/js/voice_input.js','utf8')+'\nthis.voice=VoiceInput;',context);
 const result=(r,...texts)=>r.onresult({resultIndex:Math.max(0,texts.length-1),results:texts.map(text=>Object.assign([{transcript:text}],{isFinal:true}))});
 return {voice:context.voice,context,elements,input,recognitions,observers,windowEvents,documentEvents,warnings,Element,result,owner:v=>owner=v,thread:v=>thread=v};
}

test('voice typing preserves existing text and earlier final results without duplicating interim updates',()=>{
 const f=fixture(),saved=[];f.input.addEventListener('input',()=>saved.push(f.input.value));
 f.voice.start('chat-input');const r=f.recognitions[0];assert.equal(r.lang,'hi-IN');r.onstart();
 f.result(r,'पहली बात','दूसरी');assert.equal(f.input.value,'Existing text पहली बात दूसरी');
 f.result(r,'पहली बात','दूसरी बात');assert.equal(f.input.value,'Existing text पहली बात दूसरी बात');
 f.result(r,'पहली बात','दूसरी बात');assert.equal(f.input.value,'Existing text पहली बात दूसरी बात');
 assert.equal(saved.length,3);assert.ok(f.voice.current);assert.equal(f.elements.get('voice-mic-chat-input').attributes.get('aria-pressed'),'true');
});

test('the selected speech language is used and text is inserted at the selected position',()=>{
 const f=fixture();f.elements.get('voice-language-chat-input').value='en';f.input.value='before OLD after';f.input.selectionStart=7;f.input.selectionEnd=10;
 f.voice.start('chat-input');const r=f.recognitions[0];assert.equal(r.lang,'en-IN');f.result(r,'new words');assert.equal(f.input.value,'before new words after');
});

test('Stop, navigation and submitting stop recording and late results cannot change the input',()=>{
 for(const stop of ['button','navigation','submit']){
  const f=fixture();f.voice.start('chat-input');const r=f.recognitions[0];f.result(r,'kept words');const text=f.input.value;
  if(stop==='button')f.voice.toggle('chat-input');else if(stop==='navigation')f.windowEvents.get('hashchange')();else f.documentEvents.get('submit')();
  assert.equal(f.voice.current,null);assert.equal(r.aborted,true);f.result(r,'late result');assert.equal(f.input.value,text);
  assert.equal(f.elements.get('voice-mic-chat-input').attributes.get('aria-pressed'),'false');
 }
});

test('a new chat, account or replacement court-stage input cannot receive an old transcript',()=>{
 for(const change of ['chat','account','stage']){
  const f=fixture();f.voice.start('chat-input');const r=f.recognitions[0];
  if(change==='chat')f.thread('case-two');else if(change==='account')f.owner('two');else{f.input.isConnected=false;f.elements.set('chat-input',new f.Element('chat-input','New stage draft'));}
  f.result(r,'must not arrive');assert.equal(f.voice.current,null);assert.equal(f.input.value,'Existing text');
  if(change==='stage')assert.equal(f.elements.get('chat-input').value,'New stage draft');
 }
});

test('manual editing is kept and stops dictation instead of overwriting the edit',()=>{
 const f=fixture();f.voice.start('chat-input');const r=f.recognitions[0];f.input.value='Manually corrected';f.input.dispatchEvent({type:'input'});f.result(r,'outdated words');
 assert.equal(f.input.value,'Manually corrected');assert.equal(f.voice.current,null);
});

test('text limits preserve existing content and stop recording without submitting',()=>{
 const f=fixture();f.input.value='before OLD after';f.input.selectionStart=7;f.input.selectionEnd=10;f.input.maxLength=18;
 f.voice.start('chat-input');f.result(f.recognitions[0],'abcdefghij');assert.equal(f.input.value,'before abcde after');assert.equal(f.voice.current,null);assert.match(f.warnings.at(-1),/limit/);
});

test('permission, device, network and unsupported-browser failures leave editable text intact',()=>{
 for(const error of ['not-allowed','audio-capture','network','no-speech','language-not-supported']){
  const f=fixture();f.voice.start('chat-input');f.recognitions[0].onerror({error});assert.equal(f.voice.current,null);assert.equal(f.input.value,'Existing text');assert.equal(f.warnings.length,1);
 }
 const f=fixture();f.context.window.SpeechRecognition=undefined;f.voice.start('chat-input');assert.match(f.warnings[0],/unavailable/);assert.equal(f.input.value,'Existing text');
});

test('old permission callbacks and observers cannot stop a newer recording',()=>{
 const f=fixture();f.voice.start('chat-input');const old=f.recognitions[0],observer=f.observers[0];f.voice.stop();f.voice.start('chat-input');const active=f.voice.current;
 old.onstart();observer.callback();assert.equal(f.voice.current,active);assert.equal(old.aborted,true);assert.equal(f.recognitions[1].aborted,undefined);
});

test('the existing user-chat mic keeps its language selector and attachment preview',()=>{
 const f=fixture();f.elements.delete('voice-status-chat-input');const parent=new f.Element('chat-status-container');parent.children.push({id:'chat-attachment-bar'});f.elements.set(parent.id,parent);
 const button=new f.Element('chat-mic-btn');f.elements.set(button.id,button);f.elements.set('chat-lang-select',new f.Element('chat-lang-select','en'));
 f.voice.toggle('chat-input',{buttonId:'chat-mic-btn',languageId:'chat-lang-select',statusContainerId:'chat-status-container'});
 assert.equal(f.recognitions[0].lang,'en-IN');assert.equal(parent.children[0].id,'chat-attachment-bar');assert.equal(parent.children.length,2);assert.equal(button.attributes.get('aria-pressed'),'true');
});

test('rendered mic controls never submit a form and have accessible start/stop status',()=>{
 const {voice}=fixture(),html=voice.controls('v3-witness-input','en');assert.match(html,/type="button"/);assert.match(html,/aria-label="Start voice typing"/);assert.match(html,/role="status"/);assert.match(html,/<option value="en" selected/);assert.equal(voice.controls("bad'id"),'');
});

test('lawyer research, every rehearsal stage and hearing outcome fields render working mic controls',()=>{
 const f=fixture(),thread={id:'case-one',title:'Synthetic case',messages:[],courtSessions:{s1:{id:'s1',title:'Synthetic case',record:{facts:'Synthetic facts',research:'Synthetic brief'},stage:'bail',side:'defense',transcript:[]}}};
 f.context.Utils.escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 f.context.Components=f.context.UserComponents={AppLayout:html=>html};
 Object.assign(f.context.AssistantThreads,{active:()=>thread,list:()=>[thread],owner:()=> 'one',getForCourt:()=>thread,ensure:()=>({}),savedCourts:()=>[]});
 for(const file of ['frontend/lawyer/js/advocate_chat.js','frontend/lawyer/js/advocate_rehearsal.js','frontend/lawyer/js/court_page.js','frontend/user/js/court_page.js'])vm.runInContext(fs.readFileSync(file,'utf8'),f.context);
 assert.match(vm.runInContext('AdvocateChatBot.render()',f.context),/id="voice-mic-chat-input"/);
 vm.runInContext('AdvocateRehearsal.context={owner:"one",threadId:"case-one",sessionId:"s1"}',f.context);
 for(const stage of ['bail','charge','cross','final']){thread.courtSessions.s1.stage=stage;assert.match(vm.runInContext('AdvocateRehearsal.render()',f.context),/id="voice-mic-adv-submission"/);}
 for(const controller of ['UserCourtPage','AdvocateCourtPage']){
  const html=vm.runInContext(controller+'.renderPostHearing()',f.context);
  assert.match(html,/id="voice-mic-post-hearing-notes"/);assert.match(html,/id="voice-mic-post-hearing-purpose"/);
 }
});

test('user witness answers, cross questions and rephrasing all render mic controls in their current input stage',()=>{
 const f=fixture(),panel=new f.Element('v3-interaction');f.elements.set(panel.id,panel);
 f.context.Utils.escapeHtml=String;
 f.context.document.querySelector=()=>null;
 vm.runInContext(fs.readFileSync('frontend/user/js/court_simulator.js','utf8'),f.context);
 vm.runInContext('VirtualCourtSimulator._interactionWords=()=>({answerLabel:"Answer",questionLabel:"Question",submit:"Submit",ask:"Ask",object:"Object",done:"Done"})',f.context);
 for(const kind of ['await-answer','choice','edit-question']){
  vm.runInContext('VirtualCourtSimulator._renderInteraction({kind:"'+kind+'",answerKey:"answer",questionKey:"question",text:"Synthetic question"})',f.context);
  assert.equal(panel.hidden,false);assert.ok(panel.innerHTML.includes('voice-mic-'+(kind==='await-answer'?'v3-witness-input':'v3-question-input')));
 }
});

test('the existing user chat button delegates to the shared controller with its original language selection',()=>{
 const f=fixture();f.elements.set('chat-mic-btn',new f.Element('chat-mic-btn'));f.elements.set('chat-lang-select',new f.Element('chat-lang-select','en'));
 vm.runInContext(fs.readFileSync('frontend/user/js/chat_bot.js','utf8'),f.context);
 vm.runInContext('UserChatBot.toggleVoiceRecording()',f.context);assert.equal(f.recognitions[0].lang,'en-IN');
 vm.runInContext('UserChatBot.stopVoiceRecording()',f.context);assert.equal(f.voice.current,null);
});

const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const local=new Map(),elements=new Map();let serial=0,owner='lawyer-one';
 const context=vm.createContext({console,Map,Set,Intl,Date,JSON,AbortSignal,Blob,URL,crypto:{randomUUID:()=>String(++serial)},setTimeout:()=>1,clearTimeout(){},confirm:()=>true,
  localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)},
  AuthManager:{getSession:()=>({id:owner,role:'lawyer'}),getApiUrl:p=>p},
  document:{getElementById:id=>elements.get(id)||null},window:{addEventListener(){},removeEventListener(){},dispatchEvent(){}},Event:class{},
  Utils:{escapeHtml:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),showToast(){}},
  Components:{AppLayout:s=>s},Router:{navigate(){}},fetch:async()=>({ok:true,json:async()=>({threads:[]})})});
 ['frontend/shared/js/assistant_threads.js','frontend/lawyer/js/advocate_chat.js','frontend/lawyer/js/advocate_storage.js','frontend/lawyer/js/advocate_rehearsal.js'].forEach(f=>vm.runInContext(fs.readFileSync(f,'utf8'),context,{filename:f}));
 return {context,local,elements,run:code=>vm.runInContext(code,context),setOwner:v=>owner=v};
}
function popupFixture(){
 const f=fixture(),classes=new Set(['adv-workspace','adv-conversations-hidden']),attributes=new Map(),styles=new Map();
 const popup={open:false,showModal(){this.open=true},close(){this.open=false},style:{setProperty:(name,value)=>styles.set(name,value)},getBoundingClientRect:()=>({left:221,right:541,top:9,bottom:891})};
 const layout={getBoundingClientRect:()=>({left:220,top:8,height:884}),classList:{toggle(name,force){const add=force===undefined?!classes.has(name):force;add?classes.add(name):classes.delete(name);return add;}}};
 f.context.document.querySelector=selector=>selector==='.adv-workspace'?layout:null;
 Object.assign(f.context.window,{innerWidth:1440,innerHeight:900});
 f.elements.set('adv-conversations-dialog',popup);
 f.elements.set('adv-conversations-toggle',{setAttribute:(name,value)=>attributes.set(name,value)});
 return {...f,popup,classes,attributes,styles};
}
function historyFixture(){
 const f=fixture();
 for(const id of ['chat-messages','adv-sidebar','adv-files'])f.elements.set(id,{innerHTML:'',scrollTop:0,insertAdjacentHTML(position,html){this.innerHTML+=html;}});
 f.elements.set('chat-send-btn',{disabled:false});
 f.elements.set('chat-input',{value:'',focus(){}});
 return f;
}
test('actual lawyer HTML loads its own chat and rehearsal, without shared citizen controllers',()=>{
 const html=fs.readFileSync('frontend/lawyer/index.html','utf8');
 for(const name of ['advocate_chat','advocate_storage','advocate_rehearsal'])assert.ok(html.includes(name+'.js'));
 assert.doesNotMatch(html,/src="[^\"]*(?:assistant_chat|live_court|court_simulator|chat_bot)\.js/);
 const user=fs.readFileSync('frontend/user/index.html','utf8');assert.ok(user.includes('assistant_chat.js'));assert.ok(user.includes('live_court.js'));
});
test('research opens full width and Chats toggles a dialog without changing the case', () => {
 const f=popupFixture(),html=f.run('AdvocateChatBot.render()');
 assert.match(html, /class="adv-workspace adv-conversations-hidden"/);
 assert.match(html, /id="adv-conversations-toggle"[^>]*aria-expanded="false"/);
 assert.match(html, /<dialog[^>]*id="adv-conversations-dialog"/);
 assert.match(html, /aria-label="Close chats"/);
 const original=f.run('AssistantThreads.active().id');
 for(const expanded of ['true','false','true']){
  f.run('AdvocateChatBot.toggleConversations()');
  assert.equal(f.attributes.get('aria-expanded'),expanded);
  assert.equal(f.popup.open,expanded==='true');
  assert.equal(f.classes.has('adv-conversations-hidden'),expanded==='false');
  assert.equal(f.run('AssistantThreads.active().id'),original);
 }
 assert.equal(f.styles.get('--adv-popup-left'),'221px');
 f.context.window.innerWidth=480;
 f.run('AdvocateChatBot.positionConversations()');
 assert.equal(f.styles.get('--adv-popup-width'),'251px');
});

test('Close, Escape and outside clicks dismiss history while clicks inside keep it open', () => {
 const f=popupFixture();
 f.run('AdvocateChatBot.toggleConversations(false);AdvocateChatBot.toggleConversations(true)');
 assert.equal(f.popup.open,false);assert.equal(f.attributes.get('aria-expanded'),'false');
 f.run('AdvocateChatBot.toggleConversations(false)');
 f.popup.close(); // Native Escape closes the dialog and dispatches its close event.
 f.run('AdvocateChatBot.conversationsClosed()');
 assert.equal(f.attributes.get('aria-expanded'),'false');
 f.run('AdvocateChatBot.toggleConversations(false);AdvocateChatBot.dismissConversations({target:document.getElementById("adv-conversations-dialog"),clientX:300,clientY:100})');
 assert.equal(f.popup.open,true);
 f.run('AdvocateChatBot.dismissConversations({target:document.getElementById("adv-conversations-dialog"),clientX:800,clientY:100})');
 assert.equal(f.popup.open,false);
});

test('the main New chat action closes the popup, clears the draft and preserves the old conversation', () => {
 const f=popupFixture();let focused=0;
 f.elements.set('chat-input',{value:'Unsent draft',focus(){focused++}});
 f.run('this.old=AssistantThreads.create().id;AssistantThreads.append(old,{id:"saved",sender:"user",text:"Earlier case facts"});AdvocateChatBot.toggleConversations(false)');
 assert.match(f.run('AdvocateChatBot.render()'),/id="adv-new-chat" onclick="AdvocateChatBot.startNewChat\(\)"/);
 f.run('AdvocateChatBot.startNewChat()');
 assert.equal(f.run('AssistantThreads.list().length'),2);
 assert.equal(f.run('AssistantThreads.get(old).messages[0].text'),'Earlier case facts');
 assert.equal(f.run('AssistantThreads.active().messages.length'),0);
 assert.equal(f.run('AssistantThreads.active().id===old'),false);
 assert.equal(f.elements.get('chat-input').value,'');assert.equal(focused,1);assert.equal(f.popup.open,false);
 f.run('AdvocateChatBot.toggleConversations(false);AdvocateChatBot.selectConversation(old)');
 assert.equal(f.run('AssistantThreads.active().id===old'),true);assert.equal(f.popup.open,false);
});

test('a preparation-only recovery is labelled as pending legal verification', () => {
 const f=fixture();
 const html=f.run("AdvocateChatBot._renderMessage({id:'limited',sender:'ai',text:'Saved preparation tasks',validation:{mode:'preparation_only',reviewed:false}})");
 assert.match(html,/LEGAL VERIFICATION PENDING/);
 assert.doesNotMatch(html,/RESPONSE UNAVAILABLE|verified legal opinion/i);
 assert.match(html,/Deepen \/ recheck/);
});

test('empty chats cannot hide saved message history, drafts or rehearsals',()=>{
 const f=fixture();
 f.run('this.saved=AssistantThreads.create().id;AssistantThreads.append(saved,{id:"u",sender:"user",text:"Saved case"});this.empty=[];for(let i=0;i<8;i++)empty.push(AssistantThreads.create().id);this.draft=AssistantThreads.create().id;AssistantThreads.change(draft,t=>{t.title="Draft case";t.draft="Unsent facts"});this.court=AssistantThreads.create().id;AssistantThreads.change(court,t=>{t.title="Saved hearing";t.courtSessions.s1={id:"s1"}})');
 const html=f.run('AdvocateChatBot.sidebar()');
 assert.match(html,/Chat history \(3\)/);
 for(const title of ['Saved case','Draft case','Saved hearing'])assert.ok(html.includes(title));
 for(const id of f.run('empty'))assert.ok(!html.includes("selectConversation('"+id+"')"));
 assert.equal(f.run('AssistantThreads.list().length'),11);
});

test('repeated New chat reuses a blank conversation and keeps existing history intact',()=>{
 const f=historyFixture();
 f.run('this.saved=AssistantThreads.create().id;AssistantThreads.append(saved,{id:"u",sender:"user",text:"Keep this case"});this.blank=AssistantThreads.create().id;AdvocateChatBot.refresh()');
 for(let i=0;i<4;i++)f.run('AdvocateChatBot.startNewChat()');
 assert.equal(f.run('AssistantThreads.list().length'),2);
 assert.equal(f.run('AssistantThreads.active().id===blank'),true);
 f.run('AdvocateChatBot.selectConversation(saved);AdvocateChatBot.startNewChat()');
 assert.equal(f.run('AssistantThreads.list().length'),2);
 assert.equal(f.run('AssistantThreads.get(saved).messages[0].text'),'Keep this case');
 assert.equal(f.run('AssistantThreads.active().id===blank'),true);
});

test('messages and an unsent follow-up reopen from Chats after New chat and a page reload',()=>{
 const f=historyFixture();
 f.run('this.old=AssistantThreads.create().id;AssistantThreads.append(old,{id:"u1",sender:"user",text:"Earlier case facts"});AssistantThreads.append(old,{id:"a1",sender:"ai",text:"Earlier research answer"});AdvocateChatBot.refresh()');
 f.elements.get('chat-input').value='Follow-up still being written';
 f.run('AdvocateChatBot.saveDraft();AdvocateChatBot.startNewChat()');
 assert.equal(f.elements.get('chat-input').value,'');
 assert.equal(f.run('AssistantThreads.get(old).draft'),'Follow-up still being written');
 f.run('AdvocateChatBot.selectConversation(old)');
 assert.match(f.elements.get('chat-messages').innerHTML,/Earlier case facts/);
 assert.match(f.elements.get('chat-messages').innerHTML,/Earlier research answer/);
 assert.equal(f.elements.get('chat-input').value,'Follow-up still being written');
 f.run('AssistantThreads._data=null;AssistantThreads._owner=null;AdvocateChatBot._viewThread=null;AdvocateChatBot.refresh()');
 assert.equal(f.elements.get('chat-input').value,'Follow-up still being written');
 assert.match(f.elements.get('chat-messages').innerHTML,/Earlier research answer/);
});

test('an unsent first message is saved under its own title and safely rendered as a draft',()=>{
 const f=historyFixture();f.run('AssistantThreads.create();AdvocateChatBot.refresh()');
 f.elements.get('chat-input').value='Draft NDPS facts </textarea><script>bad()</script>';
 f.run('AdvocateChatBot.saveDraft()');
 assert.match(f.run('AdvocateChatBot.sidebar()'),/Draft NDPS facts/);
 assert.match(f.run('AdvocateChatBot.sidebar()'),/Draft · 0 messages/);
 const html=f.run('AdvocateChatBot.render()');
 assert.match(html,/&lt;\/textarea&gt;&lt;script&gt;/);assert.doesNotMatch(html,/<script>bad/);
});

test('opening history again loads newly saved server conversations and refreshes active messages',async()=>{
 const f=historyFixture(),id=f.run('AssistantThreads.create().id');
 f.run('AssistantThreads.active().dirty=false;AssistantThreads.active().revision=1');
 let loads=0;
 f.context.fetch=async()=>{loads++;return {ok:true,json:async()=>({threads:[{id,title:'Saved case',messages:[{id:'remote1',sender:'ai',text:'Saved response '+loads}],courtSessions:{},draft:'',revision:loads+1}]})}};
 await f.run('AdvocateChatBot.refreshHistory()');assert.match(f.elements.get('chat-messages').innerHTML,/Saved response 1/);
 await f.run('AdvocateChatBot.refreshHistory()');assert.match(f.elements.get('chat-messages').innerHTML,/Saved response 2/);
 assert.equal(loads,2);
});

test('sending a saved draft clears only that draft and retains the sent question and answer',async()=>{
 const f=historyFixture();f.run('AssistantThreads.create();AdvocateChatBot.refresh()');
 f.elements.get('chat-input').value='Synthetic NDPS question';f.run('AdvocateChatBot.saveDraft()');
 f.context.fetch=async()=>({ok:true,json:async()=>({ok:true,message:'Synthetic response'})});
 await f.run('AdvocateChatBot.sendMessage()');
 assert.equal(f.run('AssistantThreads.active().draft'),'');
 assert.equal(f.run('AssistantThreads.active().messages.length'),2);
 assert.equal(f.elements.get('chat-input').value,'');
});
test('lawyer history uses a separate local key and API namespace, and reload preserves it',()=>{
 const f=fixture();f.run('AssistantThreads.create();AssistantThreads.append(AssistantThreads.active().id,{id:"m1",sender:"user",text:"NDPS case"})');
 assert.ok(f.local.has('nyay_advocate_v2_lawyer-one'));assert.ok(!f.local.has('nyay_assistant_v1_lawyer-one'));
 assert.equal(f.run('AssistantThreads.url("/threads")'),'/api/advocate/assistant/threads');
 f.run('AssistantThreads._owner=null;AssistantThreads._data=null');assert.equal(f.run('AssistantThreads.active().messages[0].text'),'NDPS case');
 f.setOwner('other-lawyer');assert.equal(f.run('AssistantThreads.list().length'),0);
});
test('follow-up transport carries earlier document text and all prior facts, and never calls citizen AI',async()=>{
 const f=fixture();f.run('AssistantThreads.create();AssistantThreads.append(AssistantThreads.active().id,{id:"m1",sender:"user",text:"NDPS bag seizure",caseContext:"FSL text from earlier upload"})');
 f.elements.set('chat-input',{value:'What could the opposition argue?'});let body,url;
 f.context.fetch=async(u,o)=>{url=u;body=JSON.parse(o.body);return {ok:true,json:async()=>({ok:true,message:'Conditional preparation',sources:[]})}};
 await f.run('AdvocateChatBot.sendMessage()');
 assert.equal(url,'/api/advocate/chat');assert.equal(body.chatHistory[0].caseContext,'FSL text from earlier upload');
 assert.equal(body.chatHistory.length,1);assert.equal(f.run('AssistantThreads.active().messages.length'),3);
});
test('late research response stays with the original case and cannot cross accounts',async()=>{
 const f=fixture();f.run('this.first=AssistantThreads.create().id');f.elements.set('chat-input',{value:'NDPS case'});let finish;
 f.context.fetch=()=>new Promise(r=>finish=r);const pending=f.run('AdvocateChatBot.sendMessage()');f.run('AssistantThreads.create()');
 finish({ok:true,json:async()=>({ok:true,message:'Original case answer',sources:[]})});await pending;
 assert.equal(f.run('AssistantThreads.get(first).messages.at(-1).text'),'Original case answer');assert.equal(f.run('AssistantThreads.active().messages.length'),0);
 f.elements.get('chat-input').value='Another case';const stale=f.run('AdvocateChatBot.sendMessage()');f.setOwner('other-lawyer');f.run('AssistantThreads.ensure()');
 finish({ok:true,json:async()=>({ok:true,message:'Must not cross account'})});await stale;assert.equal(f.run('AssistantThreads.list().length'),0);
});
test('rehearsal takes only the facts and papers through the selected answer and retains its snapshot on deletion',async()=>{
 const f=fixture();f.run(`AssistantThreads.create();AssistantThreads.append(AssistantThreads.active().id,{id:'u1',sender:'user',text:'NDPS facts',caseContext:'Seizure memo'});AssistantThreads.append(AssistantThreads.active().id,{id:'a1',sender:'ai',text:'Research analysis'});AssistantThreads.append(AssistantThreads.active().id,{id:'u2',sender:'user',text:'Later changed fact'});AdvocateRehearsal.launch('a1');`);
 const record=f.run('AdvocateRehearsal.session().record');assert.match(record.facts,/Seizure memo/);assert.doesNotMatch(record.facts,/Later changed/);assert.equal(record.research,'Research analysis');
 f.run('AssistantThreads.sync=async()=>{}');await f.run('AssistantThreads.remove(AssistantThreads.active().id)');assert.match(f.run('AdvocateRehearsal.session().record.facts'),/NDPS facts/);
});
test('failed rehearsal retries the saved submission without creating duplicate counsel turns',async()=>{
 const f=fixture();f.run(`AssistantThreads.create();AssistantThreads.append(AssistantThreads.active().id,{id:'u1',sender:'user',text:'NDPS facts'});AssistantThreads.append(AssistantThreads.active().id,{id:'a1',sender:'ai',text:'Analysis'});AdvocateRehearsal.launch('a1');`);
 f.elements.set('adv-submission',{value:'The bag ownership is disputed.'});let bodies=[];
 f.context.fetch=async(u,o)=>{bodies.push(JSON.parse(o.body));return {ok:false,json:async()=>({ok:false,error:'Temporary failure'})}};
 await f.run('AdvocateRehearsal.submit()');assert.equal(f.run('AdvocateRehearsal.session().transcript.length'),1);
 f.context.fetch=async(u,o)=>{bodies.push(JSON.parse(o.body));return {ok:true,json:async()=>({ok:true,message:'Simulated response',sections:[],sources:[]})}};
 await f.run('AdvocateRehearsal.submit(true)');assert.equal(f.run('AdvocateRehearsal.session().transcript.length'),2);
 assert.equal(bodies[1].submission,'The bag ownership is disputed.');assert.equal(bodies[1].transcript.length,0);
});
test('generated content and source URLs are escaped and arbitrary links are not trusted',()=>{
 const f=fixture();assert.equal(f.run('AdvocateChatBot.markdown("<script>bad()</script>")').includes('<script>'),false);
 const html=f.run('AdvocateChatBot.sources([{id:"S1",title:"<img onerror=x>",url:"javascript:bad()",text:"<script>"}])');assert.doesNotMatch(html,/href=|<img|<script>/);
});

test('lawyer chat ignores a saved language override and document-only requests carry no synthetic English input',async()=>{
 const f=fixture();f.run("AssistantThreads.create();AssistantThreads.change(AssistantThreads.active().id,t=>{t.language='gu'})");
 f.elements.set('chat-input',{value:'Mujhe agla step batao'});const bodies=[];
 f.context.fetch=async(u,o)=>{bodies.push(JSON.parse(o.body));return {ok:true,json:async()=>({ok:true,message:'Response',sources:[]})}};
 await f.run('AdvocateChatBot.sendMessage()');assert.equal(bodies[0].language,'auto');assert.equal(bodies[0].message,'Mujhe agla step batao');
 f.run("AdvocateChatBot.files=[{id:'file1',threadId:AssistantThreads.active().id,name:'case.txt',text:'हिंदी NDPS दस्तावेज',characters:20}]");
 await f.run('AdvocateChatBot.sendMessage()');assert.equal(bodies[1].message,'');assert.match(bodies[1].caseContext,/हिंदी/);
 assert.equal(f.run('AssistantThreads.active().messages.at(-2).documentOnly'),true);
 assert.doesNotMatch(f.run('AdvocateChatBot.render()'),/chat-lang-select/);
});

test('lawyer rehearsal preserves the human language sample and ignores stale session language',async()=>{
 const f=fixture();f.run("AssistantThreads.create();AssistantThreads.append(AssistantThreads.active().id,{id:'u',sender:'user',text:'Mujhe case samjhao'});AssistantThreads.append(AssistantThreads.active().id,{id:'a',sender:'ai',text:'English research'});AdvocateRehearsal.launch('a');AdvocateRehearsal.update(s=>{s.language='gu'})");
 assert.equal(f.run('AdvocateRehearsal.session().record.languageSample'),'Mujhe case samjhao');
 f.elements.set('adv-submission',{value:'What evidence supports this objection?'});let body;
 f.context.fetch=async(u,o)=>{body=JSON.parse(o.body);return {ok:true,json:async()=>({ok:true,message:'Response',sections:[],sources:[]})}};
 await f.run('AdvocateRehearsal.submit()');assert.equal(body.language,'auto');assert.equal(body.submission,'What evidence supports this objection?');
});

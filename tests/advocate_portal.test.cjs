const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const local=new Map(),elements=new Map();let serial=0,owner='lawyer-one';
 const context=vm.createContext({console,Map,Set,Intl,Date,JSON,AbortSignal,Blob,URL,crypto:{randomUUID:()=>String(++serial)},setTimeout:()=>1,clearTimeout(){},confirm:()=>true,
  localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)},
  AuthManager:{getSession:()=>({id:owner,role:'lawyer'}),getApiUrl:p=>p},
  document:{getElementById:id=>elements.get(id)||null},window:{addEventListener(){},dispatchEvent(){}},Event:class{},
  Utils:{escapeHtml:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),showToast(){}},
  Components:{AppLayout:s=>s},Router:{navigate(){}},fetch:async()=>({ok:true,json:async()=>({threads:[]})})});
 ['frontend/shared/js/assistant_threads.js','frontend/lawyer/js/advocate_chat.js','frontend/lawyer/js/advocate_storage.js','frontend/lawyer/js/advocate_rehearsal.js'].forEach(f=>vm.runInContext(fs.readFileSync(f,'utf8'),context,{filename:f}));
 return {context,local,elements,run:code=>vm.runInContext(code,context),setOwner:v=>owner=v};
}
test('actual lawyer HTML loads its own chat and rehearsal, without shared citizen controllers',()=>{
 const html=fs.readFileSync('frontend/lawyer/index.html','utf8');
 for(const name of ['advocate_chat','advocate_storage','advocate_rehearsal'])assert.ok(html.includes(name+'.js'));
 assert.doesNotMatch(html,/src="[^\"]*(?:assistant_chat|live_court|court_simulator|chat_bot)\.js/);
 const user=fs.readFileSync('frontend/user/index.html','utf8');assert.ok(user.includes('assistant_chat.js'));assert.ok(user.includes('live_court.js'));
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

const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
function store(){
 let owner='alice',serial=0;const local=new Map(),requests=[];
 const ctx=vm.createContext({console,AbortController,crypto:{randomUUID:()=>String(++serial)},localStorage:{getItem:k=>local.get(k),setItem:(k,v)=>local.set(k,v)},
   AuthManager:{getSession:()=>owner?{id:owner}:null,getApiUrl:p=>p},setTimeout:()=>0,clearTimeout(){},Event:function(){},window:{dispatchEvent(){}},
   fetch:async(url,options)=>{requests.push({url,options});return {ok:true,status:200,json:async()=>({thread:{revision:JSON.parse(options.body).expectedRevision+1}})};}});
 vm.runInContext(fs.readFileSync('frontend/shared/js/assistant_threads.js','utf8')+'\nthis.store=AssistantThreads;',ctx);
 return {s:ctx.store,ctx,local,requests,owner:value=>{owner=value;}};
}
test('New Chat retains all prior messages and court sessions after reload',()=>{
 const {s}=store();const first=s.create();s.append(first.id,{id:'m1',sender:'user',text:'first facts'});s.change(first.id,t=>{t.courtSessions.court1={transcript:[{text:'answer'}],rooms:{DISTRICT:{timeline:10}}};});
 const second=s.create();s.append(second.id,{id:'m2',sender:'user',text:'separate case'});s._data=null;s.ensure();
 assert.equal(s.list().length,2);assert.equal(s.get(first.id).messages[0].text,'first facts');assert.equal(s.get(first.id).courtSessions.court1.rooms.DISTRICT.timeline,10);assert.equal(s.active().id,second.id);
});

test('court API carries retry information and allows enough time for generation and review',async()=>{
 const {s,ctx}=store();const timeouts=[];
 ctx.setTimeout=(_,ms)=>{timeouts.push(ms);return 0;};
 ctx.fetch=async()=>({ok:false,json:async()=>({ok:false,error:'Retry in 6 seconds.',retry_after:6,retryable:true})});
 try{await s.api('court',{summary:'synthetic'});assert.fail('Expected provider error');}
 catch(error){assert.equal(error.retryAfter,6);assert.equal(error.retryable,true);assert.equal(error.message,'Retry in 6 seconds.');}
 assert.equal(timeouts.at(-1),75000);
});

test('cancelling a courtroom request aborts fetch and remains distinct from a timeout',async()=>{
 const {s,ctx}=store();let signal;
 ctx.fetch=(_,options)=>new Promise((resolve,reject)=>{
   signal=options.signal;signal.addEventListener('abort',()=>reject(Object.assign(new Error('cancelled'),{name:'AbortError'})),{once:true});
 });
 const controller=new AbortController(),pending=s.api('court',{summary:'synthetic'},{signal:controller.signal});
 controller.abort();await assert.rejects(pending,error=>error.name==='AbortError');assert.equal(signal.aborted,true);
});
test('accounts cannot see or modify each other’s cached threads',()=>{
 const {s,owner}=store();const a=s.create();s.append(a.id,{id:'m1',sender:'user',text:'Alice only'});owner('bob');assert.equal(s.list().length,0);const b=s.create();assert.equal(s.get(a.id),undefined);owner('alice');assert.equal(s.get(b.id),undefined);assert.equal(s.get(a.id).messages[0].text,'Alice only');
});
test('a response save uses a captured thread ID, not whichever chat is active later',()=>{
 const {s}=store(),a=s.create(),b=s.create();s.append(a.id,{id:'reply',sender:'ai',text:'late answer'});assert.equal(s.get(a.id).messages.length,1);assert.equal(s.get(b.id).messages.length,0);
});
test('MySQL sync carries account cookies and optimistic revision; newer local edits stay dirty',async()=>{
 const {s,requests,ctx}=store(),t=s.create();t.revision=2;let resolve;
 ctx.fetch=(url,options)=>{requests.push({url,options});return new Promise(r=>{resolve=r;});};
 const pending=s.sync(t.id);s.change(t.id,t=>{t.title='Newer edit';t.updatedAt='2099-01-01';});resolve({ok:true,status:200,json:async()=>({thread:{revision:3}})});await pending;
 assert.equal(t.revision,3);assert.equal(t.dirty,true);assert.equal(requests[0].options.credentials,'include');assert.equal(JSON.parse(requests[0].options.body).expectedRevision,2);
});
test('stale server revision is kept as a conflict instead of overwriting either copy',async()=>{
 const {s,ctx}=store(),t=s.create();ctx.fetch=async()=>({status:409,ok:false});await s.sync(t.id);assert.equal(t.conflict,true);assert.equal(t.dirty,true);
});
test('deleted chat stays tombstoned and does not remove other chats',async()=>{
 const {s}=store(),a=s.create(),b=s.create();await s.remove(a.id);assert.equal(s.get(a.id),undefined);assert.ok(s.get(b.id));assert.equal(s.ensure().threads.find(t=>t.id===a.id).deleted,true);
});
test('no signed-out durable conversations are created',()=>{const {s,owner}=store();owner(null);assert.throws(()=>s.create(),/Sign in/);});

test('deleting chat messages preserves court preparation and its exact progress across reload',async()=>{
 const {s}=store(),chat=s.create();s.append(chat.id,{id:'m1',sender:'user',text:'Delete this chat message'});
 s.change(chat.id,t=>{t.draft='An unsent follow-up';t.courtSessions.s1={id:'s1',title:'Saved preparation',summary:'Facts needed for the hearing',script:[{actor:'JUDGE',text:'Opening'}],transcript:[{text:'Witness answer'}],rooms:{HIGH:{timeline:12,elapsed:3}}};});
 await s.remove(chat.id);assert.equal(s.get(chat.id),undefined);assert.equal(s.getForCourt(chat.id).messages.length,0);
 assert.equal(s.getForCourt(chat.id).draft,'');
 s._data=null;s.ensure();assert.equal(s.savedCourts().length,1);assert.equal(s.savedCourts()[0].chatDeleted,true);
 assert.equal(s.getForCourt(chat.id).courtSessions.s1.rooms.HIGH.timeline,12);
 s.changeCourt(chat.id,t=>{t.courtSessions.s1.rooms.HIGH.timeline=13;});assert.equal(s.getForCourt(chat.id).courtSessions.s1.rooms.HIGH.timeline,13);
});
test('court preparation has its own deletion without removing other sessions or restoring deleted chat',async()=>{
 const {s}=store(),chat=s.create();s.change(chat.id,t=>{t.courtSessions={s1:{id:'s1'},s2:{id:'s2'}};});
 await s.remove(chat.id);await s.removeCourt(chat.id,'s1');assert.equal(s.savedCourts().length,1);assert.equal(s.savedCourts()[0].session.id,'s2');assert.equal(s.get(chat.id),undefined);
});

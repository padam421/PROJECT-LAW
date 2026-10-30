const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
for(const portal of ['user'])test(portal+' portal installs its chat/court integration and New Chat preserves the old thread',()=>{
 const values=new Map();let serial=0;
 const context=vm.createContext({console,Map,URL,Intl,AbortController,crypto:{randomUUID:()=>String(++serial)},setTimeout:()=>0,clearTimeout(){},cancelAnimationFrame(){},
   localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},
   AuthManager:{getSession:()=>({id:'qa_user',email:'qa@example.invalid'}),getApiUrl:p=>p},
   document:{getElementById:()=>null,removeEventListener(){},addEventListener(){}},window:{addEventListener(){},removeEventListener(){},dispatchEvent(){},speechSynthesis:{cancel(){}}},
   Utils:{escapeHtml:String},Router:{navigate(){}},UserComponents:{AppLayout:html=>html},Components:{AppLayout:html=>html}});
 if(portal==='user')vm.runInContext("const UserStore={_state:{conversations:[],userProfile:{id:'qa_user'}},get(k){return this._state[k]},set(k,v){this._state[k]=v}};",context);
 const files=[`frontend/${portal}/js/chat_bot.js`,'frontend/shared/js/indian_courtroom.js','frontend/shared/js/courtroom_director.js','frontend/user/js/court_simulator.js','frontend/shared/js/assistant_threads.js','frontend/shared/js/assistant_chat.js','frontend/shared/js/live_court.js'];
 files.forEach(file=>vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file}));
 const result=vm.runInContext(`(()=>{const t=AssistantThreads.create();AssistantThreads.append(t.id,{id:'m1',sender:'user',text:'Earlier case facts'});${portal==='user'?'UserChatBot':'AdvocateChatBot'}.startNewChat();return {count:AssistantThreads.list().length,old:AssistantThreads.get(t.id).messages[0].text,render:AssistantChat.markdown('#### A heading')};})()`,context);
 assert.equal(result.count,2);assert.equal(result.old,'Earlier case facts');assert.ok(result.render.includes('<h3>A heading</h3>'));
});

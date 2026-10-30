const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const calls=[],session={id:'s1',title:'<unsafe>',summary:'<script>private</script>',script:[{actor:'JUDGE',text:'Opening'}],rooms:{HIGH:{timeline:12}},transcript:[{text:'Answer'}]};
 const context=vm.createContext({AssistantThreads:{hydrate(){},savedCourts:()=>[{threadId:'chat1',chatDeleted:true,session}],getForCourt:()=>({courtSessions:{s1:session}}),owner:()=> 'alice',notify:m=>calls.push(['notice',m]),removeCourt:async(...args)=>calls.push(['delete',...args])},
 Utils:{escapeHtml:v=>v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')},
 LiveCourt:{context:null,detach(){calls.push(['detach']);this.context=null;},activate:s=>calls.push(['activate',s.id])},Router:{navigate:p=>calls.push(['navigate',p])},
 document:{getElementById:()=>null},window:{addEventListener(){}},confirm:()=>true});
 vm.runInContext(fs.readFileSync('frontend/shared/js/saved_court_sessions.js','utf8')+'\nthis.library=SavedCourtSessions;',context);
 return {context,calls,session,library:context.library};
}
test('Court Prep lists retained sessions and safely escapes the stored case brief',()=>{
 const {library}=setup(),html=library.render();assert.ok(html.includes('Chat deleted'));assert.ok(html.includes('&lt;unsafe&gt;'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('Resume preparation'));assert.ok(html.includes('Delete session'));
});
test('retained preparation resumes with its original account and session context',()=>{
 const {library,calls,context}=setup();library.resume('chat1','s1');assert.equal(context.LiveCourt.context.owner,'alice');assert.equal(context.LiveCourt.context.sessionId,'s1');assert.deepEqual(calls,[['detach'],['activate','s1'],['navigate','/court/simulate']]);
});
test('session deletion is independent and requires the user choice',async()=>{
 const {library,calls,context}=setup();context.confirm=()=>false;await library.remove('chat1','s1');assert.equal(calls.length,0);context.confirm=()=>true;await library.remove('chat1','s1');assert.deepEqual(calls,[['delete','chat1','s1']]);
});

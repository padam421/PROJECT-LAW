const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function setup(initial=[{lang:'hi-IN',name:'Hindi'},{lang:'en-US',name:'English'}]){
  let voices=initial,owner='a',serial=0;const timers=new Map(),events={},spoken=[],requests=[],audio=[],revoked=[],states=[],errors=[];let ends=0;
  const synth={getVoices:()=>voices,cancel(){},resume(){},addEventListener:(name,fn)=>events[name]=fn,removeEventListener:name=>delete events[name],speak:u=>spoken.push(u)};
  const ctx=vm.createContext({console,AbortController,Blob,URL:{createObjectURL:()=> 'blob:'+ ++serial,revokeObjectURL:u=>revoked.push(u)},
    setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
    window:{speechSynthesis:synth,addEventListener:(name,fn)=>events[name]=fn},
    AuthManager:{getSession:()=>({id:owner}),getApiUrl:p=>'http://localhost:3000'+p},
    SpeechSynthesisUtterance:function(text){this.text=text;},
    Audio:function(url){this.url=url;this.pause=()=>this.paused=true;this.load=()=>{};this.removeAttribute=()=>{};this.play=async()=>{this.onplaying?.();};audio.push(this);},
    fetch:async(url,options)=>{requests.push({url,options});return {ok:true,headers:{get:()=> 'audio/mpeg'},blob:async()=>new Blob(['audio'])};}
  });
  vm.runInContext(fs.readFileSync('frontend/user/js/chat_tts.js','utf8')+'\nthis.tts=NyaySetuTTS;',ctx);
  const callbacks={onState:(id,state)=>states.push([id,state]),onEnd:()=>ends++,onError:(id,error)=>errors.push(error),requestOnline:async()=>true};
  const tick=ms=>{for(const [id,t] of [...timers])if(t.ms===ms){timers.delete(id);t.fn();}};
  return {ctx,tts:ctx.tts,spoken,requests,audio,events,timers,states,errors,revoked,callbacks,tick,ends:()=>ends,setVoices:v=>voices=v,setOwner:v=>owner=v};
}
test('auto and regional language tags resolve to matching voices',()=>{
 const {tts}=setup();assert.equal(tts.language('नमस्ते','auto'),'hi');assert.equal(tts.language('Hello','en-IN'),'en');assert.equal(tts.language('Hello','auto'),'en');assert.equal(tts.language('नमस्कार','mr_IN'),'mr');assert.equal(tts.language('ଓଡ଼ିଆ','auto'),'or');assert.equal(tts.getBestVoice('ta-IN'),null);
});
test('long answers are bounded chunks without losing text and markdown is removed',()=>{
 const {tts}=setup();const input='word '.repeat(250)+'x'.repeat(400);const chunks=tts.splitIntoChunks(input);assert.ok(chunks.every(c=>c.length<=180));assert.equal(chunks.join('').replace(/\s/g,''),input.replace(/\s/g,''));
 assert.equal(tts.cleanTextForSpeech('## Title\n**Hello** [case](https://example.test) https://example.test\n```omit```'),'Title Hello case');
});
test('delayed browser voices start native speech instead of immediately refusing Hindi',async()=>{
 const s=setup([]);s.tts.speak('m','नमस्ते।','auto',s.callbacks);assert.equal(s.spoken.length,0);s.setVoices([{lang:'hi-IN'}]);s.events.voiceschanged();await flush();assert.equal(s.spoken.length,1);assert.equal(s.spoken[0].lang,'hi-IN');assert.equal(s.requests.length,0);s.tts.stop();assert.equal(s.timers.size,0);
});
test('native readout moves through chunks and ends exactly once',()=>{
 const s=setup();s.tts.speak('m','First sentence. Second sentence.','en-IN',s.callbacks);const one=s.spoken[0];one.onstart();assert.equal(s.states.at(-1)[1],'playing');one.onend();s.tick(60);assert.equal(s.spoken.length,2);s.spoken[1].onend();s.tick(60);assert.equal(s.tts.isSpeaking(),false);assert.equal(s.ends(),1);
});
test('Stop and message switching ignore stale speech callbacks',()=>{
 const s=setup();s.tts.speak('one','नमस्ते।','hi',s.callbacks);const old=s.spoken[0].onend;s.tts.speak('two','Hello.','en',s.callbacks);old();assert.equal(s.tts.getActiveMsgId(),'two');s.tts.speak('two','Hello.','en',s.callbacks);assert.equal(s.tts.isSpeaking(),false);assert.equal(s.ends(),2);assert.equal(s.requests.length,0);assert.equal(s.timers.size,0);
});
test('missing voice never sends answer text without online permission',async()=>{
 const s=setup([]);s.callbacks.requestOnline=async()=>false;s.tts.speak('m','नमस्ते।','hi',s.callbacks);s.tick(1200);await flush();assert.equal(s.requests.length,0);assert.equal(s.tts.isSpeaking(),false);
});
test('online readout uses authenticated POST and frees audio on Stop',async()=>{
 const s=setup([]);s.tts.speak('m','नमस्ते।','auto',s.callbacks);s.tick(1200);await flush();assert.equal(s.requests.length,1);const {url,options}=s.requests[0];assert.equal(url,'http://localhost:3000/api/ai/tts');assert.equal(options.method,'POST');assert.equal(options.credentials,'include');assert.equal(JSON.parse(options.body).language,'hi');assert.equal(s.audio.length,1);assert.equal(s.states.at(-1)[1],'playing');s.tts.stop();assert.equal(s.audio[0].paused,true);assert.equal(s.revoked.length,1);assert.equal(s.ends(),1);
});
test('late online permission and fetch completion cannot restart a stopped answer',async()=>{
 const s=setup([]);let permit;s.callbacks.requestOnline=()=>new Promise(r=>permit=r);s.tts.speak('m','नमस्ते','hi',s.callbacks);s.tick(1200);await flush();s.tts.stop();permit(true);await flush();assert.equal(s.requests.length,0);
 let resolve;s.ctx.fetch=()=>new Promise(r=>resolve=r);s.callbacks.requestOnline=async()=>true;s.tts.speak('n','नमस्ते','hi',s.callbacks);s.tick(1200);await flush();s.tts.stop();resolve({ok:true,headers:{get:()=> 'audio/mpeg'},blob:async()=>new Blob(['a'])});await flush();assert.equal(s.audio.length,0);
});
test('native failure falls back at most once, stream failure reports an error rather than looping',async()=>{
 const s=setup();s.ctx.fetch=async()=>{s.requests.push(1);throw Error('offline');};s.tts.speak('m','Hello.','en',s.callbacks);s.spoken[0].onerror({error:'synthesis-failed'});await flush();assert.equal(s.requests.length,1);assert.equal(s.spoken.length,1);assert.equal(s.errors.length,1);assert.equal(s.tts.isSpeaking(),false);assert.equal(s.ends(),1);
});
test('navigating away cancels waiting and active playback',()=>{
 const s=setup([]);s.tts.speak('m','नमस्ते','hi',s.callbacks);s.events.hashchange();assert.equal(s.tts.isSpeaking(),false);assert.equal(s.timers.size,0);assert.equal(s.events.voiceschanged,undefined);
});
test('account changes cancel pending playback before the next sentence',()=>{
 const s=setup();s.tts.speak('m','First. Second.','en',s.callbacks);s.setOwner('other-account');s.spoken[0].onend();assert.equal(s.tts.isSpeaking(),false);assert.equal(s.spoken.length,1);assert.equal(s.timers.size,0);
});
test('active chat Listen reads saved message via shared controller and updates button state',()=>{
 const seen=[],buttons=[],labels={textContent:''};let selected='first';
 const c={render:()=>'',_renderMessage:()=>'',_updateTTSButton:(id,state)=>buttons.push([id,state])};
 const ctx=vm.createContext({UserChatBot:c,Utils:{escapeHtml:String,showConfirm:async()=>false},UserStore:{get:()=>[]},document:{getElementById:id=>id==='tts-label-m'?labels:null},window:{addEventListener(){}},AssistantThreads:{active:()=>({messages:[{id:'m',text:'Saved Hindi answer',lang:'hi-IN'}]}),select:id=>selected=id,notify(){},create(){}},NyaySetuTTS:{speak:(...args)=>seen.push(args),stop:()=>seen.push('stop')}});
 vm.runInContext(fs.readFileSync('frontend/shared/js/assistant_chat.js','utf8'),ctx);c.toggleSpeak('m');assert.equal(seen[0][1],'Saved Hindi answer');assert.equal(seen[0][2],'hi-IN');seen[0][3].onState('m','loading');assert.match(labels.textContent,/Stop/);seen[0][3].onEnd('m');assert.equal(buttons.at(-1)[1],false);c.selectConversation('second');assert.equal(selected,'second');assert.equal(seen.at(-1),'stop');
});
test('speech proxy requires authentication, validates inputs and only returns no-store audio',async()=>{
 const source=fs.readFileSync('backend/src/routes/index.js','utf8');let handler,middleware;const calls=[];const auth=()=>{};
 const ctx=vm.createContext({router:{post:(route,guard,fn)=>{middleware=guard;handler=fn;}},authenticate:auth,AI_SERVICE_URL:'http://ai',AbortSignal,Buffer,fetch:async(url,options)=>{calls.push({url,options});return {ok:true,headers:{get:()=> 'audio/mpeg'},arrayBuffer:async()=>Buffer.from('mp3')};}});
 vm.runInContext(source.slice(source.indexOf("router.post('/ai/tts'"),source.indexOf("router.post('/ai/chat'")),ctx);assert.equal(middleware,auth);
 const response=()=>({headers:{},statusCode:200,set(k,v){this.headers[k]=v;return this;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;},type(v){this.contentType=v;return this;},send(v){this.body=v;return this;}});
 let res=response();await handler({body:{text:'x'.repeat(301),language:'hi'}},res);assert.equal(res.statusCode,400);assert.equal(calls.length,0);
 res=response();await handler({body:{text:'नमस्ते',language:'hi'}},res);assert.equal(res.headers['Cache-Control'],'no-store');assert.equal(res.contentType,'audio/mpeg');assert.equal(res.body.toString(),'mp3');assert.equal(calls[0].options.method,'POST');
 ctx.fetch=async()=>({ok:false});res=response();await handler({body:{text:'Hello',language:'en'}},res);assert.equal(res.statusCode,502);
});

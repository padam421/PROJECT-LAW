const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function fixture({demo=false}={}) {
  const storage=new Map(),requests=[],timers=[],dom={host:{innerHTML:'',style:{},querySelectorAll:()=>[],closest:()=>null},feedback:{scrollIntoView(){}},loading:{},retry:{}};
  let account={id:'test-advocate',role:'lawyer',registrationStage:'complete',barCouncil:'DL/QA123/2020',demoMode:demo};
  let documents=[],summary={lawyerStatus:demo?'demo_not_verified':'pending',pipeline:{stages:{barCouncil:{status:'pending'},identity:{status:'not_started'}}}};
  const api={listDocuments:async()=>documents,fetchVerificationSummary:async()=>summary,
    submitIdentityCheck:async()=>{summary.pipeline.stages.identity={status:demo?'demo_not_verified':'manual_verification_required',submittedAt:'test'};return summary.pipeline.stages.identity;},
    lookupBarCouncil:async()=>({status:'manual_review',message:'manual review'})};
  const context=vm.createContext({console,AbortController,
    setTimeout:(fn,delay)=>{timers.push({fn,delay});return timers.length;},clearTimeout(){},requestAnimationFrame:fn=>fn(),
    window:{location:{hash:'#/verification'}},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
    AuthManager:{getSession:()=>account,isLoggedIn:()=>!!account,currentLawyer:()=>account},
    ApiClient:api,Utils:{escapeHtml:String,showToast(){},showConfirm:async()=>true,validateBarNumber:()=>true,scrollToTop(){}},
    document:{getElementById:id=>({'app':dom.host,'verification-stage-content':dom.host,'verification-feedback':dom.feedback,'verification-loading':dom.loading,'verification-retry':dom.retry}[id]||null),querySelectorAll:()=>[]}
  });
  vm.runInContext(fs.readFileSync('frontend/shared/js/router.js','utf8')+'\nthis.router=Router;',context);
  vm.runInContext(fs.readFileSync('frontend/lawyer/js/verification_page.js','utf8')+'\nthis.verification=VerificationPage;',context);
  const page=context.verification;
  context.router.register('/verification',()=>page.render(),{onEnter:()=>page.onEnter(),onLeave:()=>page.onLeave()});
  context.router.currentRoute='/verification';
  // Rendering markup is real; these stand in only for browser DOM layout.
  page.refresh=()=>{requests.push('refresh');};
  return {context,page,api,timers,storage,requests,account:value=>{account=value;},docs:value=>{documents=value;},summary:value=>{summary=value;}};
}

test('route entry hydrates once without transitionPage/onEnter recursion',async()=>{
  const {context,page,timers}=fixture();
  page.render=()=>'<section>verification</section>';
  const render=context.router.transitionPage('/verification');
  assert.equal(timers[0].delay,120);timers.shift().fn();await render;
  const enter=timers.shift();assert.equal(enter.delay,50);await enter.fn();
  assert.equal(timers.length,0,'onEnter must not schedule another page transition');
  assert.equal(page._loading,false);
});

test('late verification hydration cannot affect a departed page or another account',async()=>{
  const {page,api,account}=fixture();let resolve;
  api.listDocuments=()=>new Promise(r=>{resolve=r;});
  const pending=page.onEnter();page.onLeave();account({id:'other',role:'lawyer'});resolve([{id:'old-private-doc'}]);await pending;
  assert.equal(page._docs.length,0);assert.equal(page._active,false);
});

test('failed saved-record request is visible and loading can be retried without a loop',async()=>{
  const {page,api,timers}=fixture();api.listDocuments=async()=>{throw Error('Server unavailable');};
  await page.onEnter();assert.equal(page._error,'Server unavailable');assert.equal(page._loading,false);assert.equal(timers.length,0);
  api.listDocuments=async()=>[];await page.onEnter();assert.equal(page._error,'');assert.equal(timers.length,0);
});

test('normal verification progress is gated by bar check, required uploads and server submission',()=>{
  const {page}=fixture();assert.equal(page.maximumStage(),1);
  page._barResult={status:'manual_review'};assert.equal(page.maximumStage(),2);
  page._docs=['bar_enrollment','cop','llb_degree','govt_id'].map(category=>({category}));assert.equal(page.maximumStage(),3);
  page._summary={pipeline:{stages:{identity:{submittedAt:'saved'}}}};assert.equal(page.maximumStage(),5);
});

test('demo registration can skip all credential steps and never renders a verified outcome',async()=>{
  const {page}=fixture({demo:true});await page.onEnter();assert.equal(page.maximumStage(),5);
  assert.doesNotMatch(page.renderStage2({}),/disabled title="Upload all required/);
  assert.match(page.renderStage3({}),/Skip Optional Identity/);
  await page.submitIdentity();assert.equal(page._stage,4);
  await page.setStage(5);assert.equal(page._stage,5);
  const output=page.renderStage5({});assert.match(output,/Demo Profile Ready/);assert.doesNotMatch(output,/Verified Advocate/);
});

test('typing a random demo Bar number keeps the optional Next button enabled',()=>{
  const {page,context}=fixture({demo:true});const next={disabled:true};
  context.document.getElementById=id=>id==='verification-next-docs'?next:null;
  const input=page.renderStage1({}).match(/id="bc-num-input"[^>]*oninput="([^"]+)"/)[1];
  vm.runInContext('(function(){'+input+'}).call({value:"FAKE RANDOM NUMBER"})',context);
  assert.equal(next.disabled,false);assert.equal(page._barNumber,'FAKE RANDOM NUMBER');
});

test('identity submission failure stays on step 3 and releases the submit control',async()=>{
  const {page,api}=fixture();await page.onEnter();page._stage=3;
  page._docs=['bar_enrollment','cop','llb_degree','govt_id','identity_selfie'].map(category=>({category}));
  api.submitIdentityCheck=async()=>{throw Error('Upload not confirmed');};
  await page.submitIdentity();assert.equal(page._stage,3);assert.equal(page._busy.identity,false);assert.match(page._error,/not confirmed/);
});

test('selfie is a real upload control and a global session flag cannot replace a saved file',()=>{
  const {page,storage}=fixture();storage.set('lc_selfie_captured','1');assert.equal(page.selfieDone(),false);
  assert.match(page.renderStage3({}),/id="selfie-input"/);
  page._docs=[{id:'selfie',category:'identity_selfie'}];assert.equal(page.selfieDone(),true);
});

test('saved stage belongs to the account and is bounded by submitted records',async()=>{
  const {page,storage}=fixture();storage.set('nyay_verification_stage_test-advocate','5');await page.onEnter();assert.equal(page._stage,1);
});

test('verification API resolves Live Server URLs from lexical AuthManager and includes credentials',async()=>{
  const {context}=fixture();const calls=[];
  context.AuthManager.getApiUrl=p=>'http://127.0.0.1:3000'+p;
  context.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({documents:[]})};};
  context.setTimeout=()=>1;
  vm.runInContext(fs.readFileSync('frontend/lawyer/js/api_client.js','utf8')+'\nthis.client=ApiClient;',context);
  await context.client.listDocuments();assert.equal(calls[0].url,'http://127.0.0.1:3000/api/lawyer/documents');assert.equal(calls[0].options.credentials,'include');
});

test('verification API reports 401 instead of returning a fake empty upload list',async()=>{
  const {context}=fixture();context.AuthManager.getApiUrl=p=>p;context.setTimeout=()=>1;
  context.fetch=async()=>({ok:false,status:401,json:async()=>({error:'unauthorized'})});
  vm.runInContext(fs.readFileSync('frontend/lawyer/js/api_client.js','utf8')+'\nthis.client=ApiClient;',context);
  await assert.rejects(context.client.listDocuments(),/Sign in again/);
});

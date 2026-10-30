const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');

function fixture(){
  const local=new Map(),session=new Map();
  const storage=values=>({getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)});
  const context=vm.createContext({console,AbortController,setTimeout,clearTimeout,
    localStorage:storage(local),sessionStorage:storage(session),
    window:{location:{protocol:'http:',hostname:'127.0.0.1',port:'5501'}},
    document:{addEventListener(){}},
    fetch:async()=>({ok:true,json:async()=>({lawyer:{id:'demo',demoMode:true,fullName:'Demo Advocate',verificationStatus:'demo_not_verified',registrationStage:'complete'},workspace:{clients:[]}})})
  });
  for(const [file,name] of [['frontend/shared/js/utils.js','Utils'],['frontend/shared/js/store.js','Store'],['frontend/shared/js/auth.js','AuthManager']]){
    vm.runInContext(fs.readFileSync(file,'utf8')+'\nthis.'+name+'='+name+';',context);
  }
  context.AuthManager.setSession({id:'demo',role:'lawyer',demoMode:true,registrationStage:'complete'},'synthetic');
  return {context,store:context.Store,auth:context.AuthManager,local};
}

test('a blank demo workspace renders its dashboard and portfolio without a verified badge',async()=>{
  const {context,store}=fixture();await store.init();
  for(const name of ['components','dashboard','profile_page'])vm.runInContext(fs.readFileSync('frontend/lawyer/js/'+name+'.js','utf8'),context);
  const dashboard=vm.runInContext('DashboardPage.render()',context);
  const profile=vm.runInContext('ProfilePage.render()',context);
  assert.match(dashboard,/Hackathon demo account/);assert.match(dashboard,/Demo profile — not verified/);
  assert.match(profile,/Demo profile — not verified/);assert.doesNotMatch(profile,/Badge Awaiting Verification/);
  assert.doesNotMatch(dashboard,/Verified Advocate &bull; Bar ID/);
});

test('a workspace response from a departed account cannot overwrite the new account',async()=>{
  const {context,store,auth}=fixture();let resolve;
  context.fetch=()=>new Promise(r=>{resolve=r;});const pending=store.refreshFromServer();
  auth.setSession({id:'different',role:'lawyer',demoMode:true},'synthetic-new');
  resolve({ok:true,json:async()=>({lawyer:{id:'demo'},workspace:{clients:[{id:'private-old-client'}]}})});
  assert.equal(await pending,false);assert.equal(store.getState('lawyerProfile'),undefined);
});

test('currentLawyer ignores another account cache while the new profile is loading',()=>{
  const {store,auth}=fixture();store._state.lawyerProfile={id:'other',fullName:'Private old account',verificationStatus:'verified'};
  assert.equal(auth.currentLawyer().id,'demo');assert.notEqual(auth.currentLawyer().fullName,'Private old account');
});

test('logout removes the previous account workspace after clearing its local session',async()=>{
  const {store,auth,local}=fixture();await store.init();assert.ok(local.has('lc_store_cache_demo'));
  auth.clearSession();store.resetLocal();assert.equal(local.has('lc_store_cache_demo'),false);assert.equal(store.getState('lawyerProfile'),undefined);
});

test('a stalled workspace cannot hold registration or application boot forever',async()=>{
  const {store,context}=fixture();let expire;
  context.setTimeout=(fn,delay)=>{assert.equal(delay,10000);expire=fn;return 1;};context.clearTimeout=()=>{};
  context.fetch=(_,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Object.assign(Error('timeout'),{name:'AbortError'}))));
  const pending=store.refreshFromServer();expire();await assert.rejects(pending,{name:'AbortError'});
});

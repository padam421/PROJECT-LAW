const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture() {
  const local = new Map(), session = new Map(), requests = [], navigations = [], feedback = [];
  const storage = values => ({getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)});
  const button = {disabled:false,textContent:'Submit Registration'};
  const form = {querySelector:()=>button,setAttribute(){},removeAttribute(){}};
  const context = vm.createContext({console,AbortController,setTimeout,clearTimeout,
    document:{addEventListener(){},getElementById:()=>form,querySelector:()=>button},
    localStorage:storage(local),sessionStorage:storage(session),window:{location:{protocol:'http:',hostname:'127.0.0.1',port:'5501'}},
    Router:{navigate:path=>navigations.push(path),transitionPage(){throw Error('Profile submission must not replace the form');}},
    VerificationPage:{reset(){}},
    fetch:async(url,options)=>{requests.push({url,options});return {ok:true,status:200,json:async()=>({status:'profile_complete',lawyerId:'synthetic-lawyer',user:{id:'synthetic-lawyer',role:'lawyer',registrationStage:'complete'}})};}
  });
  vm.runInContext(fs.readFileSync('frontend/shared/js/utils.js','utf8')+'\nthis.utils=Utils;',context);
  context.utils.showToast=()=>{};
  context.utils.showModal=()=>{};
  vm.runInContext(fs.readFileSync('frontend/shared/js/auth.js','utf8')+'\nthis.auth=AuthManager;',context);
  context.auth.setSession({id:'synthetic-lawyer',role:'lawyer',registrationStage:'awaiting_profile'},'synthetic-session');
  vm.runInContext(fs.readFileSync('frontend/lawyer/js/register_page.js','utf8')+'\nthis.registration=RegisterPage;',context);
  const page=context.registration;
  Object.assign(page._data,{fullName:'Synthetic Advocate',dob:'1990-01-01',phone:'9876543210',address:'Synthetic chamber address',city:'Delhi',
    barCouncil:'DL/QA123/2020',enrollmentDate:'2020-01-01',yearsOfPractice:1,qualification:'LLB',university:'Synthetic University',courts:['District & Sessions Court']});
  page.collectProfileFields=()=>{};
  page.showProfileFeedback=(message,errors)=>feedback.push({message,errors});
  return {context,page,auth:context.auth,utils:context.utils,requests,navigations,feedback,button,local};
}

test('valid advocate profile passes the real validator without the missing-helper crash',()=>{
  const {page}=fixture();assert.deepEqual(Object.keys(page.validateProfile()),[]);
});

test('Bar Council validation agrees with backend format/year rules',()=>{
  const {utils}=fixture();
  for(const value of ['DL/1234/2020',' ka/AB12/2005 '])assert.equal(utils.validateBarNumber(value),true,value);
  for(const value of ['',null,'DL-1234-2020','DL/1234/1949','DL/1234/'+(new Date().getFullYear()+1)])assert.equal(utils.validateBarNumber(value),false,String(value));
});

test('cross-origin completion includes OTP cookie, photo and professional details but excludes credentials',async()=>{
  const {auth,requests}=fixture();
  const result=await auth.registerComplete({fullName:'Synthetic Advocate',profilePhotoData:'data:image/png;base64,c3ludGhldGlj',password:'discard',confirmPassword:'discard',email:'not-editable@example.invalid'});
  assert.equal(result.success,true);assert.equal(auth.getSession().registrationStage,'complete');
  assert.equal(requests[0].url,'http://127.0.0.1:3000/api/auth/register-complete');
  assert.equal(requests[0].options.credentials,'include');
  const body=JSON.parse(requests[0].options.body);
  assert.equal(body.profilePhotoData,'data:image/png;base64,c3ludGhldGlj');
  assert.equal(body.password,undefined);assert.equal(body.confirmPassword,undefined);assert.equal(body.email,undefined);
});

test('network failure cannot mark an advocate profile completed locally',async()=>{
  const {auth,context}=fixture();const before=JSON.stringify(auth.getSession());
  context.fetch=async()=>{throw Error('synthetic network failure');};
  const result=await auth.registerComplete({fullName:'Unsaved name'});
  assert.equal(result.success,false);assert.match(result.error,/connect/);assert.equal(JSON.stringify(auth.getSession()),before);
});

test('expired cross-origin session gives an actionable error and retains profile state',async()=>{
  const {auth,context}=fixture();context.fetch=async()=>({ok:false,status:401,json:async()=>({error:'Authentication required'})});
  const result=await auth.registerComplete({fullName:'Synthetic Advocate'});
  assert.equal(result.success,false);assert.match(result.error,/Sign in again/);assert.equal(auth.getSession().registrationStage,'awaiting_profile');
});

test('registration timeout cancels request and reports retained details',async()=>{
  const {auth,context}=fixture();let callback;
  context.setTimeout=(fn,delay)=>{assert.equal(delay,30000);callback=fn;return 1;};context.clearTimeout=()=>{};
  context.fetch=(_,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Object.assign(Error('aborted'),{name:'AbortError'}))));
  const pending=auth.registerComplete({});callback();const result=await pending;
  assert.equal(result.success,false);assert.match(result.error,/too long/);
});

test('an unconfirmed or malformed successful response cannot become registration success',async()=>{
  const {auth,context}=fixture();context.fetch=async()=>({ok:true,status:200,json:async()=>({ok:true})});
  assert.equal((await auth.registerComplete({})).success,false);
  context.fetch=async()=>({ok:true,status:200,json:async()=>{throw Error('not JSON');}});
  assert.equal((await auth.registerComplete({})).success,false);
});

test('duplicate-bar investigation remains a blocked review state',async()=>{
  const {auth,context}=fixture();context.fetch=async()=>({ok:true,status:202,json:async()=>({status:'under_investigation',message:'Review required'})});
  const result=await auth.registerComplete({});assert.equal(result.success,false);assert.equal(result.underInvestigation,true);
});

test('valid profile submit reaches verification without re-rendering away the form',async()=>{
  const {page,navigations,button}=fixture();await page.handleProfileSubmit({preventDefault(){}});
  assert.deepEqual(navigations,['/verification']);assert.equal(page._submitting,false);assert.equal(button.disabled,false);
});

test('validation failure names the field, retains values and permits another submission',async()=>{
  const {page,feedback,requests,button}=fixture();page._data.barCouncil='invalid';
  await page.handleProfileSubmit({preventDefault(){}});
  assert.equal(requests.length,0);assert.match(feedback.at(-1).errors.barCouncil,/format/);
  assert.equal(page._data.fullName,'Synthetic Advocate');assert.equal(page._submitting,false);assert.equal(button.disabled,false);
});

test('server field errors and unexpected exceptions unlock submit and retain the draft',async()=>{
  const {page,auth,feedback,button,navigations}=fixture();
  auth.registerComplete=async()=>({success:false,error:'Mobile number already exists',fieldErrors:{phone:'Already registered'}});
  await page.handleProfileSubmit({preventDefault(){}});
  assert.equal(feedback.at(-1).errors.phone,'Already registered');assert.equal(page._submitting,false);assert.equal(button.disabled,false);
  auth.registerComplete=async()=>{throw Error('unexpected failure');};await page.handleProfileSubmit({preventDefault(){}});
  assert.match(feedback.at(-1).message,/retained/);assert.equal(page._submitting,false);assert.equal(button.disabled,false);assert.deepEqual(navigations,[]);
});

test('double submit sends only one completion request',async()=>{
  const {page,auth}=fixture();let finish,calls=0;
  auth.registerComplete=()=>{calls++;return new Promise(resolve=>{finish=resolve;});};
  const first=page.handleProfileSubmit({preventDefault(){}});
  await page.handleProfileSubmit({preventDefault(){}});assert.equal(calls,1);
  finish({success:true});await first;assert.equal(page._submitting,false);
});

test('demo professional profile accepts empty and arbitrary sample credentials',()=>{
  const {page,auth}=fixture();auth.setSession({id:'demo',role:'lawyer',demoMode:true,registrationStage:'awaiting_profile'},'demo-session');
  page._data.fullName='';page._data.phone='';page._data.barCouncil='FAKE NUMBER';page._data.courts=[];
  assert.deepEqual(Object.keys(page.validateProfile()),[]);
  const html=page.renderProfileForm();assert.match(html,/All professional fields are optional/);assert.doesNotMatch(html,/<span class="required">\*/);
  assert.doesNotMatch(html,/<input[^>]*\srequired(?=[\s>])/);
});

test('existing verification account can switch to an optional demo profile without a registration form',async()=>{
  const {page,auth,context,navigations}=fixture();
  context.document.getElementById=()=>null;
  auth.startLawyerDemo=async()=>{auth.setSession({id:'new-demo',role:'lawyer',demoMode:true,registrationStage:'awaiting_profile'},'demo-session');return {success:true};};
  await page.startDemo();assert.deepEqual(navigations,['/register']);
  assert.equal(page.currentPhase(),'profile');assert.equal(page._draftOwner,'new-demo');assert.equal(page._submitting,false);
});

test('demo switch failures on verification are visible and can be retried',async()=>{
  const {page,auth,context,navigations}=fixture();let message;
  context.document.getElementById=()=>null;
  context.VerificationPage.fail=error=>{message=error.message;};
  auth.startLawyerDemo=async()=>({success:false,error:'Demo backend unavailable'});
  await page.startDemo();assert.equal(message,'Demo backend unavailable');assert.equal(page._submitting,false);assert.deepEqual(navigations,[]);
});

test('signup, OTP and resend network failures never fabricate authentication',async()=>{
  const {auth,context}=fixture();context.fetch=async()=>{throw Error('offline');};
  const before=JSON.stringify(auth.getSession());
  assert.equal((await auth.registerInitiate('synthetic@example.invalid','Synthetic123','lawyer')).success,false);
  assert.equal(auth._pendingOTPChallenge,null);
  auth._pendingOTPChallenge={id:'real-challenge',email:'synthetic@example.invalid',expiresAt:'2026-01-01'};
  assert.equal((await auth.verifyOTP('123456')).success,false);assert.equal(auth._pendingOTPChallenge.id,'real-challenge');
  assert.equal((await auth.resendOTP()).success,false);assert.equal(auth._pendingOTPChallenge.expiresAt,'2026-01-01');
  assert.equal((await auth.login('synthetic@example.invalid','Synthetic123')).success,false);assert.equal(JSON.stringify(auth.getSession()),before);
});

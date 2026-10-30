/* Full HTTP contracts with the real Express controllers/services and uploads.
 * Uses a separate synthetic JSON directory, captured mail and in-memory SQL adapter. */
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs'),http=require('node:http');
const root=path.resolve(__dirname,'..');
process.env.NODE_ENV='development';
process.env.DATA_DIR=path.join(root,'.tmp-test','onboarding-api-'+Date.now()+'-'+process.pid);
process.env.UPLOADS_DIR=path.join(process.env.DATA_DIR,'uploads');
process.env.JWT_SECRET='isolated-onboarding-regression-secret';
process.env.COOKIE_SECURE='false';process.env.DEMO_REGISTRATION_ENABLED='true';
process.env.BCRYPT_ROUNDS='4';process.env.OTP_BCRYPT_ROUNDS='4';
const db=require('../backend/src/config/dbConfig');
const sent=new Map(),profiles=new Map();
const repository={
  findUserByEmail:async email=>db.get().users.find(u=>u.email===email)||null,
  findUserById:async id=>db.get().users.find(u=>u.id===id)||null,
  createUser:async user=>user,saveOtpChallenge:async challenge=>challenge,markOtpChallengeUsed:async()=>{},updateUserVerified:async()=>{},
  saveSession:async()=>{},findSession:async()=>null,revokeSession:async()=>{},revokeAllSessions:async()=>{},
  getUserProfile:async id=>profiles.get(id)||null,saveLawyerProfile:async user=>profiles.set(user.id,{...user}),getMySQLPool:()=>null
};
const repoPath=require.resolve('../backend/src/services/dbService');
require.cache[repoPath]={id:repoPath,filename:repoPath,loaded:true,exports:repository};
const mailPath=require.resolve('../backend/src/services/mailService');
require.cache[mailPath]={id:mailPath,filename:mailPath,loaded:true,exports:{
  isConfigured:()=>true,activeChannel:()=> 'synthetic-capture',otpEmailHtml:()=>'',
  send:async message=>{sent.set(message.to,message.text.match(/\b\d{6}\b/)[0]);return {sent:true,provider:'synthetic-capture'};}
}};
const auth=require('../backend/src/services/authService');
const app=require('../backend/src/app');
let server,base,serial=0;
before(async()=>{db.load();server=http.createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;});
after(async()=>{db.flushNow();await new Promise(resolve=>server.close(resolve));});

async function request(url,{method='GET',body,cookie}={}){
  const response=await fetch(base+'/api'+url,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
  const data=await response.json();return {response,data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function demo(){const r=await request('/auth/demo-lawyer',{method:'POST',body:{}});assert.equal(r.response.status,200);return r;}
async function registered(){
  const email='synthetic-'+(++serial)+'@example.invalid';
  let r=await request('/auth/register-initiate',{method:'POST',body:{email,password:'Synthetic123',role:'lawyer'}});assert.equal(r.response.status,200);
  r=await request('/auth/verify-otp',{method:'POST',body:{challengeId:r.data.challengeId,code:sent.get(email)}});assert.equal(r.response.status,200);
  const profile={fullName:'Synthetic Advocate',dob:'1990-01-01',gender:'Other',phone:'987650'+String(serial).padStart(4,'0'),address:'Synthetic chamber address',city:'Delhi',state:'Delhi',
    barCouncil:'DL/QA'+serial+'/2020',stateBarCouncil:'Bar Council of Delhi',enrollmentDate:'2020-01-01',qualification:'LLB',university:'Synthetic University',yearsOfPractice:1,
    practiceType:'Independent Advocate',primarySpecialization:'Civil Law',courts:['District Court'],languages:['English']};
  const complete=await request('/auth/register-complete',{method:'POST',cookie:r.cookie,body:profile});assert.equal(complete.response.status,200,JSON.stringify(complete.data));
  return {cookie:r.cookie,user:complete.data.user,profile};
}
async function upload(cookie,category){
  const form=new FormData();
  form.set('category',category);form.set('label','Synthetic '+category);
  form.set('document',new Blob([category==='identity_selfie'?'synthetic-image-'+category:'%PDF-1.4\nsynthetic-'+category],{type:category==='identity_selfie'?'image/png':'application/pdf'}),category+(category==='identity_selfie'?'.png':'.pdf'));
  const response=await fetch(base+'/api/lawyer/documents/upload',{method:'POST',headers:{Cookie:cookie},body:form});
  return {response,data:await response.json()};
}

test('demo starts without email/OTP, accepts blank or fake professional details and remains unverified',async()=>{
  const r=await demo();const mailCount=sent.size;
  assert.equal(r.data.user.demoMode,true);assert.equal(r.data.user.isVerified,false);assert.equal(r.data.token,undefined);
  const photo='data:image/png;base64,c3ludGhldGlj';
  const saved=await request('/auth/register-complete',{method:'POST',cookie:r.cookie,body:{barCouncil:'RANDOM FAKE NUMBER',fullName:'',phone:'fake',profilePhotoData:photo}});
  assert.equal(saved.response.status,200);assert.equal(saved.data.user.fullName,'Demo Advocate');assert.equal(saved.data.user.verificationStatus,'demo_not_verified');
  assert.equal(profiles.has(r.data.user.id),false,'Demo must not enter the real SQL advocate directory');assert.equal(sent.size,mailCount);
  const identity=await request('/lawyer/identity-check',{method:'POST',cookie:r.cookie,body:{}});
  assert.equal(identity.response.status,200);assert.equal(identity.data.identity.status,'demo_not_verified');
  const summary=await request('/lawyer/verification-summary',{cookie:r.cookie});assert.equal(summary.data.demoMode,true);assert.notEqual(summary.data.lawyerStatus,'verified');
  const state=await request('/state',{cookie:r.cookie});assert.equal(state.data.lawyer.id,r.data.user.id);assert.deepEqual(state.data.workspace.clients,[]);
  assert.equal(state.data.lawyer.demoMode,true);assert.equal(state.data.lawyer.registrationStage,'complete');
  assert.equal(state.data.lawyer.profilePhoto,photo);
  const edited=await request('/lawyer/profile',{method:'PATCH',cookie:r.cookie,body:{barCouncil:'ANOTHER SAMPLE'}});
  assert.equal(edited.response.status,200);assert.equal(edited.data.lawyer.barCouncil,'ANOTHER SAMPLE');
  assert.equal(edited.data.reVerificationTriggered,false);assert.equal(edited.data.lawyer.verificationStatus,'demo_not_verified');
});

test('standard signup → OTP → profile → bar/documents/selfie → pending outcome persists end to end',async()=>{
  const a=await registered();
  let r=await request('/lawyer/verification/bar-lookup',{method:'POST',cookie:a.cookie,body:{barNumber:a.profile.barCouncil}});
  assert.equal(r.data.outcome,'manual_verification_required');
  for(const category of ['bar_enrollment','cop','llb_degree','govt_id','identity_selfie']) {
    r=await upload(a.cookie,category);assert.equal(r.response.status,201,JSON.stringify(r.data));
  }
  r=await request('/lawyer/identity-check',{method:'POST',cookie:a.cookie,body:{selfieCaptured:false,idDocSubmitted:false}});
  assert.equal(r.response.status,200);assert.equal(r.data.identity.status,'manual_verification_required');assert.equal(r.data.identity.selfieCaptured,true);
  r=await request('/lawyer/verification-summary',{cookie:a.cookie});assert.equal(r.data.pipeline.stages.identity.status,'manual_verification_required');
  assert.equal(r.data.pipeline.stages.documents.docsSubmitted,5);assert.notEqual(r.data.lawyerStatus,'verified');
  db.flushNow();const restored=JSON.parse(fs.readFileSync(db.DB_FILE));assert.equal(restored.documents.filter(d=>d.lawyerId===a.user.id).length,5);
  assert.ok(restored.verificationRecords.find(v=>v.lawyerId===a.user.id).stages.identity.selfieDocumentId);
});

test('normal profile rules cannot be skipped by caller-supplied demoMode or user role',async()=>{
  const email='unverified-profile@example.invalid';let r=await request('/auth/register-initiate',{method:'POST',body:{email,password:'Synthetic123',role:'lawyer'}});
  r=await request('/auth/verify-otp',{method:'POST',body:{challengeId:r.data.challengeId,code:sent.get(email)}});
  const invalid=await request('/auth/register-complete',{method:'POST',cookie:r.cookie,body:{demoMode:true,role:'user'}});
  assert.equal(invalid.response.status,400);assert.ok(invalid.data.fieldErrors.fullName);
});

test('forged identity flags fail without files; file ownership and duplicate checks are enforced',async()=>{
  const a=await registered(),b=await registered();
  let r=await request('/lawyer/identity-check',{method:'POST',cookie:a.cookie,body:{selfieCaptured:true,idDocSubmitted:true}});assert.equal(r.response.status,400);
  const first=await upload(a.cookie,'bar_enrollment');assert.equal(first.response.status,201);
  r=await upload(a.cookie,'bar_enrollment');assert.equal(r.response.status,409);
  r=await request('/lawyer/documents/'+first.data.document.id+'/download',{cookie:b.cookie});assert.equal(r.response.status,404);
  r=await request('/lawyer/documents',{cookie:b.cookie});assert.equal(r.data.documents.length,0);
});

test('deleting an identity document invalidates the previous normal identity submission',async()=>{
  const a=await registered();let selfie;
  for(const category of ['bar_enrollment','cop','llb_degree','govt_id','identity_selfie']){const r=await upload(a.cookie,category);if(category==='identity_selfie')selfie=r.data.document;}
  await request('/lawyer/identity-check',{method:'POST',cookie:a.cookie,body:{}});
  const deleted=await request('/lawyer/documents/'+selfie.id,{method:'DELETE',cookie:a.cookie});assert.equal(deleted.response.status,200);
  const r=await request('/lawyer/verification-summary',{cookie:a.cookie});assert.equal(r.data.pipeline.stages.identity.status,'not_started');assert.equal(r.data.pipeline.stages.documents.docsSubmitted,4);
});

test('demo accounts are excluded from real admin approval queue and logout revokes access',async()=>{
  const r=await demo();await request('/auth/register-complete',{method:'POST',cookie:r.cookie,body:{}});
  const admin={id:'synthetic-admin',role:'admin',email:'admin@example.invalid',accountStatus:'active'};db.get().users.push(admin);
  const {token}=auth.createSession(admin,{});const queue=await request('/admin/queue',{cookie:'lc_session='+token});assert.equal(queue.response.status,200);
  assert.equal(queue.data.queue.some(row=>row.id===r.data.user.id),false);
  const approval=await request('/admin/decide/'+r.data.user.id,{method:'POST',cookie:'lc_session='+token,body:{decision:'approve'}});
  assert.equal(approval.response.status,400);assert.match(approval.data.error,/Demo profiles/);
  await request('/auth/logout',{method:'POST',cookie:r.cookie,body:{}});
  const ended=await request('/lawyer/documents',{cookie:r.cookie});assert.equal(ended.response.status,401);
});

const {test}=require('node:test'),assert=require('node:assert/strict');
const root='../backend/src/';
const authPath=require.resolve(root+'middlewares/authMiddleware'),repoPath=require.resolve(root+'services/assistantRepository');
const owners=[];
require.cache[authPath]={id:authPath,filename:authPath,loaded:true,exports:{
 authenticate:(req,res,next)=>{if(!req.get('qa-role'))return res.status(401).json({error:'Sign in'});req.user={id:'same-account',role:req.get('qa-role')};next();},
 requireRole:role=>(req,res,next)=>req.user.role===role?next():res.status(403).json({error:'Wrong role'})
}};
require.cache[repoPath]={id:repoPath,filename:repoPath,loaded:true,exports:{
 list:async owner=>{owners.push(owner);return [];},put:async(owner,t)=>{owners.push(owner);return {...t,revision:1};}
}};
const express=require('../backend/node_modules/express');
test('advocate APIs require a lawyer and use a different history owner namespace',async()=>{
 const app=express();app.use(express.json());app.use('/api/assistant',require(root+'routes/assistant'));app.use('/api/advocate',require(root+'routes/advocate'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  assert.equal((await fetch(base+'/api/advocate/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
  assert.equal((await fetch(base+'/api/advocate/chat',{method:'POST',headers:{'qa-role':'user','Content-Type':'application/json'},body:'{}'})).status,403);
  assert.equal((await fetch(base+'/api/advocate/assistant/threads',{headers:{'qa-role':'lawyer'}})).status,200);
  assert.equal((await fetch(base+'/api/assistant/threads',{headers:{'qa-role':'lawyer'}})).status,200);
  assert.deepEqual(owners.slice(0,2),['advocate:same-account','same-account']);
  const thread={id:'case_1',title:'NDPS',messages:[{id:'m1',sender:'user',text:'Case facts'}],courtSessions:{}};
  const saved=await fetch(base+'/api/advocate/assistant/threads/case_1',{method:'PUT',headers:{'qa-role':'lawyer','Content-Type':'application/json'},body:JSON.stringify({thread})});
  assert.equal(saved.status,200);assert.equal(owners.at(-1),'advocate:same-account');
 }finally{await new Promise(r=>server.close(r));}
});

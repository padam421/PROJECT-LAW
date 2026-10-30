const express=require('express');
const router=express.Router();
const repository=require('../services/assistantRepository');
const {authenticate}=require('../middlewares/authMiddleware');
router.use(authenticate);
const owner = req => req.baseUrl.endsWith('/advocate/assistant') ? 'advocate:' + req.user.id : req.user.id;
router.get('/threads',async(req,res)=>{
  try{res.json({threads:await repository.list(owner(req))});}catch(error){res.status(503).json({error:'Saved conversations are temporarily unavailable. Local changes are retained.'});}
});
router.put('/threads/:id',async(req,res)=>{
  const t=req.body?.thread;
  if(!/^[a-zA-Z0-9_-]{1,96}$/.test(req.params.id)||!t||t.id!==req.params.id||!Array.isArray(t.messages)||typeof t.title!=='string')return res.status(400).json({error:'Invalid conversation.'});
  if(t.messages.some(m=>!m||!['user','ai'].includes(m.sender)||typeof m.text!=='string'||!/^[a-zA-Z0-9_-]{1,96}$/.test(m.id||'')))return res.status(400).json({error:'Invalid message.'});
  if(JSON.stringify(t).length>2500000)return res.status(413).json({error:'This conversation is too large to sync. Export or start a new thread; local history is retained.'});
  const thread={id:t.id,title:t.title.slice(0,160),createdAt:t.createdAt,updatedAt:t.updatedAt,language:t.language||'auto',messages:t.messages,courtSessions:t.courtSessions||{},deleted:!!t.deleted};
  try{res.json({thread:await repository.put(owner(req),thread,Number(req.body.expectedRevision)||0)});}catch(error){res.status(error.status||503).json({error:error.status===409?error.message:'Conversation sync failed. Your local copy is retained.'});}
});
router.delete('/threads/:id',async(req,res)=>{
  try{const thread=await repository.removeChat(owner(req),req.params.id);res.json({deleted:true,thread});}catch(error){res.status(error.status||503).json({error:'Could not delete the chat. Court preparation sessions were retained; please retry.'});}
});
router.delete('/threads/:id/courts/:sessionId',async(req,res)=>{
  try{const thread=await repository.removeCourt(owner(req),req.params.id,req.params.sessionId);res.json({deleted:true,thread});}catch(error){res.status(error.status||503).json({error:'Could not delete this preparation session. Please retry.'});}
});
module.exports=router;

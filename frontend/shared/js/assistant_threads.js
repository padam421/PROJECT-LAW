/* Durable, account-scoped threads shared by the citizen and advocate assistants. */
const AssistantThreads = {
  _owner:null,_data:null,_saving:new Map(),_timers:new Map(),_hydration:null,
  owner() { const s=typeof AuthManager!=='undefined'?AuthManager.getSession():null;return s?.id?String(s.id):s?.email?String(s.email).toLowerCase():null; },
  key(owner=this.owner()){return 'nyay_assistant_v1_'+encodeURIComponent(owner||'signed-out');},
  ensure(){
    const owner=this.owner();
    if(owner===this._owner&&this._data)return this._data;
    this._owner=owner;this._hydration=null;
    try{this._data=JSON.parse(localStorage.getItem(this.key(owner)))||{};}catch(_){this._data={};}
    if(!Array.isArray(this._data.threads))this._data.threads=[];
    this._data.threads=this._data.threads.filter(t=>t&&/^[a-zA-Z0-9_-]{1,96}$/.test(t.id)&&Array.isArray(t.messages));
    this._data.active ||= null;
    if(!this._data.migrated&&owner){
      // Citizen UserStore is account-scoped. The historical advocate global key is NOT attributable safely.
      if(typeof UserStore!=='undefined'){
        const session=AuthManager.getSession(),profile=UserStore.get('userProfile');
        const same=profile?.id?String(profile.id)===String(session.id):profile?.email?String(profile.email).toLowerCase()===String(session.email).toLowerCase():false;
        if(same)for(const conv of UserStore.get('conversations')||[]){
          if(conv.type==='ai'&&conv.messages?.length)this._data.threads.push({id:this.id('chat'),title:conv.messages.find(m=>m.sender==='user')?.text?.slice(0,80)||'Previous conversation',messages:conv.messages,courtSessions:{},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),dirty:true,revision:0});
        }
      }
      this._data.migrated=true;this.persist();
    }
    for(const thread of this._data.threads)for(const message of thread.messages)if(!/^[a-zA-Z0-9_-]{1,96}$/.test(message.id||''))message.id=this.id('msg');
    return this._data;
  },
  id(prefix='chat'){return prefix+'_'+(crypto.randomUUID?crypto.randomUUID():Date.now()+'_'+Math.random().toString(36).slice(2));},
  persist(){
    if(!this._owner)return false;
    try{localStorage.setItem(this.key(this._owner),JSON.stringify(this._data));return true;}
    catch(error){this.notify('Storage is full. Export this conversation before leaving the page.','error');return false;}
  },
  list(){return this.ensure().threads.filter(t=>!t.deleted).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));},
  active(create=true){const data=this.ensure();let t=data.threads.find(t=>t.id===data.active&&!t.deleted);if(!t&&create)t=this.create();return t;},
  get(id){return this.ensure().threads.find(t=>t.id===id&&!t.deleted);},
  getForCourt(id){return this.ensure().threads.find(t=>t.id===id);},
  savedCourts(){
    return this.ensure().threads.flatMap(thread=>Object.values(thread.courtSessions||{})
      .filter(session=>session&&/^[a-zA-Z0-9_-]{1,96}$/.test(session.id||''))
      .map(session=>({threadId:thread.id,chatDeleted:!!thread.deleted,session})))
      .sort((a,b)=>String(b.session.updatedAt||b.session.createdAt||'').localeCompare(String(a.session.updatedAt||a.session.createdAt||'')));
  },
  create(){
    if(!this.owner())throw new Error('Sign in to save conversations.');
    const data=this.ensure(),now=new Date().toISOString();
    const t={id:this.id(),title:'New conversation',messages:[],courtSessions:{},language:'auto',createdAt:now,updatedAt:now,revision:0,dirty:true};
    data.threads.push(t);data.active=t.id;this.persist();this.queue(t.id);return t;
  },
  select(id){if(!this.get(id))return;this._data.active=id;this.persist();},
  change(id,edit){const thread=this.get(id);if(!thread)return;edit(thread);thread.updatedAt=new Date().toISOString();thread.localVersion=(thread.localVersion||0)+1;thread.dirty=true;this.persist();this.queue(id);return thread;},
  changeCourt(id,edit){const thread=this.getForCourt(id);if(!thread)return;edit(thread);thread.updatedAt=new Date().toISOString();thread.localVersion=(thread.localVersion||0)+1;thread.dirty=true;this.persist();this.queue(id);return thread;},
  async removeCourt(threadId,sessionId){
    this.changeCourt(threadId,thread=>{if(thread.courtSessions)delete thread.courtSessions[sessionId];});
    await this.sync(threadId);
    window.dispatchEvent(new Event('nyay-threads-updated'));
  },
  append(id,message){return this.change(id,t=>{t.messages.push(message);if(t.title==='New conversation'&&message.sender==='user')t.title=message.text.slice(0,80);});},
  url(path){return typeof AuthManager!=='undefined'?AuthManager.getApiUrl('/api/assistant'+path):'/api/assistant'+path;},
  queue(id){if(!this.owner())return;clearTimeout(this._timers.get(id));this._timers.set(id,setTimeout(()=>this.sync(id),400));},
  notify(message,type='info'){if(typeof Utils!=='undefined'&&Utils.showToast)Utils.showToast(message,type);},
  async hydrate(){
    this.ensure();if(!this._owner)return;if(this._hydration)return this._hydration;
    const owner=this._owner;
    this._hydration=(async()=>{
      try{
        const response=await fetch(this.url('/threads'),{credentials:'include'});if(!response.ok)throw Error('History sync unavailable');
        const {threads}=await response.json();if(this.owner()!==owner)return;
        for(const remote of threads||[]){
          const local=this._data.threads.find(t=>t.id===remote.id);
          if(!local)this._data.threads.push({...remote,dirty:false});
          else if(!local.dirty)Object.assign(local,remote,{dirty:false});
          else if(remote.revision>local.revision)local.conflict=true;
        }
        this.persist();this._data.threads.filter(t=>t.dirty&&!t.conflict).forEach(t=>this.queue(t.id));
        window.dispatchEvent(new Event('nyay-threads-updated'));
      }catch(_){this._syncState='local';}
    })();return this._hydration;
  },
  async sync(id){
    this.ensure();const owner=this._owner,t=this._data.threads.find(t=>t.id===id);if(!t||!t.dirty||t.conflict)return;
    const lock=owner+'/'+id;if(this._saving.has(lock)){this.queue(id);return;}
    const snapshot=JSON.parse(JSON.stringify(t)),stamp=t.localVersion||0;this._saving.set(lock,true);
    try{
      const response=await fetch(this.url('/threads/'+encodeURIComponent(id)),{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({thread:snapshot,expectedRevision:t.revision||0})});
      if(this.owner()!==owner)return;
      if(response.status===409){t.conflict=true;this.notify('Another tab updated this chat. Your copy is kept; export it before refreshing.','warning');return;}
      if(!response.ok)throw Error('Sync failed');
      const data=await response.json();t.revision=data.thread.revision;t.dirty=(t.localVersion||0)!==stamp;this._syncState='saved';this.persist();if(t.dirty)this.queue(id);
    }catch(_){this._syncState='local';}finally{this._saving.delete(lock);window.dispatchEvent(new Event('nyay-threads-updated'));}
  },
  async remove(id){
    const t=this.get(id);if(!t)return;
    // Delete messages, not the separately retained preparation snapshots. Tombstone
    // prevents an old tab bringing deleted chat messages back after reconnecting.
    this.change(id,t=>{t.deleted=true;t.messages=[];t.draft='';});clearTimeout(this._timers.get(id));
    if(this._data.active===id)this._data.active=null;
    this.persist();await this.sync(id);
    window.dispatchEvent(new Event('nyay-threads-updated'));
  },
  export(id){const t=this.get(id);if(!t)return;const url=URL.createObjectURL(new Blob([JSON.stringify(t,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='nyay-chat-'+id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},
  async api(path,body,{signal}={}){
    const url=typeof AuthManager!=='undefined'?AuthManager.getApiUrl('/api/ai/'+path):'/api/ai/'+path;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),path==='court'?75000:240000);
    const cancel=()=>controller.abort();
    signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
    try{
      const response=await fetch(url,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
      const result=await response.json();if(!response.ok||!result.ok){
        const error=new Error(result.error||'AI response unavailable. Your messages remain saved.');
        error.retryAfter=Number(result.retry_after)||0;error.retryable=result.retryable===true;throw error;
      }return result;
    }catch(error){if(error.name==='AbortError'&&!signal?.aborted)throw new Error('The AI response took too long. Your hearing and messages remain saved; retry this turn.');throw error;}
    finally{clearTimeout(timeout);signal?.removeEventListener('abort',cancel);}
  }
};

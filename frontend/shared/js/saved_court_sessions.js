/* Saved preparation library. Storage/navigation only; the hearing engine is unchanged. */
const SavedCourtSessions = {
  render(){
    AssistantThreads.hydrate();
    return '<section class="nyay-saved-courts" id="nyay-saved-courts" aria-labelledby="nyay-saved-title">'+this.contents()+'</section>';
  },
  contents(){
    const entries=AssistantThreads.savedCourts(),e=value=>Utils.escapeHtml(String(value??''));
    return '<div class="nyay-saved-heading"><div><span class="vc-eyebrow">YOUR PREPARATION LIBRARY</span><h2 id="nyay-saved-title">Saved court sessions</h2><p>Sessions stay here when a chat is deleted. Remove a session only when you choose.</p></div><span>'+entries.length+' saved</span></div>'
      +(entries.length?'<div class="nyay-saved-grid">'+entries.map(({threadId,chatDeleted,session:s})=>{
        const rooms=Object.keys(s.rooms||{}).map(room=>room.charAt(0)+room.slice(1).toLowerCase()).join(' · ');
        return '<article class="nyay-saved-card"><h3>'+e(s.title||'Court preparation')+'</h3><p>'+e(rooms||'Hearing ready')+' · '+(s.transcript?.length||0)+' recorded turns</p>'
          +(chatDeleted?'<span class="nyay-saved-retained">Chat deleted · preparation retained</span>':'')
          +'<details><summary>Saved case brief</summary><p dir="auto">'+e(s.summary||'')+'</p></details><div class="nyay-saved-actions">'
          +'<button onclick="SavedCourtSessions.resume(\''+threadId+'\',\''+s.id+'\')">Resume preparation</button>'
          +'<button class="nyay-saved-delete" onclick="SavedCourtSessions.remove(\''+threadId+'\',\''+s.id+'\')">Delete session</button></div></article>';
      }).join('')+'</div>':'<p class="nyay-saved-empty">Open Virtual Court from an Ask Nyay Setu conversation to save a preparation session here.</p>');
  },
  refresh(){const panel=document.getElementById('nyay-saved-courts');if(panel)panel.innerHTML=this.contents();},
  resume(threadId,sessionId){
    const session=AssistantThreads.getForCourt(threadId)?.courtSessions?.[sessionId];
    if(!session?.script){AssistantThreads.notify('This session has not finished preparing yet. Please open its original chat and retry.','info');return;}
    LiveCourt.detach();LiveCourt.context={owner:AssistantThreads.owner(),threadId,sessionId};
    LiveCourt.activate(session);Router.navigate('/court/simulate');
  },
  async remove(threadId,sessionId){
    if(!confirm('Delete only this saved court preparation session? Other sessions and chats will remain.'))return;
    if(LiveCourt.context?.threadId===threadId&&LiveCourt.context?.sessionId===sessionId)LiveCourt.detach();
    await AssistantThreads.removeCourt(threadId,sessionId);this.refresh();
  }
};
window.addEventListener('nyay-threads-updated',()=>SavedCourtSessions.refresh());

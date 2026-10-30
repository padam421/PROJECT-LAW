/* Upgrade the existing chat UI without changing portal navigation or account screens. */
const AssistantChat = {
  pending:new Set(), installed:false,
  controller(){return typeof UserChatBot!=='undefined'?UserChatBot:AdvocateChatBot;},
  role(){return typeof UserChatBot!=='undefined'?'user':'lawyer';},
  escape(value){return Utils.escapeHtml(String(value??''));},
  markdown(text){
    const inline=value=>this.escape(value).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');
    const lines=String(text||'').split('\n'),out=[];let list=null,paragraph=[];
    const flush=()=>{if(paragraph.length){out.push('<p>'+paragraph.map(inline).join('<br>')+'</p>');paragraph=[];}};
    const close=()=>{if(list){out.push('</'+list+'>');list=null;}};
    for(const line of lines){
      const heading=line.match(/^#{1,6}\s+(.+)/),item=line.match(/^\s*(?:([-*•])|\d+[.)])\s+(.+)/);
      if(heading){flush();close();out.push('<h3>'+inline(heading[1])+'</h3>');}
      else if(item){flush();const kind=item[1]?'ul':'ol';if(list!==kind){close();list=kind;out.push('<'+kind+'>');}out.push('<li>'+inline(item[2])+'</li>');}
      else if(!line.trim()){flush();close();}
      else{close();paragraph.push(line);}
    }
    flush();close();return '<div class="nyay-answer" dir="auto">'+out.join('')+'</div>';
  },
  extras(message){
    let html='';const e=value=>this.escape(value);
    if(message.visual?.nodes?.length)html+='<figure class="nyay-visual" dir="auto"><figcaption>'+e(message.visual.title)+'</figcaption><ol>'+message.visual.nodes.map(n=>'<li><strong>'+e(n.title)+'</strong><p>'+e(n.detail)+'</p></li>').join('')+'</ol></figure>';
    if(message.sources?.length)html+='<details class="nyay-sources"><summary>Database sources ('+message.sources.length+')</summary>'+message.sources.map(s=>'<article><strong>['+e(s.id)+'] '+e(s.title)+'</strong><p>'+e(s.citation||s.category||'')+'</p><blockquote>'+e(s.excerpt)+'</blockquote></article>').join('')+'</details>';
    return html;
  },
  sidebar(){
    const c=this.controller(),name=c=== (typeof UserChatBot!=='undefined'?UserChatBot:null)?'UserChatBot':'AdvocateChatBot';
    const active=AssistantThreads.active(false);const e=v=>this.escape(v);
    const status=active?.conflict?'Save conflict — export local copy':active?.dirty?'Saved on this device · sync pending':AssistantThreads._syncState==='saved'?'Saved to account':'Saved on this device';
    return '<div class="nyay-thread-toolbar"><button class="u-btn u-btn-primary" onclick="'+name+'.startNewChat()">＋ New chat</button><span id="nyay-sync-status">'+status+'</span></div>'+AssistantThreads.list().map(t=>'<div class="nyay-thread-row '+(t.id===active?.id?'active':'')+'"><button class="nyay-thread-open" onclick="'+name+'.selectConversation(\''+e(t.id)+'\')"><strong>'+e(t.title)+'</strong><span>'+e(t.messages.at(-1)?.text?.slice(0,70)||'Start a conversation')+'</span><small>'+t.messages.length+' messages · '+Object.keys(t.courtSessions||{}).length+' court sessions</small></button><button class="nyay-thread-export" title="Export conversation" aria-label="Export '+e(t.title)+'" onclick="AssistantThreads.export(\''+e(t.id)+'\')">↓</button><button class="u-session-del-btn" title="Delete conversation" aria-label="Delete '+e(t.title)+'" onclick="AssistantChat.remove(\''+e(t.id)+'\')">×</button></div>').join('');
  },
  refreshSidebar(){const list=document.querySelector('.u-chat-list-items');if(list)list.innerHTML=this.sidebar();},
  recoverLegacy(){
    const legacy=this.role()==='lawyer'?localStorage.getItem('lc_advocate_ai_messages'):JSON.stringify((UserStore.get('conversations')||[]).filter(t=>t.type==='ai').flatMap(t=>t.messages||[]));
    const value=legacy;if(!value)return;
    if(!confirm('The older browser history was not labelled with an account. Import it only if it belongs to you. The original copy will be kept.'))return;
    try{const messages=JSON.parse(value);if(!Array.isArray(messages))return;const thread=AssistantThreads.create();AssistantThreads.change(thread.id,t=>{t.title='Recovered browser conversation';t.messages=messages.map(m=>({...m,id:/^[a-zA-Z0-9_-]{1,96}$/.test(m.id||'')?m.id:AssistantThreads.id('msg')}));});this.refresh();}catch(error){AssistantThreads.notify('Could not read the old browser history. The original copy was preserved.','warning');}
  },
  refresh(){
    const c=this.controller(),t=AssistantThreads.active();
    const container=document.getElementById('chat-messages');if(!container)return;
    container.innerHTML=t.messages.length?t.messages.map(m=>c._renderMessage(m)).join(''):c._emptyChat();
    if(this.pending.has(t.id))c._showTyping();
    const qq=document.getElementById('quick-questions');if(qq)qq.style.display=t.messages.length?'none':'';
    const select=document.getElementById('chat-lang-select');if(select)select.value=t.language||'auto';
    const send=document.getElementById('chat-send-btn');if(send)send.disabled=this.pending.has(t.id);
    this.refreshSidebar();container.scrollTop=container.scrollHeight;
  },
  async remove(id){
    if(!confirm('Delete this chat? Its saved court preparation sessions will remain in Court Prep.'))return;
    if(this.pending.has(id)){AssistantThreads.notify('Wait for this response before deleting the conversation.','warning');return;}
    if(typeof LiveCourt!=='undefined'&&LiveCourt.context?.threadId===id)LiveCourt.detach();
    await AssistantThreads.remove(id);this.refresh();
  },
  async send({retryMessage=null}={}){
    const c=this.controller(),t=AssistantThreads.active(),owner=AssistantThreads.owner();
    if(this.pending.has(t.id))return;
    const input=document.getElementById('chat-input');let text=retryMessage?.text||input?.value?.trim();
    const file=c._attachedFile;if(!text&&!file)return;
    if(!text)text='Please review the attached document: '+file.name;
    const lang=document.getElementById('chat-lang-select')?.value||t.language||'auto';
    let context=retryMessage?.caseContext||null;
    if(file){context='Attached file: '+file.name+'\n'+(file.content||'');if(!/text|csv/.test(file.type||'')&&!/\.(txt|csv)$/i.test(file.name))context+='\nOnly file metadata is available. Ask the user for relevant text; do not claim to have read a PDF/image.';c.removeAttachedFile();}
    if(!retryMessage){
      AssistantThreads.append(t.id,{id:AssistantThreads.id('msg'),sender:'user',text,caseContext:context,attachment:file?{name:file.name,sizeStr:file.sizeStr}:null,lang,time:new Date().toISOString()});
      if(input){input.value='';input.style.height='auto';}
    }
    AssistantThreads.change(t.id,x=>{x.language=lang;});this.pending.add(t.id);this.refresh();
    try{
      const history=t.messages.map(m=>({sender:m.sender,text:m.text}));
      if(!retryMessage)history.pop();
      const result=await AssistantThreads.api('chat',{message:text,role:this.role(),caseContext:context,language:lang,chatHistory:history,retry:!!retryMessage});
      if(AssistantThreads.owner()!==owner)return;
      AssistantThreads.append(t.id,{id:AssistantThreads.id('msg'),sender:'ai',text:result.message,lang:result.detected_language?.detected_language_code||lang,
        visual:result.visual,sources:result.sources,validation:result.validation,time:new Date().toISOString()});
    }catch(error){if(AssistantThreads.owner()===owner)AssistantThreads.append(t.id,{id:AssistantThreads.id('msg'),sender:'ai',text:error.message,error:true,lang,time:new Date().toISOString()});}
    finally{this.pending.delete(t.id);if(AssistantThreads.owner()===owner&&AssistantThreads.active(false)?.id===t.id&&document.getElementById('chat-messages'))this.refresh();}
  },
  install(){
    if(this.installed)return;this.installed=true;
    const c=this.controller(),originalRender=c.render.bind(c),originalMessage=c._renderMessage.bind(c);
    c._formatText=text=>this.markdown(text);
    c._renderMessage=message=>{
      const html=originalMessage(message);
      if(message.sender==='user')return html;
      const template=document.createElement('template');template.innerHTML=html;
      const actions=template.content.querySelector('.u-msg-actions');if(actions)actions.insertAdjacentHTML('beforebegin',this.extras(message));
      return template.innerHTML;
    };
    c._getMessages=()=>AssistantThreads.active()?.messages||[];
    c._saveMessages=messages=>{const t=AssistantThreads.active();AssistantThreads.change(t.id,x=>{x.messages=messages;});};
    c.render=()=>{
      const html=originalRender();
      const template=document.createElement('template');template.innerHTML=html;
      template.content.querySelector('.u-chat-list-items').innerHTML=this.sidebar();
      const t=AssistantThreads.active();template.content.querySelector('#chat-messages').innerHTML=t.messages.length?t.messages.map(m=>c._renderMessage(m)).join(''):c._emptyChat();
      const qq=template.content.querySelector('#quick-questions');if(qq&&t.messages.length)qq.style.display='none';
      const hasLegacy=this.role()==='lawyer'?localStorage.getItem('lc_advocate_ai_messages'):(UserStore.get('conversations')||[]).some(t=>t.type==='ai'&&t.messages?.length);
      if(hasLegacy)template.content.querySelector('.u-chat-list-items').insertAdjacentHTML('beforeend','<button class="nyay-thread-export" onclick="AssistantChat.recoverLegacy()">Recover older browser history</button>');
      AssistantThreads.hydrate();return template.innerHTML;
    };
    c.sendMessage=()=>this.send();
    c.startNewChat=()=>{if(typeof LiveCourt!=='undefined')LiveCourt.detach();window.speechSynthesis?.cancel();AssistantThreads.create();this.refresh();};
    c.selectConversation=id=>{if(typeof LiveCourt!=='undefined')LiveCourt.detach();window.speechSynthesis?.cancel();AssistantThreads.select(id);this.refresh();};
    c.handleFeedback=(id,status)=>{
      const t=AssistantThreads.active(),index=t.messages.findIndex(m=>m.id===id);if(index<0)return;
      AssistantThreads.change(t.id,t=>{t.messages[index].feedback=status;});
      if(status==='not-satisfied'){const user=t.messages.slice(0,index).reverse().find(m=>m.sender==='user');if(user)this.send({retryMessage:user});}
      else this.refresh();
    };
    c.toggleSpeak=id=>{
      const message=AssistantThreads.active()?.messages.find(m=>m.id===id);if(!message)return;
      if(window.speechSynthesis?.speaking){window.speechSynthesis.cancel();return;}
      const language=message.lang||'en',voices=window.speechSynthesis?.getVoices()||[],voice=voices.find(v=>v.lang.split('-')[0]===language);
      if(!voice){AssistantThreads.notify('Install a matching browser voice to listen in this language. Case text stays on your device.','info');return;}
      const utterance=new SpeechSynthesisUtterance(message.text.replace(/[#*`]/g,''));utterance.lang=voice.lang;utterance.voice=voice;window.speechSynthesis.speak(utterance);
    };
    c.onEnter=()=>{this.refresh();AssistantThreads.hydrate();};
    c.launchCourtSimulator=id=>LiveCourt.launch(id);
    window.addEventListener('nyay-threads-updated',()=>{if(document.getElementById('chat-messages'))this.refreshSidebar();});
    window.addEventListener('online',()=>{AssistantThreads._hydration=null;AssistantThreads.hydrate();});
  }
};
AssistantChat.install();

/* One cancellable readout per user chat. Online speech requires a choice for each answer. */
const NyaySetuTTS = {
  _run: null,
  _BCP47_MAP: {hi:'hi-IN',en:'en-IN',mr:'mr-IN',gu:'gu-IN',bn:'bn-IN',ta:'ta-IN',te:'te-IN',kn:'kn-IN',ml:'ml-IN',pa:'pa-IN',ur:'ur-IN',or:'or-IN',as:'as-IN',ne:'ne-NP',sa:'sa-IN'},
  cleanTextForSpeech(text) {
    return String(text||'').replace(/```[\s\S]*?```/g,' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/https?:\/\/\S+/g,' ')
      .replace(/^\s*(?:#{1,6}|[-*•]|\d+[.)])\s+/gm,'')
      .replace(/[*_`]/g,'').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,'')
      .replace(/\s+/g,' ').trim();
  },
  splitIntoChunks(text,maxLen=180) {
    const chunks=[];
    for(const sentence of text.match(/[^.!?।]+[.!?।]*|[.!?।]+/g)||[]) {
      let rest=sentence.trim();
      while(rest.length>maxLen){let cut=rest.lastIndexOf(' ',maxLen);if(cut<maxLen/2)cut=maxLen;chunks.push(rest.slice(0,cut).trim());rest=rest.slice(cut).trim();}
      if(rest)chunks.push(rest);
    }
    return chunks;
  },
  language(text,code) {
    const normalized=String(code||'auto').toLowerCase().replace('_','-').split('-')[0];
    if(this._BCP47_MAP[normalized])return normalized;
    for(const [lang,script] of [['hi',/[\u0900-\u097f]/],['bn',/[\u0980-\u09ff]/],['pa',/[\u0a00-\u0a7f]/],['gu',/[\u0a80-\u0aff]/],['or',/[\u0b00-\u0b7f]/],['ta',/[\u0b80-\u0bff]/],['te',/[\u0c00-\u0c7f]/],['kn',/[\u0c80-\u0cff]/],['ml',/[\u0d00-\u0d7f]/],['ur',/[\u0600-\u06ff]/]])if(script.test(text))return lang;
    return 'en';
  },
  getBestVoice(tag) {
    const voices=window.speechSynthesis?.getVoices()||[],code=tag.toLowerCase().split('-')[0];
    return voices.find(v=>v.lang?.toLowerCase()===tag.toLowerCase())||voices.find(v=>v.lang?.toLowerCase().split(/[-_]/)[0]===code)||null;
  },
  _owner(){return typeof AuthManager!=='undefined'?AuthManager.getSession()?.id:null;},
  _current(run){if(this._run===run&&run.owner!==this._owner())this.stop();return this._run===run;},
  _emit(run,name,...args){try{run.callbacks[name]?.(run.id,...args);}catch(_){}},
  isSpeaking(id=null){return !!this._run&&(!id||this._run.id===id);},
  getActiveMsgId(){return this._run?.id||null;},
  speak(id,text,lang='auto',callbacks={}) {
    if(this.isSpeaking(id)){this.stop();return false;}
    this.stop();const clean=this.cleanTextForSpeech(text);
    if(!clean){callbacks.onError?.(id,'Is answer mein padhne layak text nahi hai.');return false;}
    const run={id,owner:this._owner(),callbacks,chunks:this.splitIntoChunks(clean),lang:this.language(clean,lang),index:0,online:false,timers:new Set()};
    this._run=run;this._emit(run,'onState','loading');this._begin(run);return true;
  },
  _later(run,fn,ms){const timer=setTimeout(()=>{run.timers.delete(timer);if(this._current(run))fn();},ms);run.timers.add(timer);return timer;},
  _clearTimer(run,timer){clearTimeout(timer);run.timers.delete(timer);},
  async _begin(run) {
    try {
      let voice=this.getBestVoice(this._BCP47_MAP[run.lang]);
      if(!voice&&window.speechSynthesis) {
        await new Promise(resolve=>{
          const done=()=>{window.speechSynthesis.removeEventListener?.('voiceschanged',changed);this._clearTimer(run,timer);run.cancelWait=null;resolve();};
          const changed=()=>{if(this.getBestVoice(this._BCP47_MAP[run.lang]))done();};
          const timer=this._later(run,done,1200);run.cancelWait=done;
          window.speechSynthesis.addEventListener?.('voiceschanged',changed);
          changed();
        });
        if(!this._current(run))return;
        voice=this.getBestVoice(this._BCP47_MAP[run.lang]);
      }
      if(voice){run.voice=voice;this._next(run);}else await this._online(run);
    }catch(_){this._fail(run,'Audio start nahi ho paya. Listen par dobara click karein.');}
  },
  async _online(run) {
    if(!this._current(run))return;
    if(!run.online){
      const allowed=await run.callbacks.requestOnline?.(run.id,run.lang);
      if(!this._current(run))return;
      if(!allowed){this.stop();return;}
      run.online=true;
    }
    this._next(run);
  },
  _next(run) {
    if(!this._current(run))return;
    if(run.index>=run.chunks.length){this.stop();return;}
    if(run.online)this._stream(run);else this._native(run);
  },
  _native(run) {
    let utterance,started,deadline,settled=false;
    const cleanup=()=>{this._clearTimer(run,started);this._clearTimer(run,deadline);if(utterance){utterance.onstart=utterance.onend=utterance.onerror=null;}run.utterance=null;};
    const failed=()=>{if(settled||!this._current(run))return;settled=true;cleanup();window.speechSynthesis?.cancel();this._emit(run,'onState','loading');this._online(run).catch(()=>this._fail(run,'Audio unavailable hai. Dobara try karein.'));};
    try {
      utterance=new SpeechSynthesisUtterance(run.chunks[run.index]);run.utterance=utterance;
      utterance.voice=run.voice;utterance.lang=run.voice.lang;utterance.rate=.95;
      utterance.onstart=()=>{if(!this._current(run))return;this._clearTimer(run,started);this._emit(run,'onState','playing');this._emit(run,'onStart');};
      utterance.onend=()=>{if(settled||!this._current(run))return;settled=true;cleanup();run.index++;this._later(run,()=>this._next(run),60);};
      utterance.onerror=failed;
      started=this._later(run,failed,6000);deadline=this._later(run,failed,45000);
      if(window.speechSynthesis.paused)window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    }catch(_){failed();}
  },
  async _stream(run) {
    this._emit(run,'onState','loading');
    const abort=new AbortController();run.abort=abort;
    const timer=this._later(run,()=>abort.abort(),15000);
    try {
      const url=typeof AuthManager!=='undefined'?AuthManager.getApiUrl('/api/ai/tts'):'/api/ai/tts';
      const response=await fetch(url,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:run.chunks[run.index],language:run.lang}),signal:abort.signal});
      if(!response.ok||!response.headers.get('content-type')?.includes('audio/'))throw Error('Audio service unavailable');
      const blob=await response.blob();this._clearTimer(run,timer);if(!this._current(run))return;
      run.url=URL.createObjectURL(blob);const audio=new Audio(run.url);run.audio=audio;
      let ended=false;
      const deadline=this._later(run,()=>this._fail(run,'Audio playback ruk gaya. Listen par dobara click karein.'),45000);
      audio.onended=()=>{if(ended||!this._current(run))return;ended=true;this._clearTimer(run,deadline);this._releaseAudio(run);run.index++;this._next(run);};
      audio.onerror=()=>this._fail(run,'Audio play nahi ho saka. Browser ka sound aur connection check karein.');
      audio.onplaying=()=>{if(this._current(run)){this._emit(run,'onState','playing');this._emit(run,'onStart');}};
      await audio.play();
    }catch(error){if(this._current(run))this._fail(run,error.name==='NotAllowedError'?'Browser ne audio block kiya. Site ka sound allow karke Listen par dobara click karein.':'Online voice unavailable hai. Connection check karke dobara try karein, ya device par matching language voice install karein.');}
    finally{this._clearTimer(run,timer);}
  },
  _releaseAudio(run){if(run.audio){run.audio.onended=run.audio.onerror=run.audio.onplaying=null;run.audio.pause();run.audio.removeAttribute('src');run.audio.load();run.audio=null;}if(run.url){URL.revokeObjectURL(run.url);run.url=null;}},
  _fail(run,message){if(!this._current(run))return;this.stop();this._emit(run,'onError',message);},
  stop() {
    const run=this._run;if(!run)return;this._run=null;
    run.cancelWait?.();run.abort?.abort();for(const timer of run.timers)clearTimeout(timer);run.timers.clear();
    if(run.utterance)run.utterance.onstart=run.utterance.onend=run.utterance.onerror=null;
    this._releaseAudio(run);window.speechSynthesis?.cancel();this._emit(run,'onEnd');
  }
};
if(typeof window!=='undefined') {
  window.speechSynthesis?.getVoices();
  window.addEventListener('pagehide',()=>NyaySetuTTS.stop());
  window.addEventListener('hashchange',()=>NyaySetuTTS.stop());
}

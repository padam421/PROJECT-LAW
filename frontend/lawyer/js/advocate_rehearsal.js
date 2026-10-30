/* Counsel rehearsal uses a case snapshot and its own transcript, never the citizen simulator. */
const AdvocateRehearsal = {
  context: null, pending: new Set(),
  e(v) { return AdvocateChatBot.e(v); },
  session() {
    const owner = AssistantThreads.owner();
    if (!this.context || this.context.owner !== owner) {
      const saved = AssistantThreads.ensure().activeRehearsal;
      this.context = saved ? {owner, ...saved} : null;
    }
    const c = this.context; return c && c.owner === owner ? AssistantThreads.getForCourt(c.threadId)?.courtSessions?.[c.sessionId] : null;
  },
  remember() { const {threadId, sessionId} = this.context; AssistantThreads.ensure().activeRehearsal = {threadId, sessionId}; AssistantThreads.persist(); },
  update(edit) { const c = this.context; if (!this.session()) return; AssistantThreads.changeCourt(c.threadId, t => { const s = t.courtSessions[c.sessionId]; edit(s); s.updatedAt = new Date().toISOString(); }); },
  launch(messageId) {
    const t = AssistantThreads.active(), index = t.messages.findIndex(m => m.id === messageId);
    if (index < 0) return;
    const through = t.messages.slice(0, index + 1), facts = through.filter(m => m.sender === 'user').map(m => m.text + (m.caseContext ? '\n' + m.caseContext : '')).join('\n\n');
    const session = {id: AssistantThreads.id('hearing'), kind: 'advocate-rehearsal', title: t.title, messageId,
      record: {facts, research: t.messages[index].text}, summary: facts, stage: 'bail', side: 'defense', language: t.language || 'auto',
      transcript: [], round: 1, draft: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()};
    AssistantThreads.change(t.id, t => { t.courtSessions ||= {}; t.courtSessions[session.id] = session; });
    this.context = {owner: AssistantThreads.owner(), threadId: t.id, sessionId: session.id}; this.remember(); Router.navigate('/court/simulate');
  },
  resume(threadId, sessionId) {
    const s = AssistantThreads.getForCourt(threadId)?.courtSessions?.[sessionId];
    if (s?.kind !== 'advocate-rehearsal') return;
    this.context = {owner: AssistantThreads.owner(), threadId, sessionId}; this.remember(); Router.navigate('/court/simulate');
  },
  library() {
    const entries = AssistantThreads.savedCourts().filter(e => e.session.kind === 'advocate-rehearsal');
    return '<section class="adv-hearing-home"><header><span class="adv-eyebrow">ADVOCATE HEARING LAB</span><h1>Test the argument before the hearing.</h1><p>Practise as counsel with the case record, likely opposition and difficult bench questions. Research and hearing transcripts stay separate.</p><button class="adv-primary" onclick="Router.navigate(\'/ai-assistant\')">Open a case chat →</button></header><div class="adv-stage-grid">' +
      [['bail', 'Bail submissions', 'Stress-test custody, the available record and your requested relief.'], ['charge', 'Charge-stage arguments', 'Identify the alleged ingredients and what the record actually supports.'], ['cross', 'Cross-examination', 'Ask focused questions. Unknown witness knowledge stays unknown.'], ['final', 'Final submissions', 'Connect evidence, supported authority and alternative submissions.']].map(([key, title, detail]) => '<article><span class="adv-eyebrow">' + this.e(key.toUpperCase()) + '</span><h3>' + title + '</h3><p>' + detail + '</p></article>').join('') +
      '</div><h2>Saved rehearsals</h2><div class="adv-session-grid">' + (entries.length ? entries.map(({threadId, chatDeleted, session:s}) => '<article><h3>' + this.e(s.title) + '</h3><p>' + this.e(s.stage) + ' · ' + this.e(s.side) + ' · ' + s.transcript.length + ' turns</p>' + (chatDeleted ? '<small>Original chat deleted · case snapshot retained</small>' : '') +
        '<div><button onclick="AdvocateRehearsal.resume(\'' + threadId + '\',\'' + s.id + '\')">Resume rehearsal</button><button onclick="AdvocateRehearsal.remove(\'' + threadId + '\',\'' + s.id + '\')">Delete</button></div></article>').join('') : '<p>Use “Rehearse this case” below an analysis to create a hearing with that case record.</p>') + '</div><p class="adv-muted">Simulated practice, not a court order or prediction. Historical excerpts and official text snapshots do not confirm later legal developments.</p></section>';
  },
  render() {
    const s = this.session();
    if (!s) return '<div class="adv-hearing-home"><h1>Select a case to rehearse</h1><p>Open a research answer and choose “Rehearse this case”, or resume a saved rehearsal.</p><button class="adv-primary" onclick="Router.navigate(\'/court\')">Open hearing library</button></div>';
    return '<section class="adv-hearing"><header class="adv-chat-header adv-rehearsal-header"><div class="adv-rehearsal-heading"><span class="material-symbols-rounded adv-rehearsal-icon" aria-hidden="true">gavel</span><h1>Hearing rehearsal</h1><span class="adv-practice-badge">Simulation</span></div><button onclick="Router.navigate(\'/court\')">Saved rehearsals</button></header><div class="adv-hearing-grid"><aside class="adv-hearing-record"><h2>Hearing setup</h2><details class="adv-case-identity"><summary>Case details</summary><p dir="auto">' + this.e(s.title) + '</p></details><label>Hearing stage<select id="adv-stage" onchange="AdvocateRehearsal.setting(\'stage\',this.value)">' +
      [['bail','Bail submissions'],['charge','Charge-stage arguments'],['cross','Cross-examination'],['final','Final submissions']].map(([v,l]) => '<option value="' + v + '"' + (v === s.stage ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label><label>You appear for<select onchange="AdvocateRehearsal.setting(\'side\',this.value)"><option value="defense"' + (s.side === 'defense' ? ' selected' : '') + '>Defense / applicant</option><option value="prosecution"' + (s.side === 'prosecution' ? ' selected' : '') + '>Prosecution / respondent</option></select></label><p class="adv-muted">Changing stage or side starts a separate round; earlier turns remain saved.</p><details><summary>Factual case record</summary><div dir="auto">' + AdvocateChatBot.markdown(s.record.facts) + '</div></details><details><summary>Research brief</summary><div dir="auto">' + AdvocateChatBot.markdown(s.record.research) + '</div></details><button onclick="AdvocateRehearsal.export()">Export hearing & brief ↓</button></aside><main class="adv-hearing-main"><div id="adv-transcript" class="adv-transcript">' + this.turns(s) + '</div><form class="adv-composer" onsubmit="event.preventDefault();AdvocateRehearsal.submit()"><label for="adv-submission">Your argument</label><textarea id="adv-submission" rows="4" maxlength="30000" placeholder="State your submission, respond to the bench, or ask one cross-examination question…" oninput="AdvocateRehearsal.saveDraft(this.value)">' + this.e(s.draft || '') + '</textarea><div class="adv-compose-tools"><small>Practice uses the saved case record; added facts remain counsel statements.</small><button class="adv-primary" id="adv-hearing-send"' + (this.pending.has(s.id) ? ' disabled' : '') + '>' + (s.transcript.length ? 'Submit argument →' : 'Start this hearing →') + '</button></div></form></main></div></section>';
  },
  turns(s) {
    return (s.transcript.length ? s.transcript.map(turn => '<article class="adv-hearing-turn ' + (turn.actor === 'COUNSEL' ? 'adv-counsel-turn' : '') + '"><span class="adv-eyebrow">' + this.e(turn.actor === 'COUNSEL' ? 'YOUR SUBMISSION' : 'REHEARSAL ROUND') + ' · ' + this.e(turn.stage || s.stage) + ' · ' + this.e(turn.side || s.side) + '</span>' +
      (turn.sections?.length ? turn.sections.map(part => '<section class="adv-role-block adv-role-' + this.e(part.key) + '"><h3>' + this.e(part.title) + '</h3>' + part.paragraphs.map(p => AdvocateChatBot.markdown(p.text + ' ' + [...new Set((p.citations || []).map(c => '[' + c.source_id + ']'))].join(' '))).join('') + '</section>').join('') : AdvocateChatBot.markdown(turn.text)) + AdvocateChatBot.sources(turn.sources) + '</article>').join('') : '<div class="adv-empty"><h2>Ready for your opening submission.</h2><p>Choose the hearing stage and your side, then submit your argument. You can also start with an empty submission to receive the opposition’s position and the first bench question.</p></div>') +
      (this.pending.has(s.id) ? '<p class="adv-progress" role="status">Preparing the opposing response, bench question and counsel feedback…</p>' : '') + (s.error ? '<div class="adv-error" role="alert">' + this.e(s.error) + '<button onclick="AdvocateRehearsal.submit(true)">Retry saved submission</button></div>' : '');
  },
  refresh() {
    const s = this.session(), panel = document.getElementById('adv-transcript'); if (!s || !panel) return;
    panel.innerHTML = this.turns(s); panel.scrollTop = panel.scrollHeight;
    const button = document.getElementById('adv-hearing-send'); if (button) { button.disabled = this.pending.has(s.id); button.textContent = s.transcript.length ? 'Submit argument →' : 'Start this hearing →'; }
  },
  setting(key, value) {
    if (this.pending.has(this.session()?.id)) { Router.navigate('/court/simulate'); return; }
    this.update(s => { if (s[key] !== value) s.round = (s.round || 1) + 1; s[key] = value; s.error = ''; s.lastSubmission = ''; });
  },
  saveDraft(text) { this.update(s => { s.draft = text; }); },
  async submit(retry = false) {
    const s = this.session(), c = this.context && {...this.context}; if (!s || this.pending.has(s.id)) return;
    const input = document.getElementById('adv-submission');
    const submission = retry ? s.lastSubmission || '' : input?.value?.trim() || '';
    if (!retry && s.transcript.some(t => (t.round || 1) === (s.round || 1)) && !submission) return;
    if (!retry) this.update(s => { s.lastSubmission = submission; s.error = ''; if (submission) s.transcript.push({actor:'COUNSEL', text:submission, stage:s.stage, side:s.side, round:s.round || 1, time:new Date().toISOString()}); s.draft = ''; });
    const transcript = s.transcript.map(t => ({actor:t.actor,text:t.text,stage:t.stage,side:t.side,round:t.round || 1}));
    // The pending submission is supplied once, as latest_submission, not as a completed AI exchange.
    if (submission && transcript.at(-1)?.actor === 'COUNSEL' && transcript.at(-1).text === submission) transcript.pop();
    this.pending.add(s.id); if (input && !retry) input.value = ''; this.refresh();
    const patch = edit => { if (AssistantThreads.owner() === c.owner) AssistantThreads.changeCourt(c.threadId, t => { const target = t.courtSessions[c.sessionId]; if (target) { edit(target); target.updatedAt = new Date().toISOString(); } }); };
    try {
      const result = await AssistantThreads.api('rehearsal', {record:s.record, stage:s.stage, side:s.side, round:s.round || 1, language:s.language, transcript, submission});
      patch(s => { s.transcript.push({actor:'PRACTICE', text:result.message, sections:result.sections, sources:result.sources, stage:s.stage, side:s.side, round:s.round || 1, time:new Date().toISOString()}); s.error = ''; });
    } catch (error) { patch(s => { s.error = error.message; }); }
    finally { this.pending.delete(s.id); if (this.context?.sessionId === c.sessionId && AssistantThreads.owner() === c.owner) this.refresh(); }
  },
  export() { const s = this.session(); if (!s) return; const url = URL.createObjectURL(new Blob([JSON.stringify(s, null, 2)], {type:'application/json'})); const a = document.createElement('a'); a.href = url; a.download = 'advocate-hearing-' + s.id + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); },
  async remove(threadId, sessionId) { if (this.pending.has(sessionId) || !confirm('Delete only this rehearsal? The case chat and other rehearsals remain.')) return; await AssistantThreads.removeCourt(threadId, sessionId); Router.navigate('/court'); }
};

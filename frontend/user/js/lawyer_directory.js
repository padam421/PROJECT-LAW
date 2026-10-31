/* User-only discovery. Fictional directory entries never enter the advocate/auth database. */
const LawyerDirectory = {
  assetRoot: new URL('../assets/lawyers/', document.currentScript.src).href,
  categories: [['all','All specialisations'],['property','Property & Land'],['civil','Civil Matters'],['family','Family & Matrimonial'],['criminal','Criminal & NDPS'],['business','Business & Corporate'],['consumer','Consumer Rights'],['employment','Employment & Labour'],['tax','Tax & GST'],['cyber','Cyber & Technology'],['ip','Intellectual Property'],['immigration','Immigration'],['constitutional','Constitutional & Writs'],['banking','Banking & Recovery'],['arbitration','Arbitration'],['succession','Wills & Succession'],['environment','Environment'],['insurance','Insurance'],['motor','Motor Accident Claims']],
  rows: [
    ['arjun-mehra','Arjun Mehra','Criminal & NDPS Law',15,'Delhi',['Hindi','English','Punjabi'],4.8,326,['criminal','constitutional'],59,'Bail preparation, criminal defence and evidence review.',['District & Sessions Courts','Delhi High Court']],
    ['ananya-rao','Ananya Rao','Property & Civil Law',10,'Bengaluru',['Kannada','English','Hindi'],4.9,218,['property','civil','succession'],45,'Title review, property disputes, partitions and civil documentation.',['Civil Courts','Karnataka High Court']],
    ['devendra-shah','Devendra Shah','Business & Arbitration',30,'Mumbai',['Gujarati','Hindi','English'],4.9,684,['business','arbitration','banking'],110,'Commercial agreements, business disputes and arbitration preparation.',['Commercial Courts','Bombay High Court']],
    ['kavita-menon','Kavita Menon','Family & Matrimonial Law',18,'Kochi',['Malayalam','English','Hindi'],4.8,412,['family','succession','civil'],65,'Family consultations, mediation preparation and succession planning.',['Family Courts','Kerala High Court']],
    ['rohan-desai','Rohan Desai','Cyber & Consumer Law',5,'Pune',['Marathi','Hindi','English'],4.6,87,['cyber','consumer'],25,'Digital evidence, online disputes and consumer complaint preparation.',['Consumer Commissions','District Courts']],
    ['farah-siddiqui','Farah Siddiqui','Constitutional & Service Law',25,'Lucknow',['Urdu','Hindi','English'],4.9,526,['constitutional','employment'],90,'Writ preparation, administrative matters and service disputes.',['Allahabad High Court','Administrative Tribunals']],
    ['aman-gill','Aman Gill','Employment & Labour Law',12,'Chandigarh',['Punjabi','Hindi','English'],4.7,184,['employment','insurance'],49,'Workplace disputes, employment agreements and benefits documentation.',['Labour Courts','Punjab & Haryana High Court']],
    ['priya-iyer','Priya Iyer','Intellectual Property',5,'Chennai',['Tamil','English','Hindi'],4.7,96,['ip','business','cyber'],29,'Trademark research, copyright queries and startup documentation.',['Commercial Courts','Madras High Court']],
    ['sanjay-kulkarni','Sanjay Kulkarni','Tax, GST & Banking',22,'Mumbai',['Marathi','Hindi','English'],4.8,438,['tax','banking','business'],85,'Tax notice review, GST documentation and banking disputes.',['Tax Tribunals','Bombay High Court']],
    ['neha-banerjee','Neha Banerjee','Civil & Consumer Disputes',8,'Kolkata',['Bengali','Hindi','English'],4.7,142,['civil','consumer','motor','insurance'],35,'Civil claims, consumer grievances and accident-claim documentation.',['Civil Courts','Consumer Commissions']],
    ['vivek-reddy','Vivek Reddy','Immigration & Business Law',10,'Hyderabad',['Telugu','Hindi','English'],4.8,203,['immigration','business'],42,'Immigration document review and cross-border business consultations.',['Telangana High Court','Commercial Courts']],
    ['meera-joshi','Meera Joshi','Land & Environmental Law',20,'Jaipur',['Hindi','Rajasthani','English'],4.8,371,['property','environment','civil'],75,'Land records, environmental compliance and property dispute preparation.',['Rajasthan High Court','National Green Tribunal']]
  ],
  profiles() { return this.rows.map((r,i)=>({id:'demo_adv_'+r[0],name:'Adv. '+r[1],specialization:r[2],experienceYears:r[3],experience:r[3]+' years',city:r[4],languages:r[5],rating:r[6],reviews:r[7],categories:r[8],rate:r[9],about:r[10],courts:r[11],photo:this.assetRoot+'portrait-'+(i+1)+'.png',demo:true,verified:false,modes:['chat','audio','video']})); },
  get(id) { return this.profiles().find(l=>l.id===id); },
  e(v) { return Utils.escapeHtml(String(v??'')); },
  money(v) { return '₹'+Number(v).toLocaleString('en-IN'); },
  icon(name) { return `<span class="material-symbols-rounded" aria-hidden="true">${name}</span>`; },
  modeNames: {chat:'Chat',audio:'Voice call',video:'Video call'},
  modes: {chat:'chat_bubble',audio:'call',video:'videocam'},
  rate(l,mode) { return mode==='chat'?Math.round(l.rate*7/10):mode==='video'?Math.round(l.rate*12/10):l.rate; },
  quote(id,mode,minutes) {
    const l=this.get(id);minutes=Number(minutes);
    if(!l||!l.modes.includes(mode)||![15,30,60].includes(minutes))throw Error('Choose a valid advocate, consultation mode and duration.');
    const rate=this.rate(l,mode);return {rate,minutes,total:rate*minutes};
  },
  owner() { return AuthManager.getSession()?.id || null; },
  read() {
    const owner=this.owner();if(!owner)return [];
    try { const rows=JSON.parse(localStorage.getItem('nyay_demo_bookings_v1_'+encodeURIComponent(owner))||'[]');return Array.isArray(rows)?rows.filter(b=>b.owner===owner&&this.get(b.lawyerId)):[]; }catch(_){return [];}
  },
  write(rows) {
    const owner=this.owner();if(!owner)throw Error('Sign in to save a demo booking.');
    if(rows.some(b=>b.owner!==owner))throw Error('This booking belongs to another account.');
    localStorage.setItem('nyay_demo_bookings_v1_'+encodeURIComponent(owner),JSON.stringify(rows));
  },
  indiaDate(offset=0) {
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));const d=new Date(`${p.year}-${p.month}-${p.day}T12:00:00+05:30`);d.setUTCDate(d.getUTCDate()+offset);return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  },
  dates() { return Array.from({length:7},(_,i)=>this.indiaDate(i+1)); },
  slots:['10:00','11:30','14:00','16:00','18:00'],
  dateLabel(date) { return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',weekday:'short'}).format(new Date(date+'T12:00:00+05:30')); },
  isTaken(id,date,slot,minutes,except=null) {
    const time=s=>Number(s.slice(0,2))*60+Number(s.slice(3));
    return this.read().some(b=>b.id!==except&&b.status!=='cancelled'&&b.lawyerId===id&&b.date===date&&time(slot)<time(b.slot)+b.minutes&&time(b.slot)<time(slot)+minutes);
  },
  reserve({lawyerId,mode,minutes,date,slot,topic=''}) {
    const owner=this.owner();if(!owner)throw Error('Sign in to book a demo session.');
    const q=this.quote(lawyerId,mode,minutes);
    if(!this.dates().includes(date)||!this.slots.includes(slot))throw Error('Choose an available future date and time.');
    if(this.isTaken(lawyerId,date,slot,q.minutes))throw Error('You already reserved this advocate for that time. Choose another slot.');
    const booking={id:'demo_booking_'+crypto.randomUUID(),owner,lawyerId,mode,...q,date,slot,topic:String(topic).trim().slice(0,1500),status:'reserved',paid:false,createdAt:new Date().toISOString(),messages:[],notes:''};
    this.write([booking,...this.read()]);return booking;
  },
  update(id,patch) {
    const rows=this.read(),b=rows.find(x=>x.id===id);if(!b)throw Error('Booking not found in this account.');
    Object.assign(b,patch);this.write(rows);return b;
  },
  query:'',category:'all',sort:'experience',selected:new Set(),cache:[],_cacheOwner:null,
  async load() {
    const owner=this.owner();
    if(this._cacheOwner!==owner){this.selected.clear();this.cache=[];this._cacheOwner=owner;}
    let real=[];
    try {const res=await fetch(UserApiClient.getUrl('/api/lawyers'),{signal:AbortSignal.timeout(5000)});if(res.ok){const data=await res.json();real=Array.isArray(data.lawyers)?data.lawyers:[];}}catch(_){}
    if(this.owner()!==owner)return [];
    this.cache=[...real.filter(l=>l&&l.id&&!String(l.id).startsWith('demo_adv_')).map(l=>({...l,demo:false})),...this.profiles()];return this.cache;
  },
  matches(l) {
    const text=[l.name,l.specialization,l.city,...(l.languages||[]),...(l.categories||[])].join(' ').toLowerCase();
    const category=this.category==='all'||(l.categories||[]).includes(this.category)||text.includes(this.category==='business'?'corporate':this.category);
    return category&&this.query.toLowerCase().trim().split(/\s+/).every(w=>text.includes(w));
  },
  visible() {
    return this.cache.filter(l=>this.matches(l)).sort((a,b)=>this.sort==='price'?((a.rate||a.fee/30||0)-(b.rate||b.fee/30||0)):this.sort==='rating'?(Number(b.rating||0)-Number(a.rating||0)):(parseInt(b.experienceYears||b.experience)||0)-(parseInt(a.experienceYears||a.experience)||0));
  },
  shell(content,title='Find Lawyers') {return UserComponents.AppLayout(`<div class="ld-directory">${content}</div>`,'lawyers',title);},
  notice() {return '<p class="ld-notice">Demo profiles use AI-generated portraits and illustrative experience, ratings and fees. Demo bookings are saved on this device; no money is charged and no live advocate is contacted.</p>';},
  photo(l,cls='') {return `<img class="ld-portrait ${cls}" src="${this.e(l.photo)}" alt="AI-generated portrait for ${this.e(l.name)} — fictional demo" loading="lazy" width="112" height="112">`;},
  async render() {
    await this.load();
    return this.shell(`<header class="ld-hero"><div><span class="ld-kicker">THE RIGHT EXPERTISE, WITH CLARITY</span><h1>Find your legal expert.</h1><p>Explore practice areas, compare experience and choose a consultation that fits.</p></div><a class="u-btn u-btn-secondary" href="#/lawyers/bookings">${this.icon('calendar_month')} My demo bookings <span>${this.read().length}</span></a></header>
      ${this.notice()}<div class="ld-search-row"><label class="ld-search">${this.icon('search')}<input type="search" aria-label="Search lawyers" placeholder="Name, specialisation, city or language" value="${this.e(this.query)}" oninput="LawyerDirectory.query=this.value;LawyerDirectory.refresh()"></label><label class="ld-sort">Sort by<select aria-label="Sort lawyers" onchange="LawyerDirectory.sort=this.value;LawyerDirectory.refresh()">${[['experience','Most experienced'],['price','Lowest fee'],['rating','Highest rating']].map(([v,t])=>`<option value="${v}" ${this.sort===v?'selected':''}>${t}</option>`).join('')}</select></label></div>
      <div class="ld-filters" aria-label="Specialisations">${this.categories.map(([id,label])=>`<button type="button" data-category="${id}" aria-pressed="${this.category===id}" class="${this.category===id?'active':''}" onclick="LawyerDirectory.filter('${id}')">${label}</button>`).join('')}</div>
      <div class="ld-results-bar"><span id="ld-count">${this.visible().length} advocates</span><a href="#/lawyers/compare" class="u-btn u-btn-secondary">${this.icon('compare_arrows')} Compare <span id="ld-compare-count">${this.selected.size}/3</span></a></div>
      <div id="ld-grid" class="ld-grid">${this.cards()}</div>`);
  },
  filter(value) {this.category=value;document.querySelectorAll('[data-category]').forEach(b=>{const active=b.dataset.category===value;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});this.refresh();},
  refresh() {const grid=document.getElementById('ld-grid');if(grid)grid.innerHTML=this.cards();const count=document.getElementById('ld-count');if(count)count.textContent=this.visible().length+' advocates';},
  cards() {const rows=this.visible();return rows.length?rows.map(l=>this.card(l)).join(''):'<div class="ld-empty"><h2>No matches for these filters.</h2><p>Try another city, language or practice area.</p><button class="u-btn u-btn-secondary" onclick="LawyerDirectory.query=\'\';LawyerDirectory.category=\'all\';Router.navigate(\'/lawyers\')">Clear filters</button></div>';},
  card(l) {
    if(!l.demo)return `<article class="ld-card ld-real"><span class="ld-badge">${l.verified?'Verified advocate':'Listed advocate'}</span><h2>${this.e(l.name)}</h2><p>${this.e(l.specialization)}</p><p>${this.e(l.city)} · ${this.e(l.experience)}</p><p>${this.e((l.languages||[]).join(', '))}</p><strong>${this.money(l.fee||0)} / ${this.e(l.feeDuration||'consultation')}</strong><a class="u-btn u-btn-primary" href="#/lawyer/${encodeURIComponent(l.id)}">View profile & book</a></article>`;
    return `<article class="ld-card"><div class="ld-card-top"><span class="ld-badge">Demo profile</span><label class="ld-compare-check"><input type="checkbox" aria-label="Compare ${this.e(l.name)}" ${this.selected.has(l.id)?'checked':''} onchange="LawyerDirectory.comparePick('${l.id}',this)">Compare</label></div>
      <a class="ld-profile-link" href="#/lawyer/${l.id}">${this.photo(l)}<h2>${this.e(l.name)}</h2><p class="ld-specialty">${this.e(l.specialization)}</p></a>
      <div class="ld-rating">${this.icon('star')}<strong>${l.rating.toFixed(1)}</strong><span>${l.reviews} sample reviews</span></div>
      <p class="ld-meta">${this.icon('work')} ${l.experienceYears} years experience <span>· ${this.e(l.city)}</span></p>
      <p class="ld-meta ld-languages">${this.icon('translate')} ${this.e(l.languages.join(', '))}</p>
      <div class="ld-card-bottom"><div class="ld-fee"><strong>${this.money(l.rate)}<small>/min</small></strong><span>Voice · ${this.money(l.rate*60)}/hour</span></div><div class="ld-mode-icons">${l.modes.map(m=>`<a class="ld-mode-${m}" href="#/consultation/book?lawyerId=${l.id}&mode=${m}" aria-label="Book ${this.modeNames[m]} with ${this.e(l.name)}" title="${this.modeNames[m]} · ${this.money(this.rate(l,m))}/min">${this.icon(this.modes[m])}</a>`).join('')}</div></div>
      <a class="u-btn ld-book" href="#/consultation/book?lawyerId=${l.id}">Choose a slot ${this.icon('arrow_forward')}</a><span class="ld-availability">${this.icon('event_available')} Demo slots over the next 7 days</span></article>`;
  },
  comparePick(id,input) {
    if(input.checked&&this.selected.size>=3){input.checked=false;Utils.showToast('Compare up to 3 advocates at a time.','info');return;}
    input.checked?this.selected.add(id):this.selected.delete(id);const c=document.getElementById('ld-compare-count');if(c)c.textContent=this.selected.size+'/3';
  },
  async compare() {
    await this.load();const rows=this.profiles().filter(l=>this.selected.has(l.id));
    if(!rows.length)return this.shell('<a href="#/lawyers" class="ld-back">← Find Lawyers</a><div class="ld-empty"><h1>Choose advocates to compare.</h1><p>Select Compare on up to three profile cards.</p><a class="u-btn u-btn-primary" href="#/lawyers">Browse profiles</a></div>','Compare Lawyers');
    return this.shell(`<a href="#/lawyers" class="ld-back">← Find Lawyers</a><h1>Compare your shortlist</h1>${this.notice()}<div class="ld-table-wrap"><table class="ld-compare-table"><thead><tr><th>Profile</th>${rows.map(l=>`<th>${this.photo(l)}<a href="#/lawyer/${l.id}">${this.e(l.name)}</a></th>`).join('')}</tr></thead><tbody>${[['Specialisation',l=>l.specialization],['Experience',l=>l.experience],['City',l=>l.city],['Languages',l=>l.languages.join(', ')],['Sample rating',l=>l.rating+' / 5 · '+l.reviews+' sample reviews'],...Object.keys(this.modes).map(m=>[this.modeNames[m],l=>this.money(this.rate(l,m))+'/min · '+this.money(this.rate(l,m)*60)+'/hour'])].map(([label,fn])=>`<tr><th>${label}</th>${rows.map(l=>`<td>${this.e(fn(l))}</td>`).join('')}</tr>`).join('')}<tr><th>Next step</th>${rows.map(l=>`<td><a class="u-btn u-btn-primary" href="#/consultation/book?lawyerId=${l.id}">Choose slot</a></td>`).join('')}</tr></tbody></table></div>`,'Compare Lawyers');
  },
  profile(id) {
    const l=this.get(id);if(!l)return this.notFound();
    return this.shell(`<a href="#/lawyers" class="ld-back">← Find Lawyers</a><div class="ld-profile-hero">${this.photo(l)}<div><span class="ld-badge">Fictional demo advocate · AI portrait</span><h1>${this.e(l.name)}</h1><p>${this.e(l.specialization)}</p><p class="ld-muted">${l.experience} · ${this.e(l.city)} · ★ ${l.rating} (${l.reviews} sample reviews)</p></div></div>
      <div class="ld-two-col"><section class="ld-panel"><h2>Practice focus</h2><p>${this.e(l.about)}</p><div class="ld-tags">${l.categories.map(c=>`<span>${this.e(this.categories.find(x=>x[0]===c)[1])}</span>`).join('')}</div><h3>Languages</h3><p>${this.e(l.languages.join(' · '))}</p><h3>Illustrative courts of practice</h3><p>${this.e(l.courts.join(' · '))}</p><h3>Before your consultation</h3><p>Prepare a short timeline, your key questions and a list of available documents.</p>${this.notice()}<p class="ld-muted">This is not a verified practitioner listing. No Bar registration, qualification or case outcome is claimed.</p></section>
      <aside class="ld-panel"><h2>Choose how to connect</h2><p class="ld-muted">Illustrative rates reflect the profile’s experience and practice area.</p>${l.modes.map(m=>`<a class="ld-rate-row" href="#/consultation/book?lawyerId=${l.id}&mode=${m}">${this.icon(this.modes[m])}<span><strong>${this.modeNames[m]}</strong><small>${this.money(this.rate(l,m)*60)} / hour</small></span><b>${this.money(this.rate(l,m))}/min</b>${this.icon('chevron_right')}</a>`).join('')}<p class="ld-muted">Select 15, 30 or 60 minutes. The full demo estimate is shown before you reserve.</p></aside></div>`,'Advocate Profile');
  },
  booking(id) {
    const l=this.get(id);if(!l)return this.notFound();const requested=new URLSearchParams(window.location.hash.split('?')[1]||'').get('mode');const mode=l.modes.includes(requested)?requested:'audio';
    return this.shell(`<a href="#/lawyer/${id}" class="ld-back">← Advocate profile</a><header class="ld-hero"><div><span class="ld-kicker">PLAN YOUR CONSULTATION</span><h1>Choose a time that suits you.</h1><p>${this.e(l.name)} · ${this.e(l.specialization)}</p></div></header><div class="ld-two-col"><form id="ld-booking-form" class="ld-panel" data-owner="${this.e(this.owner())}" onsubmit="event.preventDefault();LawyerDirectory.submitBooking('${id}')"><h2>Session details</h2>
      <label>Consultation mode<select id="ld-mode" onchange="LawyerDirectory.updateQuote('${id}')">${l.modes.map(m=>`<option value="${m}" ${mode===m?'selected':''}>${this.modeNames[m]} · ${this.money(this.rate(l,m))}/min</option>`).join('')}</select></label>
      <label>Duration<select id="ld-minutes" onchange="LawyerDirectory.updateQuote('${id}')"><option value="15">15 minutes</option><option value="30" selected>30 minutes</option><option value="60">60 minutes · 1 hour</option></select></label>
      <div class="ld-field-row"><label>Date (India time)<select id="ld-date">${this.dates().map(d=>`<option value="${d}">${this.dateLabel(d)}</option>`).join('')}</select></label><label>Time (IST)<select id="ld-slot">${this.slots.map(s=>`<option value="${s}">${s}</option>`).join('')}</select></label></div>
      <label>Consultation topic <span class="ld-muted">(optional)</span><textarea id="ld-topic" maxlength="1500" rows="3" placeholder="Briefly describe what you would like to discuss. Use sample facts for this demo."></textarea></label>
      <p id="ld-book-error" role="alert"></p><button class="u-btn u-btn-primary ld-book" type="submit">Reserve demo slot ${this.icon('arrow_forward')}</button></form>
      <aside class="ld-panel ld-summary">${this.photo(l)}<h2>${this.e(l.name)}</h2><p>${l.experience} · ${this.e(l.city)}</p><div id="ld-quote" aria-live="polite">${this.quoteHtml(id,mode,30)}</div><p class="ld-notice">Demo reservation only. No payment details are collected or charged. Voice/video are previews; no live call connects.</p><a href="#/lawyers/bookings">View your saved demo bookings →</a></aside></div>`,'Book Consultation');
  },
  quoteHtml(id,mode,minutes) {const q=this.quote(id,mode,minutes);return `<div class="ld-cost"><span>${this.modeNames[mode]} · ${q.minutes} min</span><span>${this.money(q.rate)} × ${q.minutes}</span></div><div class="ld-cost ld-total"><span>Demo estimate</span><strong>${this.money(q.total)}</strong></div><p class="ld-muted">No extra demo fee. Amount charged: ₹0.</p>`;},
  updateQuote(id) {document.getElementById('ld-quote').innerHTML=this.quoteHtml(id,document.getElementById('ld-mode').value,document.getElementById('ld-minutes').value);},
  submitBooking(id) {
    try {
      if(document.getElementById('ld-booking-form').dataset.owner!==this.owner())throw Error('Your account changed. Reopen the booking page.');
      const b=this.reserve({lawyerId:id,mode:document.getElementById('ld-mode').value,minutes:document.getElementById('ld-minutes').value,date:document.getElementById('ld-date').value,slot:document.getElementById('ld-slot').value,topic:document.getElementById('ld-topic').value});
      Router.navigate('/lawyers/session/'+b.id);
    }catch(e){document.getElementById('ld-book-error').textContent=e.message;}
  },
  bookings() {
    const rows=this.read();return this.shell(`<a href="#/lawyers" class="ld-back">← Find Lawyers</a><h1>Your demo bookings</h1><p class="ld-muted">Saved for this account on this device. No payment has been taken.</p><div class="ld-bookings">${rows.length?rows.map(b=>{const l=this.get(b.lawyerId);return `<article class="ld-panel ld-booking-row">${this.photo(l)}<div><span class="ld-badge">${this.e(b.status)}</span><h2>${this.e(l.name)}</h2><p>${this.dateLabel(b.date)} · ${b.slot} IST · ${this.modeNames[b.mode]} · ${b.minutes} min</p><p>Demo estimate ${this.money(b.total)} · Charged ₹0</p></div><a href="#/lawyers/session/${b.id}" class="u-btn u-btn-secondary">View booking</a></article>`;}).join(''):'<div class="ld-empty"><h2>No demo bookings yet.</h2><a class="u-btn u-btn-primary" href="#/lawyers">Find an advocate</a></div>'}</div>`,'My Demo Bookings');
  },
  notFound() {return this.shell('<div class="ld-empty"><h1>This profile or booking is unavailable.</h1><a href="#/lawyers" class="u-btn u-btn-primary">Find Lawyers</a></div>');},
  session(id) {
    const b=this.read().find(x=>x.id===id);if(!b)return this.notFound();const l=this.get(b.lawyerId),active=b.status==='reserved';
    return this.shell(`<a href="#/lawyers/bookings" class="ld-back">← My demo bookings</a><header class="ld-hero"><div><span class="ld-kicker">${active?'DEMO SLOT RESERVED':this.e(b.status.toUpperCase())}</span><h1>${this.e(l.name)}</h1><p>${this.dateLabel(b.date)} · ${b.slot} IST · ${this.modeNames[b.mode]} · ${b.minutes} minutes</p></div><span class="ld-badge">${this.money(b.total)} estimate · ₹0 charged</span></header>
      <div class="ld-two-col"><section class="ld-panel"><h2>${b.mode==='chat'?'Demo chat workspace':'Consultation preview'}</h2><p class="ld-notice">${b.mode==='chat'?'Messages below are saved locally for testing. No advocate receives or replies to them.':'Live voice/video is not connected. This preview saves your booking and preparation notes without placing a call.'}</p>
      ${b.mode!=='chat'?`<div class="ld-call-preview">${this.photo(l)}<strong>${this.e(l.name)}</strong><span>${this.icon(this.modes[b.mode])} ${this.modeNames[b.mode]} preview</span></div>`:''}
      <div class="ld-demo-messages">${b.messages.map(m=>`<div><small>You · saved demo message</small><p>${this.e(m.text)}</p></div>`).join('')}</div>
      ${active?`<form onsubmit="event.preventDefault();LawyerDirectory.send('${b.id}')"><label>Demo message<textarea id="ld-message" rows="2" maxlength="2000" required placeholder="Write a sample message…"></textarea></label><button class="u-btn u-btn-secondary" type="submit">Save message</button></form>`:''}</section>
      <aside class="ld-panel"><h2>Preparation notes</h2><p>${this.e(b.topic||'No topic added.')}</p><label>Your notes<textarea id="ld-notes" rows="5" maxlength="5000" ${!active?'disabled':''}>${this.e(b.notes)}</textarea></label>${active?`<button class="u-btn u-btn-secondary" onclick="LawyerDirectory.saveNotes('${b.id}')">Save notes</button>`:''}<p id="ld-save-status" role="status"></p>
      <div class="ld-session-actions">${active?`<button class="u-btn u-btn-secondary" onclick="LawyerDirectory.finish('${b.id}','completed')">Complete demo</button><button class="u-btn u-btn-secondary" onclick="LawyerDirectory.finish('${b.id}','cancelled')">Cancel booking</button>`:`<a class="u-btn u-btn-primary" href="#/consultation/book?lawyerId=${l.id}">Book another slot</a>`}<button class="u-btn u-btn-secondary" onclick="LawyerDirectory.download('${b.id}')">Download record</button></div></aside></div>`,'Demo Consultation');
  },
  send(id) {try{const input=document.getElementById('ld-message'),text=input.value.trim();if(!text)return;const b=this.read().find(x=>x.id===id);if(!b||b.status!=='reserved')return;this.update(id,{messages:[...b.messages,{text:text.slice(0,2000),time:new Date().toISOString()}],notes:document.getElementById('ld-notes').value.slice(0,5000)});Router.navigate('/lawyers/session/'+id);}catch(e){Utils.showToast(e.message,'error');}},
  saveNotes(id) {try{const b=this.read().find(x=>x.id===id);if(!b||b.status!=='reserved')return;this.update(id,{notes:document.getElementById('ld-notes').value.slice(0,5000)});document.getElementById('ld-save-status').textContent='Notes saved on this device.';}catch(e){Utils.showToast(e.message,'error');}},
  async finish(id,status) {if(!['completed','cancelled'].includes(status))return;const owner=this.owner();if(!await Utils.showConfirm(status==='cancelled'?'Cancel demo booking':'Complete demo session','The booking and your notes remain in your demo history.',{confirmText:'Confirm'}))return;if(owner!==this.owner())return;try{const b=this.read().find(x=>x.id===id);if(!b||b.status!=='reserved')return;this.update(id,{status,notes:document.getElementById('ld-notes').value.slice(0,5000)});Router.navigate('/lawyers/session/'+id);}catch(e){Utils.showToast(e.message,'error');}},
  download(id) {const b=this.read().find(x=>x.id===id);if(!b)return;const url=URL.createObjectURL(new Blob([JSON.stringify({...b,notice:'Fictional demo consultation. No payment or real call.',lawyer:this.get(b.lawyerId).name},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=b.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
};

// Keep existing real-lawyer routes and booking behavior intact.
const originalLawyerProfile=UserLawyerPage.renderLawyerProfile.bind(UserLawyerPage);
const originalLawyerBooking=UserLawyerPage.renderBooking.bind(UserLawyerPage);
UserLawyerPage.renderLawyers=()=>LawyerDirectory.render();
UserLawyerPage.renderRecommended=()=>LawyerDirectory.render();
UserLawyerPage.renderCompare=()=>LawyerDirectory.compare();
UserLawyerPage.renderLawyerProfile=id=>LawyerDirectory.get(id)?LawyerDirectory.profile(id):originalLawyerProfile(id);
UserLawyerPage.renderBooking=id=>LawyerDirectory.get(id)?LawyerDirectory.booking(id):originalLawyerBooking(id);

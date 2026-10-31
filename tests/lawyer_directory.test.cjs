const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname, '../frontend/user/js/lawyer_directory.js'), 'utf8');
function setup(storage = new Map()) {
  let owner = 'user-a';
  const nodes = {};
  const context = vm.createContext({
    URL, URLSearchParams, Intl, Date, AbortSignal, Set, Blob, setTimeout,
    crypto: { randomUUID },
    document: { currentScript: { src: 'http://localhost/frontend/user/js/lawyer_directory.js' }, getElementById: id => nodes[id] },
    window: { location: { hash: '' } },
    localStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v) },
    AuthManager: { getSession: () => owner ? { id: owner } : null },
    UserApiClient: { getUrl: p => p },
    UserComponents: { AppLayout: html => html },
    UserLawyerPage: { renderLawyerProfile: id => 'original-profile:'+id, renderBooking: id => 'original-booking:'+id },
    Utils: { escapeHtml: s => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'), showToast() {}, showConfirm: async () => true },
    Router: { navigate() {} },
    fetch: async () => ({ ok:true, json:async () => ({lawyers:[]}) })
  });
  vm.runInContext(source+'\nthis.directory=LawyerDirectory;', context);
  const d=context.directory;
  const book=(patch={})=>d.reserve({lawyerId:d.profiles()[0].id,mode:'audio',minutes:30,date:d.dates()[0],slot:'10:00',...patch});
  return {d,context,nodes,storage,book,setOwner:v=>owner=v};
}
test('12 fictional profiles have generated assets and cover every practice filter',()=>{
  const {d}=setup();assert.equal(d.profiles().length,12);assert.equal(d.categories.length,19);
  for(const p of d.profiles()) {assert.equal(p.verified,false);assert.equal(p.demo,true);assert.ok(p.experienceYears>=5&&p.experienceYears<=30);assert.ok(fs.existsSync(path.join(__dirname,'../frontend/user/assets/lawyers',path.basename(new URL(p.photo).pathname))));}
  d.cache=d.profiles();for(const [id] of d.categories){d.category=id;assert.ok(d.visible().length>0,id);}
});
test('mode and duration prices are exact and reject invalid input',()=>{
  const {d}=setup(),id=d.profiles()[0].id;
  assert.equal(d.quote(id,'audio',60).total,3540);assert.equal(d.quote(id,'chat',15).total,615);assert.equal(d.quote(id,'video',30).total,2130);
  assert.equal(d.quote('demo_adv_ananya-rao','chat',30).rate,32);
  for(const args of [[id,'bogus',30],[id,'chat',5],['unknown','audio',30]])assert.throws(()=>d.quote(...args));
});
test('search handles names, cities and languages, with independent category and price sort',()=>{
  const {d}=setup();d.cache=d.profiles();d.query='Tamil';assert.equal(d.visible()[0].name,'Adv. Priya Iyer');
  d.query='Mumbai';assert.equal(d.visible().length,2);d.category='tax';assert.equal(d.visible().length,1);
  d.category='all';d.query='';d.sort='price';assert.equal(d.visible()[0].rate,25);
});
test('reservations persist through reload and remain private to each account',()=>{
  const {d,book,storage,setOwner}=setup();const b=book();assert.equal(b.paid,false);assert.equal(d.read().length,1);
  assert.equal(setup(storage).d.read()[0].id,b.id);
  setOwner('user-b');assert.equal(d.read().length,0);assert.match(d.session(b.id),/unavailable/);assert.throws(()=>d.update(b.id,{notes:'other user'}));assert.throws(()=>d.write([b]));
  book();assert.equal(d.read().length,1);setOwner('user-a');assert.equal(d.read()[0].id,b.id);
  setOwner(null);assert.equal(d.read().length,0);assert.throws(()=>book());
});
test('booking rejects old dates, unknown slots and duplicate reservations; cancellation releases slot',()=>{
  const {d,book}=setup();for(const date of d.dates())assert.match(date,/^\d{4}-\d{2}-\d{2}$/);
  assert.throws(()=>book({date:'2001-01-01'}));assert.throws(()=>book({slot:'03:00'}));
  const b=book();assert.throws(()=>book());d.update(b.id,{status:'cancelled'});assert.ok(book().id);
});
test('message and note operations persist escaped content and do not cross owners',async()=>{
  const {d,book,nodes,setOwner}=setup();const b=book({mode:'chat',topic:'<img src=x>'});
  nodes['ld-message']={value:'<script>alert(1)</script>'};nodes['ld-notes']={value:'Documents for test'};nodes['ld-save-status']={textContent:''};
  d.send(b.id);assert.equal(d.read()[0].messages.length,1);assert.match(d.session(b.id),/&lt;script&gt;/);assert.doesNotMatch(d.session(b.id),/<script>/);
  nodes['ld-notes'].value='Updated notes';d.saveNotes(b.id);assert.equal(d.read()[0].notes,'Updated notes');
  await d.finish(b.id,'completed');d.send(b.id);assert.equal(d.read()[0].messages.length,1);
  setOwner('user-b');d.send(b.id);assert.equal(d.read().length,0);
});
test('catalog failure preserves demo entries, merges real entries, and preserves real booking routes',async()=>{
  const {d,context}=setup();context.fetch=async()=>{throw Error('offline');};assert.equal((await d.load()).length,12);
  context.fetch=async()=>({ok:true,json:async()=>({lawyers:[{id:'real-1',name:'Real advocate'}, {id:'demo_adv_arjun-mehra'}]})});assert.equal((await d.load()).length,13);
  assert.equal(context.UserLawyerPage.renderLawyerProfile('real-1'),'original-profile:real-1');assert.equal(context.UserLawyerPage.renderBooking('real-1'),'original-booking:real-1');
});
test('stale account booking form is blocked and compare selection is capped at three',async()=>{
  const {d,nodes,setOwner}=setup();nodes['ld-booking-form']={dataset:{owner:'user-a'}};nodes['ld-book-error']={textContent:''};setOwner('user-b');d.submitBooking(d.profiles()[0].id);assert.match(nodes['ld-book-error'].textContent,/account changed/);assert.equal(d.read().length,0);
  await d.load();const profiles=d.profiles();for(const p of profiles.slice(0,3))d.comparePick(p.id,{checked:true});const fourth={checked:true};d.comparePick(profiles[3].id,fourth);assert.equal(fourth.checked,false);assert.equal(d.selected.size,3);
  setOwner('user-c');await d.load();assert.equal(d.selected.size,0);
});

const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('frontend/shared/js/assistant_chat.js','utf8').replace(/AssistantChat\.install\(\);\s*$/,'this.chat=AssistantChat;');
function renderer(){const ctx=vm.createContext({Utils:{escapeHtml:value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}});vm.runInContext(source,ctx);return ctx.chat;}
test('all Markdown heading levels and lists render without raw heading syntax or giant blank breaks',()=>{
 const html=renderer().markdown('#### Important\n\n1. First step\n2. Second step\n\nA **simple** explanation.');
 assert.ok(html.includes('<h3>Important</h3>'));assert.ok(html.includes('<ol>'));assert.ok(html.includes('<strong>simple</strong>'));assert.ok(!html.includes('####'));assert.ok(!html.includes('<br><br>'));
});
test('answer text and graphical explanations cannot execute HTML',()=>{
 const chat=renderer(),html=chat.markdown('<img src=x onerror=alert(1)>');assert.ok(!html.includes('<img'));
 const extra=chat.extras({visual:{title:'<script>bad</script>',nodes:[{title:'<img src=x>',detail:'<svg onload=alert(1)>'}]},sources:[{id:'S1',title:'<iframe>',excerpt:'<script>alert(1)</script>'}]});
 assert.ok(!extra.includes('<script>'));assert.ok(!extra.includes('<svg'));assert.ok(extra.includes('&lt;svg'));
});

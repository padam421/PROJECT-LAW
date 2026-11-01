/* Reuse storage mechanics, with distinct local AND server namespaces for advocates. */
AssistantThreads.key = function(owner = this.owner()) { return 'nyay_advocate_v2_' + encodeURIComponent(owner || 'signed-out'); };
AssistantThreads.url = path => AuthManager.getApiUrl('/api/advocate/assistant' + path);
AssistantThreads.api = async function(path, body) {
  if (!['chat', 'rehearsal'].includes(path)) throw Error('Unsupported advocate action.');
  const response = await fetch(AuthManager.getApiUrl('/api/advocate/' + path), {
    method: 'POST', credentials: 'include', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body), signal: AbortSignal.timeout(240000)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw Error(result.error || 'Advocate AI is unavailable. Your record is retained.');
  return result;
};
window.addEventListener('nyay-threads-updated', () => {
  const sidebar = document.getElementById('adv-sidebar');
  if (sidebar) AdvocateChatBot.refresh();
});
window.addEventListener('online', () => { AssistantThreads._hydration = null; AssistantThreads.hydrate(); });

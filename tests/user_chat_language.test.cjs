const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('client sends and retries auto-detect this turn while retaining the speech selector', async () => {
  const thread = { id: 'synthetic-thread', language: 'hi', messages: [
    { sender: 'user', text: 'पहले हिंदी में पूछा था।' },
    { sender: 'ai', text: 'पहले का उत्तर।', lang: 'hi' }
  ] };
  const requests = [];
  const input = { value: 'What documents should I keep?', style: {} };
  const context = vm.createContext({ console, Set,
    UserChatBot: {}, document: { getElementById: id => id === 'chat-input' ? input : { value: 'hi' } },
    AssistantThreads: {
      active: () => thread, owner: () => 'synthetic-user', id: () => String(thread.messages.length),
      append: (_id, message) => thread.messages.push(message),
      change: (_id, change) => change(thread),
      api: async (endpoint, body) => {
        requests.push({ endpoint, body });
        return { message: 'Keep dated copies.', detected_language: { detected_language_code: 'en' } };
      }
    }
  });
  const source = fs.readFileSync('frontend/shared/js/assistant_chat.js', 'utf8')
    .replace(/AssistantChat\.install\(\);\s*$/, '');
  vm.runInContext(source + '\nthis.chat = AssistantChat;', context);
  context.chat.refresh = () => {};
  await context.chat.send();
  assert.equal(requests[0].body.language, 'auto');
  assert.equal(requests[0].body.message, 'What documents should I keep?');
  assert.equal(requests[0].body.chatHistory.length, 2);
  assert.equal(thread.language, 'hi');
  assert.equal(thread.messages.at(-1).lang, 'en');
  const userMessage = thread.messages.find(m => m.text === 'What documents should I keep?');
  await context.chat.send({ retryMessage: userMessage });
  assert.equal(requests[1].body.language, 'auto');
  assert.equal(requests[1].body.retry, true);
  assert.equal(thread.language, 'hi');
});

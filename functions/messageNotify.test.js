const test = require('node:test');
const assert = require('node:assert/strict');
const { messagePreview } = require('./messageNotify');

test('messagePreview for text messages', () => {
  assert.equal(messagePreview({ type: 'text', text: 'Hey there!' }), 'Hey there!');
});

test('messagePreview for live sets', () => {
  assert.equal(
    messagePreview({ type: 'liveSet', sharedSet: { title: 'Dojo set' } }),
    'Sent you a set: Dojo set'
  );
});

test('messagePreview for clips', () => {
  assert.equal(
    messagePreview({ type: 'clip', clip: { title: 'GoPro clip' } }),
    'Sent you a clip: GoPro clip'
  );
});

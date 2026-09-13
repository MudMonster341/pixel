const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { FeedbackStore } = require('../../tools/feedback-store');

const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

function withStore(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-feedback-'));
  try {
    fn(new FeedbackStore(dir), dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('creates numbered items with defaults and saves the screenshot', () => {
  withStore((store, dir) => {
    const first = store.create({ title: 'Door is fiddly', screenshot: PNG_1PX, context: { map: 'meadow' } });
    const second = store.create({ title: 'Brighter grass', type: 'change', priority: 'high' });

    assert.equal(first.id, 'FB-0001');
    assert.equal(second.id, 'FB-0002');
    assert.equal(first.status, 'new');
    assert.equal(first.type, 'bug');
    assert.equal(first.area, 'General');
    assert.equal(first.context.map, 'meadow');
    assert.equal(first.screenshot, 'screenshots/FB-0001.png');
    assert.ok(fs.existsSync(path.join(dir, 'screenshots', 'FB-0001.png')));
    assert.deepEqual(store.list().map((item) => item.id), ['FB-0001', 'FB-0002']);
  });
});

test('rejects invalid input with a 400', () => {
  withStore((store) => {
    const rejects = (input, pattern) => assert.throws(() => store.create(input), (err) => err.status === 400 && pattern.test(err.message));
    rejects({}, /title is required/);
    rejects({ title: '   ' }, /title is required/);
    rejects({ title: 'x'.repeat(121) }, /longer than/);
    rejects({ title: 'ok', type: 'rant' }, /type must be one of/);
    rejects({ title: 'ok', screenshot: 'data:text/html;base64,PGgxPg==' }, /PNG or JPEG/);
    assert.deepEqual(store.list(), []);
  });
});

test('question → answer → fix → verify', () => {
  withStore((store) => {
    const { id } = store.create({ title: 'Make the lake bigger', type: 'change' });

    assert.equal(store.agentAsk(id, 'How much bigger?').status, 'needs-info');
    assert.equal(store.ownerReply(id, 'Twice as wide').status, 'answered');
    assert.equal(store.agentStatus(id, 'in-progress').status, 'in-progress');
    const fixed = store.agentFix(id, { test: 'tests/unit/maps.test.js › lake', commit: 'abc1234' });
    assert.equal(fixed.status, 'fixed');
    assert.deepEqual({ test: fixed.resolution.test, commit: fixed.resolution.commit }, { test: 'tests/unit/maps.test.js › lake', commit: 'abc1234' });

    const verified = store.ownerVerify(id);
    assert.equal(verified.status, 'verified');
    assert.deepEqual(verified.thread.map((m) => m.author), ['agent', 'owner']);
    assert.deepEqual(verified.history.map((h) => h.status), ['new', 'needs-info', 'answered', 'in-progress', 'fixed', 'verified']);
  });
});

test('a fix needs a test, and only fixed items can be verified', () => {
  withStore((store) => {
    const { id } = store.create({ title: 'Something' });
    assert.throws(() => store.agentFix(id, {}), /test is required/);
    assert.throws(() => store.ownerVerify(id), (err) => err.status === 409);
    assert.throws(() => store.ownerReopen(id, 'still broken'), (err) => err.status === 409);
  });
});

test('reopening a fix records why', () => {
  withStore((store) => {
    const { id } = store.create({ title: 'Something' });
    store.agentFix(id, { test: 't' });
    assert.throws(() => store.ownerReopen(id, ''), /text is required/);
    const reopened = store.ownerReopen(id, 'Still happens near the pond');
    assert.equal(reopened.status, 'reopened');
    assert.equal(reopened.thread.at(-1).text, 'Still happens near the pond');
  });
});

test('unknown or malformed ids fail clearly', () => {
  withStore((store) => {
    assert.throws(() => store.get('FB-0042'), (err) => err.status === 404);
    assert.throws(() => store.get('../../etc/passwd'), (err) => err.status === 400);
  });
});

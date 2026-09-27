// ADR 0016: the script runner's own control flow -- step sequencing, `parallel`, and Esc's
// fast-forward-to-end-state (skip()) -- exercised without a browser, using a minimal fake "scene"
// that only implements what src/scripts-runtime.js's Phaser-free steps need (`wait`, `setFlag`,
// `sound`, `lockInput`/`unlockInput`, `parallel` of those). The Phaser-facing steps (camera pans,
// actor sprites, dialog) are covered by the e2e specs instead (tests/e2e/scripts.spec.js), where a
// real Phaser scene/camera/tween manager actually exists.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

class TinyEmitter {
  constructor() { this.listeners = {}; }
  on(event, fn) { (this.listeners[event] ||= []).push(fn); return this; }
  emit(event, ...args) { (this.listeners[event] || []).forEach((fn) => fn(...args)); return true; }
}

// A stand-in for `window.localStorage`, same shape state.js/save.js expect (unused by these tests,
// but state.js's own module-level code doesn't touch it, so a no-op object is enough).
const fakeStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

function makeSandbox() {
  const gameEvents = new TinyEmitter();
  const context = vm.createContext({
    Phaser: { Events: { EventEmitter: TinyEmitter } },
    console,
    URLSearchParams,
    localStorage: fakeStorage,
    window: { game: { events: gameEvents } },
  });
  for (const file of ['src/state.js', 'src/audio.js', 'src/scripts-runtime.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  }
  const get = (name) => vm.runInContext(name, context);
  return { context, get, GameState: get('GameState'), ScriptRunner: get('ScriptRunner'), gameEvents };
}

// A fake Phaser scene: just enough for `wait`/`setFlag`/`sound`/`lockInput`/`unlockInput`/`parallel`.
// `time.delayedCall` uses real (short) setTimeouts -- these tests keep every wait under ~40ms so the
// whole suite still runs in well under a second.
function makeFakeScene() {
  return {
    transitioning: false,
    time: {
      delayedCall(ms, cb) {
        const handle = setTimeout(cb, ms);
        return { remove: () => clearTimeout(handle) };
      },
    },
  };
}

test('ScriptRunner: steps run in order, and setFlag/sound/wait all take effect', async () => {
  const { ScriptRunner, GameState } = makeSandbox();
  const scene = makeFakeScene();
  const runner = new ScriptRunner(scene);
  const order = [];

  const steps = [
    { setFlag: 'firstFlag' },
    { wait: 10 },
    { setFlag: { name: 'counter', value: 1 } },
    { wait: 10 },
    { setFlag: { name: 'counter', value: 2 } },
  ];
  // Instrument: wrap step_setFlag to also record order (without changing behaviour).
  const original = runner.step_setFlag.bind(runner);
  runner.step_setFlag = (value) => { order.push(typeof value === 'string' ? value : value.name); return original(value); };

  assert.equal(scene.transitioning, false);
  const promise = runner.run(steps);
  // `run()` sets transitioning synchronously, before the first await -- checkable immediately.
  assert.equal(scene.transitioning, true);
  await promise;

  assert.deepEqual(order, ['firstFlag', 'counter', 'counter']);
  assert.equal(GameState.flags.firstFlag, true);
  assert.equal(GameState.flags.counter, 2);
  assert.equal(scene.transitioning, false, 'run() releases transitioning once the whole script finishes');
  assert.equal(runner.isRunning, false);
});

test('ScriptRunner: parallel steps all run, and the sequence waits for the slowest one', async () => {
  const { ScriptRunner } = makeSandbox();
  const scene = makeFakeScene();
  const runner = new ScriptRunner(scene);
  const finishedAt = {};
  const start = Date.now();

  await runner.run([
    { parallel: [{ wait: 10 }, { wait: 30 }] },
    { setFlag: 'afterParallel' },
  ]);
  finishedAt.afterParallel = Date.now() - start;

  // Both branches of the parallel group had to finish (the slower, 30ms one) before the step after
  // it ran -- a real assertion on ordering, not just "it didn't throw".
  assert.ok(finishedAt.afterParallel >= 28, `expected at least ~30ms to have passed, got ${finishedAt.afterParallel}ms`);
});

test('ScriptRunner: Esc mid-script (skip()) fast-forwards every remaining step to its end state, with no delay', async () => {
  const { ScriptRunner, GameState } = makeSandbox();
  const scene = makeFakeScene();
  const runner = new ScriptRunner(scene);

  const steps = [
    { setFlag: 'stepOne' },
    { wait: 5_000 }, // would take 5s if not skipped -- the test only passes because skip() cuts it short
    { setFlag: 'stepTwo' }, // scheduled to run *after* the skip -- must still apply, instantly
    { wait: 5_000 },
    { setFlag: 'stepThree' },
  ];

  const start = Date.now();
  const promise = runner.run(steps);
  // Give the first wait a moment to actually start, then skip.
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(GameState.flags.stepOne, true);
  assert.equal(GameState.flags.stepTwo, undefined, 'not reached yet');
  runner.skip();
  await promise;
  const elapsed = Date.now() - start;

  assert.equal(GameState.flags.stepOne, true);
  assert.equal(GameState.flags.stepTwo, true, 'a step scheduled after the skip still ran, instantly');
  assert.equal(GameState.flags.stepThree, true, 'end state reached in full, never a half-run script');
  assert.ok(elapsed < 500, `skip() should fast-forward, not still take ~10s (took ${elapsed}ms)`);
});

test('ScriptRunner: skip() is a no-op when nothing is running, and never fires twice', async () => {
  const { ScriptRunner } = makeSandbox();
  const scene = makeFakeScene();
  const runner = new ScriptRunner(scene);
  assert.doesNotThrow(() => runner.skip()); // nothing running yet

  await runner.run([{ setFlag: 'a' }]);
  assert.equal(runner.isRunning, false);
  assert.doesNotThrow(() => runner.skip()); // already finished
});

test('ScriptRunner: an unknown step type warns and is skipped, not thrown', async () => {
  const { ScriptRunner, GameState } = makeSandbox();
  const scene = makeFakeScene();
  const runner = new ScriptRunner(scene);
  await runner.run([{ notARealStep: true }, { setFlag: 'stillRan' }]);
  assert.equal(GameState.flags.stillRan, true);
});

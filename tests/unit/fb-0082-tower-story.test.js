// FB-0082 ("room 195, give it the back story, that the prince is stuck in Rapunzel's tower, you have to save him, and then the game starts"):
// the tower climb opens with a short backstory (MINIGAMES.tower.story: 4 beats) before its usual intro card. The pages and the page-turning
// rules are pure (src/minigames/framework-data.js: minigameStoryPages / createStoryState / storyAdvance / storyTick); the shell
// (src/minigames/framework-scene.js) draws them as cards over the tower's backdrop and tower.js draws the little picture. Phaser is not
// available here, so the scenes are checked as source, the same way tests/unit/minigame-intro.test.js does.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData, plain } = require('../helpers/game-data');

const g = loadGameData();
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');
const { MINIGAMES } = g;
const pagesOf = g.evaluate('minigameStoryPages');
const createStory = g.evaluate('createStoryState');
const advance = g.evaluate('storyAdvance');
const tick = g.evaluate('storyTick');
const AUTO_MS = g.evaluate('MG_STORY_AUTO_MS');
const shell = read('src', 'minigames', 'framework-scene.js');
const tower = read('src', 'minigames', 'tower.js');

test('FB-0082: the tower has a backstory of three or four short, warm beats about the prince, Rapunzel\'s tower and the rescue', () => {
  const story = MINIGAMES.tower.story;
  assert.ok(story, 'the tower game carries a story');
  assert.ok(story.pages.length >= 3 && story.pages.length <= 4, `${story.pages.length} beats`);
  const all = story.pages.join(' ');
  assert.match(story.pages[0], /prince/i);
  assert.match(story.pages[0], /Rapunzel/);
  assert.match(story.pages[0], /tower/i);
  assert.match(all, /chameleon/i);
  assert.match(all, /gargoyle/i);
  assert.match(all, /\{name\}/, 'the princess is the player, by name');
  assert.match(all, /ladders/i);
  assert.match(all, /window/i);
  for (const page of story.pages) {
    assert.ok(page.length <= 160, `"${page}" is short enough to read at a glance`);
    assert.doesNotMatch(page, /birthday|cake|candle|gift|present|happy/i, 'no birthday mentions');
  }
  assert.equal(story.cover.key, 'tower-bg', 'the story is told over the tower\'s own backdrop');
  assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'minigames', 'tower-bg.png')), 'and that picture exists');
});

test('FB-0082: only the tower has a story, and the other games and the intro text rules are untouched', () => {
  assert.equal(MINIGAMES.hero.story, undefined);
  assert.equal(MINIGAMES.flappy.story, undefined);
  assert.deepEqual(plain(pagesOf(MINIGAMES.hero, 'Taru')), []);
  assert.deepEqual(plain(pagesOf(undefined, 'Taru')), []);
  assert.equal(MINIGAMES.tower.instructions.length, g.MG_INSTRUCTION_LINES, 'the intro card after the story is the same two-line card');
});

test('FB-0082: {name} becomes the player\'s name; with no name the aside is dropped, never a stray brace', () => {
  const named = plain(pagesOf(MINIGAMES.tower, 'Taru'));
  assert.ok(named.some((page) => page.includes('(Taru)')));
  assert.ok(named.every((page) => !page.includes('{')));
  const unnamed = plain(pagesOf(MINIGAMES.tower, ''));
  assert.ok(unnamed.every((page) => !/[{}]/.test(page) && !page.includes('()')), unnamed.join(' | '));
  assert.ok(unnamed.some((page) => /So the princess decided/.test(page)));
  assert.equal(plain(pagesOf(MINIGAMES.tower, undefined)).length, MINIGAMES.tower.story.pages.length);
});

test('FB-0082: each beat advances with a key or click, one page at a time, and the story is done after the last', () => {
  const pages = pagesOf(MINIGAMES.tower, 'Taru');
  const story = createStory(pages.length);
  assert.deepEqual(plain(story), { index: 0, ms: 0, count: pages.length, done: false });
  const seen = [story.index];
  while (!story.done) {
    advance(story);
    if (!story.done) seen.push(story.index);
  }
  assert.deepEqual(seen, [...pages].map((_, i) => i), 'every beat is reachable, in order');
  advance(story);
  assert.equal(story.index, pages.length, 'advancing a finished story does nothing');
  assert.equal(createStory(0).done, true, 'a game without a story is "done" at once');
});

test('FB-0082: a beat also turns by itself after the auto timer, so nobody is stuck on one', () => {
  assert.ok(AUTO_MS >= 5000 && AUTO_MS <= 8000, `about 6 s (${AUTO_MS})`);
  const pages = pagesOf(MINIGAMES.tower, 'Taru');
  const story = createStory(pages.length);
  for (let t = 0; t < AUTO_MS - 100; t += 100) tick(story, 100);
  assert.equal(story.index, 0, 'not before the timer');
  tick(story, 100);
  assert.equal(story.index, 1, 'on the timer');
  assert.equal(story.ms, 0, 'the clock restarts for the next page');
  // doing nothing at all gets through every beat (and out of the story) in pages * timer
  let elapsed = 0;
  while (!story.done && elapsed < AUTO_MS * (pages.length + 1)) { tick(story, 16); elapsed += 16; }
  assert.equal(story.done, true);
  assert.ok(elapsed <= AUTO_MS * pages.length, 'at most one timer per beat');
  // a key press in the middle of a page restarts that clock
  const s2 = createStory(pages.length);
  tick(s2, AUTO_MS - 50);
  advance(s2);
  tick(s2, 100);
  assert.equal(s2.index, 1);
});

test('FB-0082: the shell shows the story once per opening, before the intro card, and never after a retry', () => {
  // showIntro() runs from create() only; every retry goes straight to beginAttempt(), which never touches the story
  const showIntro = /\n  showIntro\(\) \{([\s\S]*?)\n  \}\n/.exec(shell)[1];
  assert.match(showIntro, /minigameStoryPages\(this\.def, GameState\.playerName\)/);
  assert.match(showIntro, /if \(pages\.length\) this\.startStory\(pages\);\s*else this\.showIntroCard\(\);/);
  const create = /\n  create\(\) \{([\s\S]*?)\n  \}\n/.exec(shell)[1];
  assert.match(create, /this\.showIntro\(\)/);
  assert.equal(shell.match(/this\.showIntro\(\)/g).length, 1, 'showIntro() is called from create() and nowhere else');
  const retry = /onRetry: \(\) => (this\.[a-zA-Z]+)\(\)/.exec(shell)[1];
  assert.equal(retry, 'this.beginAttempt');
  const begin = /\n  beginAttempt\(\) \{([\s\S]*?)\n  \}\n/.exec(shell)[1];
  assert.doesNotMatch(begin, /[sS]tory|showIntro/);
  // init() resets the story state for a new opening
  assert.match(/\n  init\(data\) \{([\s\S]*?)\n  \}\n/.exec(shell)[1], /this\.story = null;/);
  // when the story ends (or is skipped) the usual intro card follows, which starts the attempt
  const end = /\n  endStory\(\) \{([\s\S]*?)\n  \}\n/.exec(shell)[1];
  assert.match(end, /this\.showIntroCard\(\)/);
  assert.match(shell, /showIntroCard\(\) \{\s*this\.mgState = 'intro';\s*this\.card\.showIntro\(this\.def, \(\) => this\.beginAttempt\(\)\);/);
  assert.match(shell, /minigameStoryPages/);
});

test('FB-0082: a page turns with Enter / E / Space (the card\'s own keys), a click on the page or on NEXT, and has a SKIP STORY button', () => {
  const page = /\n  showStoryPage\(\) \{([\s\S]*?)\n  \}\n/.exec(shell)[1];
  assert.match(page, /this\.card\.show\(\{/);
  assert.match(page, /label: 'NEXT \(ENTER\)', onSelect: \(\) => this\.advanceStory\(\)/);
  assert.match(page, /label: 'SKIP STORY'/);
  assert.match(page, /cover: this\.def\.story\.cover/);
  assert.match(page, /this\.drawStoryArt\(index\)/);
  // the card's confirm keys are the shell's usual ones (the same keys as the rest of the shell)
  assert.match(shell, /for \(const key of \['ENTER', 'SPACE', 'E'\]\) this\.on\(`keydown-\$\{key\}`, \(e\) => \{ if \(!e\.repeat\) this\.confirm\(\); \}\);/);
  assert.match(shell, /for \(const key of \['UP', 'W'\]\)/);
  assert.match(shell, /for \(const key of \['DOWN', 'S'\]\)/);
  // a click anywhere over nothing turns the page; a click on a button is that button's own business
  const start = /\n  startStory\(pages\) \{([\s\S]*?)\n  \}\n/.exec(shell)[1];
  assert.match(start, /this\.input\.on\('pointerdown', this\.storyClick\)/);
  assert.match(start, /this\.card\.acceptInput && !\(over && over\.length\)\) this\.advanceStory\(\)/);
  const end = /\n  endStory\(\) \{([\s\S]*?)\n  \}\n/.exec(shell)[1];
  assert.match(end, /this\.input\.off\('pointerdown', this\.storyClick\)/, 'the click listener is removed with the story');
});

test('FB-0082: the shell ticks the story timer while the story is up (the auto-advance), and Esc still quits from a story page', () => {
  const update = /\n  update\(time, delta\) \{([\s\S]*?)\n  \}\n/.exec(shell)[1];
  assert.match(update, /storyTick\(this\.story, delta\)/);
  assert.match(update, /if \(this\.story\.done\) this\.endStory\(\);\s*else if \(this\.story\.index !== before\) this\.showStoryPage\(\);/);
  // a story page is still the 'intro' state, so the shell's Esc handling covers it unchanged
  assert.match(shell, /this\.input\.keyboard\.on\('keydown-ESC', \(event\) => \{ if \(!event\.repeat\) this\.onEsc\(\); \}\);/);
  const onEsc = /\n  onEsc\(\) \{([\s\S]*?)\n  \}\n/.exec(shell)[1];
  assert.match(onEsc, /this\.finish\(this\.mgState === 'win' \? 'won' : 'quit'\)/);
  const showIntro = /\n  showIntro\(\) \{([\s\S]*?)\n  \}\n/.exec(shell)[1];
  assert.match(showIntro, /this\.mgState = 'intro'/, 'the story runs in the intro state: Esc quits, the HUD is hidden');
  assert.match(showIntro, /this\.setHudVisible\(false\)/);
  assert.doesNotMatch(shell, /setScrollFactor\(1\)/);
});

test('FB-0082: the tower draws its story from its own sprites (the prince, chameleon, gargoyle and the crowned princess), no new art file', () => {
  const art = /\n  drawStoryArt\(index\) \{([\s\S]*?)\n  \}\n/.exec(tower)[1];
  assert.match(art, /'tower-prince'/);
  assert.match(art, /TW_FRAME\.chameleon\[0\]/);
  assert.match(art, /TW_FRAME\.gargoyle/);
  assert.match(art, /TW_FRAME\.crown/);
  assert.match(art, /'player'/, 'the lead\'s own sheet, so her clothes colour is kept');
  assert.match(art, /setDepth\(199\.5\)/, 'above the cover picture, below the card');
  assert.match(art, /this\.storyParts\.push/);
  // every texture it uses is one the tower already loads (or the lead's own sheet)
  const preload = /\n  preload\(\) \{([\s\S]*?)\n  \}\n/.exec(tower)[1];
  for (const key of ['tower-bg', 'tower-sprites', 'tower-prince']) assert.match(preload, new RegExp(`'${key}'`));
  assert.equal(tower.match(/this\.load\.(image|spritesheet)\(/g).length, 3, 'the tower still loads exactly its three pictures');
});

test('FB-0082 (soft-lock guard): the tower\'s skip after 3 losses is still there, and the story never gets in its way', () => {
  const { GameState, recordAttempt, minigameProgress } = loadGameData();
  assert.equal(recordAttempt(GameState, 'tower', 'lost', 0).canSkip, false);
  assert.equal(recordAttempt(GameState, 'tower', 'lost', 1).canSkip, false);
  assert.equal(recordAttempt(GameState, 'tower', 'lost', 2).canSkip, true, 'the third loss offers the skip');
  assert.equal(minigameProgress(GameState, 'tower').attempts, 3);
  assert.match(shell, /if \(canSkip\) items\.push\(\{ label: cards\.skipLabel \|\| 'SKIP -- TAKE THE KEY ANYWAY', onSelect: onSkip \}\);/);
  assert.match(shell, /onSkip: \(\) => this\.win\(true\)/);
  // the story can always be left: Esc, the SKIP STORY button, a click, a key and the timer all end it
  const states = [createStory(4), createStory(4), createStory(4)];
  advance(states[0]); advance(states[0]); advance(states[0]); advance(states[0]);
  assert.equal(states[0].done, true);
  for (let t = 0; t < AUTO_MS * 4; t += 50) tick(states[1], 50);
  assert.equal(states[1].done, true);
  assert.match(shell, /label: 'SKIP STORY', onSelect: \(\) => this\.endStory\(\)/);
});

test('FB-0082: the docs say the tower opens with its backstory', () => {
  assert.match(read('docs', 'STORY.md'), /Tower climb:[^|]*Rapunzel[^|]*backstory/i);
  assert.match(read('docs', 'ARCHITECTURE.md'), /FB-0082/);
});

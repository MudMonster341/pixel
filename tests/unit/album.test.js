// W2 the memory album (src/album.js, docs/plans/2026-10-04-day3-feedback-and-wow.md): every LUG key unlocks a polaroid on the Journal's Album page
// (src/scenes/ui.js JournalPanel), the owner's photos come from assets/card/card.json's `album` (git-ignored, same mechanism as the card's
// photos), and once all three keys are found the card's slideshow also plays them. Placeholders cover everything the owner has not supplied yet,
// so nothing here may ever need a real photo or the network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ROOT, loadGameData, plain } = require('../helpers/game-data');
const pack = require('../../tools/pack-offline');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const game = loadGameData();
const { buildCardConfig } = game;
const albumSlots = game.evaluate('albumSlots');
const albumNewSlots = game.evaluate('albumNewSlots');
const albumUnlockedCount = game.evaluate('albumUnlockedCount');
const albumComplete = game.evaluate('albumComplete');
const cardSlidePhotos = game.evaluate('cardSlidePhotos');
const albumAvailable = game.evaluate('albumAvailable');
const albumTabHint = game.evaluate('albumTabHint');

const KEY_IDS = ['physicsLab', 'icl', 'room195'];
const keysWith = (...held) => Object.fromEntries(KEY_IDS.map((id) => [id, held.includes(id)]));
const CONFIG = buildCardConfig({
  album: [{ file: 'a1.jpg', caption: 'The lab' }, { file: 'a2.jpg', caption: 'The console' }, { file: 'a3.jpg', caption: '' }],
});

// ---------- the slots ----------

test('W2: albumSlots with 0 keys: three locked polaroids, no caption, no file', () => {
  const slots = plain(albumSlots(CONFIG, keysWith()));
  assert.equal(slots.length, 3);
  for (const slot of slots) {
    assert.equal(slot.unlocked, false);
    assert.equal(slot.kind, 'locked');
    assert.equal(slot.caption, '');
    assert.equal(slot.file, null);
  }
  assert.deepEqual(slots.map((s) => s.keyId), KEY_IDS);
  assert.equal(albumUnlockedCount(slots), 0);
});

test('W2: albumSlots with 1, 2 and 3 keys unlocks one slot per key, in the stored key order, as photos when the config has them', () => {
  const one = plain(albumSlots(CONFIG, keysWith('physicsLab')));
  assert.deepEqual(one.map((s) => s.kind), ['photo', 'locked', 'locked']);
  assert.equal(one[0].file, 'a1.jpg');
  assert.equal(one[0].caption, 'The lab');
  const two = plain(albumSlots(CONFIG, keysWith('physicsLab', 'icl')));
  assert.deepEqual(two.map((s) => s.kind), ['photo', 'photo', 'locked']);
  assert.equal(albumUnlockedCount(two), 2);
  const three = plain(albumSlots(CONFIG, keysWith(...KEY_IDS)));
  assert.deepEqual(three.map((s) => s.kind), ['photo', 'photo', 'photo']);
  assert.equal(albumUnlockedCount(three), 3);
  assert.deepEqual(three.map((s) => s.file), ['a1.jpg', 'a2.jpg', 'a3.jpg']);
});

test('W2: the slot follows the KEY, not the order she finds them in (the ICL key first unlocks the second polaroid)', () => {
  const slots = plain(albumSlots(CONFIG, keysWith('icl')));
  assert.deepEqual(slots.map((s) => s.unlocked), [false, true, false]);
  assert.equal(slots[1].file, 'a2.jpg');
});

test('W2: with no album at all (null / empty config) an unlocked slot is a placeholder with a default caption, never an error', () => {
  for (const config of [null, undefined, {}, buildCardConfig(null), buildCardConfig({}), { album: 'nope' }]) {
    const slots = plain(albumSlots(config, keysWith(...KEY_IDS)));
    assert.deepEqual(slots.map((s) => s.kind), ['placeholder', 'placeholder', 'placeholder']);
    assert.deepEqual(slots.map((s) => s.file), [null, null, null]);
    assert.ok(slots.every((s) => s.caption.length > 0));
  }
  assert.equal(plain(albumSlots(null, keysWith('physicsLab')))[0].caption, 'Memory 1: the Physics Lab key');
});

test('W2: caption fallback: an empty/blank caption gets the default for that key; an unknown key id gets "Memory N"; a written caption wins', () => {
  const slots = plain(albumSlots(CONFIG, keysWith(...KEY_IDS)));
  assert.equal(slots[0].caption, 'The lab');
  assert.equal(slots[2].caption, 'Memory 3: the Room 195 key', 'a3 has an empty caption');
  const other = plain(albumSlots(CONFIG, { alpha: true, beta: false, gamma: true }));
  assert.deepEqual(other.map((s) => s.keyId), ['alpha', 'beta', 'gamma']);
  assert.equal(other[0].caption, 'The lab', 'slot 0 has a written caption whatever the key is called');
  assert.equal(other[2].caption, 'Memory 3', 'an id the default table does not know');
});

test('W2: a photo that failed to load falls back to the placeholder but keeps the owner\'s caption', () => {
  const slots = plain(albumSlots(CONFIG, keysWith('physicsLab', 'icl'), (file) => file !== 'a1.jpg'));
  assert.equal(slots[0].kind, 'placeholder');
  assert.equal(slots[0].file, null);
  assert.equal(slots[0].caption, 'The lab');
  assert.equal(slots[1].kind, 'photo');
  // hasPhoto also gets the slot index (the Journal's texture keys are per index)
  const seen = [];
  albumSlots(CONFIG, keysWith(...KEY_IDS), (file, index) => { seen.push([file, index]); return true; });
  assert.deepEqual(seen, [['a1.jpg', 0], ['a2.jpg', 1], ['a3.jpg', 2]]);
});

test('W2: odd `keys` values never throw: null/garbage keys -> all locked; only a literal true unlocks', () => {
  for (const keys of [null, undefined, 'x', 5, {}, []]) {
    assert.deepEqual(plain(albumSlots(CONFIG, keys)).map((s) => s.unlocked), [false, false, false]);
  }
  assert.deepEqual(plain(albumSlots(CONFIG, { physicsLab: 1, icl: 'yes', room195: true })).map((s) => s.unlocked), [false, false, true]);
});

test('W2: each polaroid has its own slight tilt (not all straight)', () => {
  const angles = plain(albumSlots(CONFIG, keysWith(...KEY_IDS))).map((s) => s.angle);
  assert.equal(new Set(angles).size, 3);
  assert.ok(angles.every((a) => Math.abs(a) > 0 && Math.abs(a) <= 5));
});

test('W2: albumNewSlots: only unlocked slots whose key the page has not shown yet pop', () => {
  const slots = albumSlots(CONFIG, keysWith('physicsLab', 'icl'));
  assert.deepEqual(plain(albumNewSlots(slots, new Set())), [0, 1]);
  assert.deepEqual(plain(albumNewSlots(slots, new Set(['physicsLab']))), [1]);
  assert.deepEqual(plain(albumNewSlots(slots, new Set(['physicsLab', 'icl']))), []);
  assert.deepEqual(plain(albumNewSlots(albumSlots(CONFIG, keysWith()), new Set())), []);
  assert.deepEqual(plain(albumNewSlots(slots, null)), [0, 1]);
});

test('W2: albumComplete is true only when every key is found (and there are keys)', () => {
  assert.equal(albumComplete(keysWith(...KEY_IDS)), true);
  assert.equal(albumComplete(keysWith('physicsLab', 'icl')), false);
  assert.equal(albumComplete({}), false);
  assert.equal(albumComplete(null), false);
});

// ---------- the album is optional: no real entry in card.json means no album page at all ----------

test('no-photo card: albumAvailable is true only when card.json\'s album has at least one real entry', () => {
  assert.equal(albumAvailable(null), false, 'card.json not read yet / missing');
  assert.equal(albumAvailable(undefined), false);
  assert.equal(albumAvailable({}), false);
  assert.equal(albumAvailable({ album: 'x' }), false);
  assert.equal(albumAvailable(buildCardConfig(null)), false);
  assert.equal(albumAvailable(buildCardConfig({})), false);
  assert.equal(albumAvailable(buildCardConfig({ album: [] })), false);
  assert.equal(albumAvailable(buildCardConfig({ album: [null, 7, 'x', {}] })), false, 'only malformed entries');
  assert.equal(albumAvailable(buildCardConfig({ album: [{ file: 'a1.jpg' }] })), true);
  assert.equal(albumAvailable(buildCardConfig({ album: [null, { file: 'a2.jpg' }] })), true, 'an entry in any slot counts');
  assert.equal(albumAvailable(CONFIG), true);
});

test('no-photo card: the Journal footer hint about the album exists only when there is an album', () => {
  const slots = albumSlots(CONFIG, keysWith('physicsLab'));
  assert.equal(albumTabHint(null, albumSlots(null, keysWith('physicsLab')), new Set()), null);
  assert.equal(albumTabHint(buildCardConfig(null), albumSlots(buildCardConfig(null), keysWith(...KEY_IDS)), new Set()), null);
  assert.deepEqual(plain(albumTabHint(CONFIG, slots, new Set())), { fresh: true, text: 'TAB: NEW POLAROID!' });
  assert.deepEqual(plain(albumTabHint(CONFIG, slots, new Set(['physicsLab']))), { fresh: false, text: 'TAB: ALBUM 1/3' });
  assert.deepEqual(plain(albumTabHint(CONFIG, albumSlots(CONFIG, keysWith()), new Set())), { fresh: false, text: 'TAB: ALBUM 0/3' });
});

test('no-photo card: the Journal never switches pages or shows a TAB hint without album entries (wiring)', () => {
  const ui = read('src/scenes/ui.js');
  const journal = ui.slice(ui.indexOf('class JournalPanel'), ui.indexOf('\nclass ', ui.indexOf('class JournalPanel') + 10) > 0 ? ui.indexOf('\nclass ', ui.indexOf('class JournalPanel') + 10) : undefined);
  // the keys do nothing extra, the page can never be reached, build() falls back to the clues
  assert.match(journal, /if \(!e\.repeat && albumAvailable\(this\.albumConfig\)\) this\.setPage\(/);
  assert.match(journal, /if \(page === 'album' && !albumAvailable\(this\.albumConfig\)\) return;/);
  assert.match(journal, /if \(this\.page === 'album' && albumAvailable\(this\.albumConfig\)\) \{ this\.buildAlbum\(\); return; \}\s*this\.page = 'clues';/);
  // the footer hint comes from albumTabHint() (null: no hint), never a hard-coded string
  assert.match(journal, /const tab = albumTabHint\(this\.albumConfig, this\.albumSlotsNow\(\), this\.albumSeen\);/);
  assert.match(journal, /\$\{tab \? `\$\{tab\.text\} -- ` : ''\}J \/ ESC TO CLOSE/);
  assert.doesNotMatch(journal.replace(/\/\/.*$/gm, ''), /'TAB: (NEW POLAROID!|ALBUM)/, 'the TAB hint text lives only in src/album.js');
});

// ---------- the config ----------

test('W2: buildCardConfig album: absent / not an array / garbage entries are tolerated (placeholders), never an error', () => {
  assert.deepEqual(plain(buildCardConfig(null).album), []);
  assert.deepEqual(plain(buildCardConfig({}).album), []);
  assert.deepEqual(plain(buildCardConfig({ album: 'a1.jpg' }).album), []);
  assert.deepEqual(plain(buildCardConfig({ album: { file: 'a1.jpg' } }).album), []);
  assert.deepEqual(plain(buildCardConfig({ album: [] }).album), []);
});

test('W2: buildCardConfig album: at most 3 entries, a bad entry stays in place as null (it must not shift the later photos onto the wrong keys)', () => {
  const config = buildCardConfig({
    album: [{ file: ' a1.jpg ', caption: ' Hi ' }, { caption: 'no file' }, { file: 'a3.jpg' }, { file: 'a4.jpg', caption: 'too many' }],
  });
  assert.deepEqual(plain(config.album), [{ file: 'a1.jpg', caption: 'Hi' }, null, { file: 'a3.jpg', caption: '' }]);
  const slots = plain(albumSlots(config, keysWith(...KEY_IDS)));
  assert.deepEqual(slots.map((s) => s.kind), ['photo', 'placeholder', 'photo']);
  assert.equal(slots[2].file, 'a3.jpg');
  assert.deepEqual(plain(buildCardConfig({ album: [null, 7, 'x', {}] }).album), [null, null, null]);
});

test('W2: the album never leaks into the card\'s own photos list, and a card.json without one is unchanged', () => {
  const config = buildCardConfig({ photos: [{ file: '1.jpg', caption: 'One' }], album: [{ file: 'a1.jpg' }] });
  assert.deepEqual(plain(config.photos), [{ file: '1.jpg', caption: 'One' }]);
  assert.equal(config.messages.length > 0, true);
});

test('W2: assets/card/card.example.json documents an album of 3 entries that buildCardConfig accepts', () => {
  const example = JSON.parse(read('assets/card/card.example.json'));
  assert.equal(Array.isArray(example.album), true);
  assert.equal(example.album.length, 3);
  const config = buildCardConfig(example);
  assert.ok(config.album.every((entry) => entry && entry.file && entry.caption));
});

// ---------- the card's slideshow ----------

test('W2: cardSlidePhotos: the album joins the card photos only once every key is found, after them, without duplicates', () => {
  const config = buildCardConfig({
    photos: [{ file: '1.jpg', caption: 'One' }, { file: 'a2.jpg', caption: 'Card caption wins' }],
    album: [{ file: 'a1.jpg', caption: 'The lab' }, { file: 'a2.jpg', caption: 'Album caption' }, { file: 'a3.jpg', caption: 'The room' }],
  });
  assert.deepEqual(plain(cardSlidePhotos(config, keysWith('physicsLab', 'icl'))).map((p) => p.file), ['1.jpg', 'a2.jpg'], 'two keys: card photos only');
  const merged = plain(cardSlidePhotos(config, keysWith(...KEY_IDS)));
  assert.deepEqual(merged.map((p) => p.file), ['1.jpg', 'a2.jpg', 'a1.jpg', 'a3.jpg'], 'photos first, then the album, a2.jpg once');
  assert.equal(merged[1].caption, 'Card caption wins');
  assert.equal(merged[1].album, undefined, 'a card photo is never tagged as an album one');
  assert.deepEqual(merged.slice(2).map((p) => p.album), [true, true], 'album entries are tagged so the card can drop one that fails to load');
});

test('W2: cardSlidePhotos with no album entries (the common case), null entries or a null config changes nothing', () => {
  const photos = [{ file: '1.jpg', caption: 'One' }];
  assert.deepEqual(plain(cardSlidePhotos(buildCardConfig({ photos }), keysWith(...KEY_IDS))), photos);
  assert.deepEqual(plain(cardSlidePhotos(buildCardConfig({ photos, album: [null, null, null] }), keysWith(...KEY_IDS))), photos);
  assert.deepEqual(plain(cardSlidePhotos(buildCardConfig(null), keysWith(...KEY_IDS))), []);
  assert.deepEqual(plain(cardSlidePhotos(null, keysWith(...KEY_IDS))), []);
  const albumOnly = buildCardConfig({ album: [{ file: 'a1.jpg' }, { file: 'a1.jpg' }] });
  assert.deepEqual(plain(cardSlidePhotos(albumOnly, keysWith(...KEY_IDS))).map((p) => p.file), ['a1.jpg'], 'the same file twice plays once');
  assert.deepEqual(plain(cardSlidePhotos(albumOnly, keysWith('icl'))), [], 'not finished: no album photos in the card');
});

test('W2: the card scene plays src/album.js cardSlidePhotos(), drops any photo that failed to load (no placeholder slide), and shows the cake when nothing real is left', () => {
  const scene = read('src/scenes/card.js');
  assert.match(scene, /this\.slidePhotos = cardSlidePhotos\(this\.config, GameState\.quest\.keys\)/);
  assert.match(scene, /this\.slidePhotos\.forEach\(\(photo, i\) => this\.load\.image\(`card-photo-\$\{i\}`/);
  assert.match(scene, /\.filter\(\(\{ i \}\) => !isMissing\(i\)\)/);
  assert.doesNotMatch(scene, /this\.config\.photos/, 'the scene reads the merged list, never config.photos directly');
});

// ---------- the packer ----------

function scratchProject(setup) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'album-pack-test-'));
  fs.cpSync(path.join(ROOT, 'src'), path.join(tmp, 'src'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'assets', 'card', 'photos'), { recursive: true });
  setup(path.join(tmp, 'assets', 'card'));
  // everything outside assets/card/ "exists" (this is about the card files, not the art)
  const exists = (p) => (p.startsWith(path.join(tmp, 'assets', 'card')) ? fs.existsSync(p) : true);
  return { tmp, exists, cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }) };
}
const collect = (p) => new Set(pack.collectRuntimeAssets({ root: p.tmp, exists: p.exists }).assets.map((a) => a.path));

test('W2: the offline packer embeds the album photos listed in card.json (also the hosted site: the same bundle), once even when the card lists them too', () => {
  const p = scratchProject((card) => {
    fs.writeFileSync(path.join(card, 'card.json'), JSON.stringify({
      photos: [{ file: '1.jpg' }, { file: 'a2.jpg' }],
      album: [{ file: 'a1.jpg', caption: 'x' }, { file: 'a2.jpg' }, { file: 'sub name.png' }, { file: 'ignored-4th.jpg' }, null, { caption: 'no file' }],
    }));
    for (const f of ['1.jpg', 'a1.jpg', 'a2.jpg', 'sub name.png']) fs.writeFileSync(path.join(card, 'photos', f), 'x');
  });
  try {
    const manifest = pack.collectRuntimeAssets({ root: p.tmp, exists: p.exists });
    const have = new Set(manifest.assets.map((a) => a.path));
    for (const rel of ['assets/card/photos/1.jpg', 'assets/card/photos/a1.jpg', 'assets/card/photos/a2.jpg', 'assets/card/photos/sub name.png']) assert.ok(have.has(rel), rel);
    assert.equal(manifest.assets.filter((a) => a.path === 'assets/card/photos/a2.jpg').length, 1, 'listed twice, embedded once');
    assert.ok(!have.has('assets/card/photos/ignored-4th.jpg'), 'only the first 3 album entries count (the game ignores the rest)');
    assert.ok(manifest.assets.find((a) => a.path === 'assets/card/photos/a1.jpg').reason.includes('album'));
  } finally { p.cleanup(); }
});

test('W2: the packer fails loudly on an album file that is listed but missing, or that points outside the photos folder', () => {
  const p = scratchProject((card) => {
    fs.writeFileSync(path.join(card, 'card.json'), JSON.stringify({ album: [{ file: 'gone.jpg' }] }));
  });
  try {
    assert.throws(() => collect(p), /photos\/gone\.jpg/);
    fs.writeFileSync(path.join(p.tmp, 'assets', 'card', 'card.json'), JSON.stringify({ album: [{ file: '../secret.jpg' }] }));
    assert.throws(() => collect(p), /album .*plain file name/);
  } finally { p.cleanup(); }
});

test('W2: with no card.json, an album-less card.json or an empty album the packer embeds no album file and does not throw', () => {
  for (const card of [null, {}, { album: [] }, { album: 'x' }, { album: [null] }]) {
    const p = scratchProject((dir) => { if (card) fs.writeFileSync(path.join(dir, 'card.json'), JSON.stringify(card)); });
    try {
      const have = collect(p);
      assert.ok([...have].every((rel) => !rel.startsWith('assets/card/photos/')));
    } finally { p.cleanup(); }
  }
});

test('W2: the repo itself still packs (no source literal the bundler cannot expand) and the new script is loaded by index.html, copied into the bundle', () => {
  assert.doesNotThrow(() => pack.collectRuntimeAssets());
  const html = read('index.html');
  assert.ok(html.indexOf('<script src="src/album.js"></script>') > html.indexOf('<script src="src/card.js"></script>'), 'album.js loads after card.js');
  assert.ok(html.indexOf('<script src="src/album.js"></script>') < html.indexOf('<script src="src/scenes/ui.js"></script>'), '... and before the scenes that use it');
  assert.ok(pack.scriptSrcs(pack.buildIndexHtml(html, { dataFiles: [] })).includes('src/album.js'), 'the bundle\'s index.html keeps the tag, so build() copies the file');
});

// ---------- the Journal ----------

test('W2: the Journal wiring: an Album page next to the clues, Tab/Left/Right to switch, the same open/close/scroll handlers', () => {
  const ui = read('src/scenes/ui.js');
  const journal = ui.slice(ui.indexOf('class JournalPanel'), ui.indexOf('\nclass ', ui.indexOf('class JournalPanel') + 10) > 0 ? ui.indexOf('\nclass ', ui.indexOf('class JournalPanel') + 10) : undefined);
  assert.match(journal, /for \(const key of \['TAB', 'LEFT', 'RIGHT', 'A', 'D'\]\)/);
  assert.match(journal, /this\.setPage\(this\.page === 'clues' \? 'album' : 'clues'\)/);
  assert.match(journal, /albumSlots\(this\.albumConfig, GameState\.quest\.keys, hasPhoto\)/);
  assert.match(journal, /buildAlbum\(\)/);
  assert.match(journal, /drawPolaroid\(slot, cx, cy\)/);
  assert.match(journal, /A memory for you/);
  // the existing behaviour is still there, untouched: scroll keys, the J/ESC close footer, open() resets to the clues page
  assert.match(journal, /for \(const key of \['UP', 'W'\]\)[^\n]*scrollBy\(-1\)/);
  assert.match(journal, /for \(const key of \['DOWN', 'S'\]\)[^\n]*scrollBy\(1\)/);
  assert.match(journal, /J \/ ESC TO CLOSE/);
  assert.match(journal, /open\(\) \{\s*this\.visible = true;\s*this\.scroll = 0;\s*this\.page = 'clues';/);
  assert.match(ui, /if \(this\.journal\.visible\) this\.journal\.close\(\);\s*\n\s*else if \(!this\.dialog\.isOpen && !this\.pause\.visible && !this\.fullMap\.visible\) this\.journal\.open\(\);/);
});

test('W2: the Journal asks for card.json / the photos only once, only when she holds a key, through the Phaser loader (no network of its own), tolerating every failure', () => {
  const ui = read('src/scenes/ui.js');
  const body = ui.slice(ui.indexOf('  requestAlbum() {'), ui.indexOf('  albumSlotsNow() {'));
  assert.match(body, /if \(this\.albumState !== 'idle' \|\| !Object\.values\(GameState\.quest\.keys\)\.some\(Boolean\)\) return;/);
  assert.match(body, /load\.json\('album-config', CARD_CONFIG_URL\)/);
  assert.match(body, /load\.image\(`album-photo-\$\{i\}`, `\$\{CARD_PHOTOS_DIR\}\$\{entry\.file\}`\)/);
  assert.match(body, /buildCardConfig\(this\.scene\.cache\.json\.get\('album-config'\) \|\| null\)/);
  assert.match(body, /this\.albumMissing\.add\(file\.key\)/);
  assert.equal((body.match(/catch \(error\)/g) || []).length, 2, 'both the outer and the in-callback paths catch');
  assert.doesNotMatch(body, /fetch\(|XMLHttpRequest/);
  assert.doesNotMatch(ui, /['"`]assets\/card/, 'no asset path literal: the packer finds the files through card.json');
});

test('W2: the unlock pop honours ?juice=0 and the album page is a fixed size (no scrolling) that fits the screen', () => {
  const ui = read('src/scenes/ui.js');
  assert.match(ui, /popPolaroid\(polaroid, cx, cy, order\) \{\s*try \{\s*if \(!juiceEnabled\(\)\) return;/);
  const layout = /const ALBUM_LAYOUT = (\{[^}]*\})/.exec(ui);
  assert.ok(layout, 'ALBUM_LAYOUT');
  const L = Function(`return ${layout[1]}`)();
  const panelH = 56 + L.viewportH + 34; // JournalPanel headerH + viewport + footerH
  assert.ok(panelH <= 540 - 40, 'panel fits the screen with a margin');
  assert.ok(L.spacing * 2 + L.w <= 560 - 32, 'three polaroids fit the 560 px panel');
  assert.ok(L.h + 12 <= L.viewportH, 'a tilted polaroid fits the viewport');
  assert.equal(L.border * 2 + L.photoW, L.w);
  assert.equal(L.border + L.photoH + L.stripH, L.h);
});

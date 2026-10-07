// The memory album (wow idea W2, docs/plans/2026-10-04-day3-feedback-and-wow.md): every LUG key she finds unlocks one polaroid in the
// Journal's "Album" page, and once all three keys are found the album's real photos also join the birthday card's slideshow. Pure data +
// rules, no Phaser -- src/scenes/ui.js (JournalPanel) draws the polaroids and src/scenes/card.js merges the photos in
// (docs/ARCHITECTURE.md "content is data, the engine is code").
//
// The photos are the owner's own, from the git-ignored assets/card/ folder (the same mechanism as the card's slideshow): card.json's optional
//   "album": [ { "file": "a1.jpg", "caption": "..." }, ... ]     // up to 3 entries, one per LUG key, in the order the keys are stored
// (src/state.js defaultQuest(): physicsLab, icl, room195), each "file" a name inside assets/card/photos/ -- validated by buildCardConfig()
// (src/card.js, `config.album`; a malformed entry is kept as `null` so it does not shift the later photos onto the wrong keys).
// The album is OPTIONAL: with no real entry in card.json (the fresh-checkout case) albumAvailable() is false and the Journal has no Album page and
// no hint about one at all -- nothing is drawn as a stand-in. Once at least one entry exists, a slot without its own photo (or whose file failed to
// load) is still a small pastel polaroid with a default caption, so the page never looks half-built.

const ALBUM_SLOT_COUNT = 3;

// True only when card.json's `album` has at least one real (non-null) entry. `config` is a buildCardConfig() result, or null/anything while
// card.json has not been read yet or is missing: then there is no album page, no Tab switching and no footer hint (src/scenes/ui.js JournalPanel).
function albumAvailable(config) {
  const album = config && Array.isArray(config.album) ? config.album : [];
  return album.some((entry) => entry && typeof entry.file === 'string' && entry.file.length > 0);
}

// The default caption of a slot whose entry has none (or has no entry at all): keyed by key id, so it stays true whichever order she finds
// the keys in. A key id this table doesn't know (a future key) gets "Memory N".
const ALBUM_DEFAULT_CAPTIONS = {
  physicsLab: 'Memory 1: the Physics Lab key',
  icl: 'Memory 2: the ICL key',
  room195: 'Memory 3: the Room 195 key',
};

// A little tilt each, in degrees: a pile of snapshots, not a spreadsheet.
const ALBUM_ANGLES = [-3, 2, -1.5];

function albumDefaultCaption(keyId, index) {
  return ALBUM_DEFAULT_CAPTIONS[keyId] || `Memory ${index + 1}`;
}

// The ids of the keys the album has a slot for: the first three keys of quest.keys, in stored order (a missing/odd `keys` gives none, and
// the slots below simply stay locked).
function albumKeyIds(keys) {
  return keys && typeof keys === 'object' ? Object.keys(keys).slice(0, ALBUM_SLOT_COUNT) : [];
}

// The three slot descriptors the Journal draws: { index, keyId, unlocked, kind, file, caption, angle }.
//   kind 'locked'      -- she does not hold that key yet (a dim "?" polaroid; caption '')
//   kind 'photo'       -- she holds it and the config has a photo for the slot whose file loaded
//   kind 'placeholder' -- she holds it but there is no photo for the slot (none configured, or `hasPhoto(file, index)` says it failed to load)
// `config` is a buildCardConfig() result (or anything: null/garbage just means no photos), `keys` is GameState.quest.keys, `hasPhoto(file, index)`
// answers "did that file load" (the Journal knows, this pure file does not; the default trusts every file).
function albumSlots(config, keys, hasPhoto = () => true) {
  const album = config && Array.isArray(config.album) ? config.album : [];
  const ids = albumKeyIds(keys);
  const slots = [];
  for (let i = 0; i < ALBUM_SLOT_COUNT; i++) {
    const keyId = ids[i] || null;
    const unlocked = keyId !== null && keys[keyId] === true;
    const entry = album[i] && typeof album[i].file === 'string' && album[i].file ? album[i] : null;
    const real = unlocked && entry !== null && hasPhoto(entry.file, i) !== false;
    const caption = !unlocked ? '' : (entry && typeof entry.caption === 'string' && entry.caption.trim()) || albumDefaultCaption(keyId, i);
    slots.push({
      index: i, keyId, unlocked, kind: !unlocked ? 'locked' : real ? 'photo' : 'placeholder',
      file: real ? entry.file : null, caption, angle: ALBUM_ANGLES[i % ALBUM_ANGLES.length],
    });
  }
  return slots;
}

// How many polaroids are unlocked (the "n/3" in the footer).
function albumUnlockedCount(slots) {
  return slots.filter((s) => s.unlocked).length;
}

// The slots that pop in when the album page is shown: unlocked ones whose key id the player has not been shown yet (`seen` is a Set of key
// ids the panel remembers for this session). Returns the slot indexes.
function albumNewSlots(slots, seen) {
  return slots.filter((s) => s.unlocked && !(seen && seen.has(s.keyId))).map((s) => s.index);
}

// The Journal's clues-page footer hint about the album: null when there is no album (no hint at all), else { text, fresh } where `fresh` means a
// polaroid is waiting that the page has not shown yet (the footer then turns highlight-coloured).
function albumTabHint(config, slots, seen) {
  if (!albumAvailable(config)) return null;
  const fresh = albumNewSlots(slots, seen).length > 0;
  return { fresh, text: fresh ? 'TAB: NEW POLAROID!' : `TAB: ALBUM ${albumUnlockedCount(slots)}/${ALBUM_SLOT_COUNT}` };
}

// True when every key is found (a non-empty `keys` with each value true): the card's slideshow only takes the album once the hunt is done.
function albumComplete(keys) {
  const values = keys && typeof keys === 'object' ? Object.values(keys) : [];
  return values.length > 0 && values.every((v) => v === true);
}

// The photo list the card's slideshow plays: the card's own photos, then (only when every key is found) the album's photos, skipping any file
// the card already lists. Album entries carry `album: true` so src/scenes/card.js can drop one whose file failed to load instead of showing a
// placeholder for it. With no album entries (the common case) this is exactly `config.photos`: nothing changes.
function cardSlidePhotos(config, keys) {
  const photos = config && Array.isArray(config.photos) ? config.photos : [];
  const album = config && Array.isArray(config.album) ? config.album : [];
  if (!albumComplete(keys) || album.length === 0) return photos;
  const seen = new Set(photos.map((p) => p.file));
  const extras = [];
  for (const entry of album) {
    if (!entry || seen.has(entry.file)) continue;
    seen.add(entry.file);
    extras.push({ ...entry, album: true });
  }
  return [...photos, ...extras];
}

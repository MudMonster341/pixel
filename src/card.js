// The birthday card's content (docs/STORY.md "the ending"): recipient name, messages and the photo
// slideshow's order/captions. Pure data + validation, no Phaser -- src/scenes/card.js is the only
// thing that draws this (docs/ARCHITECTURE.md "content is data, the engine is code").
//
// This is the ONE piece of content in the whole game the owner edits directly, by hand, without
// touching code: assets/card/card.json (gitignored, see .gitignore and docs/STORY.md "How to put
// your photos and messages in" for the exact shape and how the game finds it). Because that file
// lives outside version control, a fresh checkout never has one -- buildCardConfig() below always
// has to produce something playable from nothing at all, which is also exactly what makes the ending
// testable without the owner's real media.
//
// Shape the game understands, every field optional (missing/invalid falls back to a default so a
// half-written card.json degrades gracefully instead of breaking the ending):
//   {
//     "recipient": "Taru",                           // who the card is for; falls back to
//                                                     // DEFAULT_RECIPIENT ("Taru") if left out -- NOT the
//                                                     // name typed at the start of the game
//                                                     // (decisions/0019: the gift always names her)
//     "messages": [
//       "Happy Birthday, {name}!",
//       "..."
//     ],
//     "photos": [
//       { "file": "1.jpg", "caption": "..." },        // "file" is a name inside assets/card/photos/
//       { "file": "2.jpg", "caption": "..." }
//     ],
//     "album": [                                     // the Journal's memory album (src/album.js): up to 3
//       { "file": "a1.jpg", "caption": "..." }        // entries, one per LUG key in key order; "file" is also a
//     ]                                               // name inside assets/card/photos/
//   }
// `{name}` in a message is replaced with the resolved recipient name (the same `{name}` token
// src/dialog.js uses for the typed player name -- but here it is the recipient, "Taru" by default).
// card.json also carries the optional credits fields `age` and `wishes`, read by src/credits.js.
//
// A ready-to-copy example of this exact shape lives at assets/card/card.example.json (committed --
// unlike the rest of assets/card/, see .gitignore's own exception for it).

// Who the card (and the credits, src/credits.js) is for until card.json says otherwise.
const DEFAULT_RECIPIENT = 'Taru';

// Shown until the owner writes their own card.json -- warm, generic, and honest about being a
// placeholder, so an unfinished setup still plays as a complete (if plain) little card rather than
// looking broken.
// Kept short on purpose -- src/scenes/card.js's own message box sits inside the card itself, sized
// for about two lines per page (coordinator review, 2026-09-22), not the game's ordinary full-width
// dialog box.
const DEFAULT_CARD_MESSAGES = [
  'Happy Birthday, {name}!',
  'You made it through the whole hunt --',
  'every key, every room, right to the end.',
  'This little game is just the wrapping.',
  'The real gift is wishing you',
  'a wonderful day.',
  'Have the best year yet.',
];

const CARD_CONFIG_URL = 'assets/card/card.json';
const ALBUM_MAX_ENTRIES = 3; // src/album.js ALBUM_SLOT_COUNT: one polaroid per LUG key
const CARD_PHOTOS_DIR = 'assets/card/photos/';
const CARD_VIDEO_URL = 'assets/card/video.mp4';
const BOX_VIDEO_URL = 'assets/cutscenes/video/box-opening.mp4';

// Turns whatever JSON the owner's card.json parsed into (or `null`/`undefined` if it's missing or
// failed to parse) into a config the card scene can always safely draw. The recipient is card.json's
// own `recipient`, else DEFAULT_RECIPIENT -- never the name typed at the start of the game
// (decisions/0019); the old second argument (that typed name) is gone.
//
// Every field is validated independently so a mistake in one (a typo'd photo entry, say) doesn't
// take the rest of a real card.json down with it -- the owner is editing this by hand, not through a
// tool that would catch a mistake before it's played.
function buildCardConfig(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};

  const recipient = typeof source.recipient === 'string' && source.recipient.trim()
    ? source.recipient.trim()
    : DEFAULT_RECIPIENT;

  const messages = Array.isArray(source.messages)
    ? source.messages.filter((line) => typeof line === 'string' && line.trim().length > 0)
    : [];

  const photos = Array.isArray(source.photos)
    ? source.photos
        .filter((p) => p && typeof p === 'object' && typeof p.file === 'string' && p.file.trim())
        .map((p) => ({
          file: p.file.trim(),
          caption: typeof p.caption === 'string' ? p.caption.trim() : '',
        }))
    : [];

  // The memory album (src/album.js): the first 3 entries, kept IN PLACE -- a malformed entry becomes `null` (that slot stays a placeholder)
  // rather than shifting the later photos onto the wrong keys. Absent/invalid -> [] (every slot a placeholder).
  const album = Array.isArray(source.album)
    ? source.album.slice(0, ALBUM_MAX_ENTRIES).map((p) => (p && typeof p === 'object' && typeof p.file === 'string' && p.file.trim()
      ? { file: p.file.trim(), caption: typeof p.caption === 'string' ? p.caption.trim() : '' }
      : null))
    : [];

  return {
    recipient,
    messages: (messages.length ? messages : DEFAULT_CARD_MESSAGES).map((line) => renderCardText(line, recipient)),
    photos,
    album,
  };
}

// `{name}` -> the resolved recipient name, the same templating convention src/dialog.js's
// renderLine() uses for `{name}` -> GameState.playerName. Kept as its own tiny function (not a call
// into dialog.js) so src/card.js has no load-order dependency on it -- this file is pure data/logic,
// loadable and testable on its own.
function renderCardText(text, name) {
  return text.replace(/\{name\}/g, name || '');
}

// ---------- the temporary slideshow ("add in a temporary card as well", owner brief, this pass) ----------
//
// Until the owner drops real photos into assets/card/photos/ (buildCardConfig() above always leaves
// `photos` an empty array on a fresh checkout -- assets/card/ is gitignored and empty by default),
// the slideshow shows these 5 generated pixel illustrations instead of the single "YOUR PHOTO HERE"
// placeholder repeated forever: campus/story moments in story order (docs/STORY.md), so the
// placeholder-state card still looks like a finished slideshow rather than an empty slot. The art
// itself is drawn by tools/make-card-art.js (`card-temp-1.png`..`card-temp-5.png`, into
// assets/cutscenes/ -- committed, not the owner's own gitignored content); this is just the caption
// list src/scenes/card.js pairs each one with. Captions are short and neutral on purpose (matching
// DEFAULT_CARD_MESSAGES' own tone) -- no invented personal details, this game doesn't know any yet.
const TEMP_CARD_SLIDES = [
  { key: 'card-temp-1', caption: 'Day one at BITS Dubai' },
  { key: 'card-temp-2', caption: 'Up the stairs, behind the staircase' },
  { key: 'card-temp-3', caption: 'The LUG treasure hunt' },
  { key: 'card-temp-4', caption: 'Three keys, one at a time' },
  { key: 'card-temp-5', caption: 'A small box, right at the end' },
];

// Chooses what the card's photo frame actually shows, given the resolved config's own `photos` list.
// `resolvePhotoKey(index)` turns a real photo entry into the texture key to show for it (its own real
// photo, or that one slide's placeholder texture if the file 404'd) -- passed in rather than looked up
// here because that check needs `this.textures`/`this.missingPhotoKeys`, Phaser-only state this file
// has no business knowing about (see the file header: this is pure data/logic, no Phaser). Real
// photos always win whenever there are any at all -- the temporary slideshow only ever appears when
// `photos` is completely empty, never mixed in alongside real ones.
function buildCardSlides(photos, resolvePhotoKey) {
  if (!Array.isArray(photos) || photos.length === 0) {
    return TEMP_CARD_SLIDES.map((slide) => ({ ...slide }));
  }
  return photos.map((photo, i) => ({ key: resolvePhotoKey(i), caption: photo.caption }));
}

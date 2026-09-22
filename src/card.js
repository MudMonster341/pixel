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
//     "recipient": "Aisha",                          // who the card is for; falls back to
//                                                     // GameState.playerName (the name typed at the
//                                                     // start of the game) if left out
//     "messages": [
//       "Happy Birthday, {name}!",
//       "..."
//     ],
//     "photos": [
//       { "file": "1.jpg", "caption": "..." },        // "file" is a name inside assets/card/photos/
//       { "file": "2.jpg", "caption": "..." }
//     ]
//   }
// `{name}` in a message is replaced with the resolved recipient name, the same `{name}` convention
// src/dialog.js already uses for the player's name everywhere else in the game.

// Shown until the owner writes their own card.json -- warm, generic, and honest about being a
// placeholder, so an unfinished setup still plays as a complete (if plain) little card rather than
// looking broken.
const DEFAULT_CARD_MESSAGES = [
  'Happy Birthday, {name}!',
  'You made it through the whole hunt -- every key, every room, right to the end.',
  'This little game is just the wrapping. The real gift is wishing you a wonderful day.',
  'Have the best year yet.',
];

const CARD_CONFIG_URL = 'assets/card/card.json';
const CARD_PHOTOS_DIR = 'assets/card/photos/';
const CARD_VIDEO_URL = 'assets/card/video.mp4';
const BOX_VIDEO_URL = 'assets/cutscenes/video/box-opening.mp4';

// Turns whatever JSON the owner's card.json parsed into (or `null`/`undefined` if it's missing or
// failed to parse) into a config the card scene can always safely draw. `fallbackName` is
// GameState.playerName, used when the owner hasn't pinned an explicit recipient of their own.
//
// Every field is validated independently so a mistake in one (a typo'd photo entry, say) doesn't
// take the rest of a real card.json down with it -- the owner is editing this by hand, not through a
// tool that would catch a mistake before it's played.
function buildCardConfig(raw, fallbackName) {
  const source = raw && typeof raw === 'object' ? raw : {};

  const recipient = typeof source.recipient === 'string' && source.recipient.trim()
    ? source.recipient.trim()
    : (fallbackName || 'you');

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

  return {
    recipient,
    messages: (messages.length ? messages : DEFAULT_CARD_MESSAGES).map((line) => renderCardText(line, recipient)),
    photos,
  };
}

// `{name}` -> the resolved recipient name, the same templating convention src/dialog.js's
// renderLine() uses for `{name}` -> GameState.playerName. Kept as its own tiny function (not a call
// into dialog.js) so src/card.js has no load-order dependency on it -- this file is pure data/logic,
// loadable and testable on its own.
function renderCardText(text, name) {
  return text.replace(/\{name\}/g, name || '');
}

// The birthday credits' content and schedule (decisions/0019-credits-ending-and-recipient.md): the
// "Happy Birthday, Taru" / "Happy 22" / wishes-one-by-one / THE END / "Made for you by Mustafa" phase
// that plays after the card (src/scenes/card.js). Pure data + logic, no Phaser -- src/scenes/credits.js
// is the only thing that draws it (docs/ARCHITECTURE.md "content is data, the engine is code").
//
// Like the card, this is edited by the owner without touching code: the same assets/card/card.json
// (gitignored, see src/card.js) may carry three optional fields that override the defaults below:
//   { "recipient": "Taru", "age": 22, "wishes": ["...", "..."] }
// Anything missing or of the wrong type just falls back to the default, so a half-written card.json
// can never break the ending. `{name}` inside a wish is replaced with the recipient.
//
// Loaded after src/card.js (it reuses DEFAULT_RECIPIENT and renderCardText from there).

// PLACEHOLDERS: these eight wishes are deliberately generic and soft -- the owner replaces them with
// his own (via card.json "wishes") once the real card content exists. Nothing here may claim anything
// personal about her life: no invented memories, no in-jokes, no real people. Keep each under 70
// characters so a line stays readable at the credits' text size.
const DEFAULT_CREDITS = {
  recipient: DEFAULT_RECIPIENT,
  age: 22,
  wishes: [
    'May this year be your gentlest and brightest yet.',
    'I hope every day gives you a reason to smile.',
    'Here is to laughing until it hurts, often.',
    'May good friends always find their way to you.',
    'I hope your next adventure is better than you imagined.',
    'Wishing you calm mornings and happy surprises.',
    'You have every reason to be proud of yourself.',
    'Happy birthday, {name}. Today is entirely yours.',
  ],
  madeBy: 'Mustafa',
};

// Merges the (already parsed) assets/card/card.json over DEFAULT_CREDITS. `raw` may be anything,
// including null/undefined when the file is missing or failed to parse. Every field is validated on
// its own, so one typo can't discard the rest.
function buildCreditsConfig(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};

  const recipient = typeof source.recipient === 'string' && source.recipient.trim()
    ? source.recipient.trim()
    : DEFAULT_CREDITS.recipient;

  const age = typeof source.age === 'number' && Number.isInteger(source.age) && source.age > 0 && source.age < 150
    ? source.age
    : DEFAULT_CREDITS.age;

  const ownWishes = Array.isArray(source.wishes)
    ? source.wishes.filter((wish) => typeof wish === 'string' && wish.trim().length > 0).map((wish) => wish.trim())
    : [];

  return {
    recipient,
    age,
    wishes: (ownWishes.length ? ownWishes : DEFAULT_CREDITS.wishes).map((wish) => renderCardText(wish, recipient)),
    madeBy: DEFAULT_CREDITS.madeBy,
  };
}

// The credits' schedule, in milliseconds from the scene's start, so the pacing is one tested place
// rather than numbers scattered through the scene. Every phase is a { start, end } window:
//   fadeIn  the sky fades up from black
//   title   "Happy Birthday, <name>" -- visible from `start` until the wishes begin
//   age     "Happy 22" appears under the title partway through, leaves with it
//   wishes  one window per wish, back to back; each wish fades in at the start of its window and
//           cross-fades into the next one, so exactly one wish is on screen at a time
//   theEnd  "THE END"; then `madeBy` ("Made for you by ...") fades in under it
// `total` is when the scene hands back to the title. With 8 wishes this is about 42 s overall, of which
// the wishes phase is 30 s (decisions/0019: "not too long").
const CREDITS_DEFAULT_TIMING = {
  fadeInMs: 1500,
  titleMs: 5500, // "Happy Birthday" window, including the beat where "Happy 22" shares the screen
  ageDelayMs: 2500, // how long after the title appears that the age line joins it
  wishMs: 3750, // 3 s fading in and holding + a 0.75 s cross-fade into the next wish
  endMs: 5500, // THE END window
  madeByDelayMs: 1800, // how long after THE END appears the "Made for you" line joins it
};

function creditsTimeline(wishCount, opts) {
  const t = { ...CREDITS_DEFAULT_TIMING, ...(opts || {}) };
  const count = Number.isFinite(wishCount) && wishCount > 0 ? Math.floor(wishCount) : 0;

  const fadeIn = { start: 0, end: t.fadeInMs };
  const titleStart = fadeIn.end;
  const wishesStart = titleStart + t.titleMs;
  const title = { start: titleStart, end: wishesStart };
  const age = { start: titleStart + t.ageDelayMs, end: wishesStart };
  const wishes = [];
  for (let i = 0; i < count; i++) {
    wishes.push({ start: wishesStart + i * t.wishMs, end: wishesStart + (i + 1) * t.wishMs });
  }
  const wishesEnd = wishesStart + count * t.wishMs;
  const theEnd = { start: wishesEnd, end: wishesEnd + t.endMs };
  const madeBy = { start: theEnd.start + t.madeByDelayMs, end: theEnd.end };

  return { fadeIn, title, age, wishes, wishesStart, wishesEnd, theEnd, madeBy, total: theEnd.end };
}

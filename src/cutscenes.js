// Cutscene data (content, not engine — docs/ARCHITECTURE.md). Played by src/scenes/cutscene.js.
// `image` is a texture key; the scene loads it from assets/cutscenes/<name>.png, stripping the
// "cutscene-" prefix (see tools/make-cutscenes.js). The illustration is drawn taller than the
// 960x540 frame on purpose, so the scene can pan down it automatically as it fades in — no pan
// numbers need to live in the data. `speaker` is null for a narration-style box with no name tag
// (DialogBox in ui.js supports this). The owner writes the real story later (CLAUDE.md); keep
// lines short and neutral for now.
const CUTSCENES = {
  gate2: {
    image: 'cutscene-gate2',
    lines: [
      'Welcome to BITS Pilani, Dubai Campus!',
      'Your first day on campus begins here.',
    ],
    speaker: null,
  },
};

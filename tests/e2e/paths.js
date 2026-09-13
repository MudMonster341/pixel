const os = require('os');
const path = require('path');

module.exports = {
  PORT: 4173,
  // Browser tests write feedback here, never into the real feedback/ folder.
  FEEDBACK_DIR: path.join(os.tmpdir(), 'pixel-quest-e2e-feedback'),
};

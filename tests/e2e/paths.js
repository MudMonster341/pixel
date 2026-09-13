const os = require('os');
const path = require('path');

// E2E_PORT lets more than one agent run browser tests at the same time without clashing on 4173.
const PORT = Number(process.env.E2E_PORT) || 4173;

module.exports = {
  PORT,
  // Browser tests write feedback here, never into the real feedback/ folder. The port is baked
  // into the folder name so two agents on different ports never share (and race on) one folder.
  FEEDBACK_DIR: path.join(os.tmpdir(), `pixel-quest-e2e-feedback-${PORT}`),
};

const fs = require('fs');
const { FEEDBACK_DIR } = require('./paths');

module.exports = async () => {
  fs.rmSync(FEEDBACK_DIR, { recursive: true, force: true });
};

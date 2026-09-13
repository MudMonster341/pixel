// Dev feedback storage: one JSON file per item (feedback/items/FB-0001.json) plus its screenshot.
// Used by server.js (the in-game overlay, i.e. the owner) and tools/feedback.js (the agent).
// Workflow and statuses are described in docs/FEEDBACK.md.
const fs = require('fs');
const path = require('path');

const TYPES = ['bug', 'change', 'idea'];
const PRIORITIES = ['low', 'normal', 'high'];
const STATUSES = ['new', 'needs-info', 'answered', 'planned', 'in-progress', 'fixed', 'verified', 'reopened', 'wont-fix'];
const WAITING_ON_OWNER = ['needs-info', 'fixed'];
const WAITING_ON_AGENT = ['new', 'answered', 'reopened', 'planned', 'in-progress'];
const LIMITS = { title: 120, area: 60, text: 5000, screenshotBytes: 5 * 1024 * 1024 };

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const invalid = (message) => new HttpError(400, message);

function requireText(value, name, max = LIMITS.text) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw invalid(`${name} is required`);
  if (text.length > max) throw invalid(`${name} is longer than ${max} characters`);
  return text;
}

function optionalText(value, name, max = LIMITS.text) {
  if (value == null || value === '') return '';
  return requireText(value, name, max);
}

function oneOf(value, allowed, name) {
  if (!allowed.includes(value)) throw invalid(`${name} must be one of: ${allowed.join(', ')}`);
  return value;
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function decodeImage(dataUrl) {
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl));
  if (!match) throw invalid('screenshot must be a PNG or JPEG data URL');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > LIMITS.screenshotBytes) throw invalid('screenshot is too large');
  return { buffer, ext: match[1] === 'png' ? 'png' : 'jpg' };
}

class FeedbackStore {
  constructor(dir) {
    this.dir = dir;
    this.itemsDir = path.join(dir, 'items');
    this.screenshotsDir = path.join(dir, 'screenshots');
  }

  list() {
    if (!fs.existsSync(this.itemsDir)) return [];
    return fs
      .readdirSync(this.itemsDir)
      .filter((name) => /^FB-\d+\.json$/.test(name))
      .sort()
      .map((name) => JSON.parse(fs.readFileSync(path.join(this.itemsDir, name), 'utf8')));
  }

  get(id) {
    if (!/^FB-\d+$/.test(String(id))) throw invalid(`"${id}" is not a feedback id (expected e.g. FB-0001)`);
    const file = path.join(this.itemsDir, `${id}.json`);
    if (!fs.existsSync(file)) throw new HttpError(404, `${id} not found`);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  screenshotPath(id) {
    const item = this.get(id);
    const file = item.screenshot && path.join(this.dir, item.screenshot);
    if (!file || !fs.existsSync(file)) throw new HttpError(404, `${id} has no screenshot`);
    return file;
  }

  // ----- owner actions (from the in-game overlay) -----

  create(input = {}) {
    const item = {
      id: null,
      title: requireText(input.title, 'title', LIMITS.title),
      type: oneOf(input.type ?? 'bug', TYPES, 'type'),
      area: optionalText(input.area, 'area', LIMITS.area) || 'General',
      priority: oneOf(input.priority ?? 'normal', PRIORITIES, 'priority'),
      status: 'new',
      createdAt: null,
      updatedAt: null,
      details: optionalText(input.details, 'details'),
      context: isPlainObject(input.context) ? input.context : {},
      marker: isPlainObject(input.marker) ? input.marker : null,
      screenshot: null,
      thread: [],
      resolution: null,
      history: [],
    };
    const image = input.screenshot ? decodeImage(input.screenshot) : null;

    const at = new Date().toISOString();
    item.id = this.nextId();
    item.createdAt = at;
    item.updatedAt = at;
    item.history.push({ at, by: 'owner', status: 'new' });
    if (image) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
      item.screenshot = `screenshots/${item.id}.${image.ext}`;
      fs.writeFileSync(path.join(this.dir, item.screenshot), image.buffer);
    }
    this.save(item);
    return item;
  }

  ownerReply(id, text) {
    return this.update(id, 'owner', (item, at) => {
      item.thread.push({ author: 'owner', text: requireText(text, 'text'), at });
      return item.status === 'needs-info' ? 'answered' : null;
    });
  }

  ownerVerify(id, text) {
    return this.update(id, 'owner', (item, at) => {
      expectStatus(item, ['fixed'], 'verify');
      if (text) item.thread.push({ author: 'owner', text: requireText(text, 'text'), at });
      return 'verified';
    });
  }

  ownerReopen(id, text) {
    return this.update(id, 'owner', (item, at) => {
      expectStatus(item, ['fixed', 'verified', 'wont-fix'], 'reopen');
      item.thread.push({ author: 'owner', text: requireText(text, 'text'), at });
      return 'reopened';
    });
  }

  // ----- agent actions (from tools/feedback.js) -----

  agentAsk(id, question) {
    return this.update(id, 'agent', (item, at) => {
      item.thread.push({ author: 'agent', text: requireText(question, 'question'), at });
      return 'needs-info';
    });
  }

  agentNote(id, text) {
    return this.update(id, 'agent', (item, at) => {
      item.thread.push({ author: 'agent', text: requireText(text, 'note'), at });
      return null;
    });
  }

  agentStatus(id, status, note) {
    return this.update(id, 'agent', (item, at) => {
      oneOf(status, ['planned', 'in-progress'], 'status');
      if (note) item.thread.push({ author: 'agent', text: requireText(note, 'note'), at });
      return status;
    });
  }

  agentFix(id, { test, commit, note } = {}) {
    return this.update(id, 'agent', (item, at) => {
      item.resolution = { test: requireText(test, 'test'), commit: commit || null, at };
      if (note) item.thread.push({ author: 'agent', text: requireText(note, 'note'), at });
      return 'fixed';
    });
  }

  agentWontFix(id, reason) {
    return this.update(id, 'agent', (item, at) => {
      item.thread.push({ author: 'agent', text: requireText(reason, 'reason'), at });
      return 'wont-fix';
    });
  }

  // ----- internals -----

  update(id, by, change) {
    const item = this.get(id);
    const at = new Date().toISOString();
    const status = change(item, at);
    if (status && status !== item.status) {
      item.status = status;
      item.history.push({ at, by, status });
    }
    item.updatedAt = at;
    this.save(item);
    return item;
  }

  nextId() {
    const highest = Math.max(0, ...this.list().map((item) => Number(item.id.slice(3))));
    return `FB-${String(highest + 1).padStart(4, '0')}`;
  }

  save(item) {
    fs.mkdirSync(this.itemsDir, { recursive: true });
    const file = path.join(this.itemsDir, `${item.id}.json`);
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(item, null, 2) + '\n');
    fs.renameSync(`${file}.tmp`, file);
  }
}

function expectStatus(item, allowed, action) {
  if (!allowed.includes(item.status)) {
    throw new HttpError(409, `Can't ${action} ${item.id} while it is "${item.status}"`);
  }
}

module.exports = { FeedbackStore, HttpError, TYPES, PRIORITIES, STATUSES, WAITING_ON_OWNER, WAITING_ON_AGENT };

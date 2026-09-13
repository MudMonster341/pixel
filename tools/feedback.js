// The agent's side of the dev feedback system. The owner creates items in-game (dev mode, press `).
// Workflow: docs/FEEDBACK.md
//
//   npm run feedback                                   items waiting on the agent
//   npm run feedback -- list --all                     every item
//   npm run feedback -- show FB-0001                   details, context, thread
//   npm run feedback -- ask FB-0001 "Which tree?"      question → owner answers in-game
//   npm run feedback -- plan FB-0001 ["note"]          → planned
//   npm run feedback -- start FB-0001 ["note"]         → in-progress
//   npm run feedback -- note FB-0001 "text"            message only, status unchanged
//   npm run feedback -- fix FB-0001 --test "<spec file> › <test name>" [--commit abc123] ["note"]
//   npm run feedback -- wontfix FB-0001 "reason"
const path = require('path');
const { FeedbackStore, WAITING_ON_OWNER, WAITING_ON_AGENT } = require('./feedback-store');

const FEEDBACK_DIR = process.env.FEEDBACK_DIR || path.join(__dirname, '..', 'feedback');
const store = new FeedbackStore(FEEDBACK_DIR);

function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      options[arg.slice(2)] = true;
    } else {
      options[arg.slice(2)] = next;
      i++;
    }
  }
  return { positional, options };
}

function printList(items) {
  if (!items.length) return console.log('Nothing here.');
  for (const item of items) {
    console.log(
      [item.id, item.status.padEnd(11), item.priority.padEnd(6), item.type.padEnd(6), item.area.padEnd(16), item.title].join('  '),
    );
  }
}

function printItem(item) {
  const { context = {}, marker } = item;
  const lines = [
    `${item.id}  [${item.status}]  ${item.type} · ${item.area} · ${item.priority} priority`,
    item.title,
    `Created ${item.createdAt} · updated ${item.updatedAt}`,
    '',
    item.details ? `Details:\n  ${item.details.replace(/\n/g, '\n  ')}` : 'Details: (none)',
    '',
    `Where: map "${context.map}" · player tile ${context.tile?.x},${context.tile?.y} · facing ${context.facing}` +
      (marker ? ` · pointed at tile ${marker.tile.x},${marker.tile.y}` : ''),
    `Build: ${context.build || 'unknown'} · tutorial: ${context.tutorial?.stage} · dialog open: ${context.dialogOpen}`,
    item.screenshot ? `Screenshot: ${path.join(FEEDBACK_DIR, item.screenshot)}` : 'Screenshot: (none)',
    `Game state: ${JSON.stringify({ inventory: context.inventory, flags: context.flags, collected: context.collected })}`,
  ];
  if (item.thread.length) {
    lines.push('', 'Thread:');
    for (const message of item.thread) lines.push(`  [${message.author} ${message.at}] ${message.text}`);
  }
  if (item.resolution) lines.push('', `Resolution: test "${item.resolution.test}"${item.resolution.commit ? `, commit ${item.resolution.commit}` : ''}`);
  console.log(lines.join('\n'));
}

const report = (item) => console.log(`${item.id} → ${item.status}`);
const text = (positional) => positional.slice(1).join(' ');

const commands = {
  list({ options }) {
    const items = store.list();
    printList(options.all ? items : items.filter((item) => WAITING_ON_AGENT.includes(item.status)));
    const waiting = items.filter((item) => WAITING_ON_OWNER.includes(item.status)).length;
    if (!options.all && waiting) console.log(`\n${waiting} item(s) waiting on the owner (use --all to see them).`);
  },
  show: ({ positional }) => printItem(store.get(positional[0])),
  ask: ({ positional }) => report(store.agentAsk(positional[0], text(positional))),
  note: ({ positional }) => report(store.agentNote(positional[0], text(positional))),
  plan: ({ positional }) => report(store.agentStatus(positional[0], 'planned', text(positional))),
  start: ({ positional }) => report(store.agentStatus(positional[0], 'in-progress', text(positional))),
  fix: ({ positional, options }) =>
    report(store.agentFix(positional[0], { test: options.test, commit: options.commit, note: text(positional) })),
  wontfix: ({ positional }) => report(store.agentWontFix(positional[0], text(positional))),
};

const [command = 'list', ...rest] = process.argv.slice(2);
if (!commands[command]) {
  console.error(`Unknown command "${command}". Commands: ${Object.keys(commands).join(', ')}`);
  process.exit(1);
}
try {
  commands[command](parseArgs(rest));
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}

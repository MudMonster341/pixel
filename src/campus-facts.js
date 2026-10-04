// Talkable campus students (decisions/0018): every ambient student (src/ambient.js) has a `role`; a role
// has a few small-talk openers and a pool of real campus facts. Content, not engine (docs/ARCHITECTURE.md):
// src/scenes/world.js only asks campusTalkLines() "what does this student say right now?". The owner can
// edit or add facts here without touching the engine.
//
// Sourcing rule (ADR 0018): every fact is traced to a row of docs/research/campus-facts.md by `source`
// (its F-id), is paraphrased in a friendly student voice, and never says anything that research file
// doesn't. A claim that file marks unsure or "Left out" is not used. Real CS professors may be *named*
// (owner's decision), limited to the names, titles and areas that file lists. For the two people whose
// titles conflict there (Elakkiya R and J. Angel Arul Jothi) the name appears with NO title at all.
// Name tags are role labels ("LUG member") unless an ambient entry is a NAMED character (FB-0050, ADR 0021:
// the owner's friends and professors): its `name` replaces the label and its `lines` are what it says (see the
// src/ambient.js header and campusTalkLines() below). The full list for review is
// docs/research/campus-lines-review.md.
//
// Shapes:
//   CAMPUS_ROLES[roleId] = { label, outfit?, openers: [1-6 short role-flavoured greetings, no facts], smallTalk? }
//     openers:   FB-0051: the CS-flavoured roles have 4-6 funny ones (semicolons, 'works on my machine', sudo, vim ...), light and
//                never about a real person; one is picked per student by hash, and is followed by one sourced fact.
//     outfit:    a club colour (FB-0057): 'sky' | 'acm' | 'lug' | 'mtc'. A club role's students wear it:
//                the sheet is `npc-<character>-<outfit>` (tools/make-assets.js CLUB_OUTFITS), see ambientSheetKey().
//                No outfit = the student's plain clothes.
//     smallTalk: 2-3 light, NON-factual lines, used as the pool only when a role has no sourced facts (a club
//                the research has nothing on yet, e.g. 'mtc-member'); marked as placeholders in the review doc.
//   CAMPUS_FACTS         = [{ id, role, text, source }]   (text <= 160 chars; source = an F-id)

const CAMPUS_ROLES = {
  'first-year': {
    label: 'First-year',
    openers: [
      "Hi! It's only my first few weeks, everything is still new.",
      'Oh hey! Still finding my way around. The map and I are not on speaking terms.',
      "I've walked into the wrong class twice. Both times it sounded more interesting.",
      'Hi! Do deadlines always land tomorrow, or is that just mine?',
      'A senior told me to sleep more, then went for an energy drink. Mixed messages!',
    ],
  },
  'lug-member': {
    label: 'LUG member',
    outfit: 'lug', // orange and black, like the Linux logo (FB-0057)
    openers: [
      'Hey! Have you tried Linux yet? Just asking.',
      'Penguins are underrated, you know.',
      'sudo make me a sandwich... permission denied. Hi!',
      'I use Linux, by the way. Sorry, it just slips out.',
      'I once deleted my whole project folder with one command. I still say hello to it every morning.',
      'My workflow is Stack Overflow, copy, paste, hope. Hi!',
    ],
  },
  'library-regular': {
    label: 'Library regular',
    openers: [
      'Shh... just kidding, hi! I practically live in the library.',
      'I came for one book. Four hours and thirty browser tabs later, here I am.',
      "The library Wi-Fi and I have a complicated relationship. It's mostly one-sided.",
      'Hello! Quiet campus day, the way I like it.',
      'Quiet please, my code is thinking.',
    ],
  },
  'tech-club-member': {
    label: 'Tech club member',
    outfit: 'sky',
    openers: [
      'Hi! Sorry, I was thinking about a circuit.',
      "Hey! I'm on my way to the lab. Have you tried turning it off and on again?",
      'Our soldering iron has a better attendance record than I do.',
      'Everything is a circuit if you stare at it long enough. Even lunch.',
      'Magic smoke is what makes a circuit work. When it leaves, so does the circuit.',
    ],
  },
  'sports-player': {
    label: 'Sports player',
    openers: [
      "Hey! Just warming up, don't mind me.",
      'Hi! Great day for a game.',
      'I run to clear my head. The bug is still waiting when I get back.',
    ],
  },
  'hostel-resident': {
    label: 'Hostel mate',
    openers: [
      'Hi! Just heading back to the hostel.',
      'Hey! Is it dinner time yet?',
      'My Wi-Fi password is longer than my last essay. I type it with love.',
    ],
  },
  'cs-student': {
    label: 'CS student',
    openers: [
      "It works on my machine. I have no idea why it doesn't work on yours.",
      "I forgot a semicolon and lost an hour. We don't talk about it.",
      'Quick question: is it a bug or a feature? Asking for my project.',
      "My code compiled on the first try. I'm scared. Something is wrong.",
      "I'm not procrastinating. I'm running a background process called Later.",
      "Hey! Do you know how to exit vim? Asking for a friend. It's been three days.",
    ],
  },
  'ai-student': {
    label: 'CS student',
    openers: [
      "The AI wrote my code. Now I'm politely asking it to explain it to me.",
      "My model is ninety-nine percent accurate on the training data. We don't discuss the test data.",
      'I asked a chatbot for advice. It said it would get back to me. Relatable.',
      'Machine learning is just statistics with a better logo.',
      "I trained a model all night. It learned to predict that I'm sleepy.",
      'Hi! Ask me anything about AI. Well, almost anything.',
    ],
  },
  'quiz-club-member': {
    label: 'Quiz club member',
    outfit: 'sky',
    openers: [
      "Hi! Quick question: how good is your trivia? I'll know if you google it.",
      "Fun fact: I know a lot of fun facts. Ask me one. Actually don't, I'll start.",
      "Hey! I'm in a quizzing mood today. Phone a friend? I only have a calculator.",
      "Stack Overflow answers my questions. I answer everyone else's. Fair trade.",
      'Trick question: which comes first, the chicken or the compile error?',
    ],
  },
  'cultural-club-member': {
    label: 'Cultural club member',
    outfit: 'sky',
    openers: [
      "Hi! I'm rushing to a rehearsal.",
      'Hey! Do you like music or art more?',
      'I wrote a song about my code. It has a lot of bugs and one very sad chorus.',
    ],
  },
  'senior': {
    label: 'Senior',
    openers: [
      "Hi! Final stretch for me, can't wait.",
      "I've survived every deadline so far. Mostly with snacks and optimism.",
      "Seniors don't panic. We quietly open seven tabs of Stack Overflow.",
      'My advice: save the file, back it up, then save it again.',
      "Hey! I've been around campus a while now. I know which seat has the best Wi-Fi.",
    ],
  },
  'volunteer': {
    label: 'Volunteer',
    outfit: 'lug', // the volunteers here are the LUG's (FB-0057)
    openers: [
      'Hi there! Always happy to help.',
      'Hey! Got a minute to chat?',
      'I signed up for one small thing. It is now my whole personality.',
    ],
  },
  'campus-regular': {
    label: 'Student',
    openers: [
      'Hi! I know my way around, so ask away.',
      'Hello! Looking for something?',
      "If you need directions: left, then right, then ask someone else. That's my map.",
    ],
  },
  'acm-member': {
    label: 'ACM member',
    outfit: 'acm', // dark pink (FB-0057)
    openers: [
      'Hi! Got a minute? I could talk about computing all day.',
      'Our meetings run on pizza and optimism. Mostly pizza.',
      "I told my code it was just a phase. It's still in production.",
      "I once used git push --force. We don't speak of the incident. Hi!",
      "Competitive programming: because regular programming wasn't stressful enough.",
    ],
  },
  // MTC: the owner asked for black and white (FB-0057). The research has no sourced facts about it, so it talks
  // small talk only (PLACEHOLDERS, owner to replace: docs/research/campus-lines-review.md) and is the one role
  // the "at least 2 facts" test makes an explicit exception for.
  'mtc-member': {
    label: 'MTC member',
    outfit: 'mtc',
    openers: [
      'Hi! Black and white, always. It saves time in the morning.',
      'Our club motto is keep it simple. Our group chat disagrees.',
      'We tried a colour scheme once. The meeting never recovered.',
      "Hey! I'm off to a club meeting. It's for ideas. Mostly for snacks.",
    ],
    smallTalk: ['Our club room is the best place to lose track of time.', 'We like to keep things simple: black, white and good ideas.', 'Come by one day, we are always up for new faces.'],
  },
};

const CAMPUS_FACTS = [
  // first-year
  { id: 'CF01', role: 'first-year', source: 'F002', text: "We're in Dubai International Academic City, the city's education hub. Lots of campuses next door!" },
  { id: 'CF02', role: 'first-year', source: 'F011', text: 'The campus shuttles run around Dubai, Sharjah and Ajman, and you pay per semester. Really handy.' },
  { id: 'CF03', role: 'first-year', source: 'F063', text: "There's a student council, so if something bugs you, you actually have a voice here." },
  // LUG member
  { id: 'CF04', role: 'lug-member', source: 'F047', text: 'We have student chapters like IEEE, SAE, ASHRAE, Dot-Net and the Linux Users Group. That is us!' },
  { id: 'CF05', role: 'lug-member', source: 'F048', text: 'The LUG is for open-source and Linux fans. It started in 2023, so we are still pretty new.' },
  { id: 'CF06', role: 'lug-member', source: 'F073', text: 'Dr. Tamizharasan Periyasamy in CS works on deep learning, edge inference and IoT.' },
  // library regular
  { id: 'CF07', role: 'library-regular', source: 'F023', text: 'The library has about 25,000 print books and over 10,000 e-books. I could read forever.' },
  { id: 'CF08', role: 'library-regular', source: 'F024', text: 'The library reading room has 288 seats. Go early before exams or you will not get one!' },
  { id: 'CF09', role: 'library-regular', source: 'F022', text: 'The campus network links about 500 computers, with fibre between the blocks, library and hostels.' },
  // tech club member
  { id: 'CF10', role: 'tech-club-member', source: 'F046', text: 'Our IEEE Student Branch is said to be the largest IEEE student branch in the Gulf.' },
  { id: 'CF11', role: 'tech-club-member', source: 'F064', text: 'A team of 30 students from here launched five pico satellites in the MAHASAT project, in six weeks!' },
  { id: 'CF12', role: 'tech-club-member', source: 'F072', text: 'Dr. Raja Muthalagu in CS works on blockchain, IoT and network security.' },
  // sports player
  { id: 'CF13', role: 'sports-player', source: 'F034', text: 'We have a grass football pitch, basketball, volleyball, tennis and a turf cricket ground.' },
  { id: 'CF14', role: 'sports-player', source: 'F054', text: 'BITS Sports Festival 2025 was the 22nd edition, with 5,500+ athletes from 39 universities.' },
  { id: 'CF15', role: 'sports-player', source: 'F055', text: 'At that festival our football team won gold for the first time in 22 years, after a penalty shootout!' },
  // hostel resident
  { id: 'CF16', role: 'hostel-resident', source: 'F025', text: 'Boys and girls have separate hostels, fully air-conditioned and furnished.' },
  { id: 'CF17', role: 'hostel-resident', source: 'F026', text: "There are four boys' hostel blocks and two girls' blocks, and every one has Wi-Fi." },
  { id: 'CF18', role: 'hostel-resident', source: 'F027', text: 'Hostel dining has both vegetarian and non-vegetarian options, so everyone is covered.' },
  // CS student
  { id: 'CF19', role: 'cs-student', source: 'F015', text: 'CS offers a B.E. in CS, a B.E. in Electronics and Computer, and an M.E. in Software Systems.' },
  { id: 'CF20', role: 'cs-student', source: 'F068', text: 'Dr. Pranav Mothabhau Pawar is the Head of our CS department, working on AI and networks.' },
  { id: 'CF21', role: 'cs-student', source: 'F069', text: 'Dr. Amitava Mukherjee is a Professor in Computer Science and Information Systems.' },
  // AI student
  { id: 'CF22', role: 'ai-student', source: 'F071', text: 'J. Angel Arul Jothi, in CS, works on deep learning and medical imaging.' },
  { id: 'CF23', role: 'ai-student', source: 'F074', text: 'Elakkiya R, in CS, works on AI and machine learning, language and computer vision.' },
  { id: 'CF24', role: 'ai-student', source: 'F075', text: 'Dr. Amanjot Kaur is an Assistant Professor in CS, working on edge AI and EV cybersecurity.' },
  { id: 'CF25', role: 'ai-student', source: 'F076', text: 'Dr. Hussain Ahmed Chowdhury is an Assistant Professor in CS (bioinformatics and machine learning).' },
  // quiz club member
  { id: 'CF26', role: 'quiz-club-member', source: 'F042', text: 'Flummoxed is the quiz club, and it hosts quizzing events all through the year.' },
  { id: 'CF27', role: 'quiz-club-member', source: 'F043', text: 'Supernova is the club for stars, astronomy and quantum physics fans.' },
  { id: 'CF28', role: 'quiz-club-member', source: 'F044', text: "There's a Wall Street Club for finance and investing, and an F1 Club for racing fans." },
  // cultural club member
  { id: 'CF29', role: 'cultural-club-member', source: 'F040', text: 'Trebel is the music club, and Shades is the art club.' },
  { id: 'CF30', role: 'cultural-club-member', source: 'F041', text: 'Paribhasha is the drama club, with plays, stand-up and street theatre.' },
  { id: 'CF31', role: 'cultural-club-member', source: 'F052', text: 'Jashn is our big inter-university cultural fest, with music, dance and art.' },
  // senior
  { id: 'CF32', role: 'senior', source: 'F017', text: 'Practice School means 7.5 months of real industry work as part of your degree.' },
  { id: 'CF33', role: 'senior', source: 'F005', text: 'Over 6,000 graduates have come out of this campus and gone on to big jobs around the world.' },
  { id: 'CF34', role: 'senior', source: 'F006', text: 'This campus has turned out more than 50 start-ups in the last five years.' },
  // volunteer
  { id: 'CF35', role: 'volunteer', source: 'F061', text: 'Students run an annual blood donation drive, city clean-ups, and Earth Day tree planting.' },
  { id: 'CF36', role: 'volunteer', source: 'F057', text: 'Spectrum is a joyful event for children of determination, run by the Make a Difference club.' },
  { id: 'CF37', role: 'volunteer', source: 'F059', text: 'Daan Utsav is a whole week about giving. Proscenium is our theatre competition.' },
  // campus regular
  { id: 'CF38', role: 'campus-regular', source: 'F030', text: 'There is a campus clinic with a doctor and nurses for first aid and emergencies.' },
  { id: 'CF39', role: 'campus-regular', source: 'F038', text: 'The Student Welfare Division sorts out ID cards, travel concessions and bonafide certificates.' },
  { id: 'CF40', role: 'campus-regular', source: 'F032', text: 'Free, confidential counselling is available if exams or life get stressful.' },
  // ACM member
  { id: 'CF41', role: 'acm-member', source: 'F049', text: 'ACM BPDC has 250+ members, with AI/ML, competitive programming, development and cybersecurity groups.' },
  { id: 'CF42', role: 'acm-member', source: 'F051', text: 'The ACM-W chapter at BITS Dubai started in 2019, the first of its kind in the UAE.' },
  { id: 'CF43', role: 'acm-member', source: 'F070', text: 'Dr. Sujala Deepak Shetty is a CS Professor and Associate Dean for Practice School and Industry Engagement.' },
];

// ---------- talking (pure; src/scenes/world.js calls campusTalkLines) ----------

// A tiny stable string hash, so the same student always starts at the same spot in a pool and two
// neighbours rarely say the same thing first.
function campusHash(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

function campusFactsFor(role) {
  return CAMPUS_FACTS.filter((fact) => fact.role === role);
}

// FB-0057: the texture a student draws with. A club role has an `outfit` (CAMPUS_ROLES), and the generator
// (tools/make-assets.js CLUB_OUTFITS) bakes one sheet per ambient body and club colour, `npc-<character>-<outfit>`.
// A role with no outfit (or an unknown role) keeps the plain `npc-<character>` sheet. `entry` is an
// src/ambient.js entry; src/maplogic.js characterSheets() preloads exactly these keys, src/scenes/world.js draws them.
// FB-0051: a named friend or professor names its own sheet (`sheet`, e.g. 'npc-friend-sid'), which wins over the role's outfit.
function ambientSheetKey(entry) {
  if (entry.sheet) return entry.sheet;
  const role = CAMPUS_ROLES[entry.role];
  return role && role.outfit ? `npc-${entry.character}-${role.outfit}` : `npc-${entry.character}`;
}

// Session state (GameState.campusTalk, src/state.js; never saved): `heard[factId]` = how many times
// that fact has been said, `talks[studentId]` = how many times she has spoken to that student.
function newCampusTalkState() {
  return { heard: {}, talks: {} };
}

// What student `studentId` of `role` says right now: { name, lines, factId }. The fact is the
// least-heard one in the role's pool (ties go in the pool order rotated by the student's own hash), so
// every fact is said before any repeats -- for one student, and across the students of one role.
// The first time she talks to a given student the line starts with a role-flavoured opener; later
// visits go straight to the next fact. A role with no sourced facts uses its `smallTalk` lines as the pool.
//
// `named` (FB-0050, optional; pass the src/ambient.js entry): { name?, lines?, factIds? } makes the student a named
// character. `name` is the name tag instead of the role label. `lines` are fixed lines she says in full the
// first time she talks to this student, INSTEAD of the role's opener and fact; later talks continue with the
// role's facts (the opener is never repeated), or, if the role has none (or `factIds` is empty), say the fixed lines again.
// Lines may contain `{name}`: world.js interact() renders them with the player's name (default "Taru"), src/dialog.js renderLines().
function campusTalkLines(role, studentId, state, named) {
  const info = CAMPUS_ROLES[role];
  const name = (named && named.name) || (info ? info.label : 'Student');
  const fixed = named && Array.isArray(named.lines) && named.lines.length > 0 ? named.lines.slice() : null;
  let pool = campusFactsFor(role);
  // `factIds` (FB-0051, optional): restrict a named character to some of the role's facts ('CF23' only, for the professor the
  // fact is about); an empty list means "only my own fixed lines", said again on every talk.
  if (named && Array.isArray(named.factIds)) pool = pool.filter((fact) => named.factIds.includes(fact.id));
  else if (pool.length === 0 && info && Array.isArray(info.smallTalk)) {
    pool = info.smallTalk.map((text, i) => ({ id: `${role}#${i}`, text })); // placeholders, not sourced facts
  }
  if (!info || pool.length === 0) return { name, lines: fixed || ['Hi there!'], factId: null };
  const hash = campusHash(studentId);
  const start = hash % pool.length;
  let best = null;
  for (let i = 0; i < pool.length; i++) {
    const fact = pool[(start + i) % pool.length];
    const count = state.heard[fact.id] || 0;
    if (best === null || count < (state.heard[best.id] || 0)) best = fact;
  }
  const talks = state.talks[studentId] || 0;
  if (fixed && talks === 0) { // a named character's own words come first, and use up no fact
    state.talks[studentId] = 1;
    return { name, lines: fixed, factId: null };
  }
  state.heard[best.id] = (state.heard[best.id] || 0) + 1;
  state.talks[studentId] = talks + 1;
  const lines = talks === 0 && !fixed ? [info.openers[hash % info.openers.length], best.text] : [best.text];
  return { name, lines, factId: best.id };
}

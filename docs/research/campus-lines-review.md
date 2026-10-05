# Talkable campus lines: review list

For the owner to review (ADR 0018, [decisions/0018-talkable-campus-life.md](../../decisions/0018-talkable-campus-life.md)). Generated from `src/campus-facts.js` on 2026-10-03.
Every fact is traced to a row of [campus-facts.md](campus-facts.md) by its `source` id (F-number); nothing else is said.
To change a line, edit `src/campus-facts.js` (then update this table; `npm test` checks the two agree).

## How it works in the game

- Every ambient student has a **role** (the name tag in the dialog box is the role label). One ambient entry can be a **named character** (FB-0050): see "Named characters" below.
- Club members wear their club's colours (FB-0057, ADR 0021): MTC black and white, ACM dark pink, LUG (and the volunteers) orange and black like the Linux logo, the other clubs sky blue.
- Pressing E near a student: they stop, turn to her, and say a role-flavoured **opener**, then a **fact** from the role's pool.
  The next time she talks to the same student they go straight to the next fact. Every fact in a role's pool is said before any repeats.
- Real CS professors are named only as listed in campus-facts.md. For the two people whose titles conflict there
  (Elakkiya R and J. Angel Arul Jothi) the name appears **with no title**. No opinions or personal details.
- Cats say a soft "Meow." (two of them are talkable); see the animals note at the bottom.

## Roles and openers

FB-0051 (2026-10-04): the owner asked for funnier, weirder CS-student lines, so the openers below were rewritten (4-6 per CS-flavoured role: semicolons, "works on my machine", AI wrote it, sudo, vim, git push --force, deadlines, Wi-Fi, Stack Overflow, energy drinks). Light, never about a real person. Each opener is followed by one sourced fact; the facts did not change. **Owner: please read and tell me which to change or cut.**

| role | name tag | openers (small talk, no facts; one is picked per student) |
|------|----------|--------------------------------|
| first-year | First-year | Hi! It's only my first few weeks, everything is still new. / Oh hey! Still finding my way around. The map and I are not on speaking terms. / I've walked into the wrong class twice. Both times it sounded more interesting. / Hi! Do deadlines always land tomorrow, or is that just mine? / A senior told me to sleep more, then went for an energy drink. Mixed messages! |
| lug-member | LUG member | Hey! Have you tried Linux yet? Just asking. / Penguins are underrated, you know. / sudo make me a sandwich... permission denied. Hi! / I use Linux, by the way. Sorry, it just slips out. / I once deleted my whole project folder with one command. I still say hello to it every morning. / My workflow is Stack Overflow, copy, paste, hope. Hi! |
| library-regular | Library regular | Shh... just kidding, hi! I practically live in the library. / I came for one book. Four hours and thirty browser tabs later, here I am. / The library Wi-Fi and I have a complicated relationship. It's mostly one-sided. / Hello! Quiet campus day, the way I like it. / Quiet please, my code is thinking. |
| tech-club-member | Tech club member | Hi! Sorry, I was thinking about a circuit. / Hey! I'm on my way to the lab. Have you tried turning it off and on again? / Our soldering iron has a better attendance record than I do. / Everything is a circuit if you stare at it long enough. Even lunch. / Magic smoke is what makes a circuit work. When it leaves, so does the circuit. |
| sports-player | Sports player | Hey! Just warming up, don't mind me. / Hi! Great day for a game. / I run to clear my head. The bug is still waiting when I get back. |
| hostel-resident | Hostel mate | Hi! Just heading back to the hostel. / Hey! Is it dinner time yet? / My Wi-Fi password is longer than my last essay. I type it with love. |
| cs-student | CS student | It works on my machine. I have no idea why it doesn't work on yours. / I forgot a semicolon and lost an hour. We don't talk about it. / Quick question: is it a bug or a feature? Asking for my project. / My code compiled on the first try. I'm scared. Something is wrong. / I'm not procrastinating. I'm running a background process called Later. / Hey! Do you know how to exit vim? Asking for a friend. It's been three days. |
| ai-student | CS student | The AI wrote my code. Now I'm politely asking it to explain it to me. / My model is ninety-nine percent accurate on the training data. We don't discuss the test data. / I asked a chatbot for advice. It said it would get back to me. Relatable. / Machine learning is just statistics with a better logo. / I trained a model all night. It learned to predict that I'm sleepy. / Hi! Ask me anything about AI. Well, almost anything. |
| quiz-club-member | Quiz club member | Hi! Quick question: how good is your trivia? I'll know if you google it. / Fun fact: I know a lot of fun facts. Ask me one. Actually don't, I'll start. / Hey! I'm in a quizzing mood today. Phone a friend? I only have a calculator. / Stack Overflow answers my questions. I answer everyone else's. Fair trade. / Trick question: which comes first, the chicken or the compile error? |
| cultural-club-member | Cultural club member | Hi! I'm rushing to a rehearsal. / Hey! Do you like music or art more? / I wrote a song about my code. It has a lot of bugs and one very sad chorus. |
| senior | Senior | Hi! Final stretch for me, can't wait. / I've survived every deadline so far. Mostly with snacks and optimism. / Seniors don't panic. We quietly open seven tabs of Stack Overflow. / My advice: save the file, back it up, then save it again. / Hey! I've been around campus a while now. I know which seat has the best Wi-Fi. |
| volunteer | Volunteer | Hi there! Always happy to help. / Hey! Got a minute to chat? / I signed up for one small thing. It is now my whole personality. |
| campus-regular | Student | Hi! I know my way around, so ask away. / Hello! Looking for something? / If you need directions: left, then right, then ask someone else. That's my map. |
| acm-member | ACM member | Hi! Got a minute? I could talk about computing all day. / Our meetings run on pizza and optimism. Mostly pizza. / I told my code it was just a phase. It's still in production. / I once used git push --force. We don't speak of the incident. Hi! / Competitive programming: because regular programming wasn't stressful enough. |
| mtc-member | MTC member | Hi! Black and white, always. It saves time in the morning. / Our club motto is keep it simple. Our group chat disagrees. / We tried a colour scheme once. The meeting never recovered. / Hey! I'm off to a club meeting. It's for ideas. Mostly for snacks. |

## Placeholder lines (no sourced facts yet)

The research has nothing on the MTC club, so the MTC member says these light, non-factual lines instead of facts (**PLACEHOLDERS: owner, please replace with real MTC lines**). The role rotates through them.

| role | placeholder line |
|------|------------------|
| mtc-member | Our club room is the best place to lose track of time. |
| mtc-member | We like to keep things simple: black, white and good ideas. |
| mtc-member | Come by one day, we are always up for new faces. |

## Named characters

One ambient student can have a `name` (the name tag) and fixed `lines` (said the first time she talks to them, instead of the opener and a fact; later talks carry on with the role's facts). The data is in `src/ambient.js`. These are **PLACEHOLDERS for the owner to edit**: light, friendly, no invented personal facts.

FB-0051 (P2b, the owner's friends, Mustafa and three professors; ADR 0021 and its addendum):
- `{name}` in a line is the player's name (it is "Taru" unless the player typed another). No line mentions a birthday: that stays the surprise at the end.
- **Mustafa** (black and orange LUG hoodie) stands near each mini-game with a different fixed line, and repeats only that line. The three tiles: Physics Lab (main-block-3, 9,4), ICL (main-block-1, 6,17: in the corridor outside the lab, since P5c the ICL is a sealed lab), Room 195 (main-block-1, 27,4).
- **Professors** keep their tag as "Prof. <first name>" (names only, no surnames). After the jokes the sourced fact about that professor is said (Raja CF12, Angel CF22, Elakkiya CF23), nothing else.
  Raja's last line hints at the chariot scene that comes in a later package. The girls (Sana, Shraddha, Palak), Mevin and Narda are also a later package.
- The other friends carry on with their role's facts after their own lines (e.g. Sid, a CS student, shares a CS fact).
- Looks: Satvik has a camera and a slightly deeper skin tone, Prof. Angel has small white wings, Prof. Raja a gold-trimmed maroon jacket. The hair length is the pack body's own (three hair shapes), so people differ by hair colour, skin, shirt and body.
- Risky lines to look at first: Prof. Raja ("I carry myself like royalty"), Prof. Elakkiya ("goated", "no mercy"), Prof. Angel ("the wings are real"), Najam ("Sleep is a feature I turned off").

| name | where | lines |
|------|-------|-------|
| Sid | campus, patrols 232,160 to 248,165, sheet npc-friend-sid | Hey {name}! I'm Sid. Quick question: how many browser tabs is too many? I'm at forty and climbing. / My laptop fan is louder than my lecture right now. It's a duet. / If you hear screaming from the lab, don't worry. It's just me and a merge conflict. |
| Deanne | campus, tile 243,162 | Hi, I'm Deanne! I live in the hostel. / Hostel dinner is the best part of my day, honestly. That and my chai. / I know every quiet corner on this campus. Ask me anything. |
| Akshit | campus, tile 221,137, sheet npc-friend-akshit | Akshit here. My rules: nothing before coffee, nothing after midnight, nothing without a backup. / Is it a bug or a feature? Depends on whether the demo is today. / I'd tell you a UDP joke, but you might not get it. |
| Satvik | campus, tile 215,134, sheet npc-friend-satvik | Hold still, {name}! The light is perfect. Say cheese... or say semicolon, it works for us too. / I photograph everything here: sunsets, lunch, bugs on the screen. Mostly lunch. / My camera's one rule: if it's a good moment, it's a good shot. Strike a pose! |
| Varun | campus, tile 238,136, sheet npc-friend-varun | I'm Varun. I came for a quick chat and stayed for a long one. / My code has two states: it works, and nobody touch it. / Is the canteen open? Asking for my stomach. It has no Wi-Fi and no patience. |
| Mitul | campus, tile 190,63, sheet npc-friend-mitul | Mitul reporting! Fun fact: it's always a missing semicolon. Always. / I counted my deadlines. Then I stopped counting, for my own health. / Hydration check, {name}! Water first. Then energy drink number seven. |
| Siva | campus, tile 150,115, sheet npc-friend-siva | Siva here! I use dark mode for everything. Even this conversation. / Why do programmers prefer dark mode? Because light attracts bugs. / If it works, don't touch it. If it doesn't, also don't touch it. Go get chai. |
| Prof. Raja | main-block-g, tile 26,19, sheet npc-prof-raja | Greetings, {name}. I am Prof. Raja. A proper entrance is half of any lecture. / I carry myself like royalty because my timetable demands it. Mostly the Monday ones. / I have a ride coming. Quite soon, actually. |
| Shamsuddin | main-block-g, patrols 22,24 to 27,24, sheet npc-friend-shamsuddin | Shamsuddin! I name my files final, final2 and really_final. It's called version control. / My code review was one question mark. I'm still thinking about it. / Wi-Fi is the one thing I can't compile, debug or fix. Good luck! |
| Mustafa | main-block-1, tile 6,17, sheet npc-mustafa | That door is a fingerprint scanner with an attitude. Tap gently, don't mash. / My record on that scan is embarrassing. I'm not telling. |
| Mustafa | main-block-1, tile 27,4, sheet npc-mustafa | Room 195 is a climb. Bring good shoes. And a bit of patience. / Look up before you go up. Things come down faster than deadlines do. |
| Prof. Elakkiya | main-block-1, patrols 8,20 to 20,20, sheet npc-prof-elakkiya | Ah, {name}! Ready for a pop quiz? They say my quizzes are hard. I say they build character. / Some students call me goated. I just call it a fair quiz with no mercy. / Remember: no panic, and read the question twice. Maybe three times. Good luck! |
| Najam | main-block-2, tile 10,14, sheet npc-friend-najam | Najam here. I only open my laptop when it's charged and I'm brave. / I made a to-do list. Item one: stop making to-do lists. / Sleep is a feature I turned off this semester. Not recommended. |
| Prof. Angel | main-block-2, tile 24,14, sheet npc-prof-angel | Hello {name}! Yes, I'm Prof. Angel. And yes, the wings are real. Mostly. / Angel is my name and patience is my superpower. Don't worry, I'll go easy. I'm an angel, not a miracle worker. / If your grades are heavenly, thank the wings. If not, bless you, there's always the next exam. |
| Karthik | main-block-3, patrols 14,19 to 27,19, sheet npc-friend-karthik | I'm Karthik. I fixed one bug today and made three new ones. Net growth! / If Stack Overflow goes down, so do I. It's like a holiday, but scary. / Read the error message. Then read it again. Then blame the compiler. |
| Mustafa | main-block-3, tile 9,4, sheet npc-mustafa | Welcome to the Physics Lab! Fair warning: gravity here is taken very seriously. / Mind the jumps. I fell off three times. Okay, more. |

## Facts (43)

| id | role | line | source |
|----|------|------|--------|
| CF01 | first-year | We're in Dubai International Academic City, the city's education hub. Lots of campuses next door! | F002 |
| CF02 | first-year | The campus shuttles run around Dubai, Sharjah and Ajman, and you pay per semester. Really handy. | F011 |
| CF03 | first-year | There's a student council, so if something bugs you, you actually have a voice here. | F063 |
| CF04 | lug-member | We have student chapters like IEEE, SAE, ASHRAE, Dot-Net and the Linux Users Group. That is us! | F047 |
| CF05 | lug-member | The LUG is for open-source and Linux fans. It started in 2023, so we are still pretty new. | F048 |
| CF06 | lug-member | Dr. Tamizharasan Periyasamy in CS works on deep learning, edge inference and IoT. | F073 |
| CF07 | library-regular | The library has about 25,000 print books and over 10,000 e-books. I could read forever. | F023 |
| CF08 | library-regular | The library reading room has 288 seats. Go early before exams or you will not get one! | F024 |
| CF09 | library-regular | The campus network links about 500 computers, with fibre between the blocks, library and hostels. | F022 |
| CF10 | tech-club-member | Our IEEE Student Branch is said to be the largest IEEE student branch in the Gulf. | F046 |
| CF11 | tech-club-member | A team of 30 students from here launched five pico satellites in the MAHASAT project, in six weeks! | F064 |
| CF12 | tech-club-member | Dr. Raja Muthalagu in CS works on blockchain, IoT and network security. | F072 |
| CF13 | sports-player | We have a grass football pitch, basketball, volleyball, tennis and a turf cricket ground. | F034 |
| CF14 | sports-player | BITS Sports Festival 2025 was the 22nd edition, with 5,500+ athletes from 39 universities. | F054 |
| CF15 | sports-player | At that festival our football team won gold for the first time in 22 years, after a penalty shootout! | F055 |
| CF16 | hostel-resident | Boys and girls have separate hostels, fully air-conditioned and furnished. | F025 |
| CF17 | hostel-resident | There are four boys' hostel blocks and two girls' blocks, and every one has Wi-Fi. | F026 |
| CF18 | hostel-resident | Hostel dining has both vegetarian and non-vegetarian options, so everyone is covered. | F027 |
| CF19 | cs-student | CS offers a B.E. in CS, a B.E. in Electronics and Computer, and an M.E. in Software Systems. | F015 |
| CF20 | cs-student | Dr. Pranav Mothabhau Pawar is the Head of our CS department, working on AI and networks. | F068 |
| CF21 | cs-student | Dr. Amitava Mukherjee is a Professor in Computer Science and Information Systems. | F069 |
| CF22 | ai-student | J. Angel Arul Jothi, in CS, works on deep learning and medical imaging. | F071 |
| CF23 | ai-student | Elakkiya R, in CS, works on AI and machine learning, language and computer vision. | F074 |
| CF24 | ai-student | Dr. Amanjot Kaur is an Assistant Professor in CS, working on edge AI and EV cybersecurity. | F075 |
| CF25 | ai-student | Dr. Hussain Ahmed Chowdhury is an Assistant Professor in CS (bioinformatics and machine learning). | F076 |
| CF26 | quiz-club-member | Flummoxed is the quiz club, and it hosts quizzing events all through the year. | F042 |
| CF27 | quiz-club-member | Supernova is the club for stars, astronomy and quantum physics fans. | F043 |
| CF28 | quiz-club-member | There's a Wall Street Club for finance and investing, and an F1 Club for racing fans. | F044 |
| CF29 | cultural-club-member | Trebel is the music club, and Shades is the art club. | F040 |
| CF30 | cultural-club-member | Paribhasha is the drama club, with plays, stand-up and street theatre. | F041 |
| CF31 | cultural-club-member | Jashn is our big inter-university cultural fest, with music, dance and art. | F052 |
| CF32 | senior | Practice School means 7.5 months of real industry work as part of your degree. | F017 |
| CF33 | senior | Over 6,000 graduates have come out of this campus and gone on to big jobs around the world. | F005 |
| CF34 | senior | This campus has turned out more than 50 start-ups in the last five years. | F006 |
| CF35 | volunteer | Students run an annual blood donation drive, city clean-ups, and Earth Day tree planting. | F061 |
| CF36 | volunteer | Spectrum is a joyful event for children of determination, run by the Make a Difference club. | F057 |
| CF37 | volunteer | Daan Utsav is a whole week about giving. Proscenium is our theatre competition. | F059 |
| CF38 | campus-regular | There is a campus clinic with a doctor and nurses for first aid and emergencies. | F030 |
| CF39 | campus-regular | The Student Welfare Division sorts out ID cards, travel concessions and bonafide certificates. | F038 |
| CF40 | campus-regular | Free, confidential counselling is available if exams or life get stressful. | F032 |
| CF41 | acm-member | ACM BPDC has 250+ members, with AI/ML, competitive programming, development and cybersecurity groups. | F049 |
| CF42 | acm-member | The ACM-W chapter at BITS Dubai started in 2019, the first of its kind in the UAE. | F051 |
| CF43 | acm-member | Dr. Sujala Deepak Shetty is a CS Professor and Associate Dean for Practice School and Industry Engagement. | F070 |

## Moments (FB-0051 follow-up: the unskippable little scenes, `src/moments.js`, `src/scripts.js`)

Short scenes that play ONCE only while she walks around (never again after Continue; a brand-new save plays them again), at least 90 s of play apart and never two on one map visit (EXCEPT the entrance pair: M2 follows M1 about 6 s after it ends, on the same visit), each ending by itself in about 14-16 s (every line advances on its own after a moment, and E still speeds it up). `{name}` is the player's name ("Taru" by default). **Owner: edit any line.**

| Moment | Where | Speaker | Line |
|---|---|---|---|
| M1 the unicorn and the prince | just inside Gate 2 (first time only, after the welcome) | {name} | WOAH, WHAT? I'm not drunk yet, so why is a unicorn here? |
| | | Prince | Don't mind me. I'm always watching. |
| | | {name} | Huh... is this the actual BITS? |
| M2 Mevin the drummer (plays for Treble, the music club; runs in with a drum kit, drums a bar, ends on a rimshot, runs off) | the brick forecourt in front of the Main Block, as she first walks up to the Main Block, about 6 s after M1 ends | Mevin (Treble) | WOAHHH, {name}! You da goat! |
| | | Mevin (Treble) | Come watch me perform at Jashn some day! |

M1's first line is the owner's own inside joke, exactly as written (no softening). The prince is a generic crowned stand-in; the unicorn is a generic white horse with a horn (no protected character).

## Where the people are

Ambient students are listed in `src/ambient.js` (about 38 on the campus map, 3-6 per Main Block floor). A role is attached to each one; edit the `role` field to change who says what.

## Animals

The only animal line is "Meow." (the Gate 2 cat and the hostel cat are talkable and show a small heart). Cats are not named. See `src/animals.js`.

## P5c (FB-0071): Alice, the ICL's robot (a story NPC, `src/story.js` STORY.alice; lines are placeholders for the owner to edit)

Alice (name tag "Alice") hovers over a charging pad inside the fingerprint-locked ICL, beside the core console that holds the key. The first talk greets her and hands over the key (the same actions the console uses); later talks give one light line each, in order, then the last line on repeat. Tile 7,10 of main-block-1.
- First talk: Welcome to the ICL, {name}! I'm Alice. I run 4,096 threads and still lose to the coffee machine. / Those racks crunch the numbers, the holo table draws them, and I try to look useful. / You cracked my front door, so this is yours: the LUG key from my core console. Take it!
- Then: The key found a good home, I hope. Keys are my second favourite thing. Coffee is first, sadly. / Fun fact: the globe over the table is just the lab's Wi-Fi, drawn dramatically. / My battery says I'm at 100 percent. My mood says snack break.
- Then, repeated: Good luck with the other keys, {name}. Come back whenever the Wi-Fi gets lonely.
The door and scanner say: "Sealed. Fingerprint scan required." / "The scanner on the wall beside the door is the way in." / "A fingerprint scanner pulses blue. Time to crack it." / "Scan accepted. The ICL door opens."

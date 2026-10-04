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

| role | name tag | openers (small talk, no facts) |
|------|----------|--------------------------------|
| first-year | First-year | Hi! It's only my first few weeks, everything is still new. / Oh hey! Still finding my way around, honestly. |
| lug-member | LUG member | Hey! Have you tried Linux yet? Just asking. / Penguins are underrated, you know. |
| library-regular | Library regular | Shh... just kidding, hi! I practically live in the library. / Hello! Quiet campus day, the way I like it. |
| tech-club-member | Tech club member | Hi! Sorry, I was thinking about a circuit. / Hey! I'm on my way to the lab. |
| sports-player | Sports player | Hey! Just warming up, don't mind me. / Hi! Great day for a game. |
| hostel-resident | Hostel mate | Hi! Just heading back to the hostel. / Hey! Is it dinner time yet? |
| cs-student | CS student | Hey! Give me a second, my code is compiling. / Hi! Do you know any good debugging tricks? |
| ai-student | CS student | Hello! I've been reading about machine learning all day. / Hi! Ask me anything about AI. Well, almost anything. |
| quiz-club-member | Quiz club member | Hi! Quick question: how good is your trivia? / Hey! I'm in a quizzing mood today. |
| cultural-club-member | Cultural club member | Hi! I'm rushing to a rehearsal. / Hey! Do you like music or art more? |
| senior | Senior | Hi! Final stretch for me, can't wait. / Hey! I've been around campus a while now. |
| volunteer | Volunteer | Hi there! Always happy to help. / Hey! Got a minute to chat? |
| campus-regular | Student | Hi! I know my way around, so ask away. / Hello! Looking for something? |
| acm-member | ACM member | Hi! Got a minute? I could talk about computing all day. / Hey! I'm heading to a chapter meeting. |
| mtc-member | MTC member | Hi! Black and white, always. It saves time in the morning. / Hey! I'm off to a club meeting. |

## Placeholder lines (no sourced facts yet)

The research has nothing on the MTC club, so the MTC member says these light, non-factual lines instead of facts (**PLACEHOLDERS: owner, please replace with real MTC lines**). The role rotates through them.

| role | placeholder line |
|------|------------------|
| mtc-member | Our club room is the best place to lose track of time. |
| mtc-member | We like to keep things simple: black, white and good ideas. |
| mtc-member | Come by one day, we are always up for new faces. |

## Named characters

One ambient student can have a `name` (the name tag) and fixed `lines` (said the first time she talks to them, instead of the opener and a fact; later talks carry on with the role's facts). The data is in `src/ambient.js`. These are **PLACEHOLDERS for the owner to edit**: light, friendly, no invented personal facts.

| name | where | lines |
|------|-------|-------|
| Deanne | campus, avenue bench (tile 243,162), role hostel-resident | Hi, I'm Deanne! I live in the hostel. / Hostel dinner is the best part of my day, honestly. That and my chai. / I know every quiet corner on this campus. Ask me anything. |

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

## Where the people are

Ambient students are listed in `src/ambient.js` (about 38 on the campus map, 3-6 per Main Block floor). A role is attached to each one; edit the `role` field to change who says what.

## Animals

The only animal line is "Meow." (the Gate 2 cat and the hostel cat are talkable and show a small heart). Cats are not named. See `src/animals.js`.

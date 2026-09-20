# Roadmap to the finished game

**Goal (owner, 2026-09-20):** a finished, sendable game of the [LUG treasure hunt](STORY.md), ending
in an animated birthday card. Shipped as a **Windows .exe** (plus a hosted web build), with Pokémon-
class pixel art, proper UI boxes, animations, and genuinely good game feel.

**Target:** 2 to 4 weeks from 2026-09-20.

**Owner decisions (2026-09-20):**
- **Art:** keep the 16 px tile grid; redraw everything to a much higher standard (characters get real
  faces, hair and shading; tiles get depth; UI gets classy boxes). No grid change, so maps survive.
- **Card:** the owner supplies photos and a video, dropped into `assets/card/` (never committed).
- **Map:** the current OpenStreetMap-based campus is the one to keep. **Minor enhancements only.**
- **Loop:** work runs on a schedule every few hours, day and night (see "The loop" below).

## How this file is used

This is the **loop's single source of truth**. Each scheduled run:
1. reads CLAUDE.md, CONTEXT.md, STORY.md and this file
2. runs `npm run feedback`; anything the owner sent goes to the front of the queue
3. picks the **first unchecked task**, delegates it to a Sonnet agent, reviews it, tests it
4. ticks the box, logs it in MEMORY.md, commits and pushes
5. leaves the game running on http://localhost:8080 for the owner

Tasks are written so one run can finish one. Keep them that size.

## M1 — Story engine (the toolkit the script needs)

- [ ] Quest/flag state in GameState (`flags`, `keys`, `stage`), plus save/load to localStorage with versioned saves and profile-ready storage
- [ ] Data-driven NPC dialog: lines chosen by flags, with an `onEnd` action list (give item, set flag, start mini-game, play cutscene)
- [ ] Dialog choices (yes/no and branches), matching the UI box style
- [ ] Interaction bubble: a floating **E** above any NPC/thing in range (owner asked for this), plus **!** for new info
- [ ] Blocked doors: a `locked` reason shown as a toast ("Locked for the event"), driven by map object properties
- [ ] Quest tracker panel: "Keys: 1 / 3" and the current objective
- [ ] Journal (J): the clues received so far

## M2 — Art overhaul (Pokémon class)

- [ ] Characters: the lead redrawn at 16×24 with a real face, hair, and 4-frame walks in 4 directions; shadows
- [ ] The LUG volunteer NPC, plus 2-3 background students, same quality
- [ ] Outdoor tiles: re-shade lawn, paths, roads, walls and trees so the campus reads as DS-era Pokémon
- [ ] Interior tiles: floors, walls, doors, stairs and furniture redrawn to the same standard
- [ ] UI kit: classy dialog box, panels, buttons, quest tracker, and the hotbar, all in one visual language
- [ ] Title screen and pause menu (ESC), with the game's name and art

## M3 — The story slice (the actual game)

- [ ] Entrance cutscene: the Main Block steps, pillars and red arch, drawn from photos as reference
- [ ] Main Block foyer becomes the story hub: the LUG stall behind the staircase, other exits politely blocked
- [ ] The volunteer: full dialog, gives the hunt, reacts to progress, and hands over the reward at the end
- [ ] The three key rooms get their own cutscenes: Physics Lab (3rd floor), ICVL (1st floor), Room 195
- [ ] Keys as real items, with the tracker and journal updating
- [ ] The reward box: opening animation, then the card
- [ ] The birthday card: animated pixel card, photo slots from `assets/card/`, the owner's messages, then the video

## M4 — Mini-games

- [ ] A mini-game framework: launch from a dialog action, score target, retry, "skip after 3 tries", return the result to the quest
- [ ] Platformer (Physics Lab)
- [ ] Flappy-style flyer (ICVL)
- [ ] Tetris (Room 195)
- [ ] Each one: its own art, sound-ready hooks, and Playwright tests that play it headlessly

## M5 — Feel and polish

- [ ] Sound effects (jsfxr, free) and background music (CC0), with a volume setting
- [ ] Transitions everywhere: doors, cutscenes, mini-games, card
- [ ] Idle animations, footstep dust, door-open animation, camera nudges
- [ ] Minor campus enhancements only (the owner likes the map): benches, bins, bus stop, better signage, a few students walking loops

## M6 — Ship it

- [ ] Web build served as static files, tested in a clean browser profile
- [ ] Electron wrapper: `npm run dist` produces a signedless Windows `.exe` with an icon, no install needed
- [ ] The card's media folder documented so the owner can drop files in without touching code
- [ ] A README for the person receiving the game

## M7 — Continuous QA (runs every loop, never "done")

- [ ] Strict UI tests: every panel at every window size, no overlap, no text overflow, nothing covering the player
- [ ] UX checks: every screen reachable by keyboard only; no dead ends; every prompt readable in under 2 s
- [ ] A full playthrough test: gate → foyer → 3 keys → card, headless, asserting each beat
- [ ] `npm run qa:shots` after every visual change, reviewed before anything is called done

## The loop

- A scheduled job runs every few hours and does one roadmap task (see "How this file is used").
- The owner interrupts any time with feedback (press O in game). Feedback wins over the roadmap.
- Every run ends with: tests green, work pushed, the game running, and a line in MEMORY.md.

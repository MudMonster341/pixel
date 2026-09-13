# Dev feedback

A dev-only loop for play-testing: the owner reports things in-game, the agent asks questions when
something is unclear, then fixes it with a test, and the owner confirms it in-game. Players never
see or download any of this.

## For the owner

1. Run `npm start` and open http://localhost:8080. Dev mode is on automatically there. Add `?dev=0`
   to the address to play without dev tools.
2. Press **O** (the backtick `` ` `` also works) or click the yellow **Feedback** button in the bottom-right corner.
   The game pauses and takes a screenshot.
3. *Optional:* click the screenshot to point at exactly what you mean.
4. Choose **Bug / Change / Idea**, an area and a priority, then write a title and details.
5. **Send & add another** keeps the panel open for the next thing. **Send & close** returns to the game.
6. The **Inbox** tab (and the red number on the button) shows what needs you:
   - **Question for you:** Claude needs more detail before starting. Answer right there.
   - **Fixed – please check:** try it, then click **It works** or **Still not right** and say
     what's still wrong.

Then tell Claude "check feedback" (or just start a new session) and it picks everything up.

## For the agent

At the start of every session, and whenever the owner says "check feedback":

1. `npm run feedback`: lists items waiting on the agent.
2. `npm run feedback -- show FB-0007`: read the item, open the screenshot, and check the context
   (map, player tile, pointed-at tile, inventory, flags).
3. Decide:
   - **Unclear, or more than one reasonable way to do it:** ask, don't guess.
     `npm run feedback -- ask FB-0007 "..."`. The owner answers in-game.
   - **Clear:** `npm run feedback -- start FB-0007`. Group related items into one piece of work.
     Use `plan` for items queued for later.
   - **Conflicts with the docs or is out of scope:** `npm run feedback -- wontfix FB-0007 "reason"`.
     The owner can reopen it.
4. Fix it, add a regression test named `FB-0007: ...` ([TESTING.md](TESTING.md)), and get `npm test` passing.
5. `npm run feedback -- fix FB-0007 --test "tests/e2e/<file>.spec.js › FB-0007: ..." "what changed"`,
   then checkpoint, so the commit includes the status change.
6. The owner verifies in-game. Reopened items go back to step 2.

## Statuses

```
new ──▶ needs-info ──▶ answered ──▶ planned ──▶ in-progress ──▶ fixed ──▶ verified
  └──────────────────────────────────▶────────────────────────────┘   │
                                                     reopened ◀───────┘
wont-fix  (the owner can reopen)
```

| Waiting on | Statuses |
|---|---|
| Owner | `needs-info`, `fixed` |
| Agent | `new`, `answered`, `reopened`, `planned`, `in-progress` |
| Nobody | `verified`, `wont-fix` |

## Storage

- `feedback/items/FB-0007.json`: the item, its game context, conversation thread and status history.
- `feedback/screenshots/FB-0007.jpg`: the screenshot, with the pointed-at spot circled.
- Both are committed to git, so the history survives.
- They're written only through `tools/feedback-store.js`: by `server.js` for the owner's actions,
  and by `tools/feedback.js` for the agent's.
- The server only accepts connections from this computer (127.0.0.1).

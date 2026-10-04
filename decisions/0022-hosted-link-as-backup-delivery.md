---
status: accepted
date: 2026-10-04
authored_by: agent
derived_from: ["owner 2026-10-04: no Mac to test on, 'site is okay'", "ADR 0017 offline bundle"]
supersedes: null
superseded_by: null
---

# 0022 — A hosted link is a backup delivery next to the offline zip

## Context
The deliverable is the offline double-click bundle (ADR 0017), but Safari on her MacBook cannot be tested here (Playwright's Windows WebKit has no Web
Audio, and there is no Mac). The owner agreed a static site is acceptable as a fallback.

## Decision
- `npm run pack:site` builds `dist/offline-site/`: the same plain-script-tag bundle plus a noindex meta, `robots.txt` and a `_headers` file
  (no-cache + `X-Robots-Tag`). It was played over http from title to credits with zero console errors.
- Host: **Netlify Drop** with the owner's free account, an unguessable site name and no public sharing; card photos are included
  (owner's choice). The owner uploads it (an account login is needed); the agent does not create accounts or publish.
- Steps and maintenance: docs/HOSTING.md. The zip stays the primary delivery; the link is what Taru can fall back to.

## Consequences
- Anyone with the link can play and see the card, so the link is only sent to Taru.
- Every rebuild with new card assets needs both `npm run pack:offline -- --zip` and `npm run pack:site`, then a re-upload.

# Hosting the game as a link (backup for the MacBook zip)

There is no Mac here to test Safari on, so besides the offline zip (docs/OFFLINE_BUNDLE.md) the game can be put on a
static site and opened by a link. Same game, same files; nothing to install for her. Owner decision 2026-10-04:
**Netlify Drop, unlisted link, card photos included.**

## Build the site folder

```
npm run pack:site        # -> dist/offline-site/  (same bundle + noindex meta, robots.txt, _headers)
```

It is the plain offline bundle (plain script tags, assets embedded as data), so it works from any static host and
also from a double-click. Checked over http with `tools/qa-offline-play.js` (set `PLAY_URL`): title to credits, zero
console errors, audio running in Chromium.

## Put it on Netlify (about 2 minutes, you do this: it needs your Netlify login)

1. Go to https://app.netlify.com/drop and sign in with a free account (an anonymous drop is deleted after about an hour;
   an account keeps it).
2. Drag the **`dist/offline-site`** folder onto the page. Netlify answers with a link like
   `https://random-words-123abc.netlify.app`.
3. Optional: Site configuration -> "Change site name" to something long and hard to guess (the link is the only
   protection: anyone with it can play and see the card photos). Do not post the link anywhere public.
4. Open the link in Safari or Chrome and play the first minute. Send the link to Taru, together with the zip as a fallback.

## When the card photos / video / final wishes change

Put them in `assets/card/` (card.json, photos, optional video.mp4), run `npm run pack:site` again, and drag the new
`dist/offline-site` folder onto the same site (Netlify -> Deploys -> drag the folder onto the "Deploy" box). The link stays.
The video must stay small (the whole site is one folder of embedded data; a big mp4 makes the first load slow).

## Notes

- The save lives in the browser she plays in, per site address: "Continue" only finds it on the same link in the same browser.
- To take it down: Netlify -> Site configuration -> Delete this site.
- Search engines are told to stay away (robots.txt, `X-Robots-Tag`, noindex meta), but that is politeness, not security.

# Vendored third-party code (not game art)

Local copies of CDN dependencies so the packaged build (and the web build) never needs the
internet ([ADR 0010](../decisions/0010-ship-as-windows-exe-and-web-build.md)). Distinct from
`assets/vendor/` (the third-party *art* packs, [ADR 0012](../decisions/0012-third-party-asset-packs.md)).

| What | Version | Licence | Source |
|---|---|---|---|
| `phaser/phaser.min.js` | 3.80.1 | MIT (`phaser/LICENSE`) | cdnjs.cloudflare.com/ajax/libs/phaser/3.80.1/phaser.min.js |
| `press-start-2p/press-start-2p-latin.woff2` | Google Fonts v16, latin subset | SIL OFL 1.1 (`press-start-2p/OFL.txt`) | fonts.gstatic.com (via fonts.googleapis.com/css2?family=Press+Start+2P) |

To update either: re-download from the source URL above and re-check the licence hasn't changed.

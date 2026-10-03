# Graph notes (graphify review, 2026-10-03)

Findings from the first graph build, traced and judged. None blocks the game; kept as notes.

| Finding | Real problem? | Why | If we ever act |
|---|---|---|---|
| `@playwright/test` bridges ~15 test communities | No | Every spec imports it; that's fan-in, not coupling. | Nothing. |
| `openGame()`, `teleport()`, `state()` are god nodes | No | `tests/e2e/helpers.js` is the shared harness by design (266 lines). | Keep helpers small; add new ones there. |
| `WorldScene` (59 edges), `loadAtlas()`/`blitAtlas()` (51/46) | No | The scene is the hub of the game; atlas helpers are called by every art generator. | Only split WorldScene if it passes ~2000 lines. |
| `UIScene` bridges UI Scene, Settings & Controls UI, and PauseMenu/FullMap | Mild smell | `src/scenes/ui.js` is 1,941 lines holding HUD, controls panel, pause menu, full map, tutorial. They share one file, so the graph links them. | Split into `ui/` modules (hud, pause, controls, fullmap) after the quality loop, with tests green. |
| Low cohesion (0.02-0.05) in Asset Generator, Campus Builder, Campus Props | No | `tools/make-assets.js` (3,904 lines) is a long list of independent sprite builders and constants, so few call each other. ADR: art lives there as text sprites. | Leave as is. Could split per category later for readability. |
| 751 weakly connected nodes | No | Mostly constants, `fs`/`path` imports, and doc concepts with no cross-links. | Ignore. |
| 4 dangling edges, 15 self-loops at first build | Not checked after dropping `vendor/` | Likely recursion and external refs. | Re-run diagnostics if the graph looks off. |

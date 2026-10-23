# Tools

Headless Chrome scripts for checking the game. Start the dev server first with `npx vite --port 5288`, then run a script with `node tools/<name>.mjs`. Screenshots go to `tools/shots/`.

| Script | What it does |
| --- | --- |
| `race.mjs [bay,jungle]` | Runs a full autopilot race on each map and fails on page errors |
| `replay.mjs [map]` | Races, watches the replay, returns to results and races again |
| `screens.mjs` | Walks the menus, settings, slot rules and course picker |
| `weapons.mjs` | Checks firing arcs, overheating, missile charges and hook cutting |
| `river.mjs` | Checks the jungle cave lift and the waterfall jump |
| `i18n.mjs` | Checks that every language has all interface text, attachment text and combo names |
| `perf.mjs [maps]` | Prints frame rate, script time, draw calls, triangles and heap per map |
| `balance.mjs [races] [out]` + `analyze-balance.mjs [file]` | Simulates AI only races and ranks attachments and combos |
| `shipyard.mjs [a,b] [out]` | Screenshots the shipyard boat with the given attachments |
| `mapthumbs.mjs` | Renders the course preview images in `public/maps/` |
| `logo-png.mjs` | Renders `.github/logo.png` for the README |
| `sheet.mjs out.png files...` | Tiles screenshots into one contact sheet |

`lib.mjs` holds the shared launch and menu helpers.

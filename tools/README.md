# Tools

Headless Chrome scripts for checking the game. Start the dev server first with `npx vite --port 5288`, then run a script with `node tools/<folder>/<name>.mjs` from the repo root. Screenshots go to `tools/shots/`, which git ignores. `lib.mjs` holds the shared launch, menu and race helpers.

Set `CI=1` to use software rendering and skip drawing the 3D scene, as the deploy workflow does. Set `CHROME_PATH` to use a Chrome other than the macOS default, and `BB_URL` to test a different server.

## checks

Pass or fail tests. `node tools/checks/all.mjs` runs all of them and lists the failures. Give it names, as in `all.mjs race,weapons`, to run only some.

| Script | What it checks |
| --- | --- |
| `smoke.mjs [maps]` | Boats race for a few seconds on every course without page errors. Runs before each deploy |
| `prodsmoke.mjs [maps]` | The production build starts a race from the menus on every course. Runs before each deploy against `npx vite preview` |
| `race.mjs [maps]` | A full autopilot race finishes on each course |
| `replay.mjs [map]` | Races, watches the replay, returns to results and races again |
| `replaysong.mjs` | The replay restarts the race song and ends 1 second after it |
| `screens.mjs` | Menus, settings, slot rules and the course picker |
| `settings.mjs` | Settings and credits panels at desktop and phone sizes |
| `yardsizes.mjs [sizes]` | The shipyard layout at many window sizes |
| `tabs.mjs` | The shipyard panel stays still while switching tabs |
| `i18n.mjs` | Every language has all interface text, attachment text and combo names |
| `hints.mjs` | First race hints |
| `weapons.mjs` | Firing arcs, overheating, missile charges and hook cutting |
| `seeker.mjs` | Missile tracking and lock on markers |
| `laseraim.mjs` | The laser beam leaves the barrel |
| `burns.mjs [map]` | Laser burn marks while hot and after cooling |
| `collider.mjs [map]` | The collision index matches three.js raycasts against the drawn scenery |
| `laserwalls.mjs [map] [spots] [tag]` | Sweeps the laser across buildings around the course and checks that every burn sits on a surface |
| `bulletsplash.mjs` | Machine gun bullets splash into the water |
| `chop.mjs [map]` | The laser fells trees |
| `river.mjs` | The jungle cave lift and the waterfall jump |
| `routes.mjs [maps]` | Boats take both routes at each fork, everyone finishes, and race progress never jumps |
| `routereturn.mjs [maps]` | Boats in either channel are tracked on that channel, and return to course points into a channel |
| `planes.mjs` | Midway plane speeds and frame rate |
| `shiphits.mjs` | Midway shells and crashing planes explode on the ships. Set `QUICK=1` to skip the 30 second count |
| `sound.mjs` | Engine, weapon, gadget and music sounds |

## views

Screenshots for looking at scenery and screens. Most take a tag argument that goes into the file names.

| Script | What it shows |
| --- | --- |
| `bay.mjs`, `jungle.mjs`, `alps.mjs`, `midway.mjs` | Fixed camera views of each course and its landmarks |
| `routes.mjs [map] [tag]` | Views of each alternate route: the fork, an aerial, inside the route and where it rejoins |
| `title.mjs`, `mapscreen.mjs [sizes]`, `shipyard.mjs [a,b] [out]` | The title, course picker and shipyard |
| `mobile.mjs [device] [tag]` | Every screen on an emulated phone |

## sim

| Script | What it does |
| --- | --- |
| `balance.mjs [races] [out] [url] [maps]` + `analyze-balance.mjs [file]` | Simulates AI only races across the courses and ranks attachments and combos |
| `perf.mjs [maps]` | Frame rate, script time, draw calls, triangles and heap per course |

## render

| Script | What it does |
| --- | --- |
| `mapthumbs.mjs` | Renders the course preview images in `public/maps/` |
| `logo-png.mjs` | Renders `.github/logo.png` |
| `sheet.mjs out.png files...` | Tiles screenshots into one contact sheet |

# Battleship Bonanza

A cartoony 3D boat racing game. Six boats race three laps around a tropical lagoon. Each boat carries two attachments picked from eleven. Pick them in the shipyard, where you can test fire each one before the race.

## Run it

```bash
npm install
npm run dev
```

Build a static copy with `npm run build`. The output goes to `dist/`.

## Controls

| Key | Action |
| --- | --- |
| W A S D or arrows | Drive |
| Q | First attachment |
| E | Second attachment |
| Esc | Pause |
| M | Sound on or off |

A gamepad also works. Use the left stick to steer, the right trigger to go, the left trigger to brake, and A and B for attachments.

## Attachments

| Group | Attachment | What it does |
| --- | --- | --- |
| Defense | Spikes | Boats that bump into you take damage |
| Defense | Armor | Immune to machine gun, spikes and saw blade. Much slower |
| Defense | Camo | Heat seeking missiles cannot lock on |
| Gadgets | Jet pack | Jump with a speed burst. Flies over mines and bullets |
| Gadgets | Grappling hook | Hooks a boat with spikes or a jet pack and slingshots you toward it |
| Gadgets | EMP | Knocks away grappling hooks and heat seeking missiles |
| Weapons | Machine gun | Burst of bullets |
| Weapons | Laser | Instant long range beam. Saw blades bounce it back |
| Weapons | Saw blade | Spinning lunge. Deflects lasers |
| Weapons | Heat seeking missiles | Chases the nearest boat ahead |
| Weapons | Sea mines | Dropped behind you. Explode on contact |

## Code layout

- `src/race.js` handles boat physics, combat, attachments and lap tracking.
- `src/ai.js` steers the computer boats and decides when they use attachments.
- `src/boatModel.js` builds the boat models and attachments.
- `src/world.js`, `src/water.js` and `src/track.js` build the lagoon, waves and course.
- `src/hud.js` drives the race HUD. `src/loadout.js` runs the shipyard.
- `tools/` holds headless Chrome scripts that screenshot and test the game against the dev server.

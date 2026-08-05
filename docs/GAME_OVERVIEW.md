# Dead of the Dead — Spirit Village

A living Día de los Muertos village, Pocket-God-inspired but **friendly and for kids**: things are always happening whether or not the player touches anything, and interactions are rewarding and delightful rather than mean-spirited or chaotic. Poking the world should make a kid smile, not wince.

Concept reference: `docs/concept-art/gameplay-overview.jpg`

## Roster

Pepita, Miguelito (placeholder art), and Xolo (partial real art) are implemented and in the live village (see `assets/characters/`, `src/`). Everyone else below has a `character.json` stub under `assets/characters/<slug>/` marked `"status": "planned"` — the folder and id exist so future work has a home, but there's no art or animation manifest yet.

| Name | Role | Kind | Slug |
| --- | --- | --- | --- |
| Pepita | florist | humanoid | `pepita` — **implemented**, mostly real art |
| Miguelito | mischievous kid | humanoid | `miguelito` — **implemented**, placeholder art |
| Xolo | loyal dog | pet | `xolo` — **implemented**, real `walk_left`/`walk_right` and all four `idle` poses; `walk_down`/`walk_up` still placeholder |
| Abuela Rosa | always baking | humanoid | `abuela-rosa` |
| Tito | mariachi | humanoid | `tito` |
| Pinto | painter | humanoid | `pinto` |
| Don Mateo | carpenter | humanoid | `don-mateo` |
| Doña Luz | candle keeper | humanoid | `dona-luz` |
| Señor Curevo | clever crow | pet (flighted) | `senor-curevo` |
| Gato | curious cat | pet | `gato` |

Humanoid residents are meant to reuse Pepita's controllers (`CharacterAnimationController`, `CharacterStateMachine`, `CharacterBehaviourController`, `CharacterNavigationController`, `CharacterInteractionController`, `CharacterExpressionController`) by supplying their own sprite set and `character.json`. Pets turned out to need the same thing, not a separate lighter rig as originally assumed here — Xolo proved the existing controllers handle a lower/wider quadruped silhouette fine; the only real requirement is that a resident's `character.json` only lists animations it actually has art for (missing ones degrade gracefully rather than crashing). A flighted pet like Señor Curevo will still likely need real perching/flying states whenever that gets built, since "walk" doesn't cover flight.

## World interactions (target list, not yet built)

These are the "poke the world, something delightful happens" moments from the concept — the standard every future interaction should be held to (positive outcome, no punishing the player for tapping something):

- **Firework + Mariachi** → huge street festival
- **Dog + Bone** (Xolo) → digs up hidden treasure
- **Crow + Hat** (Señor Curevo) → steals it and flies off (playful, not malicious)
- **Rain + Marigolds** → flowers bloom everywhere
- **Lantern + Night** → friendly spirits visit
- **Chocolate + Abuela Rosa** → everyone comes for a party

Pepita's flower-bed watering loop (`src/interaction.js`, wired in `src/app.js`) is the first real implementation of this pattern: dry → interact → reward → celebrate.

## Decorations (target list)

Folders exist under `assets/decorations/<name>/` (currently empty, `.gitkeep`-tracked) for: candle, flower-pot, bench, fountain, lantern, archway. These are ambient/placeable world objects, distinct from character sprites.

## UI (target list)

`assets/ui/icons/` is scaffolded for the HUD shown in the concept: currency (marigold-skull coin, flower currency), a heart/affection meter, and icon buttons for inventory, journal/book, pets, camera, and settings.

## Backgrounds

- `assets/backgrounds/village_day.jpg` — implemented, used as the live `.village` background in `index.html`/`src/styles.css`.
- Village night and graveyard scenes are referenced in the concept art but not yet added as separate background assets.

## Roadmap

1. ~~Pepita Phase 1: reusable animation foundation~~ — done
2. Pepita Phase 2: real artwork for every Pepita animation (in progress — `walk_down` and all four `idle` directions are real art; skip/talk/dance/expressions/actions are still placeholder)
3. ~~Multi-resident framework + resident-to-resident talking~~ — done, proved with Miguelito (placeholder art) talking to Pepita autonomously via `src/village.js`
4. Give Miguelito (or whichever resident comes next) real artwork — he's currently a deliberately minimal placeholder that exists only to validate #3
5. ~~Carry/drag system~~ — done: drag any idle resident onto the house to house them (they disappear, the house's window lights up), tap the house to release. Proved with Miguelito; works for anyone, not pet-specific, so Xolo can use the same mechanism once his art exists.
6. ~~Generalize the stateful-hotspot pattern~~ — done: `src/hotspots.js` has `createInteractiveHotspot` (flower bed, bench) and `createHousingZone` (house), both flower bed and house refactored onto it with no behaviour change, and the bench is a new third example proving it generalizes to a fresh object/action pair. Still open: more objects using the same factories (other buildings, a door), and a real "linger while seated" behaviour for the bench (see its README note on `finishAction` always celebrating)
7. ~~First pet rig (Xolo)~~ — turned out not to need a separate rig at all: the existing humanoid controllers work fine for a pet silhouette. Xolo is in the village now with real, verified `walk_left`/`walk_right` art and real static idle poses in all four directions, and can be carried/housed/tapped like anyone else. Still needed: real `walk_down`/`walk_up` walking gaits (currently reusing the left-facing walk frames as a placeholder stand-in -- his front/back art so far is static idle only) and the dog+bone interaction itself
8. Decorations and UI icon sets

## Parked ideas (not scheduled, just don't want to lose them)

1. **Day/night toggle** — tap the sun or moon to switch the village between day and night backgrounds. Needs a night version of the background art (day exists: `assets/backgrounds/village_day.jpg`); the swap itself is trivial once that art exists.
2. **Per-character idle/free-move toggle** — tap a resident to pin them to one spot (idle) or let them roam freely. The debug viewer already disables `resident.behaviour.enabled` when scrubbing animations manually; this would be the player-facing version of that same switch.
3. ~~**Tap a building to interact with it** — turn on a light, open a door, etc.~~ — partially done: dragging a resident onto the house turns its window light on/off (`src/village.js` drop zones + `#house-light`). Still to do: interactions that don't require carrying something (e.g. tap the house directly to trigger something), and other buildings besides the house.
4. **Wider/zoomed-out map** — current `.village` viewport is fixed at 650px tall; revisit once there are enough residents/objects that the space feels crowded.
5. **Multiple maps, move characters between them** — e.g. village → graveyard → spirit realm, carrying a resident along. Bigger structural change: `Village` would need to track which map each resident is on, and there'd need to be a per-map background + obstacle set instead of the single hardcoded one in `app.js` today.
6. **Lots more interactive objects generally** — reinforces #3/#6 above; the flower-bed interaction chain (`src/interaction.js`) is the template to repeat for whatever gets added.

## Known bad art attempts (don't reuse)

- **Xolo, first attempt** — ChatGPT generated a moss/rock totem-creature completely unrelated to the alebrije spirit-dog brief (teal-black glowing patterns, red bat ears, one big glowing eye per side). Discarded, not saved to the repo.
- **Xolo, front-facing walk cycle attempt** — design was correct this time (matched the confirmed reference), but all 8 frames were the same standing pose with no real leg movement — verified by cropping and comparing frames directly, not just eyeballing. Not usable as a *walk cycle*, but not wasted either: since all frames were identical anyway, one frame got reused later as the real static `idle_down` pose once that's what was actually needed. Takeaway: a straight-on front view is a genuinely hard angle for these models to convey quadruped walking motion in (legs mostly swing side-to-side from that angle, so the per-frame difference is small and easy for the model to flatten away) -- but that same flatness is exactly fine for a static idle pose. The side-view walk request worked on the first try — see `assets/characters/xolo/walk/left/`.

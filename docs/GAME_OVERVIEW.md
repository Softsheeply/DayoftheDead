# Dead of the Dead — Spirit Village

A living Día de los Muertos village, Pocket-God-inspired but **friendly and for kids**: things are always happening whether or not the player touches anything, and interactions are rewarding and delightful rather than mean-spirited or chaotic. Poking the world should make a kid smile, not wince.

Concept reference: `docs/concept-art/gameplay-overview.jpg`

## Roster

Pepita is the only resident actually implemented (see `assets/characters/pepita/`, `src/`). Everyone else below has a `character.json` stub under `assets/characters/<slug>/` marked `"status": "planned"` — the folder and id exist so future work has a home, but there's no art or animation manifest yet.

| Name | Role | Kind | Slug |
| --- | --- | --- | --- |
| Pepita | florist | humanoid | `pepita` — **implemented** |
| Abuela Rosa | always baking | humanoid | `abuela-rosa` |
| Miguelito | mischievous kid | humanoid | `miguelito` |
| Tito | mariachi | humanoid | `tito` |
| Pinto | painter | humanoid | `pinto` |
| Don Mateo | carpenter | humanoid | `don-mateo` |
| Xolo | loyal dog | pet | `xolo` |
| Doña Luz | candle keeper | humanoid | `dona-luz` |
| Señor Curevo | clever crow | pet (flighted) | `senor-curevo` |
| Gato | curious cat | pet | `gato` |

Humanoid residents are meant to reuse Pepita's controllers (`CharacterAnimationController`, `CharacterStateMachine`, `CharacterBehaviourController`, `CharacterNavigationController`, `CharacterInteractionController`, `CharacterExpressionController`) by supplying their own sprite set and `character.json`. Pets will likely need a lighter rig (lower silhouette, no florist-style actions; a flighted pet like Señor Curevo needs perching/flying states) but should keep the same state-machine and weighted-behaviour *concepts*.

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
5. Carry/drag system (pick up a pet, drop it in a building) — not started
6. Stateful world hotspots beyond the flower bed (e.g. a house window that toggles lit/unlit) — not started
7. First pet rig (Xolo) — lower silhouette, dog+bone interaction
8. Decorations and UI icon sets

## Parked ideas (not scheduled, just don't want to lose them)

1. **Day/night toggle** — tap the sun or moon to switch the village between day and night backgrounds. Needs a night version of the background art (day exists: `assets/backgrounds/village_day.jpg`); the swap itself is trivial once that art exists.
2. **Per-character idle/free-move toggle** — tap a resident to pin them to one spot (idle) or let them roam freely. The debug viewer already disables `resident.behaviour.enabled` when scrubbing animations manually; this would be the player-facing version of that same switch.
3. **Tap a building to interact with it** — turn on a light, open a door, etc. This is the "stateful world hotspots" item already on the roadmap (#6), generalized from the flower-bed pattern.
4. **Wider/zoomed-out map** — current `.village` viewport is fixed at 650px tall; revisit once there are enough residents/objects that the space feels crowded.
5. **Multiple maps, move characters between them** — e.g. village → graveyard → spirit realm, carrying a resident along. Bigger structural change: `Village` would need to track which map each resident is on, and there'd need to be a per-map background + obstacle set instead of the single hardcoded one in `app.js` today.
6. **Lots more interactive objects generally** — reinforces #3/#6 above; the flower-bed interaction chain (`src/interaction.js`) is the template to repeat for whatever gets added.

## Known bad art attempts (don't reuse)

- **Xolo, first attempt** — ChatGPT generated a moss/rock totem-creature completely unrelated to the alebrije spirit-dog brief (teal-black glowing patterns, red bat ears, one big glowing eye per side). Discarded, not saved to the repo. Re-run the prompt in a fresh chat before trying again.

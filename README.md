# Spirit Village — Pepita Phase 1

This repository contains the first reusable resident-animation foundation for **Dead of the Dead / Spirit Village**. Pepita the florist is the only resident implemented so far.

See [`docs/GAME_OVERVIEW.md`](docs/GAME_OVERVIEW.md) for the full game vision — the planned roster, world interactions, decorations, and UI — and how the current code maps onto it. The rest of the roster has scaffolded (art-less) folders under `assets/characters/` so future work has a home.

## Run locally

```sh
npm run dev
```

Then open <http://localhost:4173>. Tap Pepita in the village to trigger her reaction. The panel on the right is the developer animation viewer.

## Validate assets

```sh
npm test
```

The validation checks the animation manifest, expected frame files, PNG dimensions, and event markers.

## Artwork status

`walk/down` (8 frames) and `idle_down` / `idle_left` / `idle_right` / `idle_up` (1 real frame each, from a labeled turnaround sheet — down/left mirrored to right/up from back view) have been replaced with real illustrated artwork, background-matted and re-anchored to the shared 128×128 foot baseline. Idle is a static pose per direction for now rather than the spec's 6-frame subtle-motion loop; `character.json` frame counts were updated to match honestly (1 frame, not 6 padded with placeholder duplicates). Every other animation (skip, talk, dance, expressions, florist actions) is still an explicit transparent placeholder. Diagonal reference poses are stashed in `assets/characters/pepita/reference/` for future 8-direction support.

The village background (`assets/backgrounds/village_day.jpg`) is real illustrated art as well. The `.house` and `.fountain` DOM elements are kept as invisible obstacle hitboxes positioned over their painted counterparts; `.flower-bed` stays interactive with a state-driven glow.

## Architecture

- `assets/characters/pepita/character.json` — Pepita's complete data-driven definition
- `src/animation.js` — reusable playback and frame-event controller
- `src/state-machine.js` — prioritized resident states
- `src/behaviour.js` — weighted autonomous behaviour selection
- `src/navigation.js` — obstacle-avoiding random point selection and nav-area bounds
- `src/interaction.js` — object interaction registry (approach → face → act → complete)
- `src/expression.js` — timed expression icon overlay
- `src/resident.js` — reusable resident composition, movement, and interactions
- `src/debug-viewer.js` — animation inspection controls
- `scripts/generate-placeholders.py` — deterministic placeholder generator

Future humanoid residents can reuse these controllers by supplying a compatible character manifest and sprite set.

## Interactive objects

- **Flower bed** — starts dry; tap it (or Pepita will autonomously notice ~12%/1.5s while idle) to trigger the full spec interaction chain: walk to the interaction point → face the bed → play `water_flowers` → mark it watered (visual glow) → play `celebrate` → return to idle. It dries out again after 20s.

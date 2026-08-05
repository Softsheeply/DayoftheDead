# Spirit Village — Pepita Phase 1

This repository contains the first reusable resident-animation foundation for **Dead of the Dead / Spirit Village**. Pepita the florist is the only resident implemented in Phase 1.

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

`walk/down` (8 frames) has been replaced with real illustrated artwork, background-matted and re-anchored to the shared 128×128 foot baseline. Every other animation is still an explicit transparent placeholder. Next up: `idle/down`, following the same crop/matte pipeline, without changing filenames or anchors.

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

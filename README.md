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

Every sprite is currently an explicit 128×128 transparent placeholder with a shared foot baseline and anchor. The concept sheet is visual reference only and was not cropped into the game. Final illustrated artwork should replace `idle/down` first, then `walk/down`, without changing filenames or anchors.

## Architecture

- `assets/characters/pepita/character.json` — Pepita's complete data-driven definition
- `src/animation.js` — reusable playback and frame-event controller
- `src/state-machine.js` — prioritized resident states
- `src/behaviour.js` — weighted autonomous behaviour selection
- `src/resident.js` — reusable resident composition, movement, and interactions
- `src/debug-viewer.js` — animation inspection controls
- `scripts/generate-placeholders.py` — deterministic placeholder generator

Future humanoid residents can reuse these controllers by supplying a compatible character manifest and sprite set.

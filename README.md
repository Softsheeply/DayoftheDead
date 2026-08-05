# Spirit Village — Pepita Phase 1

This repository contains the first reusable resident-animation foundation for **Dead of the Dead / Spirit Village**. Pepita the florist is the first fully-art'd resident. Miguelito exists as a deliberately minimal placeholder second resident (`scripts/generate-miguelito-placeholders.py`), used to prove the multi-resident framework actually generalizes beyond a single hardcoded character — not a real character yet. Xolo is the first pet: real, background-matted `walk_left` art (genuine alternating-leg gait, confirmed frame-by-frame before wiring in) mirrored to `walk_right`; `walk_down`/`walk_up`/idle are temporary stand-ins reusing the left-facing art until front/back poses exist (see `assets/characters/xolo/character.json`'s `visualReference.note`).

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
- `src/village.js` — manages the list of residents in the scene and finds a nearby idle resident to talk to
- `src/resident.js` — reusable resident composition, movement, interactions, and resident-to-resident conversation
- `src/debug-viewer.js` — animation inspection controls, with a character switcher for multi-resident scenes
- `scripts/generate-placeholders.py` — deterministic Pepita placeholder generator
- `scripts/generate-miguelito-placeholders.py` — deterministic Miguelito placeholder generator

Any resident — humanoid or pet — can reuse these controllers by supplying a compatible character manifest and sprite set; `character.json`'s `animations` map drives everything, including which actions/expressions exist. Residents without a given animation (e.g. Miguelito has no `wave`, Xolo has no `talk_down`) fall back gracefully instead of throwing: `playAction` shows the reaction without changing pose, and `checkConversation`/`canBeTalkedTo` simply skip residents with no talk animation. Xolo turned out not to need a separate "pet rig" as originally planned — the existing controllers handle a lower/wider quadruped silhouette fine as long as its `character.json` only defines animations it actually has art for.

## Interactive objects

- **Flower bed** — starts dry; tap it (or Pepita will autonomously notice ~12%/1.5s while idle) to trigger the full spec interaction chain: walk to the interaction point → face the bed → play `water_flowers` → mark it watered (visual glow) → play `celebrate` → return to idle. It dries out again after 20s.
- **House** — drag any idle resident and drop them on the house to "house" them: they disappear, the house's window lights up (`#house-light`), and they stop being simulated (state `disabled`, same priority tier the spec reserves for "not part of the sim right now"). Tap the house to release whoever's inside — they reappear at the door and resume normal life. Drag is press-and-move-8px-then-release, distinct from a tap (which still triggers the wave reaction); a resident that's busy, mid-conversation, or already housed/being carried can't be picked up.

## Multi-resident: talking to each other

Any two residents that both have a `talk_down` animation can talk to each other: `resident.talkTo(otherResident)` walks the initiator to a standoff point near the other, has both face each other, plays `talk_<direction>` on both, shows a speech bubble on both, and returns both to idle after ~2.6s. Idle residents periodically (~10%/1.8s) check `village.findConversationPartner()` for a nearby idle resident and start a conversation on their own — this is what makes Pepita and Miguelito occasionally walk over and chat without the player doing anything. `window.__village` is exposed in the browser console (`{ village, pepita, miguelito }`) for manually poking at this — e.g. `window.__village.pepita.talkTo(window.__village.miguelito)`.

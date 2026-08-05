# Spirit Village — Pepita Phase 1

This repository contains the first reusable resident-animation foundation for **Dead of the Dead / Spirit Village**. Pepita the florist is the first fully-art'd resident. Miguelito exists as a deliberately minimal placeholder second resident (`scripts/generate-miguelito-placeholders.py`), used to prove the multi-resident framework actually generalizes beyond a single hardcoded character — not a real character yet. Xolo is the first pet: real, background-matted `walk_left` art (genuine alternating-leg gait, confirmed frame-by-frame before wiring in) mirrored to `walk_right`, plus real static idle poses in all four directions (front/back/side references). `walk_down`/`walk_up` still temporarily reuse the left-facing walk frames until real front/back walking gaits exist — front-view gaits are a hard angle for these image models to convey motion in (see `docs/GAME_OVERVIEW.md`'s "known bad art attempts" section), so getting those right will likely take more iteration than the side view did.

See [`docs/GAME_OVERVIEW.md`](docs/GAME_OVERVIEW.md) for the full game vision — the planned roster, world interactions, decorations, and UI — and how the current code maps onto it. The rest of the roster has scaffolded (art-less) folders under `assets/characters/` so future work has a home. See [`docs/ART_WISHLIST.md`](docs/ART_WISHLIST.md) for the next batch of art to request, with ready-to-paste prompts.

## Run locally

```sh
npm run dev
```

Then open <http://localhost:4173>. Tap Pepita in the village to trigger her reaction. The panel on the right is the developer animation viewer.

## Tests

```sh
npm test
```

Runs two things:
- `tests/validate-assets.mjs` — checks Pepita's animation manifest, expected frame files, PNG dimensions, and event markers.
- `tests/logic.mjs` (Node's built-in test runner) — exercises the actual runtime logic against lightweight DOM stubs, no browser needed: state machine transitions/locking, weighted behaviour selection, navigation obstacle avoidance, the interaction request/resolve/complete lifecycle, animation frame timing/looping/event markers, both hotspot factories (including the revert timer via `node:test`'s mock timers), `Village`'s drop-zone hit-testing and conversation-partner search, and `AnimatedResident` itself (construction, graceful fallback for missing animations, tap-vs-drag disambiguation, carry/house/release, talk, and movement arrival).

## Artwork status

`walk/down` (8 frames) and `idle_down` / `idle_left` / `idle_right` / `idle_up` (1 real frame each, from a labeled turnaround sheet — down/left mirrored to right/up from back view) have been replaced with real illustrated artwork, background-matted and re-anchored to the shared 128×128 foot baseline. Idle is a static pose per direction for now rather than the spec's 6-frame subtle-motion loop; `character.json` frame counts were updated to match honestly (1 frame, not 6 padded with placeholder duplicates). Every other animation (skip, talk, dance, expressions, florist actions) is still an explicit transparent placeholder. Diagonal reference poses are stashed in `assets/characters/pepita/reference/` for future 8-direction support.

The village background (`assets/backgrounds/village_day.jpg`) is real illustrated art as well. The `.house`, `.fountain`, and `.bench` DOM elements are kept as obstacle hitboxes positioned over their painted counterparts, so autonomous wandering (`moveRandomly`'s `navigation.randomPoint()`) routes around them instead of visually overlapping. `.flower-bed` is deliberately *not* an obstacle — it's a low ground-level patch, not something a resident would visibly clip through by walking over it. Deliberate interaction approaches (walking to a specific interaction point, like the bench's sit spot) bypass obstacle checking entirely, since those targets are explicit, not randomly chosen.

## Architecture

- `assets/characters/pepita/character.json` — Pepita's complete data-driven definition
- `src/animation.js` — reusable playback and frame-event controller
- `src/state-machine.js` — prioritized resident states
- `src/behaviour.js` — weighted autonomous behaviour selection
- `src/navigation.js` — obstacle-avoiding random point selection and nav-area bounds
- `src/interaction.js` — object interaction registry (approach → face → act → complete)
- `src/expression.js` — timed expression icon overlay
- `src/village.js` — manages the list of residents in the scene, drop zones, and finds a nearby idle resident to talk to
- `src/resident.js` — reusable resident composition, movement, interactions, and resident-to-resident conversation
- `src/hotspots.js` — factories for stateful world objects: `createInteractiveHotspot` (tap/notice → approach → act → state changes, optionally reverts after a delay) and `createHousingZone` (drag someone in, indicator toggles, tap to release). Pulled out after building the flower bed and the house as one-off code each; the bench reuses `createInteractiveHotspot` with zero new glue
- `src/debug-viewer.js` — animation inspection controls, with a character switcher for multi-resident scenes
- `scripts/generate-placeholders.py` — deterministic Pepita placeholder generator
- `scripts/generate-miguelito-placeholders.py` — deterministic Miguelito placeholder generator

Any resident — humanoid or pet — can reuse these controllers by supplying a compatible character manifest and sprite set; `character.json`'s `animations` map drives everything, including which actions/expressions exist. Residents without a given animation (e.g. Miguelito has no `wave`, Xolo has no `talk_down`) fall back gracefully instead of throwing: `playAction` shows the reaction without changing pose, and `checkConversation`/`canBeTalkedTo` simply skip residents with no talk animation. Xolo turned out not to need a separate "pet rig" as originally planned — the existing controllers handle a lower/wider quadruped silhouette fine as long as its `character.json` only defines animations it actually has art for.

## Interactive objects

All four below are built on the two factories in `src/hotspots.js`:

- **Flower bed** (`createInteractiveHotspot`) — starts dry; tap it (or Pepita will autonomously notice ~12%/1.5s while idle) to trigger the full spec interaction chain: walk to the interaction point → face the bed → play `water_flowers` (with an intermediate `watering` pulse state) → mark it watered (visual glow) → play `celebrate` → return to idle. It dries out again after 20s.
- **Bench** (`createInteractiveHotspot`) — tap it to have Pepita walk over, sit, and actually stay seated for 5s (`postAction: "hold"`, see below) before standing back up. The bench's glow window (5.5s) slightly outlasts the hold so it doesn't clear while she's still visibly sitting there.
- **Fountain** (`createInteractiveHotspot`) — tap it to have Pepita walk over and play `throw_petals`, making a wish. This reuses an animation (and its `spawn_petals` frame-4 event marker) that already existed in Pepita's manifest but had no in-game trigger until now — no new art needed. Reverts to available again after 8s.
- **House** (`createHousingZone`) — drag any idle resident and drop them on the house to "house" them: they disappear, the house's window lights up (`#house-light`), and they stop being simulated (state `disabled`, same priority tier the spec reserves for "not part of the sim right now"). Tap the house to release whoever's inside — they reappear at the door and resume normal life. Drag is press-and-move-8px-then-release, distinct from a tap (which still triggers the wave reaction); a resident that's busy, mid-conversation, or already housed/being carried can't be picked up.

### What happens after an interaction's action animation finishes

By default (`resident.js` `finishAction`), a resident plays `celebrate` and returns to idle right after any interaction's action animation completes — that's what the flower bed does. A hotspot can opt out by passing `postAction: "hold"` and `holdMs: <ms>` to `createInteractiveHotspot`: instead of celebrating, the resident just stays in the action's final pose (state stays `performingAction`, `busy` stays `true`) for `holdMs`, then returns to idle on its own. This is what makes the bench work — she genuinely sits there instead of sitting-then-instantly-standing-to-celebrate.

The hold is guarded against being interrupted: if something else takes over mid-hold (tapped, dragged into the house, started a conversation...), a version counter (`resident.actionVersion`, bumped by every state-changing method) means the hold's own timer becomes a no-op when it eventually fires, instead of clobbering whatever took over.

## Day/night toggle

The moon/sun button in the top-right corner of the village toggles `#village`'s `data-time` attribute between `"day"` and `"night"`. Night is currently a CSS filter placeholder (`.village[data-time="night"]` in `src/styles.css` — darkens/cools the whole scene, background and every resident/hotspot alike, since they're all descendants of `.village`) rather than a second background image, since only `village_day.jpg` exists. Swap the filter rule for a real `village_night.jpg` background whenever that art shows up; `app.js`'s toggle wiring doesn't need to change. Purely visual right now — nothing in the simulation (behaviour, interactions) currently reacts to time of day.

## Pinning a resident in place

Long-press any resident (hold ~550ms without moving more than 8px) to toggle them between roaming freely and staying pinned in place — the player-facing version of the debug viewer's existing `resident.behaviour.enabled` switch (parked idea #2). A pinned resident shows a 📍 badge, stops picking new autonomous behaviours (idle/walk/skip/etc.), and stops noticing the flower bed or starting conversations on its own — it will still respond to direct interaction (tap, drag/carry, an explicit `talkTo()` call), it just won't initiate anything by itself. Long-press again to unpin.

This is a third gesture alongside the existing tap (wave reaction) and drag (carry into the house): quick release before the threshold with no movement is a tap, movement past 8px before the threshold starts a carry, and holding still past the threshold pins/unpins. Whichever gesture resolves, the resulting synthetic click is suppressed via the existing `suppressClick` flag so it can't also fire a wave.

## Multi-resident: talking to each other

Any two residents that both have a `talk_down` animation can talk to each other: `resident.talkTo(otherResident)` walks the initiator to a standoff point near the other, has both face each other, plays `talk_<direction>` on both, shows a speech bubble on both, and returns both to idle after ~2.6s. Idle residents periodically (~10%/1.8s) check `village.findConversationPartner()` for a nearby idle resident and start a conversation on their own — this is what makes Pepita and Miguelito occasionally walk over and chat without the player doing anything. `window.__village` is exposed in the browser console (`{ village, pepita, miguelito }`) for manually poking at this — e.g. `window.__village.pepita.talkTo(window.__village.miguelito)`.

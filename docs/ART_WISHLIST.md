# Art wishlist — next session

Per the "characters first" plan: finish Miguelito (already a placeholder in the village) before starting Tito (brand new). Both prompts follow the pattern that's actually worked this session: single confirmation pose first, then side-view walk cycle (front/back-ish angles keep failing for quadrupeds AND may be worth avoiding for humanoids too — untested, but side view is the proven-safe bet), separate front/back static poses last.

---

## 1. Miguelito — design confirmation (send first, alone)

Generate a single character reference image for "Miguelito," a mischievous skeleton kid in a Día de los Muertos village game.

**Design** (from the existing roster concept art):
- Small chibi skeleton child, same style family as other village residents: large expressive skull, small body, calavera face paint
- Dark purple/navy beanie or hood
- Dark navy/purple hoodie or jacket
- Mischievous, playful grin
- Standing, facing directly forward toward the camera
- No other accessories

**Technical requirements:**
- Transparent PNG background (true alpha)
- No text, no labels, no watermark
- Clean, well-lit, single centered pose, nothing cropped at the edges

Just this one pose for now — I'll ask for more once this design is confirmed.

---

## 2. Miguelito — walk cycle, side view (send after #1 is approved)

Using the attached confirmed design as reference, generate a walking cycle for this same character in full side profile, facing left, walking left.

Keep the design 100% identical to the reference — same colors, same hood/hoodie, same face. Only the pose and angle change.

**8 frames in a single row**, side view, each one a clearly different leg/arm position — obvious alternation through the stride, not the same pose repeated 8 times.

**Technical requirements**, same as always:
- Transparent PNG background (true alpha)
- No text, no labels, no watermark
- Same scale/proportions and same ground baseline in every frame
- Same lighting in every frame
- Each frame padded and isolated so it can be cropped cleanly

Just this one row (left-facing walk) for now.

---

## 3. Miguelito — front/back static poses (send after #2 is approved)

Using the attached confirmed design as reference, generate two single reference poses — not a walk cycle, just standing still:

1. Front view — facing directly toward the camera
2. Back view — facing directly away from the camera

Same technical requirements as #1 (transparent, no text, same scale/baseline/lighting in both).

---

## 4. Tito — design confirmation (new character, send whenever ready to start him)

Generate a single character reference image for "Tito," a mariachi skeleton musician in a Día de los Muertos village game.

**Design** (from the existing roster concept art):
- Small chibi skeleton, same style family as the other village residents: large expressive skull, small body, calavera face paint
- Orange/gold wide-brimmed mariachi sombrero
- Dark mariachi outfit (charro jacket style), warm accent trim
- Holding a small trumpet
- Standing, facing directly forward toward the camera

**Technical requirements**, same as always:
- Transparent PNG background (true alpha)
- No text, no labels, no watermark
- Clean, well-lit, single centered pose, nothing cropped at the edges

Just this one pose for now.

---

## Notes / reminders for next session

- **Xolo's walk_down/walk_up are on hold** — 3 failed attempts (frozen pose, then two full style drifts). Not worth more rounds right now; he's fine as-is (real idle in all 4 directions, real walk left/right). Revisit later if you want, maybe with a different tool.
- **The pattern that's actually worked**, every time: one static pose first to lock the design → confirm it → then ask for a walk cycle in **side view specifically** (front-view gaits keep failing to show real leg motion) → crop and compare frames directly before trusting a "success," don't just eyeball it.
- Real alpha transparency has been hit-or-miss even when asked for — always verify (`.mode == 'RGBA'` and actually check the alpha channel isn't just checkerboard-baked-into-RGB) before treating an image as ready to crop. I do this automatically when processing what you send.

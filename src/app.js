import { AnimatedResident } from "./resident.js";
import { AnimationDebugViewer } from "./debug-viewer.js";
import { Village } from "./village.js";
import { createInteractiveHotspot, createHousingZone } from "./hotspots.js";

function localBox(el, villageRect) {
  const rect = el.getBoundingClientRect();
  return { x: rect.left - villageRect.left, y: rect.top - villageRect.top, width: rect.width, height: rect.height };
}

async function loadCharacter(id) {
  const response = await fetch(`./assets/characters/${id}/character.json`);
  if (!response.ok) throw new Error(`${id} character data could not be loaded.`);
  return response.json();
}

const [pepitaConfig, miguelitoConfig, xoloConfig] = await Promise.all([
  loadCharacter("pepita"),
  loadCharacter("miguelito"),
  loadCharacter("xolo")
]);

const villageEl = document.querySelector("#village");
const villageRect = villageEl.getBoundingClientRect();
const houseEl = document.querySelector(".house");
const houseBox = localBox(houseEl, villageRect);
const fountainEl = document.querySelector("#fountain");
const fountainBox = localBox(fountainEl, villageRect);
const fountainPoint = { x: fountainBox.x + fountainBox.width * 0.5, y: fountainBox.y + fountainBox.height + 20 };
const flowerBedEl = document.querySelector("#flower-bed");
const flowerBedBox = localBox(flowerBedEl, villageRect);
const flowerBedPoint = { x: flowerBedBox.x + flowerBedBox.width - 34, y: flowerBedBox.y + flowerBedBox.height + 22 };
const benchEl = document.querySelector("#bench");
const benchBox = localBox(benchEl, villageRect);
const benchPoint = { x: benchBox.x + benchBox.width * 0.5, y: benchBox.y + benchBox.height + 18 };
const cottageBox = localBox(document.querySelector(".cottage"), villageRect);
const templeBox = localBox(document.querySelector(".temple"), villageRect);
const treeBaseBox = localBox(document.querySelector(".tree-base"), villageRect);
const pondBox = localBox(document.querySelector(".pond"), villageRect);
const bounds = { width: villageEl.clientWidth, height: villageEl.clientHeight };
// The flower bed is deliberately left out: it's a low, ground-level patch,
// not a solid object residents would visibly clip through. Everything else
// here -- buildings, the tree's base, the bench, the pond -- is something a
// resident shouldn't visually walk onto/through while wandering.
const obstacles = [houseBox, fountainBox, benchBox, cottageBox, templeBox, treeBaseBox, pondBox];

const village = new Village(villageEl);

// Every resident is wired up from the same set of DOM ids, derived from its
// own character.json id (#resident-<id>, #resident-<id>-sprite,
// #speech-<id>, #resident-<id>-expression) -- so adding the next resident
// (Tito, a real-art Miguelito, whoever) is one line here instead of a fresh
// ~15-line copy-pasted block.
function createResident(config, spawn) {
  const id = config.id;
  const resident = new AnimatedResident(
    config,
    document.querySelector(`#resident-${id}`),
    document.querySelector(`#resident-${id}-sprite`),
    document.querySelector(`#speech-${id}`),
    bounds,
    {
      obstacles,
      expressionIcon: document.querySelector(`#resident-${id}-expression`),
      spawn
    }
  );
  village.register(resident);
  return resident;
}

const pepita = createResident(pepitaConfig, { x: bounds.width * 0.4, y: bounds.height * 0.6 });
const miguelito = createResident(miguelitoConfig, { x: bounds.width * 0.65, y: bounds.height * 0.68 });
const xolo = createResident(xoloConfig, { x: bounds.width * 0.52, y: bounds.height * 0.78 });

new AnimationDebugViewer(document.querySelector("#debug-viewer"), [pepita, miguelito, xolo]);

// Dev convenience: inspect/drive the live village from the browser console.
window.__village = { village, pepita, miguelito, xolo };

pepita.events.addEventListener("spawn_petals", () => pepita.showSpeech("Petals!"));
pepita.events.addEventListener("transfer_flower", () => pepita.showSpeech("A flower for you."));

// -- Flower bed: dry -> water_flowers -> watered -> dry again after 20s ------
createInteractiveHotspot({
  id: "flowerBed",
  element: flowerBedEl,
  point: flowerBedPoint,
  facing: "down",
  action: "water_flowers",
  resident: pepita,
  fromState: "dry",
  toState: "watered",
  duringState: "watering",
  revertAfterMs: 20000,
  emptyLabel: "Dry flower bed, tap to water",
  settledLabel: "Watered flower bed",
  onSettled: () => pepita.showSpeech("Flowers watered!")
});

// -- Bench: empty -> sit (and actually stay seated for 5s) -> empty ----------
// postAction: "hold" keeps Pepita in the sit animation's final pose for
// holdMs instead of immediately celebrating and standing back up (see
// resident.js holdAfterAction). revertAfterMs is a touch longer than holdMs
// so the bench's glow doesn't clear while she's still visibly sitting there.
createInteractiveHotspot({
  id: "bench",
  element: benchEl,
  point: benchPoint,
  facing: "down",
  action: "sit",
  resident: pepita,
  fromState: "empty",
  toState: "occupied",
  postAction: "hold",
  holdMs: 5000,
  revertAfterMs: 5500,
  emptyLabel: "Empty bench, tap to rest",
  settledLabel: "Pepita is resting",
  onSettled: () => pepita.showSpeech("Just a moment...")
});

// -- Fountain: toss petals in and make a wish, reusing throw_petals ----------
// throw_petals already existed in Pepita's manifest (with a spawn_petals
// event marker at frame 4) but had no in-game trigger -- the fountain gives
// it one, using existing art rather than needing anything new. Uses the
// default postAction ("celebrate") since a quick wish doesn't need to hold.
createInteractiveHotspot({
  id: "fountain",
  element: fountainEl,
  point: fountainPoint,
  facing: "down",
  action: "throw_petals",
  resident: pepita,
  fromState: "still",
  toState: "wished",
  revertAfterMs: 8000,
  emptyLabel: "Toss petals into the fountain to make a wish",
  settledLabel: "A wish was just made here",
  onSettled: () => pepita.showSpeech("I wish for a wonderful day!")
});

// -- House: drag a resident in, window lights up, tap to release -------------
createHousingZone({
  village,
  box: houseBox,
  zoneElement: houseEl,
  indicatorElement: document.querySelector("#house-light"),
  releasePoint: () => ({ x: houseBox.x + houseBox.width * 0.5, y: houseBox.y + houseBox.height + 26 }),
  emptyLabel: "Empty house",
  occupiedLabel: count => `${count} resident(s) inside, tap to let them out`
});

// -- Day/night toggle ----------------------------------------------------------
// Purely visual for now (a CSS filter placeholder, see styles.css) -- no
// gameplay behaviour is tied to time of day yet. Swap the CSS filter for a
// real village_night.jpg background whenever that art exists; this toggle
// wiring doesn't need to change either way.
const dayNightToggleEl = document.querySelector("#day-night-toggle");
let timeOfDay = villageEl.dataset.time ?? "day";
dayNightToggleEl.addEventListener("click", () => {
  timeOfDay = timeOfDay === "day" ? "night" : "day";
  villageEl.dataset.time = timeOfDay;
  dayNightToggleEl.textContent = timeOfDay === "day" ? "🌙" : "☀️";
  dayNightToggleEl.setAttribute("aria-label", timeOfDay === "day" ? "Switch to night" : "Switch to day");
});

// -- Keep navigation/obstacles/interaction points in sync with the actual
// rendered layout --------------------------------------------------------
// `bounds` and every obstacle box above were measured once, synchronously,
// at page load. .village's width is fluid (only height is fixed by CSS),
// so if the window resizes -- or if this initial measurement simply raced
// ahead of the browser's final layout pass, which happened during testing
// -- every resident's navigation would otherwise silently keep using
// stale dimensions for the rest of the session. Recompute everything
// derived from villageEl's box whenever it might have changed.
function recomputeLayout() {
  const rect = villageEl.getBoundingClientRect();
  const newBounds = { width: villageEl.clientWidth, height: villageEl.clientHeight };
  const newHouseBox = localBox(houseEl, rect);
  const newFountainBox = localBox(fountainEl, rect);
  const newFlowerBedBox = localBox(flowerBedEl, rect);
  const newBenchBox = localBox(benchEl, rect);
  const newCottageBox = localBox(document.querySelector(".cottage"), rect);
  const newTempleBox = localBox(document.querySelector(".temple"), rect);
  const newTreeBaseBox = localBox(document.querySelector(".tree-base"), rect);
  const newPondBox = localBox(document.querySelector(".pond"), rect);
  const newObstacles = [newHouseBox, newFountainBox, newBenchBox, newCottageBox, newTempleBox, newTreeBaseBox, newPondBox];

  for (const resident of village.residents) {
    resident.bounds = newBounds;
    resident.navigation.setBounds(newBounds);
    resident.navigation.setObstacles(newObstacles);
  }

  // houseBox/fountainBox/flowerBedBox/benchBox are shared-by-reference with
  // the drop zone's `box` and each hotspot's `point` (both read live at call
  // time, not captured once) -- mutate in place rather than reassigning the
  // const bindings, so those stay correct without any other wiring changes.
  Object.assign(houseBox, newHouseBox);
  Object.assign(fountainBox, newFountainBox);
  Object.assign(flowerBedBox, newFlowerBedBox);
  Object.assign(benchBox, newBenchBox);
  Object.assign(fountainPoint, { x: newFountainBox.x + newFountainBox.width * 0.5, y: newFountainBox.y + newFountainBox.height + 20 });
  Object.assign(flowerBedPoint, { x: newFlowerBedBox.x + newFlowerBedBox.width - 34, y: newFlowerBedBox.y + newFlowerBedBox.height + 22 });
  Object.assign(benchPoint, { x: newBenchBox.x + newBenchBox.width * 0.5, y: newBenchBox.y + newBenchBox.height + 18 });
}

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(recomputeLayout, 150);
});
// Defensive re-check shortly after load: if the very first measurement above
// raced ahead of the browser's final layout/font/grid settling, this catches
// it instead of leaving every resident stuck with wrong dimensions all game.
setTimeout(recomputeLayout, 500);

let previous = performance.now();
function loop(now) {
  village.update(Math.min(now - previous, 100));
  previous = now;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

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
const fountainBox = localBox(document.querySelector(".fountain"), villageRect);
const flowerBedEl = document.querySelector("#flower-bed");
const flowerBedBox = localBox(flowerBedEl, villageRect);
const flowerBedPoint = { x: flowerBedBox.x + flowerBedBox.width - 34, y: flowerBedBox.y + flowerBedBox.height + 22 };
const benchEl = document.querySelector("#bench");
const benchBox = localBox(benchEl, villageRect);
const benchPoint = { x: benchBox.x + benchBox.width * 0.5, y: benchBox.y + benchBox.height + 18 };
const bounds = { width: villageEl.clientWidth, height: villageEl.clientHeight };
const obstacles = [houseBox, fountainBox];

const village = new Village(villageEl);

const pepita = new AnimatedResident(
  pepitaConfig,
  document.querySelector("#resident-pepita"),
  document.querySelector("#resident-pepita-sprite"),
  document.querySelector("#speech-pepita"),
  bounds,
  {
    obstacles,
    expressionIcon: document.querySelector("#resident-pepita-expression"),
    spawn: { x: bounds.width * 0.4, y: bounds.height * 0.6 }
  }
);

const miguelito = new AnimatedResident(
  miguelitoConfig,
  document.querySelector("#resident-miguelito"),
  document.querySelector("#resident-miguelito-sprite"),
  document.querySelector("#speech-miguelito"),
  bounds,
  {
    obstacles,
    expressionIcon: document.querySelector("#resident-miguelito-expression"),
    spawn: { x: bounds.width * 0.65, y: bounds.height * 0.68 }
  }
);

const xolo = new AnimatedResident(
  xoloConfig,
  document.querySelector("#resident-xolo"),
  document.querySelector("#resident-xolo-sprite"),
  document.querySelector("#speech-xolo"),
  bounds,
  {
    obstacles,
    expressionIcon: document.querySelector("#resident-xolo-expression"),
    spawn: { x: bounds.width * 0.52, y: bounds.height * 0.78 }
  }
);

village.register(pepita);
village.register(miguelito);
village.register(xolo);

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

// -- Bench: empty -> sit -> just-used -> empty again after 6s ----------------
// NOTE: the resident's interaction chain (see resident.js finishAction)
// always plays "celebrate" and returns to idle right after the action
// animation completes -- there's no "hold this pose for N seconds" concept
// yet. So Pepita actually only sits for a moment, not for the full
// revertAfterMs window; the bench's glow just outlasts her visit as a
// "recently used" cue rather than claiming she's still sitting there.
// A real "linger while seated" behaviour would need finishAction to support
// a configurable post-action step instead of always celebrating.
createInteractiveHotspot({
  id: "bench",
  element: benchEl,
  point: benchPoint,
  facing: "down",
  action: "sit",
  resident: pepita,
  fromState: "empty",
  toState: "just-used",
  revertAfterMs: 6000,
  emptyLabel: "Empty bench, tap to rest",
  settledLabel: "Recently-used bench",
  onSettled: () => pepita.showSpeech("Just a moment...")
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

let previous = performance.now();
function loop(now) {
  village.update(Math.min(now - previous, 100));
  previous = now;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

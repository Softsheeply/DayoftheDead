import { AnimatedResident } from "./resident.js";
import { AnimationDebugViewer } from "./debug-viewer.js";
import { Village } from "./village.js";

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

let dryTimer = null;
function scheduleDryOut() {
  clearTimeout(dryTimer);
  dryTimer = setTimeout(() => { flowerBedEl.dataset.state = "dry"; flowerBedEl.setAttribute("aria-label", "Dry flower bed, tap to water"); }, 20000);
}

pepita.interactions.register("flowerBed", {
  point: flowerBedPoint,
  facing: "down",
  action: "water_flowers",
  isAvailable: () => flowerBedEl.dataset.state === "dry",
  onStart: () => { flowerBedEl.dataset.state = "watering"; },
  onComplete: () => {
    flowerBedEl.dataset.state = "watered";
    flowerBedEl.setAttribute("aria-label", "Watered flower bed");
    pepita.showSpeech("Flowers watered!");
    scheduleDryOut();
  }
});

flowerBedEl.addEventListener("click", () => pepita.interactions.request("flowerBed"));

// -- Carry Pepita or Miguelito into the florist house ------------------------
const houseLightEl = document.querySelector("#house-light");
const housedResidents = new Set();

function updateHouseLight() {
  houseLightEl.classList.toggle("on", housedResidents.size > 0);
  houseEl.setAttribute(
    "aria-label",
    housedResidents.size > 0 ? `${housedResidents.size} resident(s) inside, tap to let them out` : "Empty house"
  );
}

village.registerDropZone({
  box: houseBox,
  onHouse: resident => {
    housedResidents.add(resident);
    updateHouseLight();
  }
});

houseEl.addEventListener("click", () => {
  const resident = housedResidents.values().next().value;
  if (!resident) return;
  housedResidents.delete(resident);
  const doorPoint = { x: houseBox.x + houseBox.width * 0.5, y: houseBox.y + houseBox.height + 26 };
  resident.release(doorPoint);
  updateHouseLight();
});

let previous = performance.now();
function loop(now) {
  village.update(Math.min(now - previous, 100));
  previous = now;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

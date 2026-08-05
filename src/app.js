import { AnimatedResident } from "./resident.js";
import { AnimationDebugViewer } from "./debug-viewer.js";

function localBox(el, villageRect) {
  const rect = el.getBoundingClientRect();
  return { x: rect.left - villageRect.left, y: rect.top - villageRect.top, width: rect.width, height: rect.height };
}

const response = await fetch("./assets/characters/pepita/character.json");
if (!response.ok) throw new Error("Pepita character data could not be loaded.");
const config = await response.json();
const village = document.querySelector("#village");
const villageRect = village.getBoundingClientRect();
const houseBox = localBox(document.querySelector(".house"), villageRect);
const fountainBox = localBox(document.querySelector(".fountain"), villageRect);
const flowerBedEl = document.querySelector("#flower-bed");
const flowerBedBox = localBox(flowerBedEl, villageRect);
const flowerBedPoint = { x: flowerBedBox.x + flowerBedBox.width - 34, y: flowerBedBox.y + flowerBedBox.height + 22 };

const resident = new AnimatedResident(
  config,
  document.querySelector("#resident"),
  document.querySelector("#resident-sprite"),
  document.querySelector("#speech"),
  { width: village.clientWidth, height: village.clientHeight },
  { obstacles: [houseBox, fountainBox], expressionIcon: document.querySelector("#resident-expression") }
);
new AnimationDebugViewer(document.querySelector("#debug-viewer"), resident);

resident.events.addEventListener("spawn_petals", () => resident.showSpeech("Petals!"));
resident.events.addEventListener("transfer_flower", () => resident.showSpeech("A flower for you."));

let dryTimer = null;
function scheduleDryOut() {
  clearTimeout(dryTimer);
  dryTimer = setTimeout(() => { flowerBedEl.dataset.state = "dry"; flowerBedEl.setAttribute("aria-label", "Dry flower bed, tap to water"); }, 20000);
}

resident.interactions.register("flowerBed", {
  point: flowerBedPoint,
  facing: "down",
  action: "water_flowers",
  isAvailable: () => flowerBedEl.dataset.state === "dry",
  onStart: () => { flowerBedEl.dataset.state = "watering"; },
  onComplete: () => {
    flowerBedEl.dataset.state = "watered";
    flowerBedEl.setAttribute("aria-label", "Watered flower bed");
    resident.showSpeech("Flowers watered!");
    scheduleDryOut();
  }
});

flowerBedEl.addEventListener("click", () => resident.interactions.request("flowerBed"));

let previous = performance.now();
function loop(now) {
  resident.update(Math.min(now - previous, 100));
  previous = now;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

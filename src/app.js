import { AnimatedResident } from "./resident.js";
import { AnimationDebugViewer } from "./debug-viewer.js";

const response = await fetch("./assets/characters/pepita/character.json");
if (!response.ok) throw new Error("Pepita character data could not be loaded.");
const config = await response.json();
const village = document.querySelector("#village");
const resident = new AnimatedResident(
  config,
  document.querySelector("#resident"),
  document.querySelector("#resident-sprite"),
  document.querySelector("#speech"),
  { width: village.clientWidth, height: village.clientHeight }
);
new AnimationDebugViewer(document.querySelector("#debug-viewer"), resident);

resident.events.addEventListener("spawn_petals", () => resident.showSpeech("Petals!"));
resident.events.addEventListener("transfer_flower", () => resident.showSpeech("A flower for you."));

let previous = performance.now();
function loop(now) {
  resident.update(Math.min(now - previous, 100));
  previous = now;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

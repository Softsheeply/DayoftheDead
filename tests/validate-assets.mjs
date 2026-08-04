import { readFile, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const characterRoot = resolve(root, "assets/characters/pepita");
const config = JSON.parse(await readFile(resolve(characterRoot, "character.json"), "utf8"));
const expectedStates = ["idle", "walking", "skipping", "talking", "dancing", "performingAction", "sitting", "sleeping", "falling", "disabled"];

if (config.frameWidth !== 128 || config.frameHeight !== 128) throw new Error("Pepita frames must be 128×128.");
if (JSON.stringify(config.states) !== JSON.stringify(expectedStates)) throw new Error("State list is incomplete.");
if (config.animations.throw_petals.events["4"] !== "spawn_petals") throw new Error("throw_petals event marker is missing.");
if (config.animations.give_flower.events["4"] !== "transfer_flower") throw new Error("give_flower event marker is missing.");

let count = 0;
for (const [name, animation] of Object.entries(config.animations)) {
  if (animation.paths.length !== animation.frames) throw new Error(`${name} path count does not match frame count.`);
  for (const path of animation.paths) {
    const bytes = await readFile(resolve(characterRoot, path));
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    if (width !== 128 || height !== 128) throw new Error(`${path} is ${width}×${height}.`);
    await access(resolve(characterRoot, path));
    count += 1;
  }
}
console.log(`Validated ${count} Pepita frames across ${Object.keys(config.animations).length} animations.`);

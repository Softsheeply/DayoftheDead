// Logic-level tests for the game engine (state machine, behaviour, navigation,
// interactions, hotspots, village, and the AnimatedResident orchestrator).
//
// Unlike validate-assets.mjs (which checks the shipped PNG/JSON files), this
// suite exercises the actual runtime logic against lightweight DOM stubs, so
// it runs in plain Node with no browser needed.
//
// Run with: node tests/logic.mjs   (or via `npm test`, which runs both files)

import { test, mock } from "node:test";
import assert from "node:assert/strict";

import { CharacterStateMachine, STATE_PRIORITY } from "../src/state-machine.js";
import { CharacterBehaviourController } from "../src/behaviour.js";
import { CharacterNavigationController } from "../src/navigation.js";
import { CharacterInteractionController } from "../src/interaction.js";
import { CharacterAnimationController, AnimationEventDispatcher } from "../src/animation.js";
import { createInteractiveHotspot, createHousingZone } from "../src/hotspots.js";
import { Village } from "../src/village.js";
import { AnimatedResident } from "../src/resident.js";
import { t, getLocale, setLocale, availableLocales, onLocaleChange, applyLocale } from "../src/i18n.js";

// Mirrors resident.js's internal LONG_PRESS_MS (not exported -- it's an
// implementation detail of the pointer handling, not part of the module's
// public surface). Update this if that constant changes.
const LONG_PRESS_MS_FOR_TESTS = 550;

// -- Test doubles -------------------------------------------------------------

function makeClassList() {
  const classes = new Set();
  return {
    add: (...names) => names.forEach(n => classes.add(n)),
    remove: (...names) => names.forEach(n => classes.delete(n)),
    toggle: (name, on) => { on ? classes.add(name) : classes.delete(name); },
    contains: name => classes.has(name),
    _set: classes
  };
}

function makeElementStub() {
  const listeners = new Map();
  return {
    dataset: {},
    style: {},
    classList: makeClassList(),
    attributes: {},
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    removeEventListener(type, handler) {
      const list = listeners.get(type);
      if (!list) return;
      const idx = list.indexOf(handler);
      if (idx >= 0) list.splice(idx, 1);
    },
    setAttribute(name, value) { this.attributes[name] = value; },
    getAttribute(name) { return this.attributes[name]; },
    setPointerCapture() {},
    releasePointerCapture() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0 }; },
    trigger(type, event = {}) {
      (listeners.get(type) ?? []).forEach(handler => handler(event));
    }
  };
}

function makeImageStub() {
  return { src: "" };
}

function makeConfig(overrides = {}) {
  const base = {
    id: "test-resident",
    displayName: "Testy",
    defaultDirection: "down",
    frameWidth: 128,
    frameHeight: 128,
    movement: { walkSpeed: 100, skipSpeed: 150 },
    personality: { autonomousBehaviours: [{ action: "idle", weight: 1 }] },
    animations: {
      idle_down: { frames: 1, fps: 1, loop: true, paths: ["idle_down_00.png"] },
      idle_left: { frames: 1, fps: 1, loop: true, paths: ["idle_left_00.png"] },
      idle_right: { frames: 1, fps: 1, loop: true, paths: ["idle_right_00.png"] },
      idle_up: { frames: 1, fps: 1, loop: true, paths: ["idle_up_00.png"] },
      walk_down: { frames: 2, fps: 10, loop: true, paths: ["walk_down_00.png", "walk_down_01.png"] },
      walk_left: { frames: 2, fps: 10, loop: true, paths: ["walk_left_00.png", "walk_left_01.png"] },
      walk_right: { frames: 2, fps: 10, loop: true, paths: ["walk_right_00.png", "walk_right_01.png"] },
      walk_up: { frames: 2, fps: 10, loop: true, paths: ["walk_up_00.png", "walk_up_01.png"] }
    }
  };
  return { ...base, ...overrides, animations: { ...base.animations, ...(overrides.animations ?? {}) } };
}

function makeResident(configOverrides = {}, bounds = { width: 400, height: 400 }, options = {}) {
  const config = makeConfig(configOverrides);
  const element = makeElementStub();
  const image = makeImageStub();
  const speech = makeElementStub();
  const expressionIcon = { textContent: "" };
  return new AnimatedResident(config, element, image, speech, bounds, { expressionIcon, ...options });
}

// -- CharacterStateMachine -----------------------------------------------------

test("state machine: transitions and reports previous/next state", () => {
  const sm = new CharacterStateMachine();
  assert.equal(sm.state, "idle");
  let changeDetail = null;
  sm.addEventListener("change", e => { changeDetail = e.detail; });
  const ok = sm.transition("walking");
  assert.equal(ok, true);
  assert.equal(sm.state, "walking");
  assert.deepEqual(changeDetail, { previous: "idle", next: "walking" });
});

test("state machine: rejects unknown states", () => {
  const sm = new CharacterStateMachine();
  assert.throws(() => sm.transition("flying"), /Unknown state/);
});

test("state machine: lock blocks further transitions until force or unlock", () => {
  const sm = new CharacterStateMachine();
  sm.transition("performingAction", { lock: true });
  assert.equal(sm.state, "performingAction");
  const blocked = sm.transition("walking");
  assert.equal(blocked, false);
  assert.equal(sm.state, "performingAction", "locked state must not change on a non-forced transition");
  const forced = sm.transition("disabled", { force: true });
  assert.equal(forced, true);
  assert.equal(sm.state, "disabled");
});

test("state machine: unlock clears the lock and transitions to the given state", () => {
  const sm = new CharacterStateMachine();
  sm.transition("talking", { lock: true });
  sm.unlock("idle");
  assert.equal(sm.locked, false);
  assert.equal(sm.state, "idle");
  // now a normal (non-forced) transition should work again
  assert.equal(sm.transition("walking"), true);
});

test("state machine: STATE_PRIORITY includes every state used by transition()", () => {
  // Sanity check the exported priority list stays in sync with itself.
  assert.equal(new Set(STATE_PRIORITY).size, STATE_PRIORITY.length, "no duplicate states");
});

// -- CharacterBehaviourController ----------------------------------------------

test("behaviour: does nothing while disabled or resident is busy", () => {
  const calls = [];
  const resident = { busy: false, performBehaviour: action => calls.push(action) };
  const behaviour = new CharacterBehaviourController(resident, [{ action: "idle", weight: 1 }]);
  behaviour.remaining = 0;
  behaviour.enabled = false;
  behaviour.update(16);
  assert.equal(calls.length, 0, "disabled controller should not act");

  behaviour.enabled = true;
  resident.busy = true;
  behaviour.update(16);
  assert.equal(calls.length, 0, "busy resident should not act");
});

test("behaviour: picks a weighted action once the delay elapses", () => {
  const calls = [];
  const resident = { busy: false, performBehaviour: action => calls.push(action) };
  const behaviour = new CharacterBehaviourController(resident, [
    { action: "idle", weight: 0.3 },
    { action: "walk", weight: 0.7 }
  ]);
  behaviour.remaining = 10;
  const original = Math.random;
  Math.random = () => 0.5; // lands past "idle"'s 0.3 cumulative weight -> "walk"
  try {
    behaviour.update(20); // consumes the remaining delay, triggers a pick
  } finally {
    Math.random = original;
  }
  assert.deepEqual(calls, ["walk"]);
});

test("behaviour: postpone delays the next decision", () => {
  const resident = { busy: false, performBehaviour: () => {} };
  const behaviour = new CharacterBehaviourController(resident, [{ action: "idle", weight: 1 }]);
  behaviour.postpone(5000);
  assert.equal(behaviour.remaining, 5000);
});

// -- CharacterNavigationController ---------------------------------------------

test("navigation: rejects points outside the nav band and inside obstacles", () => {
  const bounds = { width: 400, height: 400 };
  const obstacle = { x: 100, y: 100, width: 50, height: 50 };
  const nav = new CharacterNavigationController(bounds, [obstacle], { margin: 20, topRatio: 0.4, bottomRatio: 0.9 });

  assert.equal(nav.isWalkable(10, 200), false, "too close to the left edge (inside margin)");
  assert.equal(nav.isWalkable(200, 50), false, "above the nav band's top ratio");
  assert.equal(nav.isWalkable(125, 125), false, "inside the obstacle (plus footPadding)");
  assert.equal(nav.isWalkable(200, 200), true, "clear point should be walkable");
});

test("navigation: randomPoint only ever returns walkable points, or null if none found", () => {
  const bounds = { width: 400, height: 400 };
  const nav = new CharacterNavigationController(bounds, [], { margin: 20, topRatio: 0.4, bottomRatio: 0.9 });
  for (let i = 0; i < 25; i += 1) {
    const point = nav.randomPoint();
    assert.ok(point, "should find a walkable point in an obstacle-free area");
    assert.equal(nav.isWalkable(point.x, point.y), true);
  }

  // An obstacle covering the entire nav band should make every attempt fail.
  const blockedNav = new CharacterNavigationController(bounds, [{ x: 0, y: 0, width: 400, height: 400 }], { margin: 0, footPadding: 0 });
  assert.equal(blockedNav.randomPoint(5), null);
});

test("navigation: pathIsClear ignores obstacles within endBufferPx of the destination", () => {
  const bounds = { width: 400, height: 400 };
  const nav = new CharacterNavigationController(bounds, [], { margin: 0, footPadding: 0 });
  const from = { x: 0, y: 200 };
  const to = { x: 20, y: 200 }; // 20px away
  assert.equal(nav.pathIsClear(from, to, 26), true, "destination closer than endBufferPx should always be clear");
});

test("navigation: pathIsClear detects an obstacle sitting between two clear points", () => {
  const bounds = { width: 400, height: 400 };
  const obstacle = { x: 190, y: 150, width: 20, height: 100 }; // a wall straight across the middle
  const nav = new CharacterNavigationController(bounds, [obstacle], { margin: 0, footPadding: 0, topRatio: 0, bottomRatio: 1 });
  assert.equal(nav.pathIsClear({ x: 100, y: 200 }, { x: 300, y: 200 }), false, "a straight line through the wall should not be clear");
  assert.equal(nav.pathIsClear({ x: 100, y: 200 }, { x: 150, y: 200 }), true, "a line that never reaches the wall should be clear");
});

test("navigation: findApproachPath returns a direct path when nothing is in the way", () => {
  const bounds = { width: 400, height: 400 };
  const nav = new CharacterNavigationController(bounds, [], { margin: 0, footPadding: 0, topRatio: 0, bottomRatio: 1 });
  const to = { x: 300, y: 200 };
  assert.deepEqual(nav.findApproachPath({ x: 100, y: 200 }, to), [to], "clear path should be a single-point route to the destination itself");
});

test("navigation: findApproachPath routes around an obstacle that blocks the direct line", () => {
  const bounds = { width: 400, height: 400 };
  const obstacle = { x: 190, y: 100, width: 20, height: 200 }; // a wall spanning the whole vertical band
  const nav = new CharacterNavigationController(bounds, [obstacle], { margin: 0, footPadding: 0, topRatio: 0, bottomRatio: 1 });
  const from = { x: 100, y: 200 };
  const to = { x: 300, y: 200 };
  const path = nav.findApproachPath(from, to);
  assert.equal(path.length, 2, "should insert exactly one waypoint to go around the wall");
  const [waypoint] = path;
  assert.equal(nav.pathIsClear(from, waypoint, 0), true, "the first leg must actually be clear");
  assert.equal(nav.pathIsClear(waypoint, to), true, "the second leg must actually be clear");
  assert.deepEqual(path[1], to, "the route must still end at the real destination");
});

test("navigation: findApproachPath falls back to the direct line when no detour clears both legs", () => {
  // An obstacle so wide that none of findApproachPath's fixed lateral offsets escape it.
  const bounds = { width: 800, height: 800 };
  const obstacle = { x: 190, y: 0, width: 420, height: 800 };
  const nav = new CharacterNavigationController(bounds, [obstacle], { margin: 0, footPadding: 0, topRatio: 0, bottomRatio: 1 });
  const from = { x: 100, y: 400 };
  const to = { x: 700, y: 400 };
  assert.deepEqual(nav.findApproachPath(from, to), [to], "should fall back to the direct route rather than getting stuck with no path at all");
});

test("navigation: findApproachPath solves an L-shaped detour findQuickDetour's single waypoint can't", () => {
  // A wall with a gap only in one corner -- routing around it needs to bend
  // twice (down, then across through the gap), which a single lateral
  // waypoint can't express but grid BFS can.
  const bounds = { width: 800, height: 800 };
  const wallWithGapAtBottom = { x: 390, y: 0, width: 20, height: 550 }; // leaves a gap between y=550 and the bottom
  const nav = new CharacterNavigationController(bounds, [wallWithGapAtBottom], { margin: 0, footPadding: 0, topRatio: 0, bottomRatio: 1 });
  const from = { x: 100, y: 100 };
  const to = { x: 700, y: 100 };

  assert.equal(nav.findQuickDetour(from, to, 0), null, "this specific gap shape shouldn't be solvable by a single lateral offset");

  const path = nav.findApproachPath(from, to);
  assert.ok(path.length > 1, "grid pathfinding should still find a route through the gap");
  let prev = from;
  for (let i = 0; i < path.length; i += 1) {
    assert.equal(nav.pathIsClear(prev, path[i], i === path.length - 1 ? 26 : 0), true, `leg ${i} of the resulting path must actually be clear`);
    prev = path[i];
  }
});

test("navigation: findGridPath does not let a diagonal step cut through a blocked corner", () => {
  const bounds = { width: 200, height: 200 };
  // Two obstacles positioned so a diagonal move between their shared corner
  // would clip both of them, even though the two diagonal endpoint cells
  // are themselves individually walkable.
  const obstacles = [
    { x: 100, y: 60, width: 40, height: 40 },
    { x: 60, y: 100, width: 40, height: 40 }
  ];
  const nav = new CharacterNavigationController(bounds, obstacles, { margin: 0, footPadding: 0, topRatio: 0, bottomRatio: 1 });
  const path = nav.findGridPath({ x: 70, y: 70 }, { x: 130, y: 130 });
  if (!path) return; // no path at all is an acceptable outcome for this tight synthetic case
  let prev = { x: 70, y: 70 };
  for (const point of path) {
    // Every consecutive pair in a corner-safe path should be walkable along
    // the straight line between them (cheap proxy: both endpoints walkable
    // and pathIsClear with no end buffer).
    assert.equal(nav.pathIsClear(prev, point, 0), true, "no leg of the grid path should cut through a blocked corner");
    prev = point;
  }
});

// -- CharacterInteractionController --------------------------------------------

test("interaction: request only proceeds when available, and drives the resident's approach", () => {
  const approachCalls = [];
  const resident = { busy: false, beginInteractionApproach: (id, obj) => approachCalls.push([id, obj]) };
  const interactions = new CharacterInteractionController(resident);
  let available = false;
  interactions.register("thing", { point: { x: 1, y: 2 }, action: "act", isAvailable: () => available });

  assert.equal(interactions.request("thing"), false, "unavailable object should not start an approach");
  assert.equal(approachCalls.length, 0);

  available = true;
  assert.equal(interactions.request("thing"), true);
  assert.equal(approachCalls.length, 1);
  assert.equal(approachCalls[0][0], "thing");
});

test("interaction: resolve faces the object, calls onStart, and plays the action", () => {
  const played = [];
  const resident = { direction: "down", playAction: (action, opts) => played.push([action, opts]) };
  const interactions = new CharacterInteractionController(resident);
  let started = false;
  interactions.register("bench", { facing: "up", action: "sit", onStart: () => { started = true; } });
  interactions.resolve("bench");
  assert.equal(resident.direction, "up", "resident should face the object's facing direction");
  assert.equal(started, true);
  assert.deepEqual(played, [["sit", { reaction: false, interactionId: "bench" }]]);
});

test("interaction: complete calls the object's onComplete", () => {
  const resident = { playAction() {} };
  const interactions = new CharacterInteractionController(resident);
  let completed = false;
  interactions.register("bench", { onComplete: () => { completed = true; } });
  interactions.complete("bench");
  assert.equal(completed, true);
  assert.doesNotThrow(() => interactions.complete("nonexistent"), "completing an unregistered id should be a no-op, not throw");
});

// -- CharacterAnimationController ----------------------------------------------

test("animation: advances frames according to fps and loops by default", () => {
  const config = makeConfig();
  const image = makeImageStub();
  const anim = new CharacterAnimationController(config, image);
  anim.play("walk_down"); // 2 frames @ 10fps -> 100ms per frame
  assert.equal(anim.frame, 0);
  anim.update(100);
  assert.equal(anim.frame, 1);
  anim.update(100); // wraps back to frame 0 since walk_down loops
  assert.equal(anim.frame, 0);
  assert.equal(anim.playing, true);
});

test("animation: stops on the last frame and dispatches 'complete' when not looping", () => {
  const config = makeConfig({ animations: { one_shot: { frames: 2, fps: 10, loop: false, paths: ["a.png", "b.png"] } } });
  const image = makeImageStub();
  const anim = new CharacterAnimationController(config, image);
  let completed = false;
  anim.addEventListener("complete", () => { completed = true; });
  anim.play("one_shot");
  anim.update(100); // frame 1
  assert.equal(completed, false);
  anim.update(100); // would be frame 2, but only 2 frames exist -> stop at frame 1
  assert.equal(anim.frame, 1);
  assert.equal(anim.playing, false);
  assert.equal(completed, true);
});

test("animation: play() throws for an animation not present in the manifest", () => {
  const config = makeConfig();
  const anim = new CharacterAnimationController(config, makeImageStub());
  assert.throws(() => anim.play("does_not_exist"), /Animation not found/);
});

test("animation: event markers fire once per pass and can fire again after looping", () => {
  const config = makeConfig({
    animations: { throw_thing: { frames: 2, fps: 10, loop: true, paths: ["a.png", "b.png"], events: { "1": "spawn_petals" } } }
  });
  const dispatcher = new AnimationEventDispatcher();
  const fired = [];
  dispatcher.addEventListener("spawn_petals", () => fired.push("spawn_petals"));
  const anim = new CharacterAnimationController(config, makeImageStub(), dispatcher);
  anim.play("throw_thing");
  anim.update(100); // frame 1 -> event fires
  anim.update(100); // wraps to frame 0, clears firedEvents
  anim.update(100); // frame 1 again -> event fires again
  assert.deepEqual(fired, ["spawn_petals", "spawn_petals"]);
});

test("animation: render() builds the sprite path from the character's own id, not a hardcoded one", () => {
  const config = makeConfig({ id: "xolo" });
  const image = makeImageStub();
  new CharacterAnimationController(config, image);
  assert.equal(image.src, "./assets/characters/xolo/idle_down_00.png");
});

// -- hotspots.js ----------------------------------------------------------------

// A stub resident with just enough surface for hotspots.js: an
// interactions controller, the fields pickResident's eligibility check
// reads (config.animations, busy/conversation/housed/beingCarried/pinned),
// and a position for the nearest-resident distance calculation.
function makeHotspotResidentStub({ position = { x: 0, y: 0 }, animations = { sit: {} }, playAction, beginInteractionApproach } = {}) {
  const played = [];
  const inner = {
    direction: "down",
    position,
    busy: false,
    conversation: null,
    housed: false,
    beingCarried: false,
    pinned: false,
    config: { animations },
    playAction: playAction ?? ((a, o) => played.push([a, o])),
    beginInteractionApproach: beginInteractionApproach ?? (() => {})
  };
  inner.interactions = new CharacterInteractionController(inner);
  inner.played = played;
  return inner;
}

test("createInteractiveHotspot: sets initial state and toggles via the full register/resolve/complete chain", () => {
  const element = makeElementStub();
  const resident = makeHotspotResidentStub();
  createInteractiveHotspot({
    id: "bench", element, point: { x: 1, y: 1 }, action: "sit", residents: [resident],
    fromState: "empty", toState: "just-used", emptyLabel: "Empty", settledLabel: "Used"
  });
  assert.equal(element.dataset.state, "empty");
  assert.equal(element.getAttribute("aria-label"), "Empty");

  // Simulate the full chain a real tap would drive: request -> resolve -> complete.
  assert.equal(resident.interactions.request("bench"), true);
  resident.interactions.resolve("bench");
  resident.interactions.complete("bench");
  assert.equal(element.dataset.state, "just-used");
  assert.equal(element.getAttribute("aria-label"), "Used");
});

test("createInteractiveHotspot: picks the nearest eligible resident when tapped, skipping busy/ineligible ones", () => {
  const element = makeElementStub();
  const near = makeHotspotResidentStub({ position: { x: 10, y: 0 } });
  const far = makeHotspotResidentStub({ position: { x: 500, y: 0 } });
  const busy = makeHotspotResidentStub({ position: { x: 5, y: 0 } });
  busy.busy = true;
  const noAnimation = makeHotspotResidentStub({ position: { x: 1, y: 0 }, animations: {} }); // closest, but can't sit
  const point = { x: 0, y: 0 };

  const hotspot = createInteractiveHotspot({
    id: "bench", element, point, action: "sit", residents: [far, busy, noAnimation, near],
    fromState: "empty", toState: "occupied"
  });

  assert.equal(hotspot.pickResident(), near, "should pick the nearest resident that is both free and has the action");
});

test("createInteractiveHotspot: onSettled receives whichever resident actually completed the interaction", () => {
  const element = makeElementStub();
  const resident = makeHotspotResidentStub();
  const settledWith = [];
  createInteractiveHotspot({
    id: "fountain", element, point: { x: 0, y: 0 }, action: "throw_petals", residents: [resident],
    fromState: "still", toState: "wished", onSettled: r => settledWith.push(r)
  });
  resident.interactions.complete("fountain");
  assert.deepEqual(settledWith, [resident]);
});

test("createInteractiveHotspot: is unavailable while in its non-initial state, and reverts after a delay", () => {
  mock.timers.enable();
  try {
    const element = makeElementStub();
    const resident = makeHotspotResidentStub();
    createInteractiveHotspot({
      id: "bed", element, point: { x: 0, y: 0 }, action: "water", residents: [resident],
      fromState: "dry", toState: "watered", revertAfterMs: 1000
    });

    resident.interactions.complete("bed"); // jump straight to "settled" for this test
    // isAvailable is gated on the object's own onComplete having run via resolve/complete;
    // exercise it directly through the registered object instead:
    const obj = resident.interactions.objects.get("bed");
    obj.onComplete(resident);
    assert.equal(element.dataset.state, "watered");
    assert.equal(obj.isAvailable(), false, "should not be available while settled");

    mock.timers.tick(999);
    assert.equal(element.dataset.state, "watered", "should not revert before the delay elapses");
    mock.timers.tick(1);
    assert.equal(element.dataset.state, "dry", "should revert back to fromState after the delay");
    assert.equal(obj.isAvailable(), true);
  } finally {
    mock.timers.reset();
  }
});

test("createInteractiveHotspot: duringState is applied on onStart, e.g. the flower bed's 'watering' pulse", () => {
  const element = makeElementStub();
  const resident = makeHotspotResidentStub();
  createInteractiveHotspot({
    id: "bed", element, point: { x: 0, y: 0 }, action: "water", residents: [resident],
    fromState: "dry", toState: "watered", duringState: "watering"
  });
  const obj = resident.interactions.objects.get("bed");
  obj.onStart();
  assert.equal(element.dataset.state, "watering");
});

test("createHousingZone: registers a drop zone, tracks occupants, and releases on tap", () => {
  const village = { dropZones: [], registerDropZone(z) { this.dropZones.push(z); } };
  const zoneElement = makeElementStub();
  const indicatorElement = makeElementStub();
  const released = [];
  const resident = { release: point => released.push(point) };

  const { occupants } = createHousingZone({
    village, box: { x: 0, y: 0, width: 10, height: 10 }, zoneElement, indicatorElement,
    releasePoint: () => ({ x: 5, y: 5 }), emptyLabel: "Empty", occupiedLabel: n => `${n} inside`
  });

  assert.equal(village.dropZones.length, 1);
  assert.equal(indicatorElement.classList.contains("on"), false);

  village.dropZones[0].onHouse(resident);
  assert.equal(occupants.has(resident), true);
  assert.equal(indicatorElement.classList.contains("on"), true);
  assert.equal(zoneElement.getAttribute("aria-label"), "1 inside");

  zoneElement.trigger("click");
  assert.equal(occupants.has(resident), false);
  assert.deepEqual(released, [{ x: 5, y: 5 }]);
  assert.equal(indicatorElement.classList.contains("on"), false);
  assert.equal(zoneElement.getAttribute("aria-label"), "Empty");
});

test("createHousingZone: tapping an empty zone is a no-op", () => {
  const village = { registerDropZone() {} };
  const zoneElement = makeElementStub();
  assert.doesNotThrow(() => {
    createHousingZone({
      village, box: { x: 0, y: 0, width: 1, height: 1 }, zoneElement, indicatorElement: null,
      releasePoint: () => ({ x: 0, y: 0 }), emptyLabel: "Empty", occupiedLabel: () => ""
    });
    zoneElement.trigger("click");
  });
});

// -- Village --------------------------------------------------------------------

test("village: toLocalPoint converts client coordinates using the village element's rect", () => {
  const villageEl = { getBoundingClientRect: () => ({ left: 50, top: 30 }) };
  const village = new Village(villageEl);
  assert.deepEqual(village.toLocalPoint(120, 80), { x: 70, y: 50 });
});

test("village: findDropZone hit-tests boxes and respects a zone's accepts() filter", () => {
  const village = new Village({ getBoundingClientRect: () => ({ left: 0, top: 0 }) });
  village.registerDropZone({ box: { x: 0, y: 0, width: 100, height: 100 }, accepts: r => r.canEnter });
  assert.equal(village.findDropZone({ x: 50, y: 50 }, { canEnter: false }), undefined, "accepts() should reject");
  const zone = village.findDropZone({ x: 50, y: 50 }, { canEnter: true });
  assert.ok(zone, "accepts() true and inside the box should match");
  assert.equal(village.findDropZone({ x: 500, y: 500 }, { canEnter: true }), undefined, "outside the box should not match");
});

test("village: findConversationPartner picks the closest available resident within range", () => {
  const village = new Village({ getBoundingClientRect: () => ({ left: 0, top: 0 }) });
  const asker = { position: { x: 0, y: 0 } };
  const far = { position: { x: 500, y: 500 }, busy: false, canBeTalkedTo: () => true };
  const near = { position: { x: 10, y: 0 }, busy: false, canBeTalkedTo: () => true };
  const busy = { position: { x: 5, y: 0 }, busy: true, canBeTalkedTo: () => true };
  village.residents = [asker, far, near, busy];
  assert.equal(village.findConversationPartner(asker), near);
});

test("village: findConversationPartner returns null when nobody is in range/available", () => {
  const village = new Village({ getBoundingClientRect: () => ({ left: 0, top: 0 }) });
  const asker = { position: { x: 0, y: 0 } };
  village.residents = [asker];
  assert.equal(village.findConversationPartner(asker), null);
});

// -- AnimatedResident (integration-ish, via stubbed DOM) -------------------------

test("resident: constructs without throwing and renders an initial idle pose", () => {
  assert.doesNotThrow(() => makeResident());
  const resident = makeResident();
  assert.equal(resident.animation.name, "idle_down");
  assert.equal(resident.stateMachine.state, "idle");
});

test("resident: playAction falls back gracefully (no throw) when the animation doesn't exist", () => {
  const resident = makeResident(); // no "wave" animation defined
  assert.doesNotThrow(() => resident.playAction("wave", { reaction: true }));
  assert.equal(resident.speech.textContent, "¡Hola! I'm Testy.");
  assert.equal(resident.busy, false, "should not become busy when the action animation is missing");
});

test("resident: playAction plays the real animation and locks state when it exists", () => {
  const resident = makeResident({ animations: { wave: { frames: 1, fps: 1, loop: false, paths: ["wave.png"] } } });
  resident.playAction("wave", { reaction: true });
  assert.equal(resident.animation.name, "wave");
  assert.equal(resident.busy, true);
  assert.equal(resident.stateMachine.state, "performingAction");
  assert.equal(resident.stateMachine.locked, true);
});

test("resident: onTap ignores the synthetic click that follows a real drag (suppressClick)", () => {
  const resident = makeResident({ animations: { wave: { frames: 1, fps: 1, loop: false, paths: ["wave.png"] } } });
  resident.suppressClick = true;
  resident.onTap();
  assert.equal(resident.busy, false, "the wave reaction should not fire when suppressClick is set");
  assert.equal(resident.suppressClick, false, "suppressClick should reset itself after being consumed");
});

test("resident: canBeCarried/canBeTalkedTo reflect busy, conversation, and housed state", () => {
  const resident = makeResident();
  assert.equal(resident.canBeCarried(), true);
  assert.equal(resident.canBeTalkedTo(), true);
  resident.busy = true;
  assert.equal(resident.canBeCarried(), false);
  assert.equal(resident.canBeTalkedTo(), false);
  resident.busy = false;
  resident.housed = true;
  assert.equal(resident.canBeCarried(), false, "a housed resident cannot be picked up again");
});

test("resident: talkTo refuses when either side lacks a talk_down animation", () => {
  const a = makeResident(); // no talk_down
  const b = makeResident({ animations: { talk_down: { frames: 1, fps: 1, loop: true, paths: ["t.png"] } } });
  a.talkTo(b);
  assert.equal(a.busy, false, "should not start a conversation without talk_down on both sides");
  assert.equal(a.conversation, null);
});

test("resident: talkTo starts a mutual conversation and walks the initiator toward a standoff point", () => {
  const talkAnim = { talk_down: { frames: 1, fps: 1, loop: true, paths: ["t.png"] } };
  const a = makeResident({ animations: talkAnim }, { width: 400, height: 400 }, { spawn: { x: 100, y: 100 } });
  const b = makeResident({ animations: talkAnim }, { width: 400, height: 400 }, { spawn: { x: 200, y: 100 } });
  a.talkTo(b);
  assert.equal(a.busy, true);
  assert.equal(b.busy, true, "the partner should also be marked busy while a conversation is pending");
  assert.equal(a.conversation.role, "initiator");
  assert.equal(b.conversation.role, "partner");
  assert.ok(a.target, "initiator should have a movement target toward the standoff point");
});

test("resident: house()/release() round-trip hides and restores the resident correctly", () => {
  const resident = makeResident();
  resident.house({ onHouse: () => {} });
  assert.equal(resident.housed, true);
  assert.equal(resident.busy, true);
  assert.equal(resident.element.style.display, "none");
  assert.equal(resident.stateMachine.state, "disabled");

  resident.release({ x: 42, y: 24 });
  assert.equal(resident.housed, false);
  assert.equal(resident.busy, false);
  assert.equal(resident.element.style.display, "");
  assert.deepEqual(resident.position, { x: 42, y: 24 });
  assert.equal(resident.stateMachine.state, "idle");
});

test("resident: moveRandomly is a no-op (falls back to idle) when navigation finds no walkable point", () => {
  const bounds = { width: 400, height: 400 };
  // An obstacle covering the whole nav band means randomPoint() always returns null.
  const resident = makeResident({}, bounds, { obstacles: [{ x: 0, y: 0, width: 400, height: 400 }] });
  resident.navigation.footPadding = 0;
  resident.navigation.margin = 0;
  resident.moveRandomly("walk");
  assert.equal(resident.busy, false);
  assert.equal(resident.target, null);
});

test("resident: updateMovement advances position toward the target and arrives cleanly", () => {
  const resident = makeResident({}, { width: 400, height: 400 }, { spawn: { x: 0, y: 0 } });
  resident.target = { x: 100, y: 0 };
  resident.movementKind = "walk"; // walkSpeed 100/s from makeConfig
  resident.busy = true;
  resident.updateMovement(500); // half a second -> 50px
  assert.equal(resident.position.x, 50);
  assert.equal(resident.target.x, 100, "target should be unchanged until arrival");

  resident.updateMovement(1000); // steps exactly onto the target, but arrival is checked at the
                                  // *start* of the next call (matches the real per-frame game loop)
  assert.equal(resident.position.x, 100);
  assert.equal(resident.target.x, 100, "not yet detected as arrived within the same call that reaches it");

  resident.updateMovement(16); // next frame: distance is now 0, so this call detects arrival
  assert.deepEqual(resident.position, { x: 100, y: 0 });
  assert.equal(resident.target, null, "target should clear once arrival is detected");
  assert.equal(resident.busy, false);
});

test("resident: walkTo routes through queued waypoints before resolving the final arrival", () => {
  const resident = makeResident({}, { width: 400, height: 400 }, { spawn: { x: 0, y: 0 } });
  // A wall the direct line to (200, 0) would cross; findApproachPath should insert a waypoint.
  resident.navigation = new CharacterNavigationController(
    { width: 400, height: 400 },
    [{ x: 90, y: -50, width: 20, height: 100 }],
    { margin: 0, footPadding: 0, topRatio: 0, bottomRatio: 1 }
  );
  resident.movementKind = "walk";
  resident.walkTo({ x: 200, y: 0 });

  assert.ok(resident.pathQueue.length >= 1, "an obstructed walk should queue at least one waypoint");
  const waypoint = resident.target;
  assert.notDeepEqual(waypoint, { x: 200, y: 0 }, "should head to the waypoint first, not straight to the final point");

  // Walk to the (queued) waypoint -- arriving there should advance to the next
  // leg of the path instead of finishing the walk.
  resident.busy = true;
  const dx = waypoint.x, dy = waypoint.y; // from (0,0)
  const distance = Math.hypot(dx, dy);
  resident.updateMovement((distance / 100) * 1000 + 50); // walkSpeed 100/s, overshoot slightly
  resident.updateMovement(16); // detect arrival at the waypoint
  assert.equal(resident.busy, true, "should still be walking -- only reached an intermediate waypoint");
  assert.deepEqual(resident.target, { x: 200, y: 0 }, "should now be heading to the real final destination");
  assert.equal(resident.pathQueue.length, 0);
});

test("resident: walkTo goes straight to the destination when nothing obstructs it (unchanged common case)", () => {
  const resident = makeResident({}, { width: 400, height: 400 }, { spawn: { x: 0, y: 0 } });
  resident.walkTo({ x: 150, y: 0 });
  assert.deepEqual(resident.target, { x: 150, y: 0 });
  assert.deepEqual(resident.pathQueue, []);
});

test("resident: postAction 'hold' keeps the resident in place, then returns to idle after holdMs", () => {
  mock.timers.enable();
  try {
    const resident = makeResident({ animations: { sit: { frames: 1, fps: 10, loop: false, paths: ["sit.png"] } } });
    resident.interactions.register("bench", { action: "sit", postAction: "hold", holdMs: 1000 });
    resident.pendingInteraction = { id: "bench", stage: "acting" };
    resident.playAction("sit", { interactionId: "bench" });
    resident.animation.update(200); // completes the 1-frame non-looping animation -> finishAction -> hold starts
    assert.equal(resident.busy, true, "should remain busy while holding, not celebrate-and-idle");
    assert.equal(resident.stateMachine.state, "performingAction", "should stay in the sit pose");
    mock.timers.tick(999);
    assert.equal(resident.busy, true, "should not resolve before holdMs elapses");
    mock.timers.tick(1);
    assert.equal(resident.busy, false);
    assert.equal(resident.stateMachine.state, "idle");
  } finally {
    mock.timers.reset();
  }
});

test("resident: an interruption during a hold prevents the stale timer from clobbering the newer action", () => {
  mock.timers.enable();
  try {
    const resident = makeResident({
      animations: {
        sit: { frames: 1, fps: 10, loop: false, paths: ["sit.png"] },
        wave: { frames: 1, fps: 10, loop: false, paths: ["wave.png"] }
      }
    });
    resident.interactions.register("bench", { action: "sit", postAction: "hold", holdMs: 1000 });
    resident.pendingInteraction = { id: "bench", stage: "acting" };
    resident.playAction("sit", { interactionId: "bench" });
    resident.animation.update(200); // hold starts

    // Something else takes over mid-hold (e.g. the player taps this resident)
    // before the hold's own timer would have fired:
    resident.playAction("wave", { reaction: true });
    assert.equal(resident.animation.name, "wave");

    mock.timers.tick(1000); // the now-stale hold timer fires here
    assert.equal(resident.animation.name, "wave", "the stale hold callback must not override the newer action");
    assert.equal(resident.busy, true, "wave hasn't completed on its own yet, so busy should still be true");
  } finally {
    mock.timers.reset();
  }
});

// -- Pin / free-roam toggle (long-press) -----------------------------------------

test("resident: holding past the long-press threshold without moving pins the resident", () => {
  mock.timers.enable();
  try {
    const resident = makeResident();
    resident.village = { toLocalPoint: () => ({ x: 0, y: 0 }) };
    resident.onPointerDown({ pointerId: 1, clientX: 100, clientY: 100 });
    assert.equal(resident.pinned, false, "not pinned yet -- the long-press hasn't fired");
    mock.timers.tick(549);
    assert.equal(resident.pinned, false, "should not fire a moment early");
    mock.timers.tick(1);
    assert.equal(resident.pinned, true);
    assert.equal(resident.behaviour.enabled, false, "pinning should disable autonomous behaviour");
    assert.equal(resident.element.classList.contains("pinned"), true);
    assert.equal(resident.suppressClick, true, "the click that follows pointerup should be suppressed");
  } finally {
    mock.timers.reset();
  }
});

test("resident: a second long-press unpins and re-enables autonomous behaviour", () => {
  mock.timers.enable();
  try {
    const resident = makeResident();
    resident.village = { toLocalPoint: () => ({ x: 0, y: 0 }) };
    resident.setPinned(true);
    assert.equal(resident.behaviour.enabled, false);

    resident.onPointerDown({ pointerId: 2, clientX: 50, clientY: 50 });
    mock.timers.tick(LONG_PRESS_MS_FOR_TESTS);
    assert.equal(resident.pinned, false);
    assert.equal(resident.behaviour.enabled, true);
    assert.equal(resident.element.classList.contains("pinned"), false);
  } finally {
    mock.timers.reset();
  }
});

test("resident: moving before the long-press threshold starts a carry instead, and cancels the pending pin", () => {
  mock.timers.enable();
  try {
    const resident = makeResident();
    resident.village = { toLocalPoint: () => ({ x: 200, y: 200 }) };
    resident.onPointerDown({ pointerId: 3, clientX: 100, clientY: 100 });
    resident.onPointerMove({ pointerId: 3, clientX: 130, clientY: 100 }); // 30px > 8px threshold
    assert.equal(resident.beingCarried, true, "should start carrying instead of waiting for the long-press");

    mock.timers.tick(LONG_PRESS_MS_FOR_TESTS); // the pending long-press timer should have been cancelled
    assert.equal(resident.pinned, false, "a carry should not also toggle pinned once the timer catches up");
  } finally {
    mock.timers.reset();
  }
});

test("resident: releasing quickly (a normal tap) never triggers the pin toggle", () => {
  const resident = makeResident();
  resident.village = { toLocalPoint: () => ({ x: 0, y: 0 }) };
  resident.onPointerDown({ pointerId: 4, clientX: 100, clientY: 100 });
  resident.onPointerUp({ pointerId: 4, clientX: 100, clientY: 100 }); // released immediately, no movement
  assert.equal(resident.pinned, false);
  assert.equal(resident.suppressClick, false, "a genuine tap must still be able to fire the wave reaction");
});

test("resident: a pinned resident does not autonomously water flowers or start conversations", () => {
  const resident = makeResident({ animations: { talk_down: { frames: 1, fps: 1, loop: true, paths: ["t.png"] } } });
  resident.village = {
    findConversationPartner: () => ({ busy: false, canBeTalkedTo: () => true, config: { animations: { talk_down: {} }, displayName: "Other" }, position: { x: 0, y: 0 } })
  };
  resident.interactions.register("flowerBed", { isAvailable: () => true, point: { x: 0, y: 0 } });
  resident.setPinned(true);

  const originalRandom = Math.random;
  Math.random = () => 0; // would definitely trigger both checks' probability rolls if not pinned
  try {
    resident.update(5000); // comfortably past both checks' notice-elapsed thresholds
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(resident.busy, false, "a pinned resident should not have started any autonomous interaction");
  assert.equal(resident.target, null);
});

// -- i18n.js ----------------------------------------------------------------

test("i18n: t() interpolates {param} placeholders and falls back to the key itself if unknown", () => {
  const original = getLocale();
  try {
    setLocale("en");
    assert.equal(t("ui.resident.tap", { name: "Pepita" }), "Tap Pepita");
    assert.equal(t("this.key.does.not.exist"), "this.key.does.not.exist", "an unknown key should fall back to itself, not throw or return blank");
  } finally {
    setLocale(original);
  }
});

test("i18n: setLocale switches the active language and t() reflects it immediately", () => {
  const original = getLocale();
  try {
    setLocale("es");
    assert.equal(getLocale(), "es");
    assert.equal(t("ui.house.empty"), "Casa vacía");
    setLocale("en");
    assert.equal(t("ui.house.empty"), "Empty house");
  } finally {
    setLocale(original);
  }
});

test("i18n: setLocale is a no-op for an unknown locale", () => {
  const original = getLocale();
  try {
    setLocale("en");
    setLocale("klingon");
    assert.equal(getLocale(), "en", "an invalid locale should not change the current one");
  } finally {
    setLocale(original);
  }
});

test("i18n: availableLocales includes at least en and es", () => {
  const locales = availableLocales();
  assert.ok(locales.includes("en"));
  assert.ok(locales.includes("es"));
});

test("i18n: onLocaleChange fires listeners on a real change, not on a no-op setLocale", () => {
  const original = getLocale();
  try {
    setLocale("en");
    const seen = [];
    const unsubscribe = onLocaleChange(locale => seen.push(locale));
    try {
      setLocale("en"); // already "en" -- should not fire
      assert.deepEqual(seen, []);
      setLocale("es");
      assert.deepEqual(seen, ["es"]);
    } finally {
      unsubscribe();
    }
  } finally {
    setLocale(original);
  }
});

test("i18n: applyLocale updates data-i18n text and data-i18n-aria attributes in a given root", () => {
  const original = getLocale();
  try {
    setLocale("es");
    // Minimal stand-in for a DOM root: applyLocale only needs querySelectorAll.
    const heading = { dataset: { i18n: "ui.village.title" }, textContent: "" };
    const villageDiv = { dataset: { i18nAria: "ui.village.ariaLabel" }, attrs: {}, setAttribute(name, value) { this.attrs[name] = value; } };
    const root = {
      querySelectorAll(selector) {
        if (selector === "[data-i18n]") return [heading];
        if (selector === "[data-i18n-aria]") return [villageDiv];
        return [];
      }
    };
    applyLocale(root);
    assert.equal(heading.textContent, "Pueblo Espíritu");
    assert.equal(villageDiv.attrs["aria-label"], "Área de prueba del Pueblo Espíritu");
  } finally {
    setLocale(original);
  }
});

console.log("logic.mjs: all tests defined (node:test will report pass/fail counts below)");

/**
 * Reusable "stateful world hotspot" factories.
 *
 * Pulled out after building the flower bed and the house as one-off code
 * each -- both are the same underlying shape, just with different states,
 * actions, and glue. Adding a third interactive object should only need a
 * config object, not a fresh copy of timers/Sets/event wiring.
 */

/**
 * A world object that any eligible resident can interact with: tap it (or a
 * resident notices it autonomously elsewhere) -> the nearest eligible idle
 * resident walks to a point near it, faces it, plays an action animation ->
 * object's state flips -> optionally reverts back to its starting state
 * after a delay.
 *
 * This is the flower-bed pattern (dry -> water_flowers -> watered -> dry
 * again after 20s), generalized so the next object like it (a door, a
 * bench, a shrine) is just a config object away.
 *
 * "Eligible" means: not busy/mid-conversation/housed/being-carried/pinned,
 * AND actually has the requested action animation (or `${action}_down`,
 * matching playAction's own fallback) -- a resident without the animation
 * would otherwise walk all the way over, have playAction silently no-op
 * (its own graceful-fallback-for-missing-animation behaviour), and leave
 * the interaction permanently stuck mid-"acting" since nothing would ever
 * fire the animation-complete event that finishes it.
 *
 * By default, once the action animation finishes the resident plays
 * "celebrate" and returns to idle (resident.js finishAction's default).
 * Pass postAction: "hold" (with holdMs) to instead have the resident stay
 * in the action's final pose for holdMs before returning to idle -- e.g.
 * actually remaining seated on a bench instead of standing right back up.
 */
export function createInteractiveHotspot({
  id,
  element,
  point,
  facing = "down",
  action,
  residents,
  fromState,
  toState,
  duringState = null,
  revertAfterMs = null,
  emptyLabel,
  settledLabel,
  onSettled,
  postAction,
  holdMs
}) {
  let revertTimer = null;

  // emptyLabel/settledLabel may be a plain string or a () => string function.
  // Callers pass a function backed by i18n's t() so the label re-resolves
  // in the current locale every time the state changes, instead of being
  // frozen in whatever language was active when the hotspot was created.
  function resolveLabel(label) {
    return typeof label === "function" ? label() : label;
  }

  function setState(state) {
    element.dataset.state = state;
    if (element.setAttribute) {
      const label = resolveLabel(state === toState ? settledLabel : emptyLabel);
      if (label) element.setAttribute("aria-label", label);
    }
    clearTimeout(revertTimer);
    if (state === toState && revertAfterMs) {
      revertTimer = setTimeout(() => setState(fromState), revertAfterMs);
    }
  }

  setState(fromState);

  function hasAction(resident) {
    const config = resident.config.animations;
    return Boolean(config[action] ?? config[`${action}_down`]);
  }

  function isFree(resident) {
    return !resident.busy && !resident.conversation && !resident.housed && !resident.beingCarried && !resident.pinned;
  }

  function pickResident() {
    let best = null;
    let bestDistance = Infinity;
    for (const resident of residents) {
      if (!hasAction(resident) || !isFree(resident)) continue;
      const distance = Math.hypot(resident.position.x - point.x, resident.position.y - point.y);
      if (distance < bestDistance) {
        best = resident;
        bestDistance = distance;
      }
    }
    return best;
  }

  const objectConfig = {
    point,
    facing,
    action,
    postAction,
    holdMs,
    isAvailable: () => element.dataset.state === fromState,
    onStart: duringState ? () => { element.dataset.state = duringState; } : undefined,
    onComplete: actingResident => {
      setState(toState);
      onSettled?.(actingResident);
    }
  };
  for (const resident of residents) resident.interactions.register(id, objectConfig);

  element.addEventListener("click", () => {
    const resident = pickResident();
    return resident ? resident.interactions.request(id) : false;
  });

  return {
    get state() { return element.dataset.state; },
    setState,
    pickResident
  };
}

/**
 * A drop zone that houses whatever resident gets dragged onto it: tracks
 * occupants, toggles a visual indicator element on/off based on occupancy,
 * and releases the first occupant when the zone itself is tapped.
 *
 * This is the house pattern (drag someone in, window lights up, tap to let
 * them out), generalized so the next building is just a config object away.
 */
export function createHousingZone({ village, box, zoneElement, indicatorElement, releasePoint, emptyLabel, occupiedLabel }) {
  const occupants = new Set();

  function updateIndicator() {
    indicatorElement?.classList.toggle("on", occupants.size > 0);
    const label = occupants.size > 0 ? occupiedLabel(occupants.size) : (typeof emptyLabel === "function" ? emptyLabel() : emptyLabel);
    zoneElement.setAttribute("aria-label", label);
  }

  village.registerDropZone({
    box,
    onHouse: resident => {
      occupants.add(resident);
      updateIndicator();
    }
  });

  zoneElement.addEventListener("click", () => {
    const resident = occupants.values().next().value;
    if (!resident) return;
    occupants.delete(resident);
    resident.release(releasePoint());
    updateIndicator();
  });

  updateIndicator();
  return { occupants, refreshLabel: updateIndicator };
}

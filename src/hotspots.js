/**
 * Reusable "stateful world hotspot" factories.
 *
 * Pulled out after building the flower bed and the house as one-off code
 * each -- both are the same underlying shape, just with different states,
 * actions, and glue. Adding a third interactive object should only need a
 * config object, not a fresh copy of timers/Sets/event wiring.
 */

/**
 * A world object that one resident interacts with: tap it (or the resident
 * notices it autonomously elsewhere) -> resident walks to a point near it,
 * faces it, plays an action animation -> object's state flips -> optionally
 * reverts back to its starting state after a delay.
 *
 * This is the flower-bed pattern (dry -> water_flowers -> watered -> dry
 * again after 20s), generalized so the next object like it (a door, a
 * bench, a shrine) is just a config object away.
 */
export function createInteractiveHotspot({
  id,
  element,
  point,
  facing = "down",
  action,
  resident,
  fromState,
  toState,
  duringState = null,
  revertAfterMs = null,
  emptyLabel,
  settledLabel,
  onSettled
}) {
  let revertTimer = null;

  function setState(state) {
    element.dataset.state = state;
    if (element.setAttribute) {
      const label = state === toState ? settledLabel : emptyLabel;
      if (label) element.setAttribute("aria-label", label);
    }
    clearTimeout(revertTimer);
    if (state === toState && revertAfterMs) {
      revertTimer = setTimeout(() => setState(fromState), revertAfterMs);
    }
  }

  setState(fromState);

  resident.interactions.register(id, {
    point,
    facing,
    action,
    isAvailable: () => element.dataset.state === fromState,
    onStart: duringState ? () => { element.dataset.state = duringState; } : undefined,
    onComplete: () => {
      setState(toState);
      onSettled?.();
    }
  });

  element.addEventListener("click", () => resident.interactions.request(id));

  return {
    get state() { return element.dataset.state; },
    setState
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
    zoneElement.setAttribute("aria-label", occupants.size > 0 ? occupiedLabel(occupants.size) : emptyLabel);
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
  return { occupants };
}

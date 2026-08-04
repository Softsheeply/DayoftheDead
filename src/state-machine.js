export const STATE_PRIORITY = [
  "disabled", "falling", "performingAction", "talking", "dancing",
  "skipping", "walking", "sitting", "sleeping", "idle"
];

export class CharacterStateMachine extends EventTarget {
  constructor(initial = "idle") {
    super();
    this.state = initial;
    this.locked = false;
  }

  transition(next, { force = false, lock = false } = {}) {
    if (!STATE_PRIORITY.includes(next)) throw new Error(`Unknown state: ${next}`);
    if (this.locked && !force) return false;
    const previous = this.state;
    this.state = next;
    this.locked = lock;
    this.dispatchEvent(new CustomEvent("change", { detail: { previous, next } }));
    return true;
  }

  unlock(next = "idle") {
    this.locked = false;
    return this.transition(next, { force: true });
  }
}

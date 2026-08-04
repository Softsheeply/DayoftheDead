export class CharacterBehaviourController {
  constructor(resident, behaviours) {
    this.resident = resident;
    this.behaviours = behaviours;
    this.enabled = true;
    this.remaining = this.nextDelay();
  }

  nextDelay() { return 2000 + Math.random() * 4000; }

  update(deltaMs) {
    if (!this.enabled || this.resident.busy) return;
    this.remaining -= deltaMs;
    if (this.remaining > 0) return;
    this.remaining = this.nextDelay();
    const roll = Math.random();
    let cursor = 0;
    const selected = this.behaviours.find(item => (cursor += item.weight) >= roll) ?? this.behaviours[0];
    this.resident.performBehaviour(selected.action);
  }

  postpone(ms = 2500) { this.remaining = ms; }
}

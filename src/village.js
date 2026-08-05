export class Village {
  constructor() {
    this.residents = [];
  }

  register(resident) {
    resident.village = this;
    this.residents.push(resident);
  }

  update(deltaMs) {
    for (const resident of this.residents) resident.update(deltaMs);
  }

  distanceBetween(a, b) {
    return Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
  }

  findConversationPartner(resident, maxDistance = 220) {
    let closest = null;
    let closestDistance = maxDistance;
    for (const other of this.residents) {
      if (other === resident) continue;
      if (other.busy || !other.canBeTalkedTo?.()) continue;
      const distance = this.distanceBetween(resident, other);
      if (distance < closestDistance) {
        closest = other;
        closestDistance = distance;
      }
    }
    return closest;
  }
}

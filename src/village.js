export class Village {
  constructor(villageEl) {
    this.residents = [];
    this.villageEl = villageEl;
    this.dropZones = [];
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

  // -- Carry / drop zones ----------------------------------------------------

  toLocalPoint(clientX, clientY) {
    const rect = this.villageEl.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  registerDropZone(zone) {
    this.dropZones.push(zone);
  }

  findDropZone(point, resident) {
    return this.dropZones.find(zone => {
      if (zone.accepts && !zone.accepts(resident)) return false;
      const box = zone.box;
      return point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height;
    });
  }
}

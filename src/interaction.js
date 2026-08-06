export class CharacterInteractionController {
  constructor(resident) {
    this.resident = resident;
    this.objects = new Map();
  }

  register(id, config) { this.objects.set(id, config); }

  isAvailable(id) {
    const object = this.objects.get(id);
    return Boolean(object) && !this.resident.busy && (object.isAvailable ? object.isAvailable() : true);
  }

  request(id) {
    const object = this.objects.get(id);
    if (!object || !this.isAvailable(id)) return false;
    this.resident.beginInteractionApproach(id, object);
    return true;
  }

  resolve(id) {
    const object = this.objects.get(id);
    if (!object) return;
    this.resident.direction = object.facing ?? this.resident.direction;
    object.onStart?.(this.resident);
    this.resident.playAction(object.action, { reaction: false, interactionId: id });
  }

  complete(id) {
    const object = this.objects.get(id);
    object?.onComplete?.(this.resident);
  }
}

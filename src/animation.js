export class AnimationEventDispatcher extends EventTarget {
  emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
    this.dispatchEvent(new CustomEvent("animationevent", { detail: { name, ...detail } }));
  }
}

export class CharacterAnimationController extends EventTarget {
  constructor(config, image, dispatcher = new AnimationEventDispatcher()) {
    super();
    this.config = config;
    this.image = image;
    this.dispatcher = dispatcher;
    this.name = "idle_down";
    this.frame = 0;
    this.elapsed = 0;
    this.playing = true;
    this.fpsOverride = null;
    this.loopOverride = null;
    this.firedEvents = new Set();
    this.render();
  }

  get definition() { return this.config.animations[this.name]; }
  get fps() { return this.fpsOverride ?? this.definition.fps; }
  get loop() { return this.loopOverride ?? this.definition.loop; }

  play(name, { restart = true } = {}) {
    if (!this.config.animations[name]) throw new Error(`Animation not found: ${name}`);
    if (name !== this.name || restart) {
      this.name = name;
      this.frame = 0;
      this.elapsed = 0;
      this.firedEvents.clear();
    }
    this.playing = true;
    this.render();
    this.emitChange();
  }

  pause() { this.playing = false; this.emitChange(); }
  resume() { this.playing = true; this.emitChange(); }

  setFrame(frame, triggerEvent = false) {
    this.frame = Math.max(0, Math.min(frame, this.definition.frames - 1));
    if (triggerEvent) this.triggerCurrentEvent(true);
    this.render();
    this.emitChange();
  }

  step() { this.setFrame((this.frame + 1) % this.definition.frames, true); }

  update(deltaMs) {
    if (!this.playing || !this.definition) return;
    this.elapsed += deltaMs;
    const frameDuration = 1000 / this.fps;
    while (this.elapsed >= frameDuration) {
      this.elapsed -= frameDuration;
      const next = this.frame + 1;
      if (next >= this.definition.frames) {
        if (this.loop) {
          this.frame = 0;
          this.firedEvents.clear();
        } else {
          this.frame = this.definition.frames - 1;
          this.playing = false;
          this.dispatchEvent(new CustomEvent("complete", { detail: { animation: this.name } }));
        }
      } else this.frame = next;
      this.triggerCurrentEvent();
      this.render();
      this.emitChange();
      if (!this.playing) break;
    }
  }

  triggerCurrentEvent(force = false) {
    const eventName = this.definition.events?.[String(this.frame)];
    const key = `${this.name}:${this.frame}:${eventName}`;
    if (eventName && (force || !this.firedEvents.has(key))) {
      this.firedEvents.add(key);
      this.dispatcher.emit(eventName, { animation: this.name, frame: this.frame });
    }
  }

  render() { this.image.src = `./assets/characters/pepita/${this.definition.paths[this.frame]}`; }
  emitChange() { this.dispatchEvent(new CustomEvent("change")); }
}

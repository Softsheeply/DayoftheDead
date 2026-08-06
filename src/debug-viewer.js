export class AnimationDebugViewer {
  constructor(root, residents) {
    this.root = root;
    this.residents = Array.isArray(residents) ? residents : [residents];
    this.resident = this.residents[0];
    this.flags = { anchor: true, collision: false, interaction: false };
    this.render();
    this.bind();
    this.detach = this.attachListeners(this.resident);
  }

  attachListeners(resident) {
    const onAnimChange = () => this.refresh();
    const onStateChange = () => this.refresh();
    const onEvent = event => this.logEvent(event.detail);
    resident.animation.addEventListener("change", onAnimChange);
    resident.stateMachine.addEventListener("change", onStateChange);
    resident.addEventListener("animationevent", onEvent);
    return () => {
      resident.animation.removeEventListener("change", onAnimChange);
      resident.stateMachine.removeEventListener("change", onStateChange);
      resident.removeEventListener("animationevent", onEvent);
    };
  }

  switchTo(resident) {
    if (resident === this.resident) return;
    this.detach?.();
    delete this.resident.element.dataset.guides;
    this.resident = resident;
    this.render();
    this.bind();
    this.detach = this.attachListeners(this.resident);
  }

  render() {
    const names = Object.keys(this.resident.config.animations);
    this.root.innerHTML = `
      <p class="eyebrow">Developer tool</p><h2>Animation viewer</h2>
      <label>Character<select id="character-select">${this.residents.map(r => `<option value="${r.config.id}" ${r === this.resident ? "selected" : ""}>${r.config.displayName}</option>`).join("")}</select></label>
      <label>Animation<select id="animation-select">${names.map(name => `<option>${name}</option>`).join("")}</select></label>
      <label>Direction<select id="direction-select"><option>down</option><option>left</option><option>right</option><option>up</option></select></label>
      <label>FPS <output id="fps-value">6</output><input id="fps" type="range" min="1" max="24" value="6" /></label>
      <div class="button-row"><button id="play-pause">Pause</button><button id="step">Next frame</button><button id="trigger">Trigger event</button></div>
      <label class="check"><input id="loop" type="checkbox" checked /> Loop</label>
      <label class="check"><input data-flag="anchor" type="checkbox" checked /> Show anchor point</label>
      <label class="check"><input data-flag="collision" type="checkbox" /> Show collision box</label>
      <label class="check"><input data-flag="interaction" type="checkbox" /> Show interaction point</label>
      <div id="readout" class="readout"></div>
      <div><strong>Event log</strong><ol id="event-log" class="event-log"><li>No events yet</li></ol></div>`;
    this.characterSelect = this.root.querySelector("#character-select");
    this.select = this.root.querySelector("#animation-select");
    this.direction = this.root.querySelector("#direction-select");
    this.fps = this.root.querySelector("#fps");
    this.loop = this.root.querySelector("#loop");
    this.readout = this.root.querySelector("#readout");
  }

  bind() {
    this.characterSelect.addEventListener("change", () => {
      const resident = this.residents.find(r => r.config.id === this.characterSelect.value);
      if (resident) this.switchTo(resident);
    });
    this.select.addEventListener("change", () => this.chooseAnimation());
    this.direction.addEventListener("change", () => this.chooseAnimation(true));
    this.fps.addEventListener("input", () => {
      this.resident.animation.fpsOverride = Number(this.fps.value);
      this.root.querySelector("#fps-value").value = this.fps.value;
      this.refresh();
    });
    this.loop.addEventListener("change", () => { this.resident.animation.loopOverride = this.loop.checked; this.refresh(); });
    this.root.querySelector("#play-pause").addEventListener("click", event => {
      const animation = this.resident.animation;
      animation.playing ? animation.pause() : animation.resume();
      event.currentTarget.textContent = animation.playing ? "Pause" : "Play";
    });
    this.root.querySelector("#step").addEventListener("click", () => { this.resident.animation.pause(); this.resident.animation.step(); });
    this.root.querySelector("#trigger").addEventListener("click", () => this.resident.animation.triggerCurrentEvent(true));
    this.root.querySelectorAll("[data-flag]").forEach(input => input.addEventListener("change", () => {
      this.flags[input.dataset.flag] = input.checked;
      this.resident.element.dataset.guides = Object.entries(this.flags).filter(([, on]) => on).map(([name]) => name).join(" ");
    }));
    this.resident.element.dataset.guides = "anchor";
    this.refresh();
  }

  chooseAnimation(preferDirection = false) {
    let name = this.select.value;
    const base = name.replace(/_(down|left|right|up)$/, "");
    const directed = `${base}_${this.direction.value}`;
    if (preferDirection && this.resident.config.animations[directed]) name = directed;
    this.select.value = name;
    this.resident.behaviour.enabled = false;
    this.resident.target = null;
    this.resident.animation.fpsOverride = null;
    this.resident.animation.loopOverride = null;
    this.resident.animation.play(name);
    this.fps.value = this.resident.animation.fps;
    this.root.querySelector("#fps-value").value = this.resident.animation.fps;
    this.loop.checked = this.resident.animation.loop;
  }

  refresh() {
    const animation = this.resident.animation;
    this.select.value = animation.name;
    this.readout.innerHTML = `Character: ${this.resident.config.displayName}<br>State: ${this.resident.stateMachine.state}<br>Animation: ${animation.name}<br>Frame: ${String(animation.frame).padStart(2, "0")} / ${String(animation.definition.frames).padStart(2, "0")}<br>FPS: ${animation.fps}`;
  }

  logEvent(detail) {
    const log = this.root.querySelector("#event-log");
    if (log.textContent.includes("No events")) log.innerHTML = "";
    log.insertAdjacentHTML("afterbegin", `<li><strong>${detail.name}</strong> · ${detail.animation} frame ${detail.frame}</li>`);
    while (log.children.length > 4) log.lastElementChild.remove();
  }
}

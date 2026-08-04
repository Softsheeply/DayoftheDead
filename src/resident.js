import { CharacterAnimationController, AnimationEventDispatcher } from "./animation.js";
import { CharacterStateMachine } from "./state-machine.js";
import { CharacterBehaviourController } from "./behaviour.js";

export class AnimatedResident extends EventTarget {
  constructor(config, element, image, speech, bounds) {
    super();
    this.config = config;
    this.element = element;
    this.speech = speech;
    this.bounds = bounds;
    this.position = { x: bounds.width * 0.52, y: bounds.height * 0.62 };
    this.target = null;
    this.direction = config.defaultDirection;
    this.stateMachine = new CharacterStateMachine();
    this.events = new AnimationEventDispatcher();
    this.animation = new CharacterAnimationController(config, image, this.events);
    this.behaviour = new CharacterBehaviourController(this, config.personality.autonomousBehaviours);
    this.busy = false;
    this.actionTimer = null;
    this.element.addEventListener("click", () => this.onTap());
    this.animation.addEventListener("complete", () => this.finishAction());
    this.events.addEventListener("animationevent", event => this.dispatchEvent(new CustomEvent("animationevent", { detail: event.detail })));
    this.renderPosition();
  }

  update(deltaMs) {
    this.animation.update(deltaMs);
    this.behaviour.update(deltaMs);
    if (this.target) this.updateMovement(deltaMs);
  }

  performBehaviour(action) {
    if (action === "idle") return this.setIdle();
    if (action === "walk" || action === "skip") return this.moveRandomly(action);
    if (action === "smell_flowers" || action === "arrange_bouquet" || action === "wave") return this.playAction(action);
  }

  moveRandomly(kind = "walk") {
    const margin = 76;
    this.target = {
      x: margin + Math.random() * (this.bounds.width - margin * 2),
      y: this.bounds.height * 0.48 + Math.random() * (this.bounds.height * 0.36)
    };
    this.movementKind = kind;
    this.busy = true;
    this.stateMachine.transition(kind === "skip" ? "skipping" : "walking");
    this.updateDirection();
    this.animation.play(`${kind}_${this.direction}`);
  }

  updateDirection() {
    if (!this.target) return;
    const dx = this.target.x - this.position.x;
    const dy = this.target.y - this.position.y;
    this.direction = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
  }

  updateMovement(deltaMs) {
    const dx = this.target.x - this.position.x;
    const dy = this.target.y - this.position.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 2) {
      this.position = this.target;
      this.target = null;
      this.busy = false;
      this.setIdle();
      return;
    }
    const speed = this.movementKind === "skip" ? this.config.movement.skipSpeed : this.config.movement.walkSpeed;
    const step = Math.min(distance, speed * deltaMs / 1000);
    this.position.x += dx / distance * step;
    this.position.y += dy / distance * step;
    this.renderPosition();
  }

  playAction(action, { reaction = false } = {}) {
    this.target = null;
    this.busy = true;
    this.direction = "down";
    this.stateMachine.transition("performingAction", { lock: true });
    const name = this.config.animations[action] ? action : `${action}_down`;
    this.animation.play(name);
    if (reaction) {
      this.element.classList.add("reacting");
      this.showSpeech("¡Hola! Flowers make every day brighter.");
    }
  }

  finishAction() {
    if (!this.busy || this.target) return;
    this.element.classList.remove("reacting");
    this.busy = false;
    this.stateMachine.unlock("idle");
    this.setIdle();
  }

  setIdle() {
    this.target = null;
    this.busy = false;
    this.stateMachine.unlock("idle");
    this.animation.play(`idle_${this.direction}`);
  }

  onTap() {
    this.behaviour.postpone(4500);
    this.playAction("wave", { reaction: true });
  }

  showSpeech(message) {
    this.speech.textContent = message;
    this.speech.classList.add("visible");
    clearTimeout(this.speechTimer);
    this.speechTimer = setTimeout(() => this.speech.classList.remove("visible"), 2600);
  }

  renderPosition() {
    this.element.style.left = `${this.position.x}px`;
    this.element.style.top = `${this.position.y}px`;
    this.element.style.zIndex = String(Math.round(this.position.y));
    this.speech.style.left = `${this.position.x}px`;
    this.speech.style.top = `${this.position.y - 82}px`;
  }
}

import { CharacterAnimationController, AnimationEventDispatcher } from "./animation.js";
import { CharacterStateMachine } from "./state-machine.js";
import { CharacterBehaviourController } from "./behaviour.js";
import { CharacterNavigationController } from "./navigation.js";
import { CharacterInteractionController } from "./interaction.js";
import { CharacterExpressionController } from "./expression.js";

export class AnimatedResident extends EventTarget {
  constructor(config, element, image, speech, bounds, options = {}) {
    super();
    this.config = config;
    this.element = element;
    this.speech = speech;
    this.expressionIcon = options.expressionIcon;
    this.bounds = bounds;
    this.position = { x: bounds.width * 0.52, y: bounds.height * 0.62 };
    this.target = null;
    this.direction = config.defaultDirection;
    this.stateMachine = new CharacterStateMachine();
    this.events = new AnimationEventDispatcher();
    this.animation = new CharacterAnimationController(config, image, this.events);
    this.behaviour = new CharacterBehaviourController(this, config.personality.autonomousBehaviours);
    this.navigation = new CharacterNavigationController(bounds, options.obstacles ?? []);
    this.interactions = new CharacterInteractionController(this);
    this.expressions = new CharacterExpressionController(this);
    this.busy = false;
    this.pendingInteraction = null;
    this.flowerBedNoticeElapsed = 0;
    this.element.addEventListener("click", () => this.onTap());
    this.animation.addEventListener("complete", () => this.finishAction());
    this.events.addEventListener("animationevent", event => this.dispatchEvent(new CustomEvent("animationevent", { detail: event.detail })));
    this.renderPosition();
  }

  update(deltaMs) {
    this.animation.update(deltaMs);
    if (!this.busy) this.checkFlowerBed(deltaMs);
    this.behaviour.update(deltaMs);
    if (this.target) this.updateMovement(deltaMs);
  }

  checkFlowerBed(deltaMs) {
    if (!this.interactions.isAvailable("flowerBed")) return;
    this.flowerBedNoticeElapsed += deltaMs;
    if (this.flowerBedNoticeElapsed < 1500) return;
    this.flowerBedNoticeElapsed = 0;
    if (Math.random() < 0.12) this.interactions.request("flowerBed");
  }

  performBehaviour(action) {
    if (action === "idle") return this.setIdle();
    if (action === "walk" || action === "skip") return this.moveRandomly(action);
    if (action === "smell_flowers" || action === "arrange_bouquet" || action === "wave") return this.playAction(action);
  }

  moveRandomly(kind = "walk") {
    const point = this.navigation.randomPoint();
    if (!point) return this.setIdle();
    this.target = point;
    this.movementKind = kind;
    this.busy = true;
    this.stateMachine.transition(kind === "skip" ? "skipping" : "walking");
    this.updateDirection();
    this.animation.play(`${kind}_${this.direction}`);
  }

  beginInteractionApproach(id, object) {
    this.pendingInteraction = { id, stage: "approaching" };
    this.target = { ...object.point };
    this.movementKind = "walk";
    this.busy = true;
    this.stateMachine.transition("walking");
    this.updateDirection();
    this.animation.play(`walk_${this.direction}`);
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
      if (this.pendingInteraction?.stage === "approaching") {
        this.pendingInteraction.stage = "acting";
        this.interactions.resolve(this.pendingInteraction.id);
        return;
      }
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

  playAction(action, { reaction = false, interactionId = null } = {}) {
    this.target = null;
    this.busy = true;
    if (!interactionId) this.direction = "down";
    this.stateMachine.transition("performingAction", { lock: true });
    const name = this.config.animations[action] ? action : `${action}_down`;
    this.animation.play(name);
    if (reaction) {
      this.element.classList.add("reacting");
      this.expressions.set("happy");
      this.showSpeech("¡Hola! Flowers make every day brighter.");
    }
  }

  finishAction() {
    if (this.pendingInteraction?.stage === "acting") {
      const { id } = this.pendingInteraction;
      this.interactions.complete(id);
      this.pendingInteraction = null;
      this.expressions.set("excited");
      this.playAction("celebrate");
      return;
    }
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

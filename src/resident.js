import { CharacterAnimationController, AnimationEventDispatcher } from "./animation.js";
import { CharacterStateMachine } from "./state-machine.js";
import { CharacterBehaviourController } from "./behaviour.js";
import { CharacterNavigationController } from "./navigation.js";
import { CharacterInteractionController } from "./interaction.js";
import { CharacterExpressionController } from "./expression.js";
import { t } from "./i18n.js";

const CONVERSATION_DURATION_MS = 2600;
const CONVERSATION_STANDOFF = 62;
const LONG_PRESS_MS = 550;

export class AnimatedResident extends EventTarget {
  constructor(config, element, image, speech, bounds, options = {}) {
    super();
    this.config = config;
    this.element = element;
    this.speech = speech;
    this.expressionIcon = options.expressionIcon;
    this.bounds = bounds;
    this.position = options.spawn ?? { x: bounds.width * 0.52, y: bounds.height * 0.62 };
    this.target = null;
    this.pathQueue = null;
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
    this.conversation = null;
    this.village = null;
    this.flowerBedNoticeElapsed = 0;
    this.conversationNoticeElapsed = 0;
    this.beingCarried = false;
    this.housed = false;
    this.dragState = null;
    this.suppressClick = false;
    this.pinned = false;
    this.longPressTimer = null;
    // Bumped by anything that changes what the resident is currently doing
    // (playing an action, walking, talking, being housed...). holdAfterAction
    // captures the version at hold-start and checks it hasn't changed before
    // finalizing back to idle, so a hold can't clobber whatever interrupted it.
    this.actionVersion = 0;
    this.element.addEventListener("click", () => this.onTap());
    this.animation.addEventListener("complete", () => this.finishAction());
    this.events.addEventListener("animationevent", event => this.dispatchEvent(new CustomEvent("animationevent", { detail: event.detail })));
    this.handlePointerMove = event => this.onPointerMove(event);
    this.handlePointerUp = event => this.onPointerUp(event);
    this.element.addEventListener("pointerdown", event => this.onPointerDown(event));
    this.renderPosition();
  }

  update(deltaMs) {
    this.animation.update(deltaMs);
    if (this.conversation?.phase === "talking" && this.conversation.role === "initiator") {
      this.conversation.timer -= deltaMs;
      if (this.conversation.timer <= 0) this.endConversation();
    }
    if (!this.busy && !this.pinned) {
      this.checkFlowerBed(deltaMs);
      this.checkConversation(deltaMs);
    }
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

  // -- Carrying (pick up, drag, drop in a building) ------------------------

  canBeCarried() {
    return !this.busy && !this.conversation && !this.housed && !this.beingCarried;
  }

  onPointerDown(event) {
    if (!this.village || !this.canBeCarried()) return;
    this.dragState = { pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, moved: false, longPressed: false };
    try { this.element.setPointerCapture?.(event.pointerId); } catch { /* no active native pointer session to capture -- safe to ignore */ }
    this.element.addEventListener("pointermove", this.handlePointerMove);
    this.element.addEventListener("pointerup", this.handlePointerUp);
    this.element.addEventListener("pointercancel", this.handlePointerUp);
    this.longPressTimer = setTimeout(() => this.triggerLongPress(event.pointerId), LONG_PRESS_MS);
  }

  onPointerMove(event) {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) return;
    if (this.dragState.longPressed) return; // gesture already resolved as a long-press; ignore further movement
    const dx = event.clientX - this.dragState.startClientX;
    const dy = event.clientY - this.dragState.startClientY;
    if (!this.dragState.moved && Math.hypot(dx, dy) > 8) {
      clearTimeout(this.longPressTimer);
      this.beginCarry();
    }
    if (this.beingCarried) {
      this.position = this.village.toLocalPoint(event.clientX, event.clientY);
      this.renderPosition();
    }
  }

  // -- Pin / free-roam toggle (long-press, distinct from a tap or a drag) -

  triggerLongPress(pointerId) {
    if (!this.dragState || this.dragState.pointerId !== pointerId || this.dragState.moved) return;
    this.dragState.longPressed = true;
    this.suppressClick = true;
    this.setPinned(!this.pinned);
  }

  setPinned(pinned) {
    this.pinned = pinned;
    this.behaviour.enabled = !pinned;
    this.element.classList.toggle("pinned", pinned);
    this.expressions.set(pinned ? "sleepy" : "excited", { durationMs: 1400 });
    this.showSpeech(t(pinned ? "speech.resident.pinned" : "speech.resident.unpinned"));
  }

  beginCarry() {
    this.actionVersion += 1;
    this.dragState.moved = true;
    this.suppressClick = true;
    this.beingCarried = true;
    this.target = null;
    this.pathQueue = null;
    this.busy = true;
    this.behaviour.postpone(2000);
    this.stateMachine.transition("disabled", { force: true, lock: true });
    this.element.classList.add("carried");
  }

  onPointerUp(event) {
    clearTimeout(this.longPressTimer);
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) return;
    try { this.element.releasePointerCapture?.(event.pointerId); } catch { /* nothing was captured -- safe to ignore */ }
    this.element.removeEventListener("pointermove", this.handlePointerMove);
    this.element.removeEventListener("pointerup", this.handlePointerUp);
    this.element.removeEventListener("pointercancel", this.handlePointerUp);
    const wasCarried = this.beingCarried;
    this.dragState = null;
    if (!wasCarried) return;
    this.beingCarried = false;
    this.element.classList.remove("carried");
    const dropPoint = this.village.toLocalPoint(event.clientX, event.clientY);
    const zone = this.village.findDropZone(dropPoint, this);
    if (zone) {
      this.house(zone);
      return;
    }
    this.position = this.navigation.isWalkable(dropPoint.x, dropPoint.y) ? dropPoint : this.position;
    this.busy = false;
    this.stateMachine.unlock("idle");
    this.setIdle();
    this.renderPosition();
  }

  house(zone) {
    this.actionVersion += 1;
    this.housed = true;
    this.busy = true;
    this.target = null;
    this.pathQueue = null;
    this.stateMachine.transition("disabled", { force: true, lock: true });
    this.element.style.display = "none";
    this.speech.classList.remove("visible");
    zone.onHouse?.(this);
  }

  release(point) {
    this.housed = false;
    this.busy = false;
    this.element.style.display = "";
    this.position = point;
    this.stateMachine.unlock("idle");
    this.setIdle();
    this.renderPosition();
    this.expressions.set("happy");
    this.showSpeech(t("speech.resident.released"));
  }

  // -- Talking to another resident -----------------------------------------

  canBeTalkedTo() {
    return !this.busy && !this.conversation;
  }

  checkConversation(deltaMs) {
    if (!this.village || !this.config.animations.talk_down) return;
    this.conversationNoticeElapsed += deltaMs;
    if (this.conversationNoticeElapsed < 1800) return;
    this.conversationNoticeElapsed = 0;
    if (Math.random() >= 0.1) return;
    const partner = this.village.findConversationPartner(this);
    if (partner) this.talkTo(partner);
  }

  talkTo(other) {
    if (this.busy || this.conversation || other.busy || other.conversation) return;
    if (!this.config.animations.talk_down || !other.config.animations?.talk_down) return;
    this.actionVersion += 1;
    other.actionVersion += 1;
    this.behaviour.postpone(6000);
    other.behaviour.postpone(6000);
    const dx = other.position.x - this.position.x;
    const dy = other.position.y - this.position.y;
    const distance = Math.hypot(dx, dy) || 1;
    this.conversation = { role: "initiator", other, phase: "approaching" };
    other.conversation = { role: "partner", other: this, phase: "waiting" };
    other.busy = true;
    this.walkTo({
      x: other.position.x - (dx / distance) * CONVERSATION_STANDOFF,
      y: other.position.y - (dy / distance) * CONVERSATION_STANDOFF
    });
    this.movementKind = "walk";
    this.busy = true;
    this.stateMachine.transition("walking");
    this.updateDirection();
    this.animation.play(`walk_${this.direction}`);
  }

  beginTalking() {
    const other = this.conversation.other;
    this.faceToward(other.position);
    other.faceToward(this.position);
    this.conversation.phase = "talking";
    this.conversation.timer = CONVERSATION_DURATION_MS;
    other.conversation.phase = "talking";
    this.stateMachine.transition("talking", { lock: true });
    other.stateMachine.transition("talking", { lock: true });
    this.animation.play(`talk_${this.direction}`);
    other.animation.play(`talk_${other.direction}`);
    this.expressions.set("happy", { durationMs: CONVERSATION_DURATION_MS - 200 });
    other.expressions.set("happy", { durationMs: CONVERSATION_DURATION_MS - 200 });
    this.showSpeech(t("speech.resident.greet", { name: other.config.displayName }));
    other.showSpeech(t("speech.resident.greet", { name: this.config.displayName }));
  }

  endConversation() {
    const other = this.conversation?.other;
    this.conversation = null;
    this.busy = false;
    this.stateMachine.unlock("idle");
    this.setIdle();
    if (other) {
      other.conversation = null;
      other.busy = false;
      other.stateMachine.unlock("idle");
      other.setIdle();
    }
  }

  faceToward(point) {
    const dx = point.x - this.position.x;
    const dy = point.y - this.position.y;
    this.direction = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
  }

  // -- Generic behaviour / movement / actions ------------------------------

  performBehaviour(action) {
    if (action === "idle") return this.setIdle();
    if (action === "walk" || action === "skip") return this.moveRandomly(action);
    if (action === "smell_flowers" || action === "arrange_bouquet" || action === "wave") return this.playAction(action);
  }

  moveRandomly(kind = "walk") {
    const point = this.navigation.randomPoint();
    if (!point) return this.setIdle();
    this.actionVersion += 1;
    this.walkTo(point);
    this.movementKind = kind;
    this.busy = true;
    this.stateMachine.transition(kind === "skip" ? "skipping" : "walking");
    this.updateDirection();
    this.animation.play(`${kind}_${this.direction}`);
  }

  beginInteractionApproach(id, object) {
    this.actionVersion += 1;
    this.pendingInteraction = { id, stage: "approaching" };
    this.walkTo(object.point);
    this.movementKind = "walk";
    this.busy = true;
    this.stateMachine.transition("walking");
    this.updateDirection();
    this.animation.play(`walk_${this.direction}`);
  }

  // Route toward finalPoint via navigation.findApproachPath instead of a raw
  // straight line, so a walk doesn't visually cut through an obstacle that
  // happens to sit between the current position and the destination.
  walkTo(finalPoint) {
    const path = this.navigation.findApproachPath(this.position, finalPoint);
    this.target = path[0];
    this.pathQueue = path.slice(1);
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
      if (this.pathQueue?.length) {
        this.target = this.pathQueue.shift();
        this.updateDirection();
        this.animation.play(`${this.movementKind}_${this.direction}`);
        return; // more of this walk left -- don't resolve the interaction/conversation/idle yet
      }
      if (this.pendingInteraction?.stage === "approaching") {
        this.pendingInteraction.stage = "acting";
        this.interactions.resolve(this.pendingInteraction.id);
        return;
      }
      if (this.conversation?.phase === "approaching") {
        this.beginTalking();
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
    const name = this.config.animations[action] ? action : `${action}_down`;
    if (!this.config.animations[name]) {
      // This resident doesn't have this action animation (e.g. a minimal
      // placeholder character) -- show the reaction without changing pose
      // instead of throwing.
      if (reaction) {
        this.expressions.set("happy");
        this.showSpeech(t("speech.resident.greetFallback", { name: this.config.displayName }));
      }
      return;
    }
    this.actionVersion += 1;
    this.target = null;
    this.pathQueue = null;
    this.busy = true;
    if (!interactionId) this.direction = "down";
    this.stateMachine.transition("performingAction", { lock: true });
    this.animation.play(name);
    if (reaction) {
      this.element.classList.add("reacting");
      this.expressions.set("happy");
      this.showSpeech(t("speech.resident.greetFlowers"));
    }
  }

  finishAction() {
    if (this.pendingInteraction?.stage === "acting") {
      const { id } = this.pendingInteraction;
      const object = this.interactions.objects.get(id);
      this.interactions.complete(id);
      this.pendingInteraction = null;
      const postAction = object?.postAction ?? "celebrate";
      if (postAction === "hold") {
        this.holdAfterAction(object?.holdMs ?? 1500);
        return;
      }
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

  // Stay in the just-completed action's final pose (e.g. sitting) for holdMs
  // instead of immediately celebrating and standing back up. Guarded by
  // actionVersion so an interruption (tapped, carried, dragged into the
  // house, started talking...) during the hold can't get clobbered when the
  // hold's timer eventually fires.
  holdAfterAction(holdMs) {
    const version = this.actionVersion;
    clearTimeout(this.holdTimer);
    this.holdTimer = setTimeout(() => {
      if (this.actionVersion !== version) return;
      this.busy = false;
      this.stateMachine.unlock("idle");
      this.setIdle();
    }, holdMs);
  }

  setIdle() {
    this.target = null;
    this.pathQueue = null;
    this.busy = false;
    this.stateMachine.unlock("idle");
    this.animation.play(`idle_${this.direction}`);
  }

  onTap() {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
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

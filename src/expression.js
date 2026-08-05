const EXPRESSION_ICONS = {
  happy: "😊", excited: "✨", sad: "😢", angry: "😠", scared: "😨",
  surprised: "😮", confused: "😕", love: "🥰", laughing: "😄", sleepy: "😴"
};

export class CharacterExpressionController {
  constructor(resident) {
    this.resident = resident;
    this.current = null;
  }

  set(expression, { durationMs = 1600 } = {}) {
    if (!EXPRESSION_ICONS[expression]) throw new Error(`Unknown expression: ${expression}`);
    this.current = expression;
    this.resident.element.dataset.expression = expression;
    this.resident.expressionIcon.textContent = EXPRESSION_ICONS[expression];
    clearTimeout(this.timer);
    if (durationMs) this.timer = setTimeout(() => this.clear(), durationMs);
  }

  clear() {
    this.current = null;
    delete this.resident.element.dataset.expression;
    this.resident.expressionIcon.textContent = "";
  }
}

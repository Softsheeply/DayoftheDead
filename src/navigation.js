export class CharacterNavigationController {
  constructor(bounds, obstacles = [], options = {}) {
    this.bounds = bounds;
    this.obstacles = obstacles;
    this.margin = options.margin ?? 76;
    this.topRatio = options.topRatio ?? 0.48;
    this.bottomRatio = options.bottomRatio ?? 0.84;
    this.footPadding = options.footPadding ?? 16;
  }

  setBounds(bounds) { this.bounds = bounds; }
  setObstacles(obstacles) { this.obstacles = obstacles; }

  inNavArea(x, y) {
    if (x < this.margin || x > this.bounds.width - this.margin) return false;
    if (y < this.bounds.height * this.topRatio || y > this.bounds.height * this.bottomRatio) return false;
    return true;
  }

  inObstacle(x, y, box) {
    return x > box.x - this.footPadding && x < box.x + box.width + this.footPadding &&
      y > box.y - this.footPadding && y < box.y + box.height + this.footPadding;
  }

  isWalkable(x, y) {
    if (!this.inNavArea(x, y)) return false;
    return !this.obstacles.some(box => this.inObstacle(x, y, box));
  }

  randomPoint(maxAttempts = 24) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const x = this.margin + Math.random() * (this.bounds.width - this.margin * 2);
      const y = this.bounds.height * this.topRatio + Math.random() * (this.bounds.height * (this.bottomRatio - this.topRatio));
      if (this.isWalkable(x, y)) return { x, y };
    }
    return null;
  }

  clampPath(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) return to;
    const steps = Math.max(1, Math.ceil(distance / 6));
    let last = { ...from };
    for (let step = 1; step <= steps; step += 1) {
      const point = { x: from.x + (dx * step) / steps, y: from.y + (dy * step) / steps };
      if (!this.isWalkable(point.x, point.y)) return last;
      last = point;
    }
    return to;
  }
}

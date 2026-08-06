export class CharacterNavigationController {
  constructor(bounds, obstacles = [], options = {}) {
    this.bounds = bounds;
    this.obstacles = obstacles;
    // margin used to default to a fixed 76px regardless of viewport width.
    // .village's width is fluid (only height is fixed), so on a narrow
    // viewport that fixed margin ate a huge fraction of the usable space --
    // enough, combined with obstacle padding, to genuinely fragment the
    // walkable area into disconnected pockets that no pathfinder can
    // route between. Scale with width instead; an explicit options.margin
    // still overrides this if a caller wants a fixed value (tests do).
    this.margin = options.margin ?? bounds.width * (options.marginRatio ?? 0.07);
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

  // Like clampPath, but ignores the last endBufferPx of the approach. Hand-
  // placed interaction points (the bench's sit spot, the fountain's wish
  // spot...) are deliberately close to -- sometimes technically inside the
  // padded edge of, or just past the general wander band around -- their
  // object, which is correct by design, not something to route around. This
  // only cares whether the *approach* crosses something unrelated.
  pathIsClear(from, to, endBufferPx = 26) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= endBufferPx) return true;
    const checkDistance = distance - endBufferPx;
    const steps = Math.max(1, Math.ceil(checkDistance / 6));
    for (let step = 1; step <= steps; step += 1) {
      const t = (step / steps) * (checkDistance / distance);
      const point = { x: from.x + dx * t, y: from.y + dy * t };
      if (!this.isWalkable(point.x, point.y)) return false;
    }
    return true;
  }

  // Cheap first attempt: a single lateral waypoint offset from a handful of
  // points along the line, at a few distances on both sides. Handles the
  // common "one obstacle in an otherwise open area" case without the cost
  // of a grid search. Returns null (not [to]) when it finds nothing, so the
  // caller knows to fall through to real pathfinding instead of treating
  // "no quick detour" as "no path exists at all".
  findQuickDetour(from, to, endBufferPx) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy) || 1;
    const perp = { x: -dy / distance, y: dx / distance };
    for (const alongT of [0.5, 0.35, 0.65, 0.2, 0.8]) {
      const anchor = { x: from.x + dx * alongT, y: from.y + dy * alongT };
      for (const offset of [90, -90, 160, -160, 230, -230]) {
        const waypoint = { x: anchor.x + perp.x * offset, y: anchor.y + perp.y * offset };
        if (!this.isWalkable(waypoint.x, waypoint.y)) continue;
        if (this.pathIsClear(from, waypoint, 0) && this.pathIsClear(waypoint, to, endBufferPx)) {
          return [waypoint, to];
        }
      }
    }
    return null;
  }

  // Coarse grid-based BFS pathfinder for anything findQuickDetour can't
  // solve (dense clusters, routes that have to go around more than one
  // obstacle). Not fancy -- unweighted 8-directional BFS over a fixed-size
  // cell grid, no A* heuristic -- but the village is small enough that this
  // is cheap, and it actually finds a path instead of just trying a couple
  // of candidate points and giving up.
  findGridPath(from, to, cellSize = 12) {
    const cols = Math.max(1, Math.ceil(this.bounds.width / cellSize));
    const rows = Math.max(1, Math.ceil(this.bounds.height / cellSize));
    const cellCenter = (col, row) => ({ x: col * cellSize + cellSize / 2, y: row * cellSize + cellSize / 2 });
    const toCell = p => ({
      col: Math.min(cols - 1, Math.max(0, Math.floor(p.x / cellSize))),
      row: Math.min(rows - 1, Math.max(0, Math.floor(p.y / cellSize)))
    });
    const cellWalkable = (col, row) => {
      const c = cellCenter(col, row);
      return this.isWalkable(c.x, c.y);
    };

    const startCell = toCell(from);
    if (!cellWalkable(startCell.col, startCell.row)) return null; // shouldn't normally happen -- `from` is where the resident already is

    let goalCell = toCell(to);
    if (!cellWalkable(goalCell.col, goalCell.row)) {
      // The literal destination cell isn't walkable -- common on purpose for
      // hand-placed interaction points sitting right at an obstacle's edge.
      // Search outward (expanding ring) for the nearest walkable cell and
      // pathfind to that instead; the final short hop from there to the
      // real `to` is covered by endBufferPx in findApproachPath.
      const found = this.nearestWalkableCell(goalCell, cellWalkable, cols, rows);
      if (!found) return null;
      goalCell = found;
    }

    const key = (c, r) => c * rows + r;
    const startKey = key(startCell.col, startCell.row);
    const goalKey = key(goalCell.col, goalCell.row);
    const cameFrom = new Map();
    const visited = new Set([startKey]);
    const queue = [startCell];
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    let reached = startKey === goalKey;

    for (let head = 0; head < queue.length && !reached; head += 1) {
      const { col, row } = queue[head];
      for (const [dc, dr] of directions) {
        const nc = col + dc;
        const nr = row + dr;
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
        // Disallow cutting a diagonal corner: if either of the two
        // orthogonal cells adjacent to this diagonal move isn't walkable,
        // the step would clip through it even though the destination cell
        // itself is clear.
        if (dc !== 0 && dr !== 0 && (!cellWalkable(col + dc, row) || !cellWalkable(col, row + dr))) continue;
        const k = key(nc, nr);
        if (visited.has(k) || !cellWalkable(nc, nr)) continue;
        visited.add(k);
        cameFrom.set(k, { col, row });
        if (k === goalKey) { reached = true; break; }
        queue.push({ col: nc, row: nr });
      }
    }
    if (!reached) return null;

    const cells = [goalCell];
    let cursor = goalKey;
    while (cursor !== startKey) {
      const prev = cameFrom.get(cursor);
      cells.push(prev);
      cursor = key(prev.col, prev.row);
    }
    cells.reverse();
    return cells.map(c => cellCenter(c.col, c.row));
  }

  // Expanding-ring search for the nearest walkable cell to an unwalkable
  // one, used when a pathfinding destination cell itself isn't walkable.
  nearestWalkableCell(cell, cellWalkable, cols, rows) {
    const maxRadius = Math.max(cols, rows);
    for (let radius = 1; radius <= maxRadius; radius += 1) {
      for (let dc = -radius; dc <= radius; dc += 1) {
        for (let dr = -radius; dr <= radius; dr += 1) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue; // only the ring's edge, already checked the interior at smaller radii
          const c = cell.col + dc;
          const r = cell.row + dr;
          if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
          if (cellWalkable(c, r)) return { col: c, row: r };
        }
      }
    }
    return null;
  }

  // Collapses a raw grid path (one waypoint per cell, often a long jagged
  // staircase) down to the few waypoints actually needed, by greedily
  // extending a straight line as far as it can go before needing to bend.
  smoothPath(from, gridWaypoints, to, endBufferPx) {
    const full = [from, ...gridWaypoints, to];
    const smoothed = [];
    let anchorIndex = 0;
    while (anchorIndex < full.length - 1) {
      let farthest = anchorIndex + 1;
      for (let candidate = full.length - 1; candidate > anchorIndex; candidate -= 1) {
        const buffer = candidate === full.length - 1 ? endBufferPx : 0;
        if (this.pathIsClear(full[anchorIndex], full[candidate], buffer)) { farthest = candidate; break; }
      }
      smoothed.push(full[farthest]);
      anchorIndex = farthest;
    }
    return smoothed;
  }

  // Full approach-routing entry point: direct line if it's clear (the
  // common case, unchanged), else a cheap single-waypoint detour, else a
  // real grid-pathfind-and-smooth. Falls back to the direct line only if
  // every one of those genuinely fails (e.g. the destination is inside a
  // fully enclosed area) -- better than leaving a resident stuck forever,
  // even though it means that rare case still visually cuts through
  // something.
  findApproachPath(from, to, endBufferPx = 26) {
    if (this.pathIsClear(from, to, endBufferPx)) return [to];
    const quick = this.findQuickDetour(from, to, endBufferPx);
    if (quick) return quick;
    const gridPath = this.findGridPath(from, to);
    if (gridPath) return this.smoothPath(from, gridPath, to, endBufferPx);
    return [to];
  }
}

/**
 * Raycasting and geometry utilities for 2D acoustic line-of-sight & wall occlusion
 */

/**
 * Extracts numeric [x, y] coordinates from an array, object, or entity.
 * Supports [x, y], { x, y }, or { coordinates: [x, y] }.
 */
function toPoint(pos) {
  if (!pos) return null;
  if (Array.isArray(pos) && pos.length >= 2) {
    const x = Number(pos[0]);
    const y = Number(pos[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
  }
  if (typeof pos === 'object') {
    if (Array.isArray(pos.coordinates) && pos.coordinates.length >= 2) {
      return toPoint(pos.coordinates);
    }
    if (Number.isFinite(Number(pos.x)) && Number.isFinite(Number(pos.y))) {
      return [Number(pos.x), Number(pos.y)];
    }
  }
  return null;
}

/**
 * Tests whether two 2D line segments (P0-P1 and P2-P3) intersect.
 * Includes an axis-aligned bounding box (AABB) early-rejection check.
 */
export function lineSegmentsIntersect(p0_x, p0_y, p1_x, p1_y, p2_x, p2_y, p3_x, p3_y) {
  const eps = 1e-5;
  if (
    Math.max(p0_x, p1_x) < Math.min(p2_x, p3_x) - eps ||
    Math.min(p0_x, p1_x) > Math.max(p2_x, p3_x) + eps ||
    Math.max(p0_y, p1_y) < Math.min(p2_y, p3_y) - eps ||
    Math.min(p0_y, p1_y) > Math.max(p2_y, p3_y) + eps
  ) {
    return false;
  }

  const s1_x = p1_x - p0_x;
  const s1_y = p1_y - p0_y;
  const s2_x = p3_x - p2_x;
  const s2_y = p3_y - p2_y;

  const denominator = -s2_x * s1_y + s1_x * s2_y;
  if (Math.abs(denominator) < 1e-5) {
    return false;
  }

  const s = (-s1_y * (p0_x - p2_x) + s1_x * (p0_y - p2_y)) / denominator;
  const t = (s2_x * (p0_y - p2_y) - s2_y * (p0_x - p2_x)) / denominator;

  return s >= 0 && s <= 1 && t >= 0 && t <= 1;
}

/**
 * Checks if acoustic walls occlude the line of sight between listener and speaker
 * @param {[number, number]|{x: number, y: number}} listenerPos - [x, y] or {x, y}
 * @param {[number, number]|{x: number, y: number}} speakerPos - [x, y] or {x, y}
 * @param {Array} walls - array of wall objects [{ x1, y1, x2, y2, acousticDamping }]
 * @returns {{ isOccluded: boolean, dampingFactor: number, wallHits: number }}
 */
export function checkAcousticOcclusion(listenerPos, speakerPos, walls = []) {
  if (!walls || !Array.isArray(walls) || walls.length === 0) {
    return { isOccluded: false, dampingFactor: 0, wallHits: 0 };
  }

  const listener = toPoint(listenerPos);
  const speaker = toPoint(speakerPos);

  if (!listener || !speaker) {
    return { isOccluded: false, dampingFactor: 0, wallHits: 0 };
  }

  const [lx, ly] = listener;
  const [sx, sy] = speaker;

  if (Math.hypot(sx - lx, sy - ly) < 1e-4) {
    return { isOccluded: false, dampingFactor: 0, wallHits: 0 };
  }

  let wallHits = 0;
  let totalDamping = 0;

  for (const wall of walls) {
    if (!wall || typeof wall !== 'object') continue;
    const x1 = Number(wall.x1);
    const y1 = Number(wall.y1);
    const x2 = Number(wall.x2);
    const y2 = Number(wall.y2);

    if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) {
      continue;
    }

    if (lineSegmentsIntersect(lx, ly, sx, sy, x1, y1, x2, y2)) {
      wallHits++;
      const damping = typeof wall.acousticDamping === 'number' && Number.isFinite(wall.acousticDamping)
        ? wall.acousticDamping
        : 0.8;
      totalDamping = Math.max(totalDamping, damping);
    }
  }

  return {
    isOccluded: wallHits > 0,
    dampingFactor: wallHits > 0 ? Math.min(1, Math.max(0, totalDamping)) : 0,
    wallHits,
  };
}

export default checkAcousticOcclusion;

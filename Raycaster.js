/**
 * Raycaster: 2D acoustic line-of-sight and wall occlusion engine.
 * Calculates segment intersections, obstacle hits, and acoustic damping factors.
 */

/**
 * Extracts numeric [x, y] coordinates from an array, object, or entity.
 * Supports [x, y], { x, y }, or { coordinates: [x, y] }.
 * @param {*} pos
 * @returns {[number, number]|null}
 */
function toPoint(pos) {
  if (!pos) return null;

  if (Array.isArray(pos) && pos.length >= 2) {
    const val0 = pos[0];
    const val1 = pos[1];
    if (val0 !== null && val0 !== '' && val1 !== null && val1 !== '') {
      const x = Number(val0);
      const y = Number(val1);
      return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
    }
    return null;
  }

  if (typeof pos === 'object') {
    if (Array.isArray(pos.coordinates) && pos.coordinates.length >= 2) {
      return toPoint(pos.coordinates);
    }
    if (pos.x !== null && pos.x !== '' && pos.y !== null && pos.y !== '') {
      const x = Number(pos.x);
      const y = Number(pos.y);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        return [x, y];
      }
    }
  }

  return null;
}

/**
 * Tests whether two 2D line segments (P0-P1 and P2-P3) intersect.
 * Uses an axis-aligned bounding box (AABB) early-rejection check and Cramer's rule.
 * @param {number} p0_x
 * @param {number} p0_y
 * @param {number} p1_x
 * @param {number} p1_y
 * @param {number} p2_x
 * @param {number} p2_y
 * @param {number} p3_x
 * @param {number} p3_y
 * @returns {boolean}
 */
export function lineSegmentsIntersect(p0_x, p0_y, p1_x, p1_y, p2_x, p2_y, p3_x, p3_y) {
  const eps = 1e-5;

  const n0_x = Number(p0_x);
  const n0_y = Number(p0_y);
  const n1_x = Number(p1_x);
  const n1_y = Number(p1_y);
  const n2_x = Number(p2_x);
  const n2_y = Number(p2_y);
  const n3_x = Number(p3_x);
  const n3_y = Number(p3_y);

  if (
    !Number.isFinite(n0_x) || !Number.isFinite(n0_y) ||
    !Number.isFinite(n1_x) || !Number.isFinite(n1_y) ||
    !Number.isFinite(n2_x) || !Number.isFinite(n2_y) ||
    !Number.isFinite(n3_x) || !Number.isFinite(n3_y)
  ) {
    return false;
  }

  // AABB bounding box early rejection
  if (
    Math.max(n0_x, n1_x) < Math.min(n2_x, n3_x) - eps ||
    Math.min(n0_x, n1_x) > Math.max(n2_x, n3_x) + eps ||
    Math.max(n0_y, n1_y) < Math.min(n2_y, n3_y) - eps ||
    Math.min(n0_y, n1_y) > Math.max(n2_y, n3_y) + eps
  ) {
    return false;
  }

  const s1_x = n1_x - n0_x;
  const s1_y = n1_y - n0_y;
  const s2_x = n3_x - n2_x;
  const s2_y = n3_y - n2_y;

  const denominator = -s2_x * s1_y + s1_x * s2_y;
  if (Math.abs(denominator) < eps) {
    return false;
  }

  const s = (-s1_y * (n0_x - n2_x) + s1_x * (n0_y - n2_y)) / denominator;
  const t = (s2_x * (n0_y - n2_y) - s2_y * (n0_x - n2_x)) / denominator;

  return s >= -eps && s <= 1 + eps && t >= -eps && t <= 1 + eps;
}

/**
 * Checks if acoustic walls occlude the line of sight between listener and speaker.
 * @param {[number, number]|{x: number, y: number}} listenerPos
 * @param {[number, number]|{x: number, y: number}} speakerPos
 * @param {Array<Object>} walls - Array of wall objects [{ x1, y1, x2, y2, acousticDamping, blocksSound }]
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

  const dx = sx - lx;
  const dy = sy - ly;
  if (dx * dx + dy * dy < 1e-8) {
    return { isOccluded: false, dampingFactor: 0, wallHits: 0 };
  }

  let wallHits = 0;
  let totalDamping = 0;

  for (const wall of walls) {
    if (!wall || typeof wall !== 'object' || wall.blocksSound === false) {
      continue;
    }

    const x1 = Number(wall.x1);
    const y1 = Number(wall.y1);
    const x2 = Number(wall.x2);
    const y2 = Number(wall.y2);

    if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) {
      continue;
    }

    if (lineSegmentsIntersect(lx, ly, sx, sy, x1, y1, x2, y2)) {
      wallHits++;
      const dampingRaw = Number(wall.acousticDamping);
      const damping = Number.isFinite(dampingRaw) ? Math.min(1, Math.max(0, dampingRaw)) : 0.8;
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

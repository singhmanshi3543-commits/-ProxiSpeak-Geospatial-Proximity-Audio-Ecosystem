/**
 * Raycasting and Geometry utilities for 2D acoustic line-of-sight & wall occlusion
 */

// Helper: Line intersection test between segment AB and segment CD
function lineSegmentsIntersect(p0_x, p0_y, p1_x, p1_y, p2_x, p2_y, p3_x, p3_y) {
  const s1_x = p1_x - p0_x;
  const s1_y = p1_y - p0_y;
  const s2_x = p3_x - p2_x;
  const s2_y = p3_y - p2_y;

  const denominator = -s2_x * s1_y + s1_x * s2_y;
  if (Math.abs(denominator) < 0.0001) return false;

  const s = (-s1_y * (p0_x - p2_x) + s1_x * (p0_y - p2_y)) / denominator;
  const t = (s2_x * (p0_y - p2_y) - s2_y * (p0_x - p2_x)) / denominator;

  return s >= 0 && s <= 1 && t >= 0 && t <= 1;
}

/**
 * Checks if acoustic walls occlude the line of sight between listener and speaker
 * @param {[number, number]} listenerPos - [x, y]
 * @param {[number, number]} speakerPos - [x, y]
 * @param {Array} walls - array of wall objects [{ x1, y1, x2, y2, acousticDamping }]
 * @returns {{ isOccluded: boolean, dampingFactor: number, wallHits: number }}
 */
export function checkAcousticOcclusion(listenerPos, speakerPos, walls = []) {
  if (!walls || walls.length === 0) {
    return { isOccluded: false, dampingFactor: 0, wallHits: 0 };
  }

  const [lx, ly] = listenerPos;
  const [sx, sy] = speakerPos;

  let wallHits = 0;
  let totalDamping = 0;

  for (const wall of walls) {
    const hit = lineSegmentsIntersect(lx, ly, sx, sy, wall.x1, wall.y1, wall.x2, wall.y2);
    if (hit) {
      wallHits++;
      totalDamping = Math.max(totalDamping, wall.acousticDamping || 0.8);
    }
  }

  return {
    isOccluded: wallHits > 0,
    dampingFactor: wallHits > 0 ? totalDamping : 0,
    wallHits,
  };
}

export default checkAcousticOcclusion;

import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { COOKIE_NAME, verifyToken } from '../utils/token.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Reusable by the Socket.IO handshake in Phase 4.
export async function authenticateToken(token) {
  if (!token) throw new AppError(401, 'Authentication required', 'UNAUTHENTICATED');
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new AppError(401, 'Invalid or expired session', 'UNAUTHENTICATED');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw new AppError(401, 'Invalid or expired session', 'UNAUTHENTICATED');
  return user;
}

export const requireAuth = asyncHandler(async (req, _res, next) => {
  req.user = await authenticateToken(req.cookies?.[COOKIE_NAME]);
  next();
});

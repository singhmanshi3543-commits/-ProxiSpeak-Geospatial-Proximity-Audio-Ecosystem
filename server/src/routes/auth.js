import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validateBody } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { registerSchema, loginSchema } from '../validators/schemas.js';
import * as ctrl from '../controllers/auth.controller.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts, try again later' } },
});

router.post('/register', authLimiter, validateBody(registerSchema), asyncHandler(ctrl.register));
router.post('/login', authLimiter, validateBody(loginSchema), asyncHandler(ctrl.login));
router.post('/logout', requireAuth, asyncHandler(ctrl.logout));

export default router;

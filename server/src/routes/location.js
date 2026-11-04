import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { locationSchema } from '../validators/schemas.js';
import * as ctrl from '../controllers/location.controller.js';

const router = Router();
const limiter = rateLimit({
  windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many location updates' } },
});

router.use(requireAuth);
router.post('/', limiter, validateBody(locationSchema), asyncHandler(ctrl.updateLocation));
router.delete('/', asyncHandler(ctrl.clearLocation));
export default router;

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { nearbyUsers } from '../controllers/nearby.controller.js';

const router = Router();
router.get('/', requireAuth, asyncHandler(nearbyUsers));
export default router;

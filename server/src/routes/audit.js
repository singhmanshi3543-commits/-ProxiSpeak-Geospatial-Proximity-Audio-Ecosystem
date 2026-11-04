import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { myAuditLog } from '../controllers/audit.controller.js';

const router = Router();
router.get('/me', requireAuth, asyncHandler(myAuditLog));
export default router;

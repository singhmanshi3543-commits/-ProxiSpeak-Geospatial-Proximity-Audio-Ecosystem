import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { updateProfileSchema } from '../validators/schemas.js';
import * as ctrl from '../controllers/users.controller.js';

const router = Router();
router.use(requireAuth);
router.get('/me', ctrl.getMe);
router.patch('/me', validateBody(updateProfileSchema), asyncHandler(ctrl.updateMe));

export default router;

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateObjectIdParam } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { connectionRequestSchema } from '../validators/schemas.js';
import * as ctrl from '../controllers/connections.controller.js';

const router = Router();
router.use(requireAuth);
router.get('/', asyncHandler(ctrl.list));
router.post('/', validateBody(connectionRequestSchema), asyncHandler(ctrl.request));
router.post('/:id/accept', validateObjectIdParam(), asyncHandler(ctrl.accept));
router.post('/:id/decline', validateObjectIdParam(), asyncHandler(ctrl.decline));
router.delete('/:id', validateObjectIdParam(), asyncHandler(ctrl.remove));
export default router;

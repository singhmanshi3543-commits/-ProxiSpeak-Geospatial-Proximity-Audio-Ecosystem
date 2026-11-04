import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateObjectIdParam } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createRoomSchema } from '../validators/schemas.js';
import * as ctrl from '../controllers/rooms.controller.js';

const router = Router();
router.use(requireAuth);
router.get('/', asyncHandler(ctrl.list));
router.post('/', validateBody(createRoomSchema), asyncHandler(ctrl.create));
router.get('/:id', validateObjectIdParam(), asyncHandler(ctrl.get));
router.post('/:id/join', validateObjectIdParam(), asyncHandler(ctrl.join));
router.post('/:id/leave', validateObjectIdParam(), asyncHandler(ctrl.leave));
export default router;

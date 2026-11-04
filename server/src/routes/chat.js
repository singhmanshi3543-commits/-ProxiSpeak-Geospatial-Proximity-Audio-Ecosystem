import { Router } from 'express';

import {
  getMe,
  searchUsers,
  getGlobalMessages,
  getPrivateMessages,
  getConversations,
} from '../controllers/chatController.js';

import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/me', getMe);

router.get('/users', searchUsers);

router.get('/conversations', getConversations);

router.get('/global', getGlobalMessages);

router.get('/private/:userId', getPrivateMessages);

export default router;
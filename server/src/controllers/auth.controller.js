import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { COOKIE_NAME, signToken, cookieOptions, clearCookieOptions } from '../utils/token.js';
import { recordAudit } from '../services/audit.js';
import { clearPresence } from '../services/presence.js';

const BCRYPT_COST = 12;
// Compared against when the account doesn't exist, so response time doesn't reveal valid usernames.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password-1', BCRYPT_COST);

function startSession(res, user) {
  const token = signToken(user._id.toString());
  res.cookie(COOKIE_NAME, token, cookieOptions(token));
}

export async function register(req, res) {
  const { username, email, password, displayName } = req.body;
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  let user;
  try {
    user = await User.create({ username, email, passwordHash, displayName });
  } catch (err) {
    if (err?.code === 11000) throw new AppError(409, 'Username or email already in use', 'CONFLICT');
    throw err;
  }
  await recordAudit({ action: 'auth.register', userId: user._id, req });
  startSession(res, user);
  res.status(201).json({ user: user.toSelf() });
}

export async function login(req, res) {
  const { identifier, password } = req.body;
  const user = await User.findOne({ $or: [{ username: identifier }, { email: identifier }] }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    await recordAudit({ action: 'auth.login.failed', userId: user?._id ?? null, req, meta: { identifier: identifier.slice(0, 64) } });
    throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  }
  user.lastLoginAt = new Date();
  await user.save();
  await recordAudit({ action: 'auth.login.success', userId: user._id, req });
  startSession(res, user);
  res.json({ user: user.toSelf() });
}

export async function logout(req, res) {
  await clearPresence(req.user._id, req); // logging out = no longer discoverable, leaves rooms
  await recordAudit({ action: 'auth.logout', userId: req.user._id, req });
  res.clearCookie(COOKIE_NAME, clearCookieOptions);
  res.status(204).end();
}

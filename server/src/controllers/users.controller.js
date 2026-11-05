import { recordAudit } from '../services/audit.js';

export function getMe(req, res) {
  res.json({ user: req.user.toSelf() });
}

export async function updateMe(req, res) {
  const changed = Object.keys(req.body);
  req.user.set(req.body); // body already restricted to whitelisted fields by zod .strict()
  await req.user.save();
  await recordAudit({ action: 'profile.update', userId: req.user._id, req, meta: { fields: changed } });
  res.json({ user: req.user.toSelf() });
}

import { AuditLog } from '../models/AuditLog.js';

// A user can only read their own audit trail.
export async function myAuditLog(req, res) {
  const logs = await AuditLog.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .select('action ip meta createdAt -_id')
    .lean();
  res.json({ logs });
}

import { AuditLog } from '../models/AuditLog.js';
import { logger } from '../utils/logger.js';

// Audit failures must never break the request that triggered them.
export async function recordAudit({ action, userId = null, req = null, meta = {} }) {
  try {
    await AuditLog.create({
      action,
      user: userId,
      ip: req?.ip ?? null,
      userAgent: req?.get?.('user-agent')?.slice(0, 300) ?? null,
      meta,
    });
  } catch (err) {
    logger.error({ err, action }, 'Failed to write audit log');
  }
}

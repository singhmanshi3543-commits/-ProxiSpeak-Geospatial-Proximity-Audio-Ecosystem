import mongoose from 'mongoose';

export const AUDIT_ACTIONS = [
  'auth.register', 'auth.login.success', 'auth.login.failed', 'auth.logout',
  'profile.update',
  'location.rejected', 'location.clear',
  'connection.request', 'connection.accept', 'connection.decline', 'connection.remove', 'connection.denied',
  'room.create', 'room.join', 'room.join.denied', 'room.leave', 'room.evicted',
  // Phase 4 adds: signal.denied, socket.connect, socket.disconnect
];

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, enum: AUDIT_ACTIONS, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null, maxlength: 300 },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ user: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);

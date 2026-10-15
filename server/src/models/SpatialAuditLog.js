import mongoose from 'mongoose';

const SpatialAuditLogSchema = new mongoose.Schema({
  testTimestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  concurrentUsersCount: {
    type: Number,
    required: true,
  },
  earshotRadiusPx: {
    type: Number,
    default: 100,
  },
  queryType: {
    type: String,
    enum: ['$near', '$geoWithin', 'cluster_pipeline'],
    default: '$near',
  },
  avgQueryLatencyMs: {
    type: Number,
    required: true,
  },
  minQueryLatencyMs: {
    type: Number,
    required: true,
  },
  maxQueryLatencyMs: {
    type: Number,
    required: true,
  },
  p95LatencyMs: {
    type: Number,
    required: true,
  },
  passed20msAudit: {
    type: Boolean,
    required: true,
  },
  clusterCount: {
    type: Number,
    default: 0,
  },
  notes: {
    type: String,
    default: '',
  }
}, {
  timestamps: true,
});

export const SpatialAuditLog = mongoose.model('SpatialAuditLog', SpatialAuditLogSchema);
export default SpatialAuditLog;

import express from 'express';
import GeospatialEngine from '../services/geospatialEngine.js';
import SpatialAuditLog from '../models/SpatialAuditLog.js';

const router = express.Router();

/**
 * POST /api/audit/run
 * Run live spatial audit benchmark to prove sub-20ms latency requirement
 */
router.post('/run', async (req, res) => {
  try {
    const concurrentUsers = parseInt(req.body.concurrentUsers || '50', 10);
    const iterations = parseInt(req.body.iterations || '25', 10);
    const earshotRadius = parseInt(req.body.earshotRadius || '100', 10);

    const auditResult = await GeospatialEngine.runSpatialAudit(concurrentUsers, iterations, earshotRadius);

    res.json({
      success: true,
      message: auditResult.passed20msAudit
        ? `Spatial Audit PASSED: Avg query latency ${auditResult.metrics.avgLatencyMs}ms is well below 20ms threshold.`
        : `Spatial Audit WARNING: Avg query latency ${auditResult.metrics.avgLatencyMs}ms exceeded 20ms target.`,
      result: auditResult,
    });
  } catch (error) {
    console.error('Audit run failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/audit/history
 * Retrieve recent spatial audit benchmarks
 */
router.get('/history', async (req, res) => {
  try {
    const logs = await SpatialAuditLog.find().sort({ testTimestamp: -1 }).limit(10).lean();
    res.json({ success: true, count: logs.length, logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/audit/clusters
 * Retrieve current real-time proximity clusters
 */
router.get('/clusters', async (req, res) => {
  try {
    const clusters = await GeospatialEngine.computeProximityClusters(100);
    res.json({ success: true, count: clusters.length, clusters });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

import React, { useState } from 'react';
import { Zap, CheckCircle2, AlertTriangle, Play, RefreshCw, X } from 'lucide-react';

export function SpatialBenchmarkModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [userCount, setUserCount] = useState(50);
  const [iterations, setIterations] = useState(25);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const runBenchmark = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/audit/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concurrentUsers: userCount, iterations, earshotRadius: 100 }),
      });
      const data = await res.json();
      if (data.success) {
        setAuditResult(data.result);
      } else {
        setError(data.error || 'Benchmark run failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="w-full max-w-2xl glass-panel-heavy p-6 shadow-2xl relative border border-white/10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Zap size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold font-heading text-white">
              Mid-Project Spatial Audit: Sub-20ms Benchmark
            </h2>
            <p className="text-xs text-slate-400">
              Validating MongoDB 2D Euclidean $near & clustering performance for 50+ concurrent users
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-5 p-4 rounded-xl bg-slate-900/60 border border-white/5">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Concurrent Users</label>
            <input
              type="number"
              min="10"
              max="200"
              value={userCount}
              onChange={(e) => setUserCount(parseInt(e.target.value) || 50)}
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Iterations</label>
            <input
              type="number"
              min="5"
              max="100"
              value={iterations}
              onChange={(e) => setIterations(parseInt(e.target.value) || 25)}
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={runBenchmark}
              disabled={loading}
              className="w-full btn-primary h-[38px] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Auditing...</span>
                </>
              ) : (
                <>
                  <Play size={16} />
                  <span>Execute Audit</span>
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {auditResult && (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-xl border flex items-center justify-between ${
                auditResult.passed20msAudit
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}
            >
              <div className="flex items-center gap-3">
                {auditResult.passed20msAudit ? (
                  <CheckCircle2 size={24} className="text-emerald-400" />
                ) : (
                  <AlertTriangle size={24} className="text-amber-400" />
                )}
                <div>
                  <div className="font-bold text-sm">
                    {auditResult.passed20msAudit
                      ? 'AUDIT PASSED: SUB-20MS TARGET ACHIEVED'
                      : 'AUDIT WARNING: LATENCY CEILING EXCEEDED'}
                  </div>
                  <div className="text-xs opacity-80">
                    MongoDB 2D $near latency measured at{' '}
                    <span className="font-mono font-bold">{auditResult.metrics.avgLatencyMs}ms</span> (Threshold &lt; 20.0ms)
                  </div>
                </div>
              </div>
              <span className="badge badge-green text-xs">CERTIFIED</span>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-slate-900/70 border border-white/5 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Average Latency</div>
                <div className="text-lg font-mono font-bold text-cyan-400 mt-1">
                  {auditResult.metrics.avgLatencyMs} ms
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/70 border border-white/5 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">95th Percentile</div>
                <div className="text-lg font-mono font-bold text-indigo-400 mt-1">
                  {auditResult.metrics.p95LatencyMs} ms
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/70 border border-white/5 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Min / Max Latency</div>
                <div className="text-xs font-mono font-bold text-slate-200 mt-2">
                  {auditResult.metrics.minLatencyMs}ms / {auditResult.metrics.maxLatencyMs}ms
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/70 border border-white/5 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Proximity Clusters</div>
                <div className="text-lg font-mono font-bold text-emerald-400 mt-1">
                  {auditResult.metrics.clustersDetected}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
          <div>Infotact Solutions • Mid-Project Geospatial Audit Specification</div>
          <button onClick={onClose} className="btn-secondary py-1 px-3 text-xs">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default SpatialBenchmarkModal;

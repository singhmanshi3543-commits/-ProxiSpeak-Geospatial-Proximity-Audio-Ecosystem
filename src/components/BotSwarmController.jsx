import React, { useState } from 'react';
import { Users, Trash2, Volume2, Sparkles, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';

export function BotSwarmController({
  botCount = 0,
  onSpawnBots,
  onClearBots,
  syntheticChatterEnabled,
  onToggleSyntheticChatter,
}) {
  const [loading, setLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleSpawn = async (count = 50) => {
    setLoading(true);
    try {
      await onSpawnBots(count);
    } finally {
      setLoading(false);
    }
  };

  if (isCollapsed) {
    return (
      <div className="glass-panel p-2 shadow-xl border border-white/10 flex items-center gap-2">
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex items-center gap-2 text-xs font-bold text-indigo-300 hover:text-white px-2 py-1 rounded transition-colors"
          title="Expand 50+ Bot Swarm Controller"
        >
          <Users size={15} className="text-indigo-400" />
          <span>COLLEAGUES ({botCount})</span>
          <ChevronDown size={14} className="text-slate-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="glass-panel p-3 flex items-center justify-between gap-3 shadow-xl border border-white/10 max-w-sm">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
          <Users size={15} />
        </div>
        <div>
          <div className="text-xs font-bold font-heading text-slate-100 flex items-center gap-1.5">
            <span>50+ Colleagues</span>
            <span className="badge badge-purple text-[9px] px-1 py-0">{botCount} Active</span>
          </div>
          <div className="text-[9px] text-slate-400">Mesh & Proximity Simulation</div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={onToggleSyntheticChatter}
          className={`btn-secondary text-[11px] px-2 py-1 flex items-center gap-1 ${
            syntheticChatterEnabled ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'opacity-70'
          }`}
          title="Toggle vocal audio chatter for nearby bots"
        >
          <Volume2 size={12} className={syntheticChatterEnabled ? 'text-emerald-400' : ''} />
          <span>Audio Demo</span>
        </button>

        {botCount === 0 ? (
          <button
            onClick={() => handleSpawn(50)}
            disabled={loading}
            className="btn-primary text-[11px] px-2.5 py-1 flex items-center gap-1"
          >
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
            <span>Spawn 50</span>
          </button>
        ) : (
          <button
            onClick={onClearBots}
            disabled={loading}
            className="btn-secondary text-[11px] px-2 py-1 text-rose-400 hover:text-rose-300 flex items-center gap-1"
            title="Remove all bots"
          >
            <Trash2 size={12} />
            <span>Clear</span>
          </button>
        )}

        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10 transition-colors"
          title="Minimize controller"
        >
          <ChevronUp size={14} />
        </button>
      </div>
    </div>
  );
}

export default BotSwarmController;

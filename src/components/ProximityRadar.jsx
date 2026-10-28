import React, { useState } from 'react';
import { Radio, Volume2, ShieldAlert, Wifi, ChevronDown, ChevronUp } from 'lucide-react';

export function ProximityRadar({ peersInEarshot = [], localCoords = [0, 0] }) {
  const [lx, ly] = localCoords;
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (isCollapsed) {
    return (
      <aside className="glass-panel p-2 shadow-xl border border-white/10 flex items-center gap-2">
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex items-center gap-2 text-xs font-bold text-cyan-300 hover:text-white px-2 py-1 rounded transition-colors"
          title="Expand Proximity Radar"
        >
          <div className="relative">
            <Radio size={15} className="text-cyan-400 animate-pulse" />
          </div>
          <span>RADAR ({peersInEarshot.length})</span>
          <ChevronDown size={14} className="text-slate-400" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-72 glass-panel p-3.5 flex flex-col gap-2.5 max-h-[70vh] shadow-xl border border-white/10 transition-all">
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Radio size={16} className="text-cyan-400" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
          </div>
          <div>
            <h3 className="text-xs font-bold font-heading text-slate-100 uppercase tracking-wider">
              Proximity Radar
            </h3>
            <p className="text-[9px] text-slate-400">100px Earshot Radius</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="badge badge-blue text-[9px] px-1.5 py-0.5">
            {peersInEarshot.length} ACTIVE
          </span>
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10 transition-colors"
            title="Minimize Radar to see more map"
          >
            <ChevronUp size={14} />
          </button>
        </div>
      </div>

      <div className="relative w-full h-28 rounded-xl radar-grid flex items-center justify-center border border-white/10 overflow-hidden">
        <div className="absolute w-24 h-24 rounded-full border border-cyan-500/20"></div>
        <div className="absolute w-16 h-16 rounded-full border border-cyan-500/30"></div>
        <div className="absolute w-8 h-8 rounded-full border border-cyan-500/40"></div>

        <div className="absolute w-full h-[1px] bg-cyan-500/20"></div>
        <div className="absolute h-full w-[1px] bg-cyan-500/20"></div>

        <div className="radar-sweep"></div>

        <div className="relative z-10 w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b] flex items-center justify-center">
          <div className="w-1 h-1 rounded-full bg-white"></div>
        </div>

        {peersInEarshot.map((peer) => {
          const dx = (peer.coordinates?.[0] || peer.x || 0) - lx;
          const dy = (peer.coordinates?.[1] || peer.y || 0) - ly;
          const radarScale = 0.5;
          const blipX = Math.max(-50, Math.min(50, dx * radarScale));
          const blipY = Math.max(-50, Math.min(50, dy * radarScale));

          return (
            <div
              key={peer.userId}
              style={{
                transform: `translate(${blipX}px, ${blipY}px)`,
                backgroundColor: peer.avatarColor || '#38bdf8',
              }}
              className="absolute z-20 w-2 h-2 rounded-full shadow-[0_0_6px_currentColor] transition-transform duration-100"
              title={`${peer.username} (${peer.distance || 0}px)`}
            />
          );
        })}
      </div>

      <div className="overflow-y-auto max-h-40 space-y-1.5 pr-1">
        {peersInEarshot.length === 0 ? (
          <div className="text-center py-3 text-slate-500 text-[11px]">
            <Wifi size={18} className="mx-auto mb-1 opacity-40 text-slate-400" />
            <p>No peers within 100px.</p>
          </div>
        ) : (
          peersInEarshot.map((peer) => {
            const distance = peer.distance || Math.round(Math.hypot(
              (peer.coordinates?.[0] || peer.x || 0) - lx,
              (peer.coordinates?.[1] || peer.y || 0) - ly
            ));
            const gainPercent = Math.max(0, Math.min(100, Math.round((1 - distance / 100) * 100)));

            return (
              <div
                key={peer.userId}
                className="p-1.5 rounded-lg bg-slate-900/60 border border-white/5 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 relative"
                    style={{ backgroundColor: peer.avatarColor || '#3b82f6' }}
                  >
                    {peer.username ? peer.username[0] : 'U'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-slate-200 truncate">{peer.username}</div>
                    <div className="text-[9px] text-slate-400 font-mono">
                      {distance}px • <span className="text-cyan-400">{gainPercent}% vol</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {peer.isOccluded && (
                    <span className="text-indigo-400" title="Wall blocking sound">
                      <ShieldAlert size={12} />
                    </span>
                  )}
                  {peer.isSpeaking ? (
                    <span className="badge badge-green text-[9px] px-1 py-0.5">Talking</span>
                  ) : (
                    <Volume2 size={12} className="text-slate-500" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

export default ProximityRadar;

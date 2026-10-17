import React from 'react';
import {
  Radio,
  Zap,
  HelpCircle,
  Settings,
  Maximize2,
  Target,
  Navigation,
} from 'lucide-react';

export const ROOM_LOCATIONS = [
  { id: 'boardroom', name: 'Executive Boardroom', coords: [300, 230], color: '#3b82f6' },
  { id: 'engineering', name: 'Engineering Hub', coords: [850, 230], color: '#10b981' },
  { id: 'breakroom', name: 'Cafeteria & Watercooler', coords: [1450, 200], color: '#f59e0b' },
  { id: 'quiet-pods', name: 'Quiet Focus Pods', coords: [200, 750], color: '#8b5cf6' },
  { id: 'auditorium', name: 'All-Hands Auditorium', coords: [1100, 850], color: '#ec4899' },
];

function RoomSelector({ onTeleport }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto py-1">
      <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
        <Navigation size={12} className="text-cyan-400" />
        <span>Teleport:</span>
      </span>
      {ROOM_LOCATIONS.map((loc) => (
        <button
          key={loc.id}
          onClick={() => onTeleport(loc.coords)}
          className="btn-secondary text-[11px] py-1 px-2.5 whitespace-nowrap hover:border-cyan-500/40 hover:text-cyan-300 transition-all"
        >
          <span
            className="w-1.5 h-1.5 rounded-full inline-block mr-1.5"
            style={{ backgroundColor: loc.color }}
          ></span>
          {loc.name}
        </button>
      ))}
    </div>
  );
}

export function HeaderNav({
  isConnected,
  fps = 60,
  latencyMs = 3.2,
  onOpenAudit,
  onOpenGuide,
  onOpenProfile,
  onTeleport,
  onFitEntireMap,
  onFocusAvatar,
  user,
}) {
  return (
    <header className="fixed top-3 left-4 right-4 z-40 glass-panel-heavy px-4 py-2 flex items-center justify-between shadow-2xl border border-white/10 gap-3">
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 via-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-lg glow-blue">
            <Radio size={16} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xs font-bold font-heading text-white tracking-tight">ProxiSpeak</h1>
              <span className="badge badge-blue text-[8px] px-1 py-0">INFOTACT</span>
            </div>
            <p className="text-[9px] text-slate-400">Virtual Office</p>
          </div>
        </div>

        <div className="hidden xl:flex items-center gap-1.5 pl-3 border-l border-white/10 text-[10px]">
          <span className="text-emerald-400 font-mono">LIVE • {fps} FPS</span>
          <span className="text-slate-500">•</span>
          <span className="text-cyan-400 font-mono">Mongo: {latencyMs}ms</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onFitEntireMap}
          className="btn-primary text-xs py-1.5 px-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 border border-cyan-400 text-white font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-600/30"
          title="Zoom out so the ENTIRE office map fits on your screen at once"
        >
          <Maximize2 size={14} />
          <span>FIT FULL MAP</span>
        </button>

        <button
          onClick={onFocusAvatar}
          className="btn-primary text-xs py-1.5 px-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 border border-amber-300 text-black font-extrabold flex items-center gap-1.5 shadow-lg shadow-amber-500/30"
          title="Snap camera directly onto your avatar and highlight location"
        >
          <Target size={14} />
          <span>GO TO MY AVATAR</span>
        </button>
      </div>

      <div className="hidden lg:flex items-center">
        <RoomSelector onTeleport={onTeleport} />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onOpenAudit}
          className="btn-secondary text-[11px] px-2 py-1 flex items-center gap-1 border-cyan-500/30 hover:border-cyan-500 text-cyan-300"
          title="Run Spatial Audit Benchmark"
        >
          <Zap size={13} className="text-cyan-400" />
          <span className="hidden sm:inline">Spatial Audit</span>
        </button>

        <button
          onClick={onOpenGuide}
          className="btn-secondary text-[11px] px-2 py-1 flex items-center gap-1"
          title="Audio and Navigation Guide"
        >
          <HelpCircle size={13} className="text-slate-300" />
          <span className="hidden sm:inline">Guide</span>
        </button>

        <button
          onClick={onOpenProfile}
          className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          title="Customize Avatar"
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-black"
            style={{ backgroundColor: '#f59e0b' }}
          >
            {user?.username ? user.username[0].toUpperCase() : 'U'}
          </div>
          <span className="text-[11px] font-semibold text-slate-200 hidden md:inline">
            {user?.username || 'User'}
          </span>
          <Settings size={12} className="text-slate-400" />
        </button>
      </div>
    </header>
  );
}

export default HeaderNav;

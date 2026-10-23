import React from 'react';
import {
  Mic,
  MicOff,
  Headphones,
  Volume2,
  VolumeX,
  Compass,
  ShieldAlert,
  Radio,
  Target,
  Volume1,
  Maximize2,
} from 'lucide-react';

export function AudioControlsBar({
  isMicMuted,
  isDeafened,
  onToggleMic,
  onToggleDeafen,
  masterVolume,
  onVolumeChange,
  enable3DPanning,
  onToggle3DPanning,
  enableOcclusion,
  onToggleOcclusion,
  activePeersCount,
  currentZone,
  micVolume = 0,
  micStatus = 'active',
  isLoopbackActive = false,
  onToggleLoopback,
  onCenterOnMe,
  onFitEntireMap,
  audioEngineState = 'running',
  onResumeAudio,
  localUser,
}) {
  return (
    <footer className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-auto max-w-5xl px-5 py-3 glass-panel-heavy flex items-center justify-between gap-5 border border-white/10 shadow-2xl">
      <div className="flex items-center gap-3 pr-4 border-r border-white/10">
        <button
          onClick={onCenterOnMe}
          className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 border border-amber-300 text-black font-extrabold shadow-lg shadow-amber-500/20"
          title="Center view directly onto your avatar (or press Space / C)"
        >
          <Target size={15} />
          <span>FIND ME</span>
        </button>

        <button
          onClick={onFitEntireMap}
          className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 border border-cyan-400 text-white font-bold shadow-lg shadow-cyan-600/20"
          title="Zoom out so the ENTIRE office map fits on screen"
        >
          <Maximize2 size={14} />
          <span>FIT MAP</span>
        </button>

        <div className="pl-2 border-l border-white/10">
          <div className="text-[10px] text-amber-300 font-bold uppercase tracking-wider flex items-center gap-1">
            <span>⭐ {localUser?.username || 'You'}</span>
          </div>
          <div className="text-[11px] font-semibold text-slate-300 truncate max-w-[120px]">
            {currentZone || 'Engineering Hub'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleMic}
            className={`btn-icon ${isMicMuted ? 'muted' : 'active'}`}
            title={isMicMuted ? 'Unmute Microphone (M)' : 'Mute Microphone (M)'}
          >
            {isMicMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          <div className="flex flex-col gap-0.5 justify-center w-14">
            <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono">
              <span>MIC</span>
              <span>{isMicMuted ? 'OFF' : `${micVolume}%`}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-white/10">
              <div
                className={`h-full transition-all duration-75 ${
                  isMicMuted
                    ? 'bg-red-500'
                    : micVolume > 60
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
                style={{ width: `${isMicMuted ? 0 : Math.min(100, micVolume)}%` }}
              />
            </div>
          </div>
        </div>

        <button
          onClick={onToggleLoopback}
          className={`btn-secondary text-[11px] px-2.5 py-1.5 flex items-center gap-1 border ${
            isLoopbackActive
              ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 font-bold'
              : 'border-white/10 text-slate-400 hover:text-slate-200'
          }`}
          title="Hear your own microphone live to verify audio clarity"
        >
          <Volume1 size={13} className={isLoopbackActive ? 'text-emerald-400' : ''} />
          <span>{isLoopbackActive ? 'Loopback ON' : 'Test Mic'}</span>
        </button>

        <button
          onClick={onToggleDeafen}
          className={`btn-icon ${isDeafened ? 'muted' : ''}`}
          title={isDeafened ? 'Undeafen Audio (D)' : 'Deafen Audio (D)'}
        >
          {isDeafened ? <VolumeX size={18} /> : <Headphones size={18} />}
        </button>
      </div>

      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/20 border border-white/5">
        <Volume2 size={15} className="text-slate-400" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={masterVolume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="w-16 accent-blue-500 cursor-pointer"
          title="Master Volume"
        />
        <span className="text-[11px] font-mono text-slate-300 w-6">
          {Math.round(masterVolume * 100)}%
        </span>
      </div>

      <div className="flex items-center gap-2 pl-2 border-l border-white/10">
        <button
          onClick={onToggle3DPanning}
          className={`btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1.5 ${
            enable3DPanning ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300' : 'opacity-60'
          }`}
          title="3D Stereo Panning (Left/Right Ear separation based on angle)"
        >
          <Compass size={14} className={enable3DPanning ? 'text-cyan-400' : ''} />
          <span className="hidden sm:inline">3D Pan</span>
        </button>

        <button
          onClick={onToggleOcclusion}
          className={`btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1.5 ${
            enableOcclusion ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300' : 'opacity-60'
          }`}
          title="Acoustic Wall Occlusion (Lowpass filter raycasting through walls)"
        >
          <ShieldAlert size={14} className={enableOcclusion ? 'text-indigo-400' : ''} />
          <span className="hidden sm:inline">Walls</span>
        </button>
      </div>

      <div className="flex items-center gap-2.5 pl-3 border-l border-white/10">
        <Radio size={16} className={activePeersCount > 0 ? 'text-emerald-400 animate-pulse' : 'text-slate-500'} />
        <div className="text-right">
          <div className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Earshot</div>
          <div className="text-xs font-bold font-mono text-emerald-400 whitespace-nowrap">
            {activePeersCount} {activePeersCount === 1 ? 'Peer' : 'Peers'}
          </div>
        </div>

        {audioEngineState === 'suspended' && (
          <button
            onClick={onResumeAudio}
            className="btn-primary text-[10px] py-1 px-2 bg-amber-500 hover:bg-amber-400 text-black font-bold animate-pulse"
            title="Browser autoplay policy requires click to activate audio"
          >
            Enable Sound 🔊
          </button>
        )}
      </div>
    </footer>
  );
}

export default AudioControlsBar;

import React from 'react';
import { Volume2, Radio, Compass, ShieldAlert, Users, X } from 'lucide-react';

export function AudioGuideModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="w-full max-w-2xl glass-panel-heavy p-6 shadow-2xl relative border border-white/10 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
            <Volume2 size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold font-heading text-white">
              Mid-Project Audio Check & Spatial Testing Guide
            </h2>
            <p className="text-xs text-slate-400">
              Demonstrating WebRTC P2P audio, dynamic distance crossfading, and 3D panning
            </p>
          </div>
        </div>

        <div className="space-y-4 text-xs text-slate-300">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-cyan-500/20">
            <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm mb-2">
              <Radio size={16} />
              <span>1. Live Multi-Browser WebRTC Peer Verification</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-300 leading-relaxed">
              <li>
                Open a <strong>second browser window or private tab</strong> at{' '}
                <code className="text-cyan-400 bg-black/40 px-1 py-0.5 rounded">http://localhost:3000</code>.
              </li>
              <li>Allow microphone access in both tabs (or click unmuted).</li>
              <li>
                Use <kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-white/10 text-white">W A S D</kbd> to move Tab 1 and Tab 2 avatars closer.
              </li>
              <li>
                When avatars enter the <span className="text-cyan-400 font-semibold">100-pixel earshot halo</span>, the backend signaling server coordinates the WebRTC peer connection.
              </li>
              <li>
                Speak into the mic or make sounds: as you walk closer, the volume increases organically!
              </li>
            </ol>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-indigo-500/20">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm mb-2">
              <Users size={16} />
              <span>2. 50+ Virtual Colleagues & Synthetic Audio Chatter</span>
            </div>
            <p className="leading-relaxed mb-2">
              Don't have two devices handy? Click <span className="text-indigo-400 font-semibold">"Spawn 50 Colleagues"</span> in the bottom bar and turn on <span className="text-emerald-400 font-semibold">"Bot Audio Demo"</span>.
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-300">
              <li>Walk toward colleague desks or the watercooler.</li>
              <li>Hear their synthetic conversational speech volume fade in as you step into their 100px earshot!</li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-black/30 border border-white/5">
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold mb-1">
                <Compass size={14} />
                <span>3D Stereo Panning</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                If a colleague is standing to your right, audio pans naturally to your right ear. If on the left, to your left ear.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-black/30 border border-white/5">
              <div className="flex items-center gap-1.5 text-indigo-400 font-bold mb-1">
                <ShieldAlert size={14} />
                <span>Acoustic Wall Occlusion</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Standing behind the executive boardroom partition wall muffles audio through a 450Hz lowpass filter with acoustic damping!
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-white/10 flex justify-end">
          <button onClick={onClose} className="btn-primary text-xs py-1.5 px-4">
            Got it, Let's Explore!
          </button>
        </div>
      </div>
    </div>
  );
}

export default AudioGuideModal;

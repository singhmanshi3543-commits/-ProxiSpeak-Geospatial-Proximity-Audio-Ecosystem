import React, { useState } from 'react';
import { User, Palette, Briefcase, Check } from 'lucide-react';

const AVATAR_PALETTE = [
  '#3b82f6', '#06b6d4', '#10b981', '#8b5cf6', '#f59e0b',
  '#ec4899', '#f43f5e', '#6366f1', '#14b8a6', '#eab308'
];

export function UserProfileModal({ isOpen, onClose, user, onSave }) {
  const [username, setUsername] = useState(user?.username || 'Engineer');
  const [role, setRole] = useState(user?.role || 'Full-Stack Developer');
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor || '#3b82f6');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ username, role, avatarColor });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="w-full max-w-md glass-panel-heavy p-6 shadow-2xl border border-white/10">
        <h2 className="text-base font-bold font-heading text-white mb-1">
          Customize Your Digital Avatar
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Personalize how colleagues identify you in the virtual workspace
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-center my-3">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-xl border-2 border-white/40 transition-transform hover:scale-105"
              style={{ backgroundColor: avatarColor }}
            >
              {username.slice(0, 2).toUpperCase() || 'ME'}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
              <User size={13} className="text-cyan-400" />
              <span>Display Name</span>
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
              <Briefcase size={13} className="text-indigo-400" />
              <span>Role / Specialization</span>
            </label>
            <input
              type="text"
              required
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
              <Palette size={13} className="text-pink-400" />
              <span>Avatar Theme Color</span>
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {AVATAR_PALETTE.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setAvatarColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                    avatarColor === c ? 'scale-110 ring-2 ring-white' : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  {avatarColor === c && <Check size={14} className="text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
            <button type="button" onClick={onClose} className="btn-secondary text-xs py-1.5 px-3">
              Cancel
            </button>
            <button type="submit" className="btn-primary text-xs py-1.5 px-4">
              Save Avatar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UserProfileModal;

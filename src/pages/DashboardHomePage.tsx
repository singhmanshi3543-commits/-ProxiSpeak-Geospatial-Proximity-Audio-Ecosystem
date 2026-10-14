import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Users,
  Compass,
  Plus,
  ArrowRight,
  Clock,
  LogOut,
  ChevronRight,
  KeyRound,
  Edit3,
  Radio
} from 'lucide-react';
import { DashboardCanvasView } from '../components/dashboard/DashboardCanvasView';

interface RoomItem {
  code: string;
  name: string;
  leaderId: string;
  isLocked: boolean;
  userCount?: number;
}

const AVATAR_OPTIONS = ['👨‍💻', '👩‍💻', '🧑‍💼', '🚀', '⚡', '🦊', '🤖', '🦉', '🎨', '🎯'];
const COLOR_OPTIONS = ['#2F80ED', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4'];

export const DashboardHomePage: React.FC = () => {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('proxispeak_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            userId: parsed.userId || `USR-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            name: parsed.name || 'Alex Morgan',
            email: parsed.email || 'alex@company.com',
            avatarIcon: parsed.avatarIcon || '👨‍💻',
            color: parsed.color || '#2F80ED'
          };
        }
      }
    } catch {}
    const rnd = Math.random().toString(36).substring(2, 7).toUpperCase();
    return {
      userId: `USR-${rnd}`,
      name: 'Alex Morgan',
      email: 'alex@company.com',
      avatarIcon: '👨‍💻',
      color: '#2F80ED'
    };
  });

  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    localStorage.setItem('proxispeak_user', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    const savedHist = localStorage.getItem('proxispeak_room_history');
    if (savedHist) {
      try { setHistory(JSON.parse(savedHist)); } catch {}
    }

    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setRooms(data.filter((r: any) => r && typeof r.code === 'string' && r.code.trim().length > 0));
        }
      }
    } catch (err) {
      console.warn('Could not fetch active rooms:', err);
    }
  };

  const saveToHistory = (code: string) => {
    const cleanCode = code.toUpperCase();
    const updated = [cleanCode, ...history.filter(c => c !== cleanCode)].slice(0, 8);
    setHistory(updated);
    localStorage.setItem('proxispeak_room_history', JSON.stringify(updated));
    localStorage.setItem('proxispeak_last_room', cleanCode);
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    const code = joinCode.trim().toUpperCase();
    if (!code) return;

    if (code.length < 4) {
      setJoinError('Please enter a valid room code (at least 4 characters).');
      return;
    }

    saveToHistory(code);
    navigate(`/room/${code}`);
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoomName.trim(),
          leaderId: profile.userId
        })
      });

      if (res.ok) {
        const data = await res.json();
        const code = data.room.code;
        saveToHistory(code);
        setShowCreateModal(false);
        navigate(`/room/${code}`);
        return;
      }
    } catch (err) {
      console.warn('API error during room creation:', err);
    }

    const fallbackCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    saveToHistory(fallbackCode);
    setShowCreateModal(false);
    navigate(`/room/${fallbackCode}`);
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-navy flex flex-col">
      <header className="bg-white border-b border-border sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="10" width="3" height="4" rx="1.5" fill="currentColor" />
                <rect x="8" y="6" width="3" height="12" rx="1.5" fill="currentColor" />
                <rect x="13" y="4" width="3" height="16" rx="1.5" fill="currentColor" />
                <rect x="18" y="9" width="3" height="6" rx="1.5" fill="currentColor" />
              </svg>
            </div>
            <div>
              <span className="text-lg font-bold text-navy tracking-tight leading-none block">ProxiSpeak</span>
              <span className="text-[10px] text-text-muted font-medium">Home Dashboard</span>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              to="/builder"
              className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-navy bg-white hover:bg-surface-bg transition-colors"
            >
              <Compass size={15} className="text-primary" />
              <span>Office Floor Designer</span>
            </Link>

            <button
              onClick={() => {
                localStorage.removeItem('proxispeak_user');
                navigate('/login');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-text-muted hover:text-danger hover:bg-red-50 transition-colors"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-4">Your Identity</h3>
            
            <div className="flex items-center gap-4 mb-5">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-sm border-2 border-white"
                style={{ backgroundColor: profile.color }}
              >
                {profile.avatarIcon}
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="font-bold text-navy text-lg w-full bg-transparent border-b border-dashed border-gray-300 focus:border-primary focus:outline-none pb-0.5"
                  placeholder="Your Name"
                />
                <span className="text-xs text-text-muted block mt-1 font-mono">
                  ID: {profile.userId}
                </span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-navy mb-2">Avatar Icon</label>
              <div className="grid grid-cols-5 gap-2">
                {AVATAR_OPTIONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setProfile({ ...profile, avatarIcon: icon })}
                    className={`h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                      profile.avatarIcon === icon
                        ? 'bg-primary-light border-2 border-primary scale-105'
                        : 'bg-surface-bg border border-border hover:bg-gray-100'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-navy mb-2">Accent Color</label>
              <div className="flex items-center gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setProfile({ ...profile, color: c })}
                    style={{ backgroundColor: c }}
                    className={`w-7 h-7 rounded-full transition-transform ${
                      profile.color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'opacity-85 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-navy flex items-center gap-1.5">
                  <Radio size={14} className="text-primary animate-pulse" />
                  Spatial Canvas Preview
                </span>
                <span className="text-[10px] text-text-muted font-mono">100px Proximity Halo</span>
              </div>
              <DashboardCanvasView profile={profile} />
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#1F3A5F] to-[#2F80ED] text-white rounded-2xl p-6 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-3">
              <Compass size={22} className="text-white" />
            </div>
            <h3 className="text-base font-bold mb-1">Office Floor Designer</h3>
            <p className="text-xs text-blue-100 leading-relaxed mb-4">
              Design and furnish custom office layouts with walls, glass doors, acoustic meeting zones, and desks in a dedicated blueprint editor.
            </p>
            <Link
              to="/builder"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-navy font-bold text-xs rounded-xl shadow-sm hover:bg-blue-50 transition-colors"
            >
              Open Floor Designer
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-border p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-9 h-9 rounded-xl bg-primary-light text-primary flex items-center justify-center mb-3">
                  <KeyRound size={20} />
                </div>
                <h3 className="font-bold text-navy text-base">Join with Room Code</h3>
                <p className="text-xs text-text-muted mt-1 mb-4">
                  Enter an existing team room code or link to jump directly into conversation.
                </p>
              </div>

              <form onSubmit={handleJoinByCode} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g. OFFICE1 or K7X2QA"
                    className="flex-1 px-3.5 py-2 rounded-xl border border-border text-sm font-mono uppercase font-semibold text-navy focus:outline-none focus:ring-2 focus:ring-primary"
                    maxLength={10}
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-hover transition-colors shadow-sm"
                  >
                    Join
                  </button>
                </div>
                {joinError && <p className="text-[11px] text-danger">{joinError}</p>}
              </form>
            </div>

            <div className="bg-white rounded-2xl border border-border p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                  <Plus size={20} />
                </div>
                <h3 className="font-bold text-navy text-base">Create New Office</h3>
                <p className="text-xs text-text-muted mt-1 mb-4">
                  Spin up a fresh virtual room with spatial audio for your startup or sprint team.
                </p>
              </div>

              <button
                onClick={() => setShowCreateModal(true)}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Plus size={16} />
                <span>Create New Room</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-primary" />
                <h3 className="font-bold text-navy text-sm uppercase tracking-wider">Your Room History</h3>
              </div>
              <span className="text-xs text-text-muted">Quick Access</span>
            </div>

            {history.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl bg-surface-bg/50">
                <p className="text-xs text-text-muted">You haven't visited any rooms yet.</p>
                <button
                  onClick={() => {
                    saveToHistory('OFFICE1');
                    navigate('/room/OFFICE1');
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                >
                  Visit Default Office 1 <ArrowRight size={13} />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {history.filter(h => Boolean(h && typeof h === 'string')).map((hCode) => (
                  <div
                    key={hCode}
                    onClick={() => {
                      saveToHistory(hCode);
                      navigate(`/room/${hCode}`);
                    }}
                    className="p-3.5 rounded-xl border border-border hover:border-primary/50 bg-white hover:bg-primary-light/10 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-mono font-bold text-sm text-navy group-hover:text-primary transition-colors">
                        {hCode}
                      </div>
                      <span className="text-[11px] text-text-muted">Recent Space</span>
                    </div>
                    <ArrowRight size={15} className="text-text-muted group-hover:text-primary transition-colors" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-primary" />
                <h3 className="font-bold text-navy text-sm uppercase tracking-wider">Available Offices</h3>
              </div>
              <button
                onClick={fetchRooms}
                className="text-xs text-primary font-semibold hover:underline"
              >
                Refresh
              </button>
            </div>

            {rooms.length === 0 ? (
              <div className="text-center py-6 text-xs text-text-muted">
                Loading available offices...
              </div>
            ) : (
              <div className="space-y-2.5">
                {rooms.filter(rm => rm && rm.code).map((rm) => {
                  const safeCode = String(rm.code || 'OFF');
                  return (
                    <div
                      key={safeCode}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-white hover:border-primary/40 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-light text-primary flex items-center justify-center font-mono font-bold text-sm">
                          {safeCode.substring(0, 3)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-navy text-sm">{rm.name || `Office ${safeCode}`}</h4>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-gray-100 text-gray-700">
                              {safeCode}
                            </span>
                            {rm.leaderId === profile.userId && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                You Own
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-text-muted">
                            {rm.userCount !== undefined ? `${rm.userCount} active now` : 'Ready to join'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          to={`/builder?room=${safeCode}`}
                          className="p-2 rounded-lg text-text-muted hover:text-navy hover:bg-gray-100 transition-colors"
                          title="Edit Room Layout"
                        >
                          <Edit3 size={15} />
                        </Link>
                        <button
                          onClick={() => {
                            saveToHistory(safeCode);
                            navigate(`/room/${safeCode}`);
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-xs"
                        >
                          Enter Office
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-border animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-navy text-lg">Create a Virtual Office</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-text-muted hover:text-navy text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase mb-1.5">
                  Office or Team Name
                </label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g. Design Lab, Core Engineering"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm text-navy focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                  autoFocus
                />
              </div>

              <div className="p-3 bg-surface-bg rounded-xl border border-border text-xs text-text-muted leading-relaxed">
                You will be granted leader permissions for this office, allowing you to reconfigure layout blueprints and host group meetings.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 rounded-xl border border-border text-xs font-semibold text-navy hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-sm"
                >
                  {creating ? 'Creating...' : 'Create & Enter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

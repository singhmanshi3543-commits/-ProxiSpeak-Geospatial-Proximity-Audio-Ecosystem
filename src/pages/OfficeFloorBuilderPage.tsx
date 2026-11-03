import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Save,
  ArrowLeft,
  Trash2,
  Undo2,
  Check,
  Grid,
  Maximize2,
  Info,
  RotateCw
} from 'lucide-react';
import { FurnitureObject } from '../types/furniture';

interface ToolItem {
  type: string;
  label: string;
  icon: string;
  defaultW: number;
  defaultH: number;
  rotatable: boolean;
  blocksMovement: boolean;
  blocksSound: boolean;
}

const TOOLS: ToolItem[] = [
  { type: 'wall', label: 'Wall (Blocks Sound & Motion)', icon: '🧱', defaultW: 20, defaultH: 140, rotatable: true, blocksMovement: true, blocksSound: true },
  { type: 'door', label: 'Glass Door (Passable)', icon: '🚪', defaultW: 20, defaultH: 80, rotatable: true, blocksMovement: false, blocksSound: false },
  { type: 'meeting_zone', label: 'Acoustic Meeting Suite', icon: '🏛️', defaultW: 280, defaultH: 200, rotatable: true, blocksMovement: false, blocksSound: false },
  { type: 'table', label: 'Team Workstation / Desk', icon: '🪑', defaultW: 140, defaultH: 70, rotatable: true, blocksMovement: true, blocksSound: false },
  { type: 'chair', label: 'Ergonomic Swivel Chair', icon: '💺', defaultW: 34, defaultH: 34, rotatable: false, blocksMovement: false, blocksSound: false },
  { type: 'plant', label: 'Potted Fiddle Leaf Fig', icon: '🌿', defaultW: 42, defaultH: 42, rotatable: false, blocksMovement: true, blocksSound: false },
  { type: 'coffee', label: 'Espresso Bar Station', icon: '☕', defaultW: 56, defaultH: 56, rotatable: false, blocksMovement: true, blocksSound: false },
  { type: 'whiteboard', label: 'Magnetic Whiteboard', icon: '📋', defaultW: 130, defaultH: 20, rotatable: true, blocksMovement: true, blocksSound: true }
];

export const OfficeFloorBuilderPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomCode = (searchParams.get('room') || 'OFFICE1').toUpperCase();

  const [selectedTool, setSelectedTool] = useState<string>('wall');
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [furniture, setFurniture] = useState<FurnitureObject[]>([]);
  const [historyStack, setHistoryStack] = useState<FurnitureObject[][]>([]);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    fetch(`/api/rooms/${roomCode}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.furniture) {
          setFurniture(data.furniture);
        }
      })
      .catch(err => console.warn('Could not load room layout:', err));
  }, [roomCode]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const userRaw = localStorage.getItem('proxispeak_user');
      const user = userRaw ? JSON.parse(userRaw) : {};

      const res = await fetch(`/api/rooms/${roomCode}/layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          furniture,
          leaderId: user.userId
        })
      });

      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2500);
      }
    } catch (err) {
      console.warn('Error saving layout:', err);
    } finally {
      setSaving(false);
    }
  };

  const pushHistory = () => {
    setHistoryStack(prev => [...prev.slice(-15), JSON.parse(JSON.stringify(furniture))]);
  };

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const last = historyStack[historyStack.length - 1];
    setFurniture(last);
    setHistoryStack(prev => prev.slice(0, -1));
  };

  const handleRotate = () => {
    setOrientation(prev => prev === 'vertical' ? 'horizontal' : 'vertical');
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    if (snapToGrid) {
      x = Math.round(x / 40) * 40;
      y = Math.round(y / 40) * 40;
    }

    pushHistory();

    const toolDef = TOOLS.find(p => p.type === selectedTool);
    if (!toolDef) return;

    let w = toolDef.defaultW;
    let h = toolDef.defaultH;

    if (toolDef.rotatable && orientation === 'horizontal') {
      w = toolDef.defaultH;
      h = toolDef.defaultW;
    }

    const newObj: FurnitureObject = {
      id: `obj-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: toolDef.type,
      x,
      y,
      w,
      h,
      blocksMovement: toolDef.blocksMovement,
      blocksSound: toolDef.blocksSound,
      label: toolDef.type === 'meeting_zone' ? 'Conference Suite' : undefined
    };

    setFurniture(prev => [...prev, newObj]);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    furniture.forEach((item) => {
      if (item.type === 'meeting_zone') {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
        ctx.fillRect(item.x, item.y, item.w, item.h);
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.strokeRect(item.x, item.y, item.w, item.h);
        ctx.setLineDash([]);

        ctx.fillStyle = '#93c5fd';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.fillText(`🏛️ ${item.label || 'Meeting Room'}`, item.x + 12, item.y + 24);
      } else if (item.type === 'wall') {
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(item.x, item.y, item.w, item.h);
        ctx.strokeStyle = '#cbd5e1';
        ctx.strokeRect(item.x, item.y, item.w, item.h);

        ctx.fillStyle = '#64748b';
        if (item.w > item.h) {
          ctx.fillRect(item.x, item.y + item.h / 2 - 1, item.w, 2);
        } else {
          ctx.fillRect(item.x + item.w / 2 - 1, item.y, 2, item.h);
        }
      } else if (item.type === 'door') {
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(item.x, item.y, item.w, item.h);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText('DOOR', item.x + 2, item.y + item.h / 2 + 3);
      } else if (item.type === 'table') {
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(item.x, item.y, item.w, item.h, 6) : ctx.rect(item.x, item.y, item.w, item.h);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '11px sans-serif';
        ctx.fillText('Desk', item.x + 8, item.y + 18);
      } else if (item.type === 'chair') {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(item.x + item.w / 2, item.y + item.h / 2, item.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.type === 'plant') {
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(item.x + item.w / 2, item.y + item.h / 2, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px sans-serif';
        ctx.fillText('🌿', item.x + 6, item.y + 22);
      } else if (item.type === 'coffee') {
        ctx.fillStyle = '#f97316';
        ctx.fillRect(item.x, item.y, item.w, item.h);
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px sans-serif';
        ctx.fillText('☕', item.x + 14, item.y + 32);
      } else if (item.type === 'whiteboard') {
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#38bdf8';
        ctx.strokeRect(item.x, item.y, item.w, item.h);
        ctx.fillStyle = '#0284c7';
        ctx.font = '10px sans-serif';
        ctx.fillText('Whiteboard', item.x + 8, item.y + 14);
      }
    });
  }, [furniture]);

  const activeToolDef = TOOLS.find(t => t.type === selectedTool);

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col select-none">
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-3.5 flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <Link
            to="/app"
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Dashboard</span>
          </Link>
          <div className="h-4 w-px bg-slate-800" />
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <span>Office Floor Plan Designer</span>
              <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-blue-950 text-blue-400 border border-blue-800">
                {roomCode}
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Select elements, choose orientation, and click canvas to place
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {activeToolDef?.rotatable && (
            <button
              onClick={handleRotate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all shadow-xs"
              title="Toggle between Horizontal (East-West) and Vertical (North-South)"
            >
              <RotateCw size={14} />
              <span>Rotate: {orientation === 'vertical' ? 'Vertical ↕' : 'Horizontal ↔'}</span>
            </button>
          )}

          <button
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              snapToGrid
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/50'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Grid size={14} />
            <span>Snap 40px Grid</span>
          </button>

          <button
            onClick={handleUndo}
            disabled={historyStack.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 transition-all text-slate-300"
          >
            <Undo2 size={14} />
            <span>Undo</span>
          </button>

          <button
            onClick={() => {
              pushHistory();
              setFurniture([]);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800/60 transition-all"
          >
            <Trash2 size={14} />
            <span>Clear Map</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold bg-primary hover:bg-primary-hover text-white shadow-md transition-all"
          >
            {savedSuccess ? <Check size={14} className="text-emerald-300" /> : <Save size={14} />}
            <span>{savedSuccess ? 'Saved to Office!' : saving ? 'Saving...' : 'Save & Publish'}</span>
          </button>

          <button
            onClick={() => navigate(`/room/${roomCode}`)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all"
          >
            <span>Live Office</span>
            <Maximize2 size={14} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 bg-slate-900 border-r border-slate-800 p-5 flex flex-col gap-4 overflow-y-auto">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Architectural Elements
            </h3>
            <p className="text-[11px] text-slate-400 mb-2 leading-normal">
              Select an item below, toggle direction if needed, and place it on the grid.
            </p>

            {activeToolDef?.rotatable && (
              <div className="flex items-center gap-2 p-2 bg-slate-950 rounded-xl border border-slate-800 mb-3">
                <span className="text-[11px] font-semibold text-slate-400">Direction:</span>
                <button
                  onClick={() => setOrientation('horizontal')}
                  className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition-all ${
                    orientation === 'horizontal' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Horizontal ↔
                </button>
                <button
                  onClick={() => setOrientation('vertical')}
                  className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition-all ${
                    orientation === 'vertical' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Vertical ↕
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {TOOLS.map((tool) => (
              <button
                key={tool.type}
                onClick={() => setSelectedTool(tool.type)}
                className={`w-full p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                  selectedTool === tool.type
                    ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-900/30 font-semibold'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700/80'
                }`}
              >
                <span className="text-2xl">{tool.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">{tool.label}</div>
                  <div className={`text-[10px] mt-0.5 ${selectedTool === tool.type ? 'text-blue-100' : 'text-slate-400'}`}>
                    {tool.blocksSound ? 'Sound Occlusion (Muffled)' : 'Open Acoustic Travel'}
                    {tool.rotatable ? ' · Rotatable' : ''}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-auto pt-4 border-t border-slate-800">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-start gap-2 text-xs text-slate-400 leading-relaxed">
              <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
              <span>
                Changes published here immediately update your team's live office workspace.
              </span>
            </div>
          </div>
        </aside>

        <main className="flex-1 bg-slate-950 p-6 flex items-center justify-center overflow-auto">
          <canvas
            ref={canvasRef}
            width={1400}
            height={800}
            onClick={handleCanvasClick}
            className="rounded-xl border border-slate-800 shadow-2xl cursor-crosshair"
          />
        </main>
      </div>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { DashboardCanvas } from '../../canvas/DashboardCanvas';

interface ProfileProps {
  name: string;
  avatarIcon: string;
  color: string;
  userId?: string;
}

interface DashboardCanvasViewProps {
  profile: ProfileProps;
}

const renderer = new DashboardCanvas();

export const DashboardCanvasView: React.FC<DashboardCanvasViewProps> = ({ profile }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pos, setPos] = useState({ x: 170, y: 120 });
  const isDraggingRef = useRef(false);

  const colleaguesRef = useRef([
    { id: '1', name: 'Sarah (Design)', x: 90, y: 80, color: '#10B981', isSpeaking: true },
    { id: '2', name: 'Alex (Backend)', x: 260, y: 170, color: '#F59E0B', isSpeaking: false },
    { id: '3', name: 'Maya (Audio)', x: 230, y: 70, color: '#EC4899', isSpeaking: true },
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = (time: number) => {
      if (!running) return;
      const parent = canvas.parentElement;
      const width = parent ? parent.clientWidth : 340;
      const height = parent ? parent.clientHeight : 240;

      renderer.render(ctx, {
        width,
        height,
        userPos: pos,
        profile,
        colleagues: colleaguesRef.current,
        hearingRadius: 100,
        time,
      });

      requestAnimationFrame(draw);
    };

    const animId = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [pos, profile]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    updateCoordinates(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    updateCoordinates(e);
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const updateCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(25, Math.min(rect.width - 25, e.clientX - rect.left));
    const y = Math.max(25, Math.min(rect.height - 25, e.clientY - rect.top));
    setPos({ x, y });
  };

  return (
    <div className="relative w-full h-64 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 shadow-inner">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full h-full cursor-crosshair touch-none"
      />
      <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-md bg-slate-950/80 border border-slate-700 text-[10px] font-mono text-cyan-400 backdrop-blur-xs pointer-events-none">
        Click / Drag to Test Earshot
      </div>
    </div>
  );
};

export default DashboardCanvasView;

import React, { useEffect, useRef } from 'react';
import { LandingCanvas } from '../../canvas/LandingCanvas';

type TeammateDraw = {
  id: string;
  name: string;
  x: number;
  y: number;
  avatarColor: string;
  status: 'active' | 'speaking' | 'idle';
};

interface LandingOfficeCanvasProps {
  roomWidth: number;
  roomHeight: number;
  userPos: { x: number; y: number };
  teammates: TeammateDraw[];
  hearingRadius: number;
}

const renderer = new LandingCanvas();

export const LandingOfficeCanvas: React.FC<LandingOfficeCanvasProps> = ({
  roomWidth,
  roomHeight,
  userPos,
  teammates,
  hearingRadius,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ userPos, teammates, hearingRadius, roomWidth, roomHeight });

  stateRef.current = { userPos, teammates, hearingRadius, roomWidth, roomHeight };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
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

    const draw = (time: number) => {
      if (!running) return;
      const parent = canvas.parentElement;
      const width = parent?.clientWidth || roomWidth;
      const height = parent?.clientHeight || roomHeight;
      const snapshot = stateRef.current;

      renderer.render(ctx, {
        width,
        height,
        roomWidth: snapshot.roomWidth,
        roomHeight: snapshot.roomHeight,
        userPos: snapshot.userPos,
        teammates: snapshot.teammates,
        hearingRadius: snapshot.hearingRadius,
        time,
      });

      frame = requestAnimationFrame(draw);
    };

    resize();
    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);
    frame = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [roomWidth, roomHeight]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
};

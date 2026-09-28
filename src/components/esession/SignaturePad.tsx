import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export interface SignaturePadHandle {
  clear: () => void;
  toDataURL: () => string;
}

interface SignaturePadProps {
  onChange: (hasInk: boolean) => void;
  label: string;
}

// Draw-to-sign canvas: mouse, pen, and touch via pointer events, sharp on high-DPI screens.
export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad({ onChange, label }, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const points = useRef<{ x: number; y: number }[]>([]);
  const hasInk = useRef(false);

  const context = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return null;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0a0f3d';
    ctx.lineWidth = 2.4 * (window.devicePixelRatio || 1);
    return ctx;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.offsetWidth * ratio);
    canvas.height = Math.round(canvas.offsetHeight * ratio);
  }, []);

  useImperativeHandle(ref, () => ({
    clear: () => {
      const canvas = canvasRef.current;
      canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      hasInk.current = false;
      onChange(false);
    },
    // Transparent PNG, so the signature sits cleanly on any background.
    toDataURL: () => canvasRef.current?.toDataURL('image/png') ?? '',
  }));

  // Map a pointer position to canvas pixels (the dialog may still be scaling in).
  const toCanvas = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * canvas.width, y: ((event.clientY - rect.top) / rect.height) * canvas.height };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer already released (e.g. a pen lifted mid-event); drawing still works without capture.
    }
    drawing.current = true;
    const point = toCanvas(event);
    points.current = [point];
    const ctx = context();
    if (!ctx) return;
    ctx.beginPath();
    ctx.arc(point.x, point.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0f3d';
    ctx.fill();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = context();
    if (!ctx) return;
    const point = toCanvas(event);
    const pts = points.current;
    pts.push(point);
    if (pts.length < 3) return;
    // Smooth the stroke with quadratic curves through the midpoints.
    const [a, b, c] = pts.slice(-3);
    ctx.beginPath();
    ctx.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2);
    ctx.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2);
    ctx.stroke();
    if (!hasInk.current) {
      hasInk.current = true;
      onChange(true);
    }
  };

  const onPointerUp = () => {
    drawing.current = false;
    points.current = [];
  };

  return (
    <div className="relative h-44 w-full overflow-hidden rounded-lg border-2 border-dashed border-border bg-slate-50">
      <span className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-slate-300" aria-hidden />
      <span className="pointer-events-none absolute bottom-4 left-6 select-none text-xs text-text-muted" aria-hidden>
        Sign above the line
      </span>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="img"
        aria-label={label}
      />
    </div>
  );
});

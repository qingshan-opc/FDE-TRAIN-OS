import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type TouchEvent } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function LandingHeroFocus({ src }: { src: string }) {
  const mediaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: 50, y: 58, active: false });
  const [active, setActive] = useState(false);
  const [pos, setPos] = useState({ x: 50, y: 58 });

  const updatePointer = useCallback((clientX: number, clientY: number) => {
    const el = mediaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    pointerRef.current = { x, y, active: true };
    setPos({ x, y });
  }, []);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    updatePointer(e.clientX, e.clientY);
    if (!active) setActive(true);
  };

  const onLeave = () => {
    pointerRef.current.active = false;
    setActive(false);
  };

  const onTouch = (e: TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    updatePointer(touch.clientX, touch.clientY);
    if (!active) setActive(true);
  };

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const canvas = canvasRef.current;
    const host = mediaRef.current;
    if (!canvas || !host) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let particles: Particle[] = [];
    const count = 520;

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.18 - 0.04,
        r: 0.6 + Math.random() * 1.6,
        a: 0.12 + Math.random() * 0.35,
      }));
    };

    const draw = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const { x: px, y: py, active: lit } = pointerRef.current;
      const focusX = (px / 100) * w;
      const focusY = (py / 100) * h;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -8) p.x = w + 8;
        if (p.x > w + 8) p.x = -8;
        if (p.y < -8) p.y = h + 8;
        if (p.y > h + 8) p.y = -8;

        let alpha = p.a * (lit ? 0.95 : 0.45);
        if (lit) {
          const dx = p.x - focusX;
          const dy = p.y - focusY;
          const dist = Math.hypot(dx, dy);
          if (dist < 220) alpha = Math.min(0.85, alpha + (1 - dist / 220) * 0.5);
        }

        ctx.beginPath();
        ctx.fillStyle = `rgba(153, 246, 228, ${alpha})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (lit) {
        const g = ctx.createRadialGradient(focusX, focusY, 0, focusX, focusY, 180);
        g.addColorStop(0, "rgba(45, 212, 191, 0.14)");
        g.addColorStop(0.45, "rgba(13, 148, 136, 0.06)");
        g.addColorStop(1, "rgba(13, 148, 136, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      raf = window.requestAnimationFrame(draw);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    raf = window.requestAnimationFrame(draw);

    return () => {
      ro.disconnect();
      window.cancelAnimationFrame(raf);
    };
  }, []);

  const style = {
    "--hero-focus-x": `${pos.x}%`,
    "--hero-focus-y": `${pos.y}%`,
  } as CSSProperties;

  return (
    <div
      ref={mediaRef}
      className={`landing-hero__media${active ? " is-active" : ""}`}
      style={style}
      onMouseMove={onMove}
      onMouseEnter={onMove}
      onMouseLeave={onLeave}
      onTouchStart={onTouch}
      onTouchMove={onTouch}
      onTouchEnd={onLeave}
      aria-hidden="true"
    >
      <img className="landing-hero__bg landing-hero__bg--blur" src={src} alt="" />
      <img className="landing-hero__bg landing-hero__bg--sharp" src={src} alt="" />
      <canvas ref={canvasRef} className="landing-hero__particles" />
      <div className="landing-hero__glow" />
      <div className="landing-hero__overlay" />
    </div>
  );
}

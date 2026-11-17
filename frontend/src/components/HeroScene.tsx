import { useRef } from "react";
import { MapPin, Watch } from "lucide-react";

/**
 * 3D animated hero scene: a slowly spinning glass cube surrounded by
 * parallax glow orbs and floating item chips. Mouse movement tilts the
 * whole scene through CSS custom properties --mx / --my.
 */
export function HeroScene() {
  const sceneRef = useRef<HTMLDivElement>(null);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = sceneRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const my = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    el.style.setProperty("--mx", mx.toFixed(3));
    el.style.setProperty("--my", my.toFixed(3));
  }

  function handleLeave() {
    const el = sceneRef.current;
    if (!el) return;
    el.style.setProperty("--mx", "0");
    el.style.setProperty("--my", "0");
  }

  const CUBE = 150;
  const HALF = CUBE / 2;

  return (
    <div
      ref={sceneRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className="cube-scene relative mx-auto flex h-[26rem] w-full max-w-md items-center justify-center"
      style={{ ["--mx" as string]: 0, ["--my" as string]: 0 }}
    >
      {/* Glow orbs (parallax layer 1) */}
      <div
        className="animate-pulse-glow absolute left-4 top-10 h-40 w-40 rounded-full bg-primary/40 blur-3xl"
        style={{ transform: "translate3d(calc(var(--mx) * 34px), calc(var(--my) * 34px), 0)" }}
      />
      <div
        className="animate-pulse-glow absolute bottom-8 right-2 h-32 w-32 rounded-full bg-primary-glow/30 blur-3xl"
        style={{
          animationDelay: "1.4s",
          transform: "translate3d(calc(var(--mx) * -44px), calc(var(--my) * -44px), 0)",
        }}
      />

      {/* Floating chips (parallax layer 2) */}
      <div
        className="animate-float absolute left-0 top-8 z-10"
        style={{ transform: "translate3d(calc(var(--mx) * 20px), calc(var(--my) * 20px), 0)" }}
      >
        <div className="glass flex items-center gap-2 rounded-2xl px-4 py-3 shadow-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-lost/15">
            <MapPin className="h-4 w-4 text-lost" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-lost">Lost</p>
            <p className="text-sm font-medium">Blue backpack</p>
          </div>
        </div>
      </div>
      <div
        className="animate-float-slow absolute bottom-10 left-6 z-10"
        style={{ transform: "translate3d(calc(var(--mx) * -28px), calc(var(--my) * -28px), 0)" }}
      >
        <div className="glass flex items-center gap-2 rounded-2xl px-4 py-3 shadow-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-found/15">
            <Watch className="h-4 w-4 text-found" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-found">Found</p>
            <p className="text-sm font-medium">Silver watch</p>
          </div>
        </div>
      </div>
      <div
        className="animate-float absolute right-0 top-24 z-10"
        style={{
          animationDelay: "0.8s",
          transform: "translate3d(calc(var(--mx) * 26px), calc(var(--my) * 26px), 0)",
        }}
      >
        <div className="glass rounded-2xl px-4 py-3 shadow-lg">
          <p className="font-display text-sm font-semibold text-foreground">
            <span className="text-gradient">2,148</span> reunions
          </p>
          <p className="text-xs text-muted-foreground">and counting</p>
        </div>
      </div>

      {/* Spinning cube (parallax layer 3, deepest) */}
      <div
        className="absolute"
        style={{ transform: "translate3d(calc(var(--mx) * -14px), calc(var(--my) * -14px), 0)" }}
      >
        <div
          className="animate-cube cube-body relative"
          style={{ width: CUBE, height: CUBE }}
        >
          <div
            className="cube-face items-center justify-center"
            style={{ transform: `translateZ(${HALF}px)` }}
          >
            <span className="text-4xl font-bold text-foreground">?</span>
          </div>
          <div
            className="cube-face"
            style={{ transform: `rotateY(90deg) translateZ(${HALF}px)` }}
          >
            <span className="text-sm font-bold uppercase tracking-widest text-lost">Lost</span>
          </div>
          <div
            className="cube-face"
            style={{ transform: `rotateY(180deg) translateZ(${HALF}px)` }}
          >
            <span className="text-sm font-bold uppercase tracking-widest text-found">Found</span>
          </div>
          <div
            className="cube-face"
            style={{ transform: `rotateY(-90deg) translateZ(${HALF}px)` }}
          >
            <span className="text-4xl font-bold text-primary-glow">R</span>
          </div>
          <div
            className="cube-face"
            style={{ transform: `rotateX(90deg) translateZ(${HALF}px)` }}
          >
            <span className="text-sm font-bold uppercase tracking-widest text-primary-glow">Reunite</span>
          </div>
          <div
            className="cube-face"
            style={{ transform: `rotateX(-90deg) translateZ(${HALF}px)` }}
          >
            <span className="text-3xl">✦</span>
          </div>
        </div>
      </div>
    </div>
  );
}

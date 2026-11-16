import { useEffect, useRef } from "react";
import type { StageOptions } from "./stage-scene";

/**
 * Full-bleed WebGL stage behind an Arena page. Three.js loads lazily in its own chunk;
 * the page never waits for it.
 */
export function Stage(props: Omit<StageOptions, "reducedMotion">) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { recipe, accent, glow, deep, focus } = props;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let disposed = false;
    let instance: { dispose: () => void } | undefined;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    import("./stage-scene")
      .then(({ createStage }) => {
        if (disposed) return;
        try {
          instance = createStage(canvas, { recipe, accent, glow, deep, focus, reducedMotion });
          canvas.style.opacity = "1";
        } catch {
          // No WebGL: the gradient backdrop below stands in.
        }
      })
      .catch(() => {});
    return () => {
      disposed = true;
      instance?.dispose();
    };
  }, [recipe, accent, glow, deep, focus]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(70% 60% at ${50 + focus * 25}% 40%, color-mix(in oklab, ${accent} 22%, transparent), transparent 70%), ${deep}`,
        }}
      />
      <canvas
        ref={ref}
        className="absolute inset-0 size-full opacity-0 transition-opacity duration-1000"
      />
      {/* On phones the sculpture sits behind the text, so dim it evenly. */}
      <div className="absolute inset-0 bg-[#07080b]/40 md:hidden" />
      {/* Legibility: darken toward the content side and the bottom. */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(${focus >= 0 ? "90deg" : "270deg"}, rgb(7 8 11 / 0.92) 0%, rgb(7 8 11 / 0.55) 42%, transparent 70%), linear-gradient(0deg, rgb(7 8 11 / 0.95) 0%, transparent 45%)`,
        }}
      />
    </div>
  );
}

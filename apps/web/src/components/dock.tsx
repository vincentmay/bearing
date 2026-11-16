import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { SlateMark } from "./brand";
import { DIRECTIONS, type DirectionId } from "../lib/dir";

/**
 * Floating exploration dock: switch the current page between directions, and always say that
 * this is sample data. Deliberately neutral so it reads the same in every direction.
 */
export function Dock({ current }: { current: DirectionId }) {
  const path = useRouterState({ select: (s) => s.location.pathname + s.location.searchStr });
  const navigate = useNavigate();
  const rest = path.replace(/^\/(slate|studio|arena|broadcast|almanac|signal)/, "");
  return (
    <nav
      aria-label="Design directions"
      className="fixed bottom-3 left-1/2 z-50 flex max-w-[calc(100vw-16px)] -translate-x-1/2 items-center gap-0.5 rounded-2xl border border-white/10 bg-[#0d0e12]/88 p-1 text-[#f2efe6] shadow-[0_12px_40px_rgb(0_0_0/0.45)] backdrop-blur-xl max-md:bottom-[76px]"
      style={{
        fontFamily: '"Inter Tight Variable", system-ui',
        fontStyle: "normal",
        textTransform: "none",
        letterSpacing: "normal",
      }}
    >
      <Link
        to="/"
        className="grid size-8 place-items-center rounded-xl text-white/60 hover:bg-white/10 hover:text-white"
        title="All directions"
      >
        <SlateMark size={18} ink="currentColor" />
      </Link>
      <span className="mx-0.5 h-5 w-px bg-white/10" />
      <div className="no-scrollbar flex overflow-x-auto">
        {DIRECTIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => void navigate({ href: `/${d.id}${rest}` })}
            aria-current={d.id === current ? "page" : undefined}
            className={`shrink-0 rounded-xl px-3 py-1.5 text-[13px] font-medium transition-colors ${
              d.id === current
                ? "bg-white text-[#0d0e12]"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            {d.name}
          </button>
        ))}
      </div>
      <span className="mx-0.5 hidden h-5 w-px bg-white/10 lg:block" />
      <span
        className="hidden px-2.5 font-mono text-[10.5px] whitespace-nowrap text-white/50 lg:inline"
        title="Real names, fictional events, generated results"
      >
        Sample week · Sun 15 Nov 19:40
      </span>
    </nav>
  );
}

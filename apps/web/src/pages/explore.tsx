import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Lockup, SlateIcon } from "../components/brand";
import { LiveCard } from "../components/live-card";
import { DIRECTIONS, DirProvider } from "../lib/dir";
import { featuredLive } from "../lib/view";
import { useAtlas } from "../lib/world";

const PAGES = [
  { label: "Now", path: "" },
  { label: "Schedule", path: "/schedule" },
  { label: "Live match", path: "/match/cs2-copenhagen-masters-2026-po-sf2" },
  { label: "Chess board", path: "/match/chess-fall-classic-2026-r6-b1" },
  { label: "Event", path: "/event/cs2-copenhagen-masters-2026?tab=bracket" },
  { label: "Team", path: "/team/cs2-vitality" },
  { label: "Player", path: "/player/cs2-zywoo" },
  { label: "Game", path: "/game/chess" },
];

const TITLE_FONT: Record<string, React.CSSProperties> = {
  slate: { fontFamily: '"Inter Tight Variable"', fontWeight: 740, letterSpacing: "-0.045em" },
  studio: { fontFamily: '"Inter Tight Variable"', fontWeight: 760, letterSpacing: "-0.045em" },
  arena: {
    fontFamily: '"Archivo Variable"',
    fontStretch: "68%",
    fontWeight: 780,
    textTransform: "uppercase",
  },
  broadcast: {
    fontFamily: '"Archivo Variable"',
    fontStretch: "75%",
    fontWeight: 900,
    fontStyle: "italic",
    textTransform: "uppercase",
  },
  almanac: {
    fontFamily: '"Fraunces Variable"',
    fontVariationSettings: '"opsz" 144',
    fontWeight: 560,
    letterSpacing: "-0.03em",
  },
  signal: { fontFamily: '"Geist Mono Variable"', fontWeight: 500, letterSpacing: "-0.04em" },
};

export function Explore() {
  const atlas = useAtlas();
  const featured = featuredLive(atlas);
  return (
    <div
      className="min-h-dvh bg-[#0b0c0f] px-4 py-14 text-[#f2efe6] sm:px-10 sm:py-20"
      style={{ fontFamily: '"Inter Tight Variable", system-ui' }}
    >
      <div className="mx-auto max-w-[1320px]">
        <div className="flex items-center gap-3">
          <Lockup size={34} ink="#f3f1ec" />
          <span className="ml-2 rounded-full border border-white/15 px-2.5 py-0.5 text-[12px] text-white/60">
            Design directions · round 3
          </span>
        </div>
        <h1 className="mt-8 max-w-[880px] text-[34px] leading-[1.08] font-[720] tracking-[-0.035em] sm:text-[52px]">
          One product, six ways it could look and feel.
        </h1>
        <p className="mt-5 max-w-[720px] text-[16px] leading-relaxed text-white/60">
          Every direction is the same complete app: Now, Schedule, match centre, events with
          brackets and standings, teams, players, game hubs, search (Ctrl K) and follows you can
          change. They share one sample week, Sunday 15 November at 19:40, so you're comparing
          design, not content. Use the dock at the bottom of any page to flip it between directions.
        </p>

        <Link
          to="/brand"
          className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.03] py-3 pr-5 pl-3 transition-colors hover:border-white/30"
        >
          <SlateIcon size={40} />
          <span>
            <span className="block text-[15px] font-semibold">The Slate brand</span>
            <span className="block text-[13px] text-white/55">
              Why the name, the mark, colour, type and voice
            </span>
          </span>
          <ArrowUpRight className="size-4 text-white/50" />
        </Link>

        <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {DIRECTIONS.map((d, i) => (
            <article
              key={d.id}
              className="flex flex-col overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.025]"
            >
              <div className="group relative block">
                <DirProvider dir={d.id}>
                  <div
                    data-dir={d.id}
                    className="relative h-[300px] overflow-hidden p-6"
                    style={{ ["--tint" as string]: "#f0a43a" }}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-[28px] leading-none" style={TITLE_FONT[d.id]}>
                        {d.name}
                      </span>
                      <span className="font-mono text-[11px] opacity-50">0{i + 1}</span>
                    </div>
                    <div
                      className="pointer-events-none origin-top-left scale-[0.86]"
                      style={{ width: "116%" }}
                    >
                      {featured && <LiveCard match={featured} />}
                    </div>
                    <div
                      className="absolute inset-x-0 bottom-0 h-16"
                      style={{ background: "linear-gradient(transparent, var(--paper))" }}
                    />
                  </div>
                </DirProvider>
                {/* A sibling overlay link: the preview itself contains links, which must not nest. */}
                <Link
                  to="/$dir"
                  params={{ dir: d.id }}
                  className="absolute inset-0"
                  aria-label={`Open ${d.name}`}
                >
                  <ArrowUpRight className="absolute top-6 right-6 size-5 text-white/0 transition-colors group-hover:text-white/80" />
                </Link>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-[20px] font-semibold">{d.name}</h2>
                  <span className="text-[12px] text-white/45">{d.tone}</span>
                </div>
                <p className="mt-2 text-[14px] leading-relaxed text-white/60">{d.line}</p>
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {PAGES.map((p) => (
                    <a
                      key={p.label}
                      href={`/${d.id}${p.path}`}
                      className="rounded-full border border-white/10 px-3 py-1.5 text-[12.5px] text-white/75 transition-colors hover:border-white/30 hover:text-white"
                    >
                      {p.label}
                    </a>
                  ))}
                </div>
              </div>
            </article>
          ))}
          <article className="flex flex-col justify-between rounded-[24px] border border-dashed border-white/15 p-6 text-[14px] leading-relaxed text-white/60">
            <div>
              <h2 className="text-[20px] font-semibold text-white">How to choose</h2>
              <ul className="mt-3 space-y-2">
                <li>Open the same page in each direction with the dock and compare.</li>
                <li>
                  Mixing is fine: Signal's timeline in Studio, Almanac's written headlines in Arena.
                </li>
                <li>
                  The live CS2 semifinal, the chess board and the Trackmania cup are the richest
                  pages.
                </li>
              </ul>
            </div>
            <p className="mt-6 text-[12.5px] text-white/40">
              Names are real; events, results and stats are generated. Nothing here is live data.
            </p>
          </article>
        </div>
      </div>
    </div>
  );
}

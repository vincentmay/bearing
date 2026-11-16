import { Link } from "@tanstack/react-router";
import { ArrowLeft, Bell, Check, X } from "lucide-react";
import type { ReactNode } from "react";
import {
  BRAND,
  Lockup,
  MARK_DOT,
  MARK_PATHS,
  SlateIcon,
  SlateMark,
  Wordmark,
} from "../components/brand";
import { DirProvider } from "../lib/dir";

/**
 * The Slate brand, documented in the house style it defines.
 */
export function BrandPage() {
  return (
    <DirProvider dir="slate">
      <div data-dir="slate" className="min-h-dvh">
        <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-6 px-4 sm:px-8">
            <Lockup size={28} ink="var(--ink)" />
            <span className="text-[13px] font-medium text-muted">Brand</span>
            <Link
              to="/"
              className="ml-auto flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink"
            >
              <ArrowLeft className="size-4" /> Directions
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-[1180px] space-y-28 px-4 pt-16 pb-32 sm:px-8">
          <Hero />
          <Meaning />
          <Mark />
          <Lockups />
          <Colour />
          <Type />
          <Voice />
          <Motion />
          <InUse />
          <Donts />
        </main>
      </div>
    </DirProvider>
  );
}

function Chapter({
  n,
  title,
  lead,
  children,
}: {
  n: string;
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="grid gap-6 border-t border-ink pt-6 md:grid-cols-[220px_1fr]">
        <div className="ui-kicker">{n}</div>
        <div>
          <h2 className="ui-h1 !text-[36px] sm:!text-[48px]">{title}</h2>
          <p className="mt-4 max-w-[640px] text-[17px] leading-relaxed text-muted">{lead}</p>
        </div>
      </div>
      <div className="mt-10">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------

function Hero() {
  return (
    <section className="grid items-end gap-12 lg:grid-cols-[1.1fr_1fr]">
      <div>
        <div className="ui-kicker">Brand guide · v1</div>
        <h1 className="mt-6 text-[56px] leading-[0.95] font-[740] tracking-[-0.05em] sm:text-[88px]">
          The whole slate,
          <br />
          at a glance.
        </h1>
        <p className="mt-6 max-w-[560px] text-[18px] leading-relaxed text-muted">
          Slate tells you what's on, what's next and how everyone got here, across every game you
          follow. The brand should feel like the product: clean, solid, exact. Nothing loud, nothing
          decorative, nothing guessed.
        </p>
      </div>
      <div
        className="relative overflow-hidden rounded-[16px] p-10 sm:p-14"
        style={{ background: BRAND.slate900 }}
      >
        <Strata />
        <div className="relative flex flex-col items-start gap-10">
          <SlateIcon size={88} />
          <Lockup size={64} ink={BRAND.chalk} />
        </div>
      </div>
    </section>
  );
}

/** Faint horizontal grain, the stone's strata. Used sparingly behind graphite surfaces. */
function Strata({ opacity = 0.04 }: { opacity?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {[14, 31, 38, 63, 71, 88].map((y) => (
        <span
          key={y}
          className="absolute inset-x-0 h-px"
          style={{ top: `${y}%`, background: `rgb(255 255 255 / ${opacity})` }}
        />
      ))}
    </div>
  );
}

function Meaning() {
  return (
    <Chapter
      n="01 · The name"
      title="Three meanings, one word"
      lead="We didn't pick Slate for how it sounds. Each of its meanings describes something the product does, and the identity is built from all three."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          title="A slate is a schedule"
          body="The day's slate is its line-up of games. That is the product: the whole slate, in order, in your time zone."
        >
          <div className="space-y-2">
            {[
              ["18:00", "Vitality v Aurora", true],
              ["19:00", "Round 6 · four boards", true],
              ["21:00", "Cup Finals QF D", false],
            ].map(([t, label, live]) => (
              <div key={String(label)} className="flex items-center gap-3 text-[14px]">
                <span className="w-12 font-mono text-[12.5px] text-muted">{t}</span>
                <span
                  className="h-[14px] flex-1 [clip-path:var(--slab)]"
                  style={{ background: "var(--raised)" }}
                />
                <span className="w-[150px] truncate font-medium">{label}</span>
                {live ? (
                  <span className="size-1.5 rounded-full bg-live" />
                ) : (
                  <span className="size-1.5" />
                )}
              </div>
            ))}
          </div>
        </Card>
        <Card
          title="Slate is a stone"
          body="Dense, layered, splits into clean flat sheets and lasts for centuries. Solid without being heavy: the feeling we want every screen to have."
        >
          <div
            className="relative h-[92px] overflow-hidden rounded-[8px]"
            style={{ background: BRAND.slate700 }}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="absolute left-0 h-[14px]"
                style={{
                  top: 6 + i * 17,
                  width: `${[86, 64, 94, 52, 78][i]}%`,
                  background: [
                    BRAND.slate500,
                    BRAND.slate300,
                    BRAND.slate500,
                    "#5b6876",
                    BRAND.slate500,
                  ][i],
                  clipPath: "polygon(0 0, 100% 0, calc(100% - 6px) 100%, 0 100%)",
                  opacity: 0.9,
                }}
              />
            ))}
          </div>
        </Card>
        <Card
          title="A chalk slate is a scoreboard"
          body="Fixtures and scores were written up on slates long before screens. Chalk on graphite gives us the palette, and the plain, legible voice."
        >
          <div
            className="relative grid h-[92px] place-items-center overflow-hidden rounded-[8px]"
            style={{ background: BRAND.graphite }}
          >
            <Strata opacity={0.05} />
            <span
              className="relative font-mono text-[26px] tracking-[-0.02em]"
              style={{ color: BRAND.chalk }}
            >
              VIT 1–0 AUR
            </span>
          </div>
        </Card>
      </div>
    </Chapter>
  );
}

function Card({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <div className="ui-card flex flex-col gap-6 p-6">
      {children}
      <div>
        <h3 className="ui-h3 text-[19px]">{title}</h3>
        <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{body}</p>
      </div>
    </div>
  );
}

function Mark() {
  const s = 12; // px per grid unit
  return (
    <Chapter
      n="02 · The mark"
      title="Three lines and a moment"
      lead="Three slabs, split at the right edge the way slate cleaves, set like lines written on a slate. The last line is short because the slate is still being written, and the flare dot is where the writing is: now. It is the only colour in the mark, and in the product it only ever means live."
    >
      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <div className="ui-card relative p-6">
          <svg
            width={32 * s}
            height={32 * s}
            viewBox="0 0 32 32"
            className="max-w-full"
            style={{ height: "auto" }}
            role="img"
            aria-label="Mark construction"
          >
            {Array.from({ length: 33 }, (_, i) => (
              <g key={i}>
                <line
                  x1={i}
                  y1={0}
                  x2={i}
                  y2={32}
                  stroke="var(--line)"
                  strokeWidth={i % 4 === 0 ? 0.06 : 0.03}
                />
                <line
                  x1={0}
                  y1={i}
                  x2={32}
                  y2={i}
                  stroke="var(--line)"
                  strokeWidth={i % 4 === 0 ? 0.06 : 0.03}
                />
              </g>
            ))}
            <rect
              x="6"
              y="8"
              width="20"
              height="16"
              fill="none"
              stroke={BRAND.slate300}
              strokeWidth="0.06"
              strokeDasharray="0.4 0.3"
            />
            {MARK_PATHS.map((d) => (
              <path key={d} d={d} fill="var(--ink)" />
            ))}
            <circle {...MARK_DOT} fill={BRAND.flare} />
            <g fontFamily="var(--mono)" fontSize="0.9" fill={BRAND.slate300}>
              <text x="27" y="9.2">
                4.4 slab
              </text>
              <text x="27" y="15.6">
                1.4 gap
              </text>
              <text x="22" y="27">
                1.6 cleave
              </text>
              <text x="22.6" y="22.2">
                r 2.2 · now
              </text>
              <text x="6" y="6.6">
                6 · 32-unit grid
              </text>
            </g>
          </svg>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Rule
            title="Proportions"
            body="Slabs are 4.4 units tall with 1.4 between them. Lengths are 20, 16.5 and 9.5: two written lines and one in progress, so it reads as writing, never as a letter."
          />
          <Rule
            title="The cleave"
            body="Each slab's right edge falls back 1.6 units. It's the one detail that makes the bars stone rather than lines. Never round it."
          />
          <Rule
            title="The dot"
            body="Radius 2.2, on the last line, one cleave-width after it: a cursor. Flare #FF5A36. On colour grounds it takes the slab colour instead (see lockups)."
          />
          <Rule
            title="Footprint"
            body="The slabs span 6 to 26 on the grid, centred on the tile. The dot sits inside that box, so the mark keeps its footprint with or without it."
          />
        </div>
      </div>
    </Chapter>
  );
}

function Rule({ title, body }: { title: string; body: string }) {
  return (
    <div className="ui-card p-5">
      <div className="ui-h3">{title}</div>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function Lockups() {
  return (
    <Chapter
      n="03 · Lockups"
      title="Mark, wordmark, icon"
      lead="The wordmark is set lowercase in Inter Tight at weight 740 with tight spacing: it's a word you'd write on a slate, not a shout. The gap between mark and word is a fifth of the mark. Keep clear space of one slab height all round."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Tile bg={BRAND.chalk} label="Primary · on chalk">
          <Lockup size={56} ink={BRAND.graphite} />
        </Tile>
        <Tile bg={BRAND.graphite} label="Primary · on graphite">
          <Lockup size={56} ink={BRAND.chalk} />
        </Tile>
        <Tile bg="#ffd400" label="On colour · single colour, dot included">
          <Lockup size={56} ink={BRAND.graphite} dot={BRAND.graphite} />
        </Tile>
        <Tile bg={BRAND.slate500} label="On slate · chalk with flare">
          <Lockup size={56} ink={BRAND.chalk} />
        </Tile>
      </div>
      <div className="ui-card mt-4 flex flex-wrap items-end gap-10 p-8">
        {[128, 72, 48, 32, 20, 16].map((n) => (
          <div key={n} className="flex flex-col items-center gap-3">
            <SlateIcon size={n} />
            <span className="font-mono text-[11px] text-muted">{n}px</span>
          </div>
        ))}
        <div className="ml-auto flex flex-col items-start gap-3">
          <div className="flex items-center gap-3">
            <SlateMark size={24} ink="var(--ink)" />
            <Wordmark size={19} />
          </div>
          <span className="font-mono text-[11px] text-muted">Smallest lockup: 24px mark</span>
        </div>
      </div>
    </Chapter>
  );
}

function Tile({ bg, label, children }: { bg: string; label: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-line">
      <div className="grid h-[180px] place-items-center" style={{ background: bg }}>
        {children}
      </div>
      <div className="bg-surface px-5 py-3 text-[13px] text-muted">{label}</div>
    </div>
  );
}

const SWATCHES: { name: string; hex: string; role: string; ink?: string }[] = [
  {
    name: "Graphite",
    hex: BRAND.graphite,
    role: "Text, primary buttons, the slab",
    ink: BRAND.chalk,
  },
  {
    name: "Slate 900",
    hex: BRAND.slate900,
    role: "Dark surfaces, featured match",
    ink: BRAND.chalk,
  },
  {
    name: "Slate 700",
    hex: BRAND.slate700,
    role: "Icon tile, raised dark surfaces",
    ink: BRAND.chalk,
  },
  { name: "Slate 500", hex: BRAND.slate500, role: "Secondary text on chalk", ink: BRAND.chalk },
  {
    name: "Slate 300",
    hex: BRAND.slate300,
    role: "Secondary text on graphite",
    ink: BRAND.graphite,
  },
  {
    name: "Slate 100",
    hex: BRAND.slate100,
    role: "Hairlines in cool contexts",
    ink: BRAND.graphite,
  },
  { name: "Chalk", hex: BRAND.chalk, role: "Page, text on graphite", ink: BRAND.graphite },
  { name: "Flare", hex: BRAND.flare, role: "Now. Live. Nothing else.", ink: BRAND.graphite },
];

function Colour() {
  return (
    <Chapter
      n="04 · Colour"
      title="Chalk, graphite, slate, one flare"
      lead="A quiet, stone palette so the colour that matters can belong to someone else: teams and games bring their own colours to their own pages. Flare is the brand's only accent, and it's reserved for one meaning."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SWATCHES.map((s) => (
          <div key={s.name} className="overflow-hidden rounded-[var(--radius)] border border-line">
            <div className="flex h-28 items-end p-4" style={{ background: s.hex, color: s.ink }}>
              <span className="font-mono text-[12px]">{s.hex}</span>
            </div>
            <div className="bg-surface p-4">
              <div className="font-semibold">{s.name}</div>
              <div className="mt-1 text-[12.5px] text-muted">{s.role}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <div className="mb-2 text-[13px] text-muted">Proportion on a typical screen</div>
        <div className="flex h-10 overflow-hidden rounded-[8px]">
          <span
            className="grid place-items-center text-[11px]"
            style={{ flex: 62, background: BRAND.chalk, color: BRAND.slate500 }}
          >
            Chalk 62
          </span>
          <span
            className="grid place-items-center text-[11px]"
            style={{ flex: 18, background: BRAND.graphite, color: BRAND.chalk }}
          >
            Graphite 18
          </span>
          <span
            className="grid place-items-center text-[11px]"
            style={{ flex: 12, background: BRAND.slate500, color: BRAND.chalk }}
          >
            Slate 12
          </span>
          <span
            className="grid place-items-center text-[11px]"
            style={{
              flex: 6,
              background: "linear-gradient(90deg,#f5e50a,#9b7bff,#e2012d)",
              color: BRAND.graphite,
            }}
          >
            Teams 6
          </span>
          <span style={{ flex: 2, background: BRAND.flare }} title="Flare 2" />
        </div>
      </div>
    </Chapter>
  );
}

function Type() {
  return (
    <Chapter
      n="05 · Type"
      title="One family for words, one for time"
      lead="Inter Tight carries everything you read: headlines tight and heavy, body plain. Geist Mono carries everything you scan: kick-off times, clocks, scorelines in tables. Figures are always tabular so columns of numbers line up like a scoreboard."
    >
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="ui-card space-y-6 p-8">
          <div>
            <div className="font-mono text-[11px] text-muted">
              Display · Inter Tight 740 · −4.5%
            </div>
            <div className="mt-2 text-[56px] leading-none font-[740] tracking-[-0.045em]">
              Vitality lead Aurora
            </div>
          </div>
          <div>
            <div className="font-mono text-[11px] text-muted">
              Heading · Inter Tight 720 · −3.5%
            </div>
            <div className="mt-2 text-[28px] font-[720] tracking-[-0.035em]">
              Copenhagen Masters, semifinal
            </div>
          </div>
          <div>
            <div className="font-mono text-[11px] text-muted">Body · Inter Tight 450 · 16/1.6</div>
            <p className="mt-2 max-w-[520px] text-[16px] leading-relaxed">
              Vitality took Nuke 13–0, and Anubis is 9–7 to Vitality. The winner plays Spirit in the
              grand final, tomorrow at 18:00.
            </p>
          </div>
          <div>
            <div className="font-mono text-[11px] text-muted">
              Label · Inter Tight 650 · on a slab
            </div>
            <div className="ui-kicker mt-2">Coming up for you</div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="ui-card p-8" style={{ background: BRAND.graphite, color: BRAND.chalk }}>
            <div className="font-mono text-[11px]" style={{ color: BRAND.slate300 }}>
              Data · Geist Mono
            </div>
            <div className="mt-3 font-mono text-[44px] leading-none tracking-[-0.03em]">19:40</div>
            <div className="mt-4 space-y-1 font-mono text-[15px]">
              <div className="flex justify-between">
                <span>Nuke</span>
                <span>13–0</span>
              </div>
              <div className="flex justify-between">
                <span>Anubis</span>
                <span>9–7</span>
              </div>
              <div className="flex justify-between" style={{ color: BRAND.slate300 }}>
                <span>Dust2</span>
                <span>—</span>
              </div>
            </div>
          </div>
          <div className="ui-card p-6 text-[14px] leading-relaxed text-muted">
            Directions may add a display face of their own (Archivo for Arena and Broadcast,
            Fraunces for Almanac), but the wordmark is always Inter Tight.
          </div>
        </div>
      </div>
    </Chapter>
  );
}

const VOICE: [string, string, string][] = [
  ["Plain", "Vitality lead Aurora in the semifinal.", "Vitality are DOMINATING Aurora!!"],
  ["Exact", "Tomorrow 18:00 · in 22 h", "Tomorrow evening"],
  [
    "Calm",
    "T1 are out. Nothing else is scheduled for them this year.",
    "Heartbreak for T1 fans 💔",
  ],
  [
    "Honest",
    "Ratings are illustrative. Source: Slate design sample, checked 19:40.",
    "(no source)",
  ],
];

function Voice() {
  return (
    <Chapter
      n="06 · Voice"
      title="Say what happened"
      lead="Slate writes like a good scoreboard reads: who, what, when, exactly. Numbers beat adjectives, local times beat vague ones, and when we don't know something we say so. Excitement comes from the games, not from our copy."
    >
      <div className="ui-card overflow-hidden">
        {VOICE.map(([k, yes, no], i) => (
          <div
            key={k}
            className={`grid gap-4 p-5 sm:grid-cols-[140px_1fr_1fr] sm:p-6 ${i ? "border-t border-line" : ""}`}
          >
            <div className="ui-h3">{k}</div>
            <div className="flex gap-2.5 text-[15px]">
              <Check className="mt-0.5 size-4 shrink-0 text-win" /> {yes}
            </div>
            <div className="flex gap-2.5 text-[15px] text-muted line-through decoration-loss/50">
              <X className="mt-0.5 size-4 shrink-0 text-loss" /> {no}
            </div>
          </div>
        ))}
      </div>
    </Chapter>
  );
}

function Motion() {
  return (
    <Chapter
      n="07 · Motion and detail"
      title="Things settle; only now moves"
      lead="Content arrives the way a slab is set down: a short rise and a firm stop, no bounce. The only thing that moves on its own is the live dot. Everything respects reduced motion."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div className="ui-card p-6">
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="rise-in block h-4 bg-ink [clip-path:var(--slab)]"
                style={{ width: `${[70, 100, 46][i]}%`, animationDelay: `${i * 90}ms` }}
              />
            ))}
          </div>
          <div className="mt-5 ui-h3">Settle</div>
          <p className="mt-1 text-[14px] text-muted">
            8px rise, 550 ms, ease-out. Lists stagger by 90 ms.
          </p>
        </div>
        <div className="ui-card p-6">
          <div className="flex h-[60px] items-center gap-3 text-[15px] font-semibold">
            <span className="live-dot size-2.5 rounded-full bg-live" /> Live
          </div>
          <div className="mt-5 ui-h3">The pulse</div>
          <p className="mt-1 text-[14px] text-muted">
            1.6 s breathing pulse on the flare dot. Never on anything else.
          </p>
        </div>
        <div className="ui-card p-6">
          <div className="flex h-[60px] items-end gap-6">
            <span className="ui-kicker">Label</span>
            <span className="relative pb-2 text-[14px] font-medium">
              Selected
              <span className="absolute inset-x-0 -bottom-px h-1 bg-ink [clip-path:var(--slab)]" />
            </span>
          </div>
          <div className="mt-5 ui-h3">The slab, small</div>
          <p className="mt-1 text-[14px] text-muted">
            Labels and selected tabs carry a tiny cleaved slab: the mark's one idea, reused.
          </p>
        </div>
      </div>
    </Chapter>
  );
}

function InUse() {
  return (
    <Chapter
      n="08 · In use"
      title="Where people meet it"
      lead="Most people meet Slate outside the app: on a home screen, in a notification, in a calendar, in a link someone shared. Each should be recognisable at a glance and useful on its own."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div
          className="ui-card flex flex-col items-center justify-center gap-4 p-8"
          style={{ background: "linear-gradient(160deg,#3b4552,#1b2027)" }}
        >
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 8 }, (_, i) =>
              i === 5 ? (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <SlateIcon size={56} rounded={0.23} />
                  <span className="text-[11px] text-white">Slate</span>
                </div>
              ) : (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <span className="size-14 rounded-[13px] bg-white/10" />
                  <span className="h-2 w-8 rounded bg-white/10" />
                </div>
              ),
            )}
          </div>
          <span className="text-[12px] text-white/60">Home screen</span>
        </div>
        <div className="space-y-4">
          <div className="ui-card p-4">
            <div className="flex items-center gap-2 text-[12px] text-muted">
              <SlateIcon size={18} /> Slate · now
              <Bell className="ml-auto size-3.5" />
            </div>
            <div className="mt-2 text-[15px] font-semibold">Vitality 1–0 Aurora</div>
            <div className="text-[14px] text-muted">
              Anubis is 9–7 to Vitality. Winner plays Spirit tomorrow at 18:00.
            </div>
          </div>
          <div className="ui-card p-4">
            <div className="flex items-center gap-2 text-[12px] text-muted">
              <SlateIcon size={18} /> Slate · in 15 min
            </div>
            <div className="mt-2 text-[15px] font-semibold">Carlsen v Praggnanandhaa</div>
            <div className="text-[14px] text-muted">Fall Classic, round 7 · 19:00</div>
          </div>
          <div className="ui-card flex gap-3 p-4">
            <span className="w-1 rounded-full bg-ink" />
            <div>
              <div className="text-[14px] font-semibold">VIT v AUR · CPH Masters SF</div>
              <div className="text-[12.5px] text-muted">Sun 18:00–20:05 · added by Slate</div>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[var(--radius)] border border-line">
            <img src="/og.svg" alt="Slate link preview card" className="block w-full" />
            <div className="bg-surface px-4 py-3">
              <div className="text-[12px] text-muted">slate.gg</div>
              <div className="text-[14px] font-semibold">
                Vitality v Aurora · Copenhagen Masters
              </div>
            </div>
          </div>
          <div className="ui-card flex items-center gap-3 p-3">
            <span className="flex items-center gap-2 rounded-[8px] bg-raised px-3 py-1.5 text-[12.5px]">
              <img src="/favicon.svg" alt="" className="size-4" /> Vitality v Aurora · Slate
            </span>
            <span className="text-[12px] text-muted">Browser tab</span>
          </div>
        </div>
      </div>
      <p className="mt-4 text-[12.5px] text-faint">
        The domain shown is a placeholder, not a registered address.
      </p>
    </Chapter>
  );
}

function Donts() {
  const items: { label: string; node: ReactNode }[] = [
    {
      label: "Don't recolour the dot",
      node: <SlateMark size={72} ink="var(--ink)" dot="#3d8bff" />,
    },
    { label: "Don't round the cleave", node: <RoundedMark /> },
    {
      label: "Don't rotate or skew",
      node: (
        <span className="inline-block -rotate-12">
          <SlateMark size={72} ink="var(--ink)" />
        </span>
      ),
    },
    {
      label: "Don't capitalise the wordmark",
      node: <span className="text-[34px] font-[740] tracking-[-0.045em]">SLATE</span>,
    },
    {
      label: "Don't add effects",
      node: (
        <span
          style={{
            filter:
              "drop-shadow(0 6px 6px rgb(0 0 0 / .45)) drop-shadow(0 0 10px rgb(255 90 54 / .7))",
          }}
        >
          <SlateMark size={72} ink="#7a8796" />
        </span>
      ),
    },
    {
      label: "Don't use flare for anything but now",
      node: (
        <span className="rounded-[8px] bg-[#ff5a36] px-4 py-2 text-[14px] font-semibold text-white">
          Buy tickets
        </span>
      ),
    },
  ];
  return (
    <Chapter
      n="09 · Don'ts"
      title="Keep it solid"
      lead="The identity works because it's simple. Most ways of breaking it come from trying to make it louder."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {items.map((it) => (
          <div key={it.label} className="ui-card overflow-hidden">
            <div className="relative grid h-[150px] place-items-center">
              {it.node}
              <X className="absolute top-3 right-3 size-5 text-loss" />
            </div>
            <div className="border-t border-line px-4 py-3 text-[13.5px]">{it.label}</div>
          </div>
        ))}
      </div>
    </Chapter>
  );
}

function RoundedMark() {
  return (
    <svg width={72} height={72} viewBox="0 0 32 32" aria-hidden>
      {[
        [6, 8, 20],
        [6, 13.8, 16.5],
        [6, 19.6, 9.5],
      ].map(([x, y, w]) => (
        <rect key={y} x={x} y={y} width={w} height={4.4} rx={2.2} fill="var(--ink)" />
      ))}
      <circle {...MARK_DOT} fill={BRAND.flare} />
    </svg>
  );
}

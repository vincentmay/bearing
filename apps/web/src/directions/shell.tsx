import { clock, longDate, seriesScore, zoneName } from "@bearing/domain";
import { CalendarDays, Moon, Radio, Search, Star, Sun, Trophy } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Lockup, SlateIcon, Wordmark } from "../components/brand";
import { Dock } from "../components/dock";
import { GameLink, MatchLink, SectionLink, type Section } from "../components/links";
import { Mark } from "../components/mark";
import { SearchPalette, useSearchHotkey } from "../components/search";
import { LiveDot } from "../components/ui";
import { useDir, type DirectionId } from "../lib/dir";
import { useMood } from "../lib/mood";
import { useAtlas, useNow } from "../lib/world";
import { Stage } from "./arena/stage";

const NAV: { id: Section; label: string; icon: typeof Radio }[] = [
  { id: "now", label: "Now", icon: Radio },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "events", label: "Events", icon: Trophy },
  { id: "following", label: "Following", icon: Star },
];

type Theme = "system" | "light" | "dark";

function useTheme(dir: DirectionId): [Theme, (t: Theme) => void, boolean] {
  const key = `slate.theme.${dir}`;
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const v = localStorage.getItem(key);
      return v === "light" || v === "dark" ? v : "system";
    } catch {
      return "system";
    }
  });
  useEffect(() => {
    try {
      if (theme === "system") localStorage.removeItem(key);
      else localStorage.setItem(key, theme);
    } catch {
      // Not remembered in private mode.
    }
  }, [key, theme]);
  const systemDark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return [theme, setTheme, theme === "dark" || (theme === "system" && systemDark)];
}

/** Picks the direction's shell and wires search, tint and the dock. */
export function Shell({ children }: { children: ReactNode }) {
  const dir = useDir();
  const atlas = useAtlas();
  const mood = useMood();
  const [open, setOpen] = useState(false);
  const openSearch = useCallback(() => setOpen(true), []);
  useSearchHotkey(openSearch);
  const [theme, setTheme, dark] = useTheme(dir);

  const discipline = mood.discipline ? atlas.discipline(mood.discipline) : undefined;
  const tint = mood.tint ?? discipline?.palette.accent;
  const style = tint ? ({ "--tint": tint } as React.CSSProperties) : undefined;
  const themeToggle =
    dir === "slate" || dir === "studio" || dir === "almanac" ? (
      <button
        type="button"
        onClick={() => setTheme(dark ? "light" : "dark")}
        className="grid size-9 place-items-center rounded-full text-muted hover:text-ink"
        aria-label={dark ? "Use light theme" : "Use dark theme"}
      >
        {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </button>
    ) : null;

  const props = { openSearch, themeToggle, children };
  return (
    <div
      data-dir={dir}
      data-theme={theme === "system" ? undefined : theme}
      className="relative min-h-dvh"
      style={style}
    >
      {dir === "slate" && <SlateShell {...props} />}
      {dir === "studio" && <StudioShell {...props} />}
      {dir === "arena" && <ArenaShell {...props} />}
      {dir === "broadcast" && <BroadcastShell {...props} />}
      {dir === "almanac" && <AlmanacShell {...props} />}
      {dir === "signal" && <SignalShell {...props} />}
      <SearchPalette open={open} onClose={() => setOpen(false)} />
      <Dock current={dir} />
    </div>
  );
}

interface ShellProps {
  openSearch: () => void;
  themeToggle: ReactNode;
  children: ReactNode;
}

function Footer({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`mx-auto max-w-[1280px] px-4 pt-16 pb-32 text-[12px] text-faint sm:px-8 ${className}`}
    >
      Slate · design sample. Real names; fictional events and generated results. Nothing here is
      live data. Times in {zoneName()}.
    </footer>
  );
}

function GamesNav({ className = "", itemClass = "" }: { className?: string; itemClass?: string }) {
  const atlas = useAtlas();
  return (
    <div className={className}>
      {atlas.world.disciplines.map((d) => (
        <GameLink key={d.id} id={d.id} className={itemClass}>
          {d.short}
        </GameLink>
      ))}
    </div>
  );
}

function liveCount(atlas: ReturnType<typeof useAtlas>) {
  return atlas.live().length;
}

// ---------------------------------------------------------------------------------------------
// Slate: the house style. A quiet chalk bar, the lockup, plain words, the local time.

function SlateShell({ openSearch, themeToggle, children }: ShellProps) {
  const atlas = useAtlas();
  const now = useNow();
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-8 px-4 sm:px-8">
          <SectionLink to="now" className="text-ink" title="Slate">
            <Lockup size={28} ink="var(--ink)" />
          </SectionLink>
          <nav className="hidden h-full items-stretch gap-6 md:flex">
            {NAV.map((n) => (
              <SectionLink
                key={n.id}
                to={n.id}
                className="relative flex items-center gap-1.5 text-[14px] font-medium text-muted transition-colors hover:text-ink aria-[current=page]:text-ink aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-0 aria-[current=page]:after:-bottom-px aria-[current=page]:after:h-1 aria-[current=page]:after:bg-ink aria-[current=page]:after:[clip-path:var(--slab)]"
              >
                {n.label}
                {n.id === "now" && liveCount(atlas) > 0 && (
                  <span className="live-dot size-1.5 rounded-full bg-live" />
                )}
              </SectionLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span
              className="hidden font-mono text-[12.5px] text-muted sm:inline"
              title={`Local time, ${zoneName()}`}
            >
              {time} <span className="text-faint">{zoneName()}</span>
            </span>
            <button
              type="button"
              onClick={openSearch}
              className="flex h-9 items-center gap-2 rounded-[8px] border border-line bg-surface px-3 text-[13.5px] text-muted hover:text-ink"
            >
              <Search className="size-4" />
              <span className="hidden lg:inline">Search</span>
              <kbd className="hidden font-mono text-[10.5px] text-faint lg:inline">Ctrl K</kbd>
            </button>
            {themeToggle}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-4 pt-8 sm:px-8 sm:pt-10">{children}</main>
      <Footer />
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-5">
          {NAV.map((n) => (
            <SectionLink
              key={n.id}
              to={n.id}
              className="flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium text-muted aria-[current=page]:text-ink"
            >
              <n.icon className="size-5" />
              {n.label}
            </SectionLink>
          ))}
          <button
            type="button"
            onClick={openSearch}
            className="flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium text-muted"
          >
            <Search className="size-5" />
            Search
          </button>
        </div>
      </nav>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Studio: app chrome. Segmented nav on desktop, bottom tab bar on phones.

function StudioShell({ openSearch, themeToggle, children }: ShellProps) {
  const atlas = useAtlas();
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-4 px-4 sm:px-8">
          <SectionLink to="now" className="flex items-center gap-2.5">
            <SlateIcon size={32} />
            <Wordmark size={21} />
          </SectionLink>
          <nav className="mx-auto hidden items-center gap-1 rounded-full bg-surface p-1 shadow-[var(--shadow)] md:flex">
            {NAV.map((n) => (
              <SectionLink
                key={n.id}
                to={n.id}
                className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[14px] font-medium text-muted transition-colors hover:text-ink aria-[current=page]:bg-ink aria-[current=page]:text-paper"
              >
                {n.label}
                {n.id === "now" && liveCount(atlas) > 0 && <LiveDot className="ml-0.5" />}
              </SectionLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <button
              type="button"
              onClick={openSearch}
              className="flex h-9 items-center gap-2 rounded-full bg-surface px-3.5 text-[13.5px] text-muted shadow-[var(--shadow)] hover:text-ink"
            >
              <Search className="size-4" />
              <span className="hidden lg:inline">Search</span>
              <kbd className="hidden rounded bg-raised px-1.5 font-mono text-[10.5px] lg:inline">
                Ctrl K
              </kbd>
            </button>
            {themeToggle}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-4 pt-6 sm:px-8 sm:pt-8">{children}</main>
      <Footer />
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-5">
          {NAV.map((n) => (
            <SectionLink
              key={n.id}
              to={n.id}
              className="flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium text-muted aria-[current=page]:text-accent"
            >
              <n.icon className="size-5" />
              {n.label}
            </SectionLink>
          ))}
          <button
            type="button"
            onClick={openSearch}
            className="flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium text-muted"
          >
            <Search className="size-5" />
            Search
          </button>
        </div>
      </nav>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Arena: transparent bar over a generated stage that follows the page's game or team.

function ArenaShell({ openSearch, children }: ShellProps) {
  const atlas = useAtlas();
  const mood = useMood();
  const discipline = atlas.discipline(mood.discipline ?? "cs2");
  const team = mood.teamId ? atlas.team(mood.teamId) : undefined;
  const stage = team
    ? {
        recipe: "team" as const,
        accent: team.colors.primary,
        glow: mix(team.colors.primary, "#ffffff", 0.45),
        deep: mix(team.colors.primary, "#000000", 0.9),
      }
    : {
        recipe: discipline.id,
        accent: discipline.palette.accent,
        glow: discipline.palette.glow,
        deep: discipline.palette.deep,
      };
  return (
    <div className="overflow-x-clip">
      <Stage {...stage} focus={0.72} />
      <header className="relative z-20 border-b border-white/[0.06]">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-8 px-4 sm:px-8">
          <SectionLink to="now" className="flex items-center" title="Slate">
            <Lockup size={30} ink="#f4f1e8" />
          </SectionLink>
          <nav className="hidden items-center gap-6 md:flex">
            {NAV.map((n) => (
              <SectionLink
                key={n.id}
                to={n.id}
                className="text-[11.5px] font-semibold tracking-[0.18em] text-muted uppercase hover:text-ink aria-[current=page]:text-ink"
              >
                {n.label}
              </SectionLink>
            ))}
          </nav>
          <GamesNav
            className="ml-auto hidden items-center gap-4 xl:flex"
            itemClass="text-[11px] font-semibold tracking-[0.16em] text-faint uppercase hover:text-ink"
          />
          <button
            type="button"
            onClick={openSearch}
            className="ml-auto flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 text-[13px] text-muted backdrop-blur hover:text-ink xl:ml-0"
          >
            <Search className="size-4" /> <span className="hidden sm:inline">Search</span>
          </button>
        </div>
        <nav className="no-scrollbar flex gap-5 overflow-x-auto px-4 pb-3 md:hidden">
          {NAV.map((n) => (
            <SectionLink
              key={n.id}
              to={n.id}
              className="shrink-0 text-[11.5px] font-semibold tracking-[0.18em] text-muted uppercase aria-[current=page]:text-ink"
            >
              {n.label}
            </SectionLink>
          ))}
        </nav>
      </header>
      <main className="relative z-10 mx-auto max-w-[1400px] px-4 pt-8 sm:px-8">{children}</main>
      <Footer className="relative z-10 max-w-[1400px]" />
    </div>
  );
}

function mix(a: string, b: string, t: number): string {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

// ---------------------------------------------------------------------------------------------
// Broadcast: angled logo plate, italic nav and a running ticker of live scores and results.

function BroadcastShell({ openSearch, children }: ShellProps) {
  return (
    <>
      <header className="sticky top-0 z-40 bg-paper">
        <div className="mx-auto flex h-16 max-w-[1400px] items-stretch gap-6 pr-4 sm:pr-8">
          <SectionLink
            to="now"
            className="flex items-center bg-accent pr-10 pl-4 text-accent-ink sm:pl-8"
            title="Slate"
          >
            <Lockup size={30} ink="#080c18" dot="#080c18" />
          </SectionLink>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <SectionLink
                key={n.id}
                to={n.id}
                className="px-3 py-2 text-[17px] text-muted hover:text-ink aria-[current=page]:text-ink aria-[current=page]:shadow-[inset_0_-4px_0_var(--accent)]"
              >
                <span
                  style={{
                    fontFamily: "var(--display)",
                    fontStretch: "75%",
                    fontWeight: 850,
                    fontStyle: "italic",
                    textTransform: "uppercase",
                  }}
                >
                  {n.label}
                </span>
              </SectionLink>
            ))}
          </nav>
          <button
            type="button"
            onClick={openSearch}
            className="my-auto ml-auto flex h-9 items-center gap-2 bg-raised px-4 text-[13px] text-muted hover:text-ink"
            style={{ clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)" }}
          >
            <Search className="size-4" /> <span className="hidden sm:inline">Search</span>
          </button>
        </div>
        <Ticker />
        <nav className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line px-3 md:hidden">
          {NAV.map((n) => (
            <SectionLink
              key={n.id}
              to={n.id}
              className="shrink-0 px-2 py-2 text-[15px] text-muted aria-[current=page]:text-ink aria-[current=page]:shadow-[inset_0_-3px_0_var(--accent)]"
            >
              <span
                style={{
                  fontFamily: "var(--display)",
                  fontStretch: "75%",
                  fontWeight: 850,
                  fontStyle: "italic",
                  textTransform: "uppercase",
                }}
              >
                {n.label}
              </span>
            </SectionLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 pt-8 sm:px-8">{children}</main>
      <Footer className="max-w-[1400px]" />
    </>
  );
}

function Ticker() {
  const atlas = useAtlas();
  const items = [...atlas.live(), ...atlas.recent().slice(0, 10)];
  const row = items.map((m) => {
    const s = seriesScore(m);
    const chess = atlas.tournamentOf(m).discipline === "chess";
    const multi = m.sides.length > 2;
    return (
      <MatchLink
        key={m.id}
        id={m.id}
        className="flex shrink-0 items-center gap-2 border-r border-white/10 px-4 text-[13px] hover:bg-white/5"
      >
        {m.status === "live" ? (
          <LiveDot />
        ) : (
          <span className="text-[10px] font-bold text-faint">FT</span>
        )}
        <span className="text-[11px] font-bold tracking-wide text-muted uppercase">
          {atlas.discipline(atlas.tournamentOf(m).discipline).short}
        </span>
        {multi ? (
          <span className="font-semibold">
            {atlas.tournamentOf(m).short} {atlas.roundOf(m)?.short}
          </span>
        ) : (
          <>
            {!chess && <Mark id={m.sides[0]!.competitorId} size={18} />}
            <span className="font-semibold">{atlas.short(m.sides[0]!.competitorId)}</span>
            <span className="bg-white px-1.5 font-bold text-black tabular-nums">
              {chess && m.status === "live" ? "–" : `${fmt(s[0]!)}-${fmt(s[1]!)}`}
            </span>
            <span className="font-semibold">{atlas.short(m.sides[1]!.competitorId)}</span>
            {!chess && <Mark id={m.sides[1]!.competitorId} size={18} />}
          </>
        )}
      </MatchLink>
    );
  });
  return (
    <div className="relative flex h-10 overflow-hidden border-y border-white/10 bg-[#0e1426]">
      <div
        className="z-10 flex shrink-0 items-center bg-live px-3 text-[13px] text-white"
        style={{
          fontFamily: "var(--display)",
          fontStretch: "75%",
          fontWeight: 900,
          fontStyle: "italic",
        }}
      >
        LIVE &amp; RESULTS
      </div>
      <div className="flex overflow-hidden">
        <div className="ticker-track flex">
          {row}
          {row.map((el, i) => (
            <span key={`dup-${i}`} className="contents" aria-hidden>
              {el}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const fmt = (n: number) => (n % 1 ? (n < 1 ? "½" : `${Math.floor(n)}½`) : String(n));

// ---------------------------------------------------------------------------------------------
// Almanac: a masthead.

function AlmanacShell({ openSearch, themeToggle, children }: ShellProps) {
  const now = useNow();
  return (
    <>
      <header className="mx-auto max-w-[1240px] px-4 pt-5 sm:px-8">
        <div className="flex items-center justify-between gap-4 text-[12px] text-muted">
          <span>{longDate(now)}</span>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">All times {zoneName()}</span>
            {themeToggle}
          </div>
        </div>
        <div className="mt-2 flex items-end justify-between border-b-2 border-ink pb-3">
          <SectionLink to="now" className="text-ink" title="Slate">
            <Lockup size={60} ink="var(--ink)" />
          </SectionLink>
          <button
            type="button"
            onClick={openSearch}
            className="mb-2 flex items-center gap-2 border-b border-ink/30 pb-1 text-[13px] text-muted hover:text-ink"
          >
            <Search className="size-3.5" />{" "}
            <span className="hidden sm:inline">Search the almanac</span>
          </button>
        </div>
        <nav className="no-scrollbar flex gap-6 overflow-x-auto border-b border-line py-2.5 text-[13.5px] font-medium">
          {NAV.map((n) => (
            <SectionLink
              key={n.id}
              to={n.id}
              className="shrink-0 text-ink/75 hover:text-ink aria-[current=page]:text-accent"
            >
              {n.id === "now" ? "Today" : n.label}
            </SectionLink>
          ))}
          <GamesNav
            className="ml-auto hidden shrink-0 gap-4 text-faint md:flex"
            itemClass="hover:text-ink"
          />
        </nav>
      </header>
      <main className="mx-auto max-w-[1240px] px-4 pt-8 sm:px-8">{children}</main>
      <Footer className="max-w-[1240px]" />
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Signal: a sidebar instrument with a running clock.

function SignalShell({ openSearch, children }: ShellProps) {
  const atlas = useAtlas();
  const now = useNow();
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(now);
  const live = atlas.live();
  return (
    <div className="lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-paper/95 font-mono text-[12px] lg:flex">
        <SectionLink
          to="now"
          className="flex h-14 items-center gap-2 border-b border-line px-4 font-semibold tracking-[0.1em] text-ink"
        >
          <Lockup size={22} ink="var(--ink)" />
        </SectionLink>
        <div className="border-b border-line px-4 py-3">
          <div className="text-[22px] text-ink tabular-nums">{time}</div>
          <div className="text-faint">
            {zoneName()} · {live.length} live
          </div>
        </div>
        <nav className="flex flex-col py-2">
          {NAV.map((n) => (
            <SectionLink
              key={n.id}
              to={n.id}
              className="flex items-center gap-2.5 px-4 py-2 text-muted hover:bg-raised hover:text-ink aria-[current=page]:bg-raised aria-[current=page]:text-ink aria-[current=page]:shadow-[inset_2px_0_0_var(--accent)]"
            >
              <n.icon className="size-3.5" /> {n.label.toLowerCase()}
            </SectionLink>
          ))}
        </nav>
        <div className="mt-2 px-4 pb-1 text-[10.5px] tracking-[0.1em] text-faint uppercase">
          games
        </div>
        <GamesNav
          className="flex flex-col pb-2"
          itemClass="px-4 py-1.5 text-muted hover:bg-raised hover:text-ink"
        />
        <div className="mt-2 px-4 pb-1 text-[10.5px] tracking-[0.1em] text-faint uppercase">
          live
        </div>
        <div className="flex-1 overflow-y-auto">
          {live.map((m) => (
            <MatchLink
              key={m.id}
              id={m.id}
              className="flex items-center justify-between gap-2 px-4 py-1.5 text-muted hover:bg-raised hover:text-ink"
            >
              <span className="truncate">
                {m.sides.length > 2
                  ? `${atlas.tournamentOf(m).short} ${atlas.roundOf(m)?.short}`
                  : m.sides.map((s) => atlas.short(s.competitorId)).join("–")}
              </span>
              <LiveDot />
            </MatchLink>
          ))}
        </div>
        <button
          type="button"
          onClick={openSearch}
          className="m-3 flex items-center gap-2 border border-line px-3 py-2 text-muted hover:text-ink"
        >
          <Search className="size-3.5" /> search <kbd className="ml-auto text-faint">ctrl k</kbd>
        </button>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-line bg-paper/90 px-4 font-mono text-[12px] backdrop-blur lg:hidden">
          <SectionLink to="now" className="flex items-center gap-2 font-semibold tracking-[0.1em]">
            <Lockup size={22} ink="var(--ink)" />
          </SectionLink>
          <span className="ml-auto text-ink tabular-nums">
            {clock(new Date(now).toISOString(), true)}
          </span>
          <button type="button" onClick={openSearch} aria-label="Search" className="text-muted">
            <Search className="size-4" />
          </button>
        </header>
        <main className="mx-auto max-w-[1320px] px-4 pt-6 sm:px-6">{children}</main>
        <Footer className="max-w-[1320px] font-mono" />
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-paper/95 font-mono text-[10.5px] lg:hidden">
        {NAV.map((n) => (
          <SectionLink
            key={n.id}
            to={n.id}
            className="flex flex-col items-center gap-1 py-2 text-muted aria-[current=page]:text-accent"
          >
            <n.icon className="size-4" />
            {n.label.toLowerCase()}
          </SectionLink>
        ))}
      </nav>
    </div>
  );
}

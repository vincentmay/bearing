import type { Follow, GameEvent } from "@bearing/domain";
import { Link } from "@tanstack/react-router";
import { Settings, Star, UserRound } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { useAccount } from "../lib/account";
import { useAtlas, useFollow } from "../lib/world";
import type { Dot, MatchView, SideView } from "./model";
import type { Times } from "./time";

/** The mark: a ball seated in its ring. Construction is in docs/BRAND.md. */
export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Bearing">
      <path
        fill="currentColor"
        d="M56.305 22.767A26 26 0 1 1 41.233 7.695A11 11 0 0 0 35.871 16.475A16 16 0 1 0 47.525 28.129A11 11 0 0 0 56.305 22.767Z"
      />
      <circle fill="currentColor" cx="46.85" cy="17.15" r="7.5" />
    </svg>
  );
}

/**
 * True once the component has been on screen. Things that arrive after that (a dot, a new
 * score, the next match) animate in; what is there from the start does not.
 */
export function useReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}

/** Decides once, when it first appears, whether to play its entrance. */
function Arrival({
  play,
  enter,
  className,
  children,
  ...rest
}: {
  play: boolean;
  enter: string;
  className?: string;
  children?: ReactNode;
  style?: CSSProperties;
  title?: string;
}) {
  const [on] = useState(play);
  const cls = [className, on ? enter : ""].filter(Boolean).join(" ");
  return (
    <i className={cls || undefined} {...rest}>
      {children}
    </i>
  );
}

/** A number that rises into place when it changes. */
export function Tick({ children }: { children: string }) {
  const ready = useReady();
  return <TickEl key={children} play={ready} text={children} />;
}

function TickEl({ play, text }: { play: boolean; text: string }) {
  const [on] = useState(play);
  return <span className={on ? "bx-tick" : undefined}>{text}</span>;
}

/**
 * A team or player as a disc. Where a source has their mark or picture it is shown, on a plain
 * plate so that any mark reads on either ground; until it has arrived, and where there is none,
 * the disc is their colour with a short name.
 */
export function Disc({ side, size = 44 }: { side: SideView; size?: number }) {
  const [state, setState] = useState<"wait" | "shown" | "failed">("wait");
  const picture = side.image && state !== "failed" ? side.image : undefined;
  return (
    <span
      className="bx-disc"
      data-long={side.short.length > 3 ? "" : undefined}
      data-pic={picture ? (side.person ? "person" : "mark") : undefined}
      data-shown={picture && state === "shown" ? "" : undefined}
      style={{ "--s": `${size}px`, background: side.color, color: side.ink } as CSSProperties}
      aria-hidden
    >
      {size >= 30 && !(picture && state === "shown") ? <span>{side.short}</span> : null}
      {picture ? (
        <img
          src={picture}
          alt=""
          decoding="async"
          // A picture already in the cache is there before React listens for it.
          ref={(img) => {
            if (img?.complete && img.naturalWidth > 0) setState("shown");
          }}
          onLoad={() => setState("shown")}
          onError={() => setState("failed")}
        />
      ) : null}
    </span>
  );
}

/**
 * The way to the viewer's own corner: their picture or initial when signed in, a figure when
 * not, and a plain gear where there are no accounts at all.
 */
export function AccountLink({ className }: { className?: string }) {
  const account = useAccount();
  const signedIn = account.state === "in";
  const label = signedIn ? "Your account and settings" : "Settings";
  return (
    <Link
      to="/settings"
      className={className ? `bx-iconbtn ${className}` : "bx-iconbtn"}
      aria-label={label}
      title={label}
      data-account={signedIn ? "" : undefined}
    >
      {signedIn ? (
        account.image ? (
          <img src={account.image} alt="" />
        ) : (
          <span aria-hidden>{(account.name ?? "?").slice(0, 1).toUpperCase()}</span>
        )
      ) : account.state === "none" ? (
        <Settings size={18} />
      ) : (
        <UserRound size={18} />
      )}
    </Link>
  );
}

/** Live, without a colour: a dot that sends out a ring. */
export function Ping() {
  return <i className="bx-ping" aria-hidden />;
}

/** Two flat halves: a game that both sides share. */
function split(sides: SideView[]): string {
  const [a, b] = sides;
  if (!a || !b) return a?.color ?? "var(--sunk)";
  return `linear-gradient(90deg, ${a.color} 50%, ${b.color} 50%)`;
}

function dotStyle(dot: Dot, sides: SideView[]): CSSProperties | undefined {
  if (dot.k === "won") return { background: sides[dot.side]?.color };
  if (dot.k === "shared") return { background: split(sides.slice(0, 2)) };
  return undefined;
}

/** One thing won, in the colour of whoever won it, in the order it happened. Flat, on a line. */
export function Dots({
  dots,
  sides,
  size = 13,
  gap,
  center = false,
  fix = false,
  wrap = false,
  children,
}: {
  dots: Dot[];
  sides: SideView[];
  size?: number;
  gap?: number;
  center?: boolean;
  fix?: boolean;
  wrap?: boolean;
  children?: ReactNode;
}) {
  const ready = useReady();
  const cls = ["bx-dots", center && "bx-center", fix && "bx-fix", wrap && "bx-wrap"]
    .filter(Boolean)
    .join(" ");
  return (
    <span
      className={cls}
      style={
        {
          "--ds": `${size}px`,
          ...(gap === undefined ? {} : { "--dg": `${gap}px` }),
        } as CSSProperties
      }
    >
      {dots.map((dot, i) => (
        <Arrival
          key={`${i}${dot.k}`}
          play={ready && (dot.k === "won" || dot.k === "shared")}
          enter="bx-land"
          className={`bx-dot-${dot.k}`}
          style={dotStyle(dot, sides)}
          title={"label" in dot ? dot.label : undefined}
        />
      ))}
      {children}
    </span>
  );
}

/** Rows of dots, as in the small form of a Counter-Strike map. */
export function DotRows({
  rows,
  sides,
  size = 13,
  center = false,
}: {
  rows: Dot[][];
  sides: SideView[];
  size?: number;
  center?: boolean;
}) {
  return (
    <>
      {rows.map((row, i) => (
        <Dots key={i} dots={row} sides={sides} size={size} center={center} fix={row.length < 12} />
      ))}
    </>
  );
}

/** The score to lead with: two numbers and a dash, or the start time, or a few words. */
export function Score({ view, times }: { view: MatchView; times: Times }) {
  if (view.match.status === "scheduled") return <>{times.clock(view.match.scheduledAt)}</>;
  const [a, b] = view.headline;
  if (b === undefined) return <Tick>{a ?? ""}</Tick>;
  return (
    <>
      <Tick>{a ?? ""}</Tick>
      <i className="bx-dash" />
      <Tick>{b}</Tick>
    </>
  );
}

const SIZE: Record<GameEvent["kind"], number> = { goal: 12, tower: 8, dragon: 12, baron: 17 };

/**
 * Things that happened, on the game's clock. With `two`, one side sits above the line and the
 * other below, and the size of a dot says how much it mattered.
 */
export function Clockline({
  events,
  sides,
  span,
  at,
  live,
  two = false,
  labels,
}: {
  events: GameEvent[];
  sides: SideView[];
  /** Seconds the whole line stands for. */
  span: number;
  /** Seconds played. */
  at: number;
  live: boolean;
  two?: boolean;
  labels?: { at: number; text: string; end?: boolean }[];
}) {
  const ready = useReady();
  const pct = (seconds: number) =>
    `${(Math.max(0, Math.min(1, seconds / span)) * 100).toFixed(1)}%`;
  const cls = ["bx-tl", two && "bx-tl-two", labels && "bx-tl-labelled"].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <i className="bx-tl-el" style={{ width: pct(at) }} />
      {events.map((e, i) => (
        <Arrival
          key={i}
          play={ready}
          enter="bx-land"
          className={`bx-tl-d${two ? (e.side === 0 ? " bx-tl-up" : " bx-tl-dn") : ""}`}
          style={
            {
              left: pct(e.at),
              "--z": `${SIZE[e.kind]}px`,
              background: sides[e.side]?.color,
            } as CSSProperties
          }
          title={`${sides[e.side]?.name ?? ""} · ${e.kind} · ${Math.floor(e.at / 60)}:${String(e.at % 60).padStart(2, "0")}`}
        />
      ))}
      {live ? <i className="bx-tl-d bx-tl-now" style={{ left: pct(at) }} /> : null}
      {labels?.map((l) => (
        <span key={l.text} style={{ left: pct(l.at) }} data-end={l.end ? "" : undefined}>
          {l.text}
        </span>
      ))}
    </div>
  );
}

/** A section on the page: a small label and, under it, one card. */
export function Section({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className ? `bx-section ${className}` : "bx-section"}>
      <h2 className="bx-label">{label}</h2>
      {children}
    </section>
  );
}

/** Follow or stop following, in one tap. */
export function FollowStar({ follow, name }: { follow: Follow; name: string }) {
  const atlas = useAtlas();
  const [direct, toggle] = useFollow(follow);
  const [taps, setTaps] = useState(0);
  // Followed through something wider, such as the organisation: shown as followed, changed there.
  const inherited =
    !direct &&
    (follow.kind === "team" || follow.kind === "player") &&
    atlas.followsCompetitor(follow.id);
  const on = direct || inherited;
  return (
    <button
      type="button"
      className="bx-star"
      aria-pressed={on}
      aria-label={
        inherited
          ? `${name} is followed through its organisation`
          : on
            ? `Stop following ${name}`
            : `Follow ${name}`
      }
      title={inherited ? "Followed through its organisation" : on ? "Following" : "Follow"}
      disabled={inherited}
      data-pop={taps ? "" : undefined}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
        setTaps((n) => n + 1);
      }}
    >
      <Star key={taps} size={17} />
    </button>
  );
}

/** A choice between a few things: a capsule with a marker that slides, like the navigation. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <div
      className="bx-seg"
      role="group"
      aria-label={label}
      style={{ "--n": options.length } as CSSProperties}
    >
      <i style={{ transform: `translateX(${index * 100}%)` }} />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** While data is on its way: the shape of the page, with words for anyone who cannot see it. */
export function Waiting({ title }: { title?: string }) {
  return (
    <div className="bx-wait" role="status">
      <span className="bx-only">Loading</span>
      <header className="bx-head">
        <span>
          <Mark />
          {title ? <h1 className="bx-title">{title}</h1> : null}
        </span>
      </header>
      <div className="bx-card" aria-hidden>
        <i className="bx-bone" style={{ width: "34%" }} />
        <i className="bx-bone" style={{ height: 22, margin: "18px 0 14px" }} />
        <i className="bx-bone" style={{ width: "60%", margin: "0 auto" }} />
      </div>
      <section className="bx-section" aria-hidden>
        <i className="bx-bone" style={{ width: 54, height: 8, margin: "0 8px 10px" }} />
        <div className="bx-list">
          {[62, 48, 70].map((w) => (
            <div key={w} className="bx-bone-row">
              <i />
              <span>
                <i className="bx-bone" style={{ width: `${w}%` }} />
                <i className="bx-bone" style={{ width: `${w - 24}%`, height: 8 }} />
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Something could not be loaded: say so plainly, and offer the one thing that might help. */
export function Problem({
  title = "This could not be loaded",
  children,
  onRetry,
}: {
  title?: string;
  children?: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div className="bx-problem" role="alert">
      <b>{title}</b>
      <p>{children ?? "The connection may be down, or the source did not answer."}</p>
      {onRetry ? (
        <button type="button" className="bx-button" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

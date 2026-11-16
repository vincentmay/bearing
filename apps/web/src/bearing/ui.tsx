import type { Champion, Follow, GameEvent } from "@bearing/domain";
import { Link } from "@tanstack/react-router";
import {
  ClipboardList,
  Crosshair,
  Eye,
  LogIn,
  LogOut,
  Megaphone,
  Settings,
  Star,
  Target,
  UserRound,
  Zap,
} from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
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

/** Whether a mark would be lost on a dark ground, or on a light one; worked out once each. */
const verdicts = new Map<string, { dim: boolean; pale: boolean }>();

function judge(img: HTMLImageElement): { dim: boolean; pale: boolean } {
  const known = verdicts.get(img.src);
  if (known) return known;
  let verdict = { dim: false, pale: false };
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 24;
    const pen = canvas.getContext("2d", { willReadFrequently: true });
    if (pen) {
      pen.drawImage(img, 0, 0, 24, 24);
      const { data } = pen.getImageData(0, 0, 24, 24);
      let seen = 0;
      let dark = 0;
      let light = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3]! < 96) continue;
        seen++;
        const lum = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
        if (lum < 64) dark++;
        else if (lum > 204) light++;
      }
      // A mark that is half dark is already lost on a dark ground: what is left of it is a
      // fragment. A pale one has to be nearly all pale to be lost on a light ground.
      verdict = { dim: seen > 0 && dark / seen > 0.48, pale: seen > 0 && light / seen > 0.62 };
    }
  } catch {
    // A picture that may not be read is taken to be fine as it is.
  }
  verdicts.set(img.src, verdict);
  return verdict;
}

/**
 * A team or player. A team's mark stands on its own, with nothing behind it; only a mark that
 * would be lost on the ground it is shown on (a black one on black) keeps a plain plate. A
 * player's picture fills a disc. Where there is no picture, or it does not arrive, the disc is
 * their colour with a short name.
 */
export function Disc({ side, size = 44 }: { side: SideView; size?: number }) {
  const [state, setState] = useState<"wait" | "shown" | "failed">("wait");
  const [verdict, setVerdict] = useState<{ dim: boolean; pale: boolean }>();
  // A small disc asks for the small picture; if there is none, for the picture itself.
  const [whole, setWhole] = useState(false);
  const wanted = side.image && !whole && size <= 64 ? small(side.image) : side.image;
  const picture = side.image && state !== "failed" ? wanted : undefined;
  const arrived = (img: HTMLImageElement) => {
    if (!side.person) setVerdict(judge(img));
    setState("shown");
  };
  return (
    <span
      className="bx-disc"
      data-long={side.short.length > 3 ? "" : undefined}
      data-pic={picture ? (side.person ? "person" : "mark") : undefined}
      data-shown={picture && state === "shown" ? "" : undefined}
      data-dim={verdict?.dim ? "" : undefined}
      data-pale={verdict?.pale ? "" : undefined}
      style={{ "--s": `${size}px`, background: side.color, color: side.ink } as CSSProperties}
      aria-hidden
    >
      {size >= 30 && !picture ? <span>{side.short}</span> : null}
      {/* A small disc of a person without a picture is not left blank: their first letter. */}
      {size < 30 && size >= 18 && !picture && side.name ? (
        <span data-letter="">{side.name.slice(0, 1)}</span>
      ) : null}
      {picture ? (
        <img
          src={picture}
          alt=""
          decoding="async"
          // Marks are looked at, to see whether they read on the ground; that needs the
          // picture's host to allow it, which it does.
          crossOrigin={side.person ? undefined : "anonymous"}
          // A picture already in the cache is there before React listens for it.
          ref={(img) => {
            if (img?.complete && img.naturalWidth > 0 && state === "wait") arrived(img);
          }}
          onLoad={(event) => arrived(event.currentTarget)}
          onError={() => {
            if (wanted !== side.image) setWhole(true);
            else setState("failed");
          }}
        />
      ) : null}
    </span>
  );
}

/**
 * The address of a picture's small version, where its host keeps one. PandaScore files a
 * `thumb_` copy beside every picture, a quarter of the weight or less; a disc of thirty
 * pixels has no use for a photograph of two hundred kilobytes.
 */
function small(image: string): string {
  if (!image.startsWith("https://cdn-api.pandascore.co/")) return image;
  const cut = image.lastIndexOf("/") + 1;
  return image.slice(cut).startsWith("thumb_")
    ? image
    : `${image.slice(0, cut)}thumb_${image.slice(cut)}`;
}

/**
 * The five positions of League of Legends, as the game itself draws them: the part of the map
 * a position plays on in full, the rest of it faint.
 */
const POSITIONS: Record<string, { full: string; faint?: string }> = {
  top: {
    full: "M4 4L4.003 28.045L9 23L9 9L23 9L28.045 4.003z",
    faint: "M21,14H14v7h7V14Zm5-3V26L11.014,26l-4,4H30V7.016Z",
  },
  jungle: {
    full: "M25,3c-2.128,3.3-5.147,6.851-6.966,11.469A42.373,42.373,0,0,1,20,20a27.7,27.7,0,0,1,1-3C21,12.023,22.856,8.277,25,3ZM13,20c-1.488-4.487-4.76-6.966-9-9,3.868,3.136,4.422,7.52,5,12l3.743,3.312C14.215,27.917,16.527,30.451,17,31c4.555-9.445-3.366-20.8-8-28C11.67,9.573,13.717,13.342,13,20Zm8,5a15.271,15.271,0,0,1,0,2l4-4c0.578-4.48,1.132-8.864,5-12C24.712,13.537,22.134,18.854,21,25Z",
  },
  mid: {
    full: "M25 4L4 25L4 30L9 30L30 9L30 4z",
    faint: "M30,12.968l-4.008,4L26,26H17l-4,4H30ZM16.979,8L21,4H4V20.977L8,17,8,8h8.981Z",
  },
  bot: {
    full: "M29.997 5.955L25 11L25 25L11 25L5.955 29.997L30 30z",
    faint: "M13,20h7V13H13v7ZM4,4V26.984l3.955-4L8,8,22.986,8l4-4H4Z",
  },
  support: {
    full: "M26,13c3.535,0,8-4,8-4H23l-3,3,2,7,5-2-3-4h2ZM22,5L20.827,3H13.062L12,5l5,6Zm-5,9-1-1L13,28l4,3,4-3L18,13ZM11,9H0s4.465,4,8,4h2L7,17l5,2,2-7Z",
  },
};

let byName: Map<string, string> | undefined;

/** The two-letter code of a country given by its code or by its English name. */
function countryCode(country: string): string | undefined {
  if (/^[A-Za-z]{2}$/.test(country)) return country.toLowerCase();
  if (!byName) {
    byName = new Map();
    try {
      const names = new Intl.DisplayNames(["en"], { type: "region" });
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      for (const x of letters)
        for (const y of letters) {
          const name = names.of(x + y);
          if (name && name !== x + y) byName.set(name.toLowerCase(), (x + y).toLowerCase());
        }
    } catch {
      // Without the list of names, only codes are known.
    }
  }
  return byName.get(country.toLowerCase());
}

/**
 * A country's flag, small, before its name. Nothing where it is not a country; with `keep`, an
 * empty place of the same size, so that names in a column still line up.
 */
export function Flag({ country, keep }: { country: string | undefined; keep?: boolean }) {
  const code = country ? countryCode(country) : undefined;
  if (!code) return keep ? <span className="bx-flag" data-none="" /> : null;
  return (
    <img
      className="bx-flag"
      src={`https://flagcdn.com/${code}.svg`}
      alt=""
      loading="lazy"
      decoding="async"
    />
  );
}

/**
 * An event's own mark, where there is one. It is drawn the way a team's is: whole, on nothing,
 * and on a plain plate only where it would be lost on the ground.
 */
export function EventMark({ image, size = 22 }: { image: string | undefined; size?: number }) {
  if (!image) return null;
  return (
    <Disc
      size={size}
      side={{
        id: null,
        name: "",
        label: "",
        short: "",
        color: "transparent",
        ink: "var(--ink)",
        plural: true,
        image,
        person: false,
      }}
    />
  );
}

/** The position a role names, if it is one of League's five. */
export function positionOf(role: string | undefined): string | undefined {
  const key = (role ?? "").toLowerCase();
  if (key === "top") return "top";
  if (key.startsWith("jun")) return "jungle";
  if (key === "mid" || key === "middle") return "mid";
  if (key === "bot" || key === "adc" || key === "bottom") return "bot";
  if (key.startsWith("sup")) return "support";
  return undefined;
}

/** What a player does in the team: the word, then its sign. */
export function Role({ role, bare }: { role: string | undefined; bare?: boolean }) {
  if (!role) return <span />;
  const key = role.toLowerCase();
  const position = positionOf(role);
  const Icon = position
    ? undefined
    : key.includes("awp")
      ? Crosshair
      : key.includes("leader") || key === "igl"
        ? Megaphone
        : key.includes("entry")
          ? Zap
          : key.includes("lurk")
            ? Eye
            : key.includes("coach")
              ? ClipboardList
              : key.includes("rifl")
                ? Target
                : undefined;
  const sign = position ? POSITIONS[position] : undefined;
  return (
    <span className="bx-role" title={bare ? role : undefined}>
      {bare ? null : role}
      {sign ? (
        <svg width="15" height="15" viewBox="0 0 34 34" aria-hidden>
          {sign.faint ? <path d={sign.faint} fill="currentColor" opacity="0.3" /> : null}
          <path d={sign.full} fill="currentColor" fillRule="evenodd" />
        </svg>
      ) : Icon ? (
        <Icon size={13} strokeWidth={2.2} aria-hidden />
      ) : null}
    </span>
  );
}

/**
 * A champion as its own picture, from the game's public files; its first letters where there
 * is no picture or it does not arrive.
 */
export function Champ({
  champion,
  patch,
  size = 28,
  out,
}: {
  champion: Champion;
  patch: string | undefined;
  size?: number;
  /** Denied to the other side rather than played. */
  out?: boolean;
}) {
  const [state, setState] = useState<"wait" | "shown" | "failed">("wait");
  const picture = champion.key && patch && state !== "failed";
  return (
    <span
      className="bx-champ"
      data-out={out ? "" : undefined}
      data-shown={state === "shown" ? "" : undefined}
      style={{ "--s": `${size}px` } as CSSProperties}
      title={champion.name}
    >
      {picture ? (
        <img
          src={`https://ddragon.leagueoflegends.com/cdn/${patch}/img/champion/${champion.key}.png`}
          alt={champion.name}
          loading="lazy"
          decoding="async"
          ref={(img) => {
            if (img?.complete && img.naturalWidth > 0 && state === "wait") setState("shown");
          }}
          onLoad={() => setState("shown")}
          onError={() => setState("failed")}
        />
      ) : (
        <span>{champion.name.slice(0, 2)}</span>
      )}
    </span>
  );
}

/**
 * The way to the viewer's own corner: their picture or initial when signed in, a figure when
 * not, and a plain gear where there are no accounts at all.
 */
export function AccountLink({ className }: { className?: string }) {
  const account = useAccount();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const button = className ? `bx-iconbtn ${className}` : "bx-iconbtn";
  // Without accounts there is nobody to be: the way leads straight to the settings.
  if (account.state === "none") {
    return (
      <Link to="/settings" className={button} aria-label="Settings" title="Settings">
        <Settings size={18} />
      </Link>
    );
  }
  const signedIn = account.state === "in";
  const face = signedIn ? (
    account.image ? (
      <img src={account.image} alt="" />
    ) : (
      <span aria-hidden>{(account.name ?? account.email ?? "?").slice(0, 1).toUpperCase()}</span>
    )
  ) : null;
  const then = (act: () => void) => () => {
    setOpen(false);
    act();
  };
  return (
    <span className="bx-account" ref={box}>
      <button
        type="button"
        className={button}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={signedIn ? "Your account" : "Account"}
        data-account={signedIn ? "" : undefined}
        onClick={() => setOpen(!open)}
      >
        {face ?? <UserRound size={18} />}
      </button>
      {open ? (
        <div className="bx-menu" role="menu">
          <div className="bx-menu-who">
            {signedIn ? <span className="bx-menu-face">{face}</span> : null}
            <span style={{ minWidth: 0 }}>
              <b>{signedIn ? (account.name ?? "Signed in") : "Not signed in"}</b>
              <span className="bx-sub">
                {signedIn ? account.email : "What you follow is kept on this device."}
              </span>
            </span>
          </div>
          {signedIn ? (
            <button type="button" role="menuitem" onClick={then(account.manage)}>
              <UserRound size={16} aria-hidden />
              Manage account
            </button>
          ) : (
            <button type="button" role="menuitem" onClick={then(account.signIn)}>
              <LogIn size={16} aria-hidden />
              Sign in or create an account
            </button>
          )}
          <Link to="/settings" role="menuitem" onClick={() => setOpen(false)}>
            <Settings size={16} aria-hidden />
            Settings
          </Link>
          {signedIn ? (
            <button type="button" role="menuitem" onClick={then(account.signOut)}>
              <LogOut size={16} aria-hidden />
              Sign out
            </button>
          ) : null}
        </div>
      ) : null}
    </span>
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

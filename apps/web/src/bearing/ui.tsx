import "./pages-you.css";
import type { Champion, Follow, GameEvent } from "@bearing/domain";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  ClipboardList,
  Crosshair,
  Eye,
  LogIn,
  LogOut,
  Megaphone,
  RotateCw,
  Settings,
  Star,
  Target,
  UserRound,
  Zap,
} from "lucide-react";
import {
  type CSSProperties,
  type ComponentProps,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useAccount } from "../lib/account";
import { usePrefs } from "../lib/prefs";
import { useAtlas, useFollow } from "../lib/world";
import type { Dot, MatchView, SideView } from "./model";
import type { Times } from "./time";

import { CardSky, Moment } from "./sky";
/** The mark: three exposures of one sunrise on one horizon (brand book §4). */
export { Logo, Mark } from "./logo";

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

/** The pictures that have arrived during this visit, by address, with what was found out about each mark. */
const arrivedBefore = new Map<string, { dim: boolean; pale: boolean } | undefined>();

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

const OnSky = createContext(false);

/**
 * A page's top card, with the sky in it (`CardSky` goes inside). What stands on it knows that
 * it stands on a dark ground, whatever the theme.
 */
export function TopCard(props: ComponentProps<"section">) {
  return (
    <OnSky value={true}>
      <section {...props} />
    </OnSky>
  );
}

const darkScheme =
  typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : undefined;

/** Whether what is drawn here stands on a dark ground: on the sky, or anywhere in the dark theme. */
function useDarkGround(): boolean {
  const onSky = useContext(OnSky);
  const { theme } = usePrefs();
  const device = useSyncExternalStore(
    (told) => {
      darkScheme?.addEventListener("change", told);
      return () => darkScheme?.removeEventListener("change", told);
    },
    () => darkScheme?.matches ?? false,
    () => false,
  );
  return onSky || theme === "dark" || (theme === "system" && device);
}

/**
 * A team or player. A team's mark stands on its own, with nothing behind it; only a mark that
 * would be lost on the ground it is shown on (a black one on black) keeps a plain plate. A
 * player's picture fills a disc. Where there is no picture, or it does not arrive, the disc is
 * their colour with a short name.
 */
export function Disc({ side, size = 44 }: { side: SideView; size?: number }) {
  // Many teams have a second mark made for dark grounds. The sky is one in both themes, and so
  // is every page in the dark theme. If that mark does not arrive, the usual one is shown.
  const dark = useDarkGround();
  const [missing, setMissing] = useState(false);
  const image = dark && side.imageDark && !missing ? side.imageDark : side.image;
  return (
    <DiscOf
      key={image}
      side={side}
      size={size}
      image={image}
      onFailed={image !== side.image ? () => setMissing(true) : undefined}
    />
  );
}

function DiscOf({
  side,
  size,
  image,
  onFailed,
}: {
  side: SideView;
  size: number;
  image: string | undefined;
  /** There is another picture to try if this one does not arrive. */
  onFailed?: () => void;
}) {
  // A picture that has been shown before in this visit is simply there: only one that is new
  // fades in.
  const first = image && size <= 64 ? small(image) : image;
  const known = !!first && arrivedBefore.has(first);
  const [state, setState] = useState<"wait" | "shown" | "failed">(known ? "shown" : "wait");
  const [verdict, setVerdict] = useState(() => (first ? arrivedBefore.get(first) : undefined));
  // A small disc asks for the small picture; if there is none, for the picture itself.
  const [whole, setWhole] = useState(false);
  const wanted = image && !whole && size <= 64 ? small(image) : image;
  const picture = image && state !== "failed" ? wanted : undefined;
  const arrived = (img: HTMLImageElement) => {
    const found = side.person ? undefined : judge(img);
    setVerdict(found);
    if (wanted) arrivedBefore.set(wanted, found);
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
            if (wanted !== image) setWhole(true);
            else if (onFailed) onFailed();
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
  // Where to come back to after signing in.
  const here = useRouterState({ select: (s) => s.location.href });
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
            <span className="bx-menu-face" data-out={signedIn ? undefined : ""}>
              {face ?? <UserRound size={18} aria-hidden />}
            </span>
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
            <Link
              to="/sign-in"
              search={{ from: here }}
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <LogIn size={16} aria-hidden />
              Sign in or create an account
            </Link>
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

/** The score to lead with: two numbers and a dash, or the start time, or a few words. */
export function Score({ view, times }: { view: MatchView; times: Times }) {
  // A match still to begin leads with its time; one that has begun, with how it stands.
  if (view.match.status === "scheduled" && !view.resumes)
    return <>{times.clock(view.match.scheduledAt)}</>;
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

/** A few rows of a list that is on its way. */
function WaitingRows({ count }: { count: number }) {
  return [58, 44, 66, 50].slice(0, count).map((w) => (
    <div key={w} className="bx-wt-row">
      <i />
      <span>
        <i style={{ width: `${w}%` }} />
        <i style={{ width: `${w - 22}%` }} />
      </span>
    </div>
  ));
}

/**
 * While a page loads: its own shape, so that nothing jumps when it arrives. The top card
 * already holds the sky; the rest breathes slowly. `live` is the Live page (a card, the other
 * matches, two lists); every other page is a card over a wide and a narrow column. `inner` is a
 * page further in, which has a way back above its card.
 */
export function Waiting({
  title,
  shape = "page",
  inner = false,
  at,
}: {
  title?: string;
  shape?: "live" | "page";
  inner?: boolean;
  /** Which page it is ("schedule", "team"…): its top card has that page's height. */
  at?: string;
}) {
  return (
    <div className="bx-wt" role="status" data-shape={shape} data-at={at}>
      <span className="bx-only">{title ? `Loading ${title}` : "Loading"}</span>
      {inner ? <i className="bx-wt-back" aria-hidden /> : null}
      <TopCard className="bx-stage bx-wt-card" aria-hidden>
        <CardSky />
        <i style={{ width: "34%", height: 38 }} />
        <i style={{ width: "52%" }} />
      </TopCard>
      {shape === "live" ? (
        <div className="bx-wt-rest" aria-hidden>
          <i className="bx-wt-h" />
          <div className="bx-wt-cards">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="bx-wt-two">
            <div>
              <i className="bx-wt-h" />
              <WaitingRows count={3} />
            </div>
            <div>
              <i className="bx-wt-h" />
              <WaitingRows count={3} />
            </div>
          </div>
        </div>
      ) : (
        <div className="bx-wt-rest" aria-hidden>
          <div className="bx-wt-two" data-k="side">
            <div>
              <i className="bx-wt-h" />
              <WaitingRows count={4} />
            </div>
            <div>
              <i className="bx-wt-h" />
              <i className="bx-wt-panel" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Something could not be loaded: say so plainly, and offer the one thing that might help. */
export function Problem({
  title = "This could not be loaded.",
  children,
  onRetry,
}: {
  title?: string;
  children?: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <Moment
      alert
      className="bx-problem"
      title={title}
      action={
        onRetry ? (
          <button type="button" className="bx-btn" data-k="main" onClick={onRetry}>
            <RotateCw size={16} aria-hidden />
            Try again
          </button>
        ) : (
          <Link to="/" className="bx-btn" data-k="main">
            Back to Live
          </Link>
        )
      }
    >
      {children ?? "The connection may be down, or the source did not answer."}
    </Moment>
  );
}

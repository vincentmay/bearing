import { type Follow, tournamentStatus } from "@bearing/domain";
import { useRouter } from "@tanstack/react-router";
import { ListOrdered, Search as SearchIcon, Star } from "lucide-react";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFideSearch } from "../lib/fide";
import { useRecents } from "../lib/recents";
import { useFollow } from "../lib/world";
import { type Board, useBoard } from "./board";
import { GROUPS, type Target, defined, everything, standing, target } from "./lists";
import { standIn } from "./model";
import { rankingTitle } from "./ranking";
import { Disc } from "./ui";

/** Where a followable thing's page is; organisations and whole games have none. */
function hrefOf(follow: Pick<Follow, "kind" | "id">): string | undefined {
  const id = encodeURIComponent(follow.id);
  if (follow.kind === "team") return `/team/${id}`;
  if (follow.kind === "player") return `/player/${id}`;
  if (follow.kind === "tournament") return `/tournament/${id}`;
  return undefined;
}

/** The name with what was typed picked out in it. */
function Marked({ text, query }: { text: string; query: string }) {
  const at = query ? text.toLowerCase().indexOf(query) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  );
}

function FollowChip({ follow, name }: { follow: Follow; name: string }) {
  const [on, toggle] = useFollow(follow);
  return (
    <button
      type="button"
      className="bx-fol"
      aria-pressed={on}
      aria-label={on ? `Stop following ${name}` : `Follow ${name}`}
      onClick={toggle}
    >
      <Star size={15} aria-hidden />
      <span>{on ? "Following" : "Follow"}</span>
    </button>
  );
}

interface Entry {
  key: string;
  href?: string;
  disc: ReactNode;
  name: string;
  line: string;
  follow?: Follow;
}

function entryOf(board: Board, item: Target): Entry {
  return {
    key: `${item.follow.kind}:${item.follow.id}`,
    href: hrefOf(item.follow),
    disc: item.disc,
    name: item.name,
    line: `${item.game ? `${item.game} · ` : ""}${standing(board, item.follow)}`,
    follow: item.follow,
  };
}

/**
 * Search, from anywhere: a team, a player or an event by name, with the star right there. With
 * nothing typed it offers what the viewer looked at last, what they follow, and what is on.
 * Arrow keys move, Enter opens, Escape closes. `page` sets it into the page instead of over it.
 */
export function Finder({ onClose, page = false }: { onClose?: () => void; page?: boolean }) {
  const board = useBoard();
  const { atlas } = board;
  const router = useRouter();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const recents = useRecents();
  const fide = useFideSearch(query);

  const groups = useMemo(() => {
    const out: { label: string; entries: Entry[] }[] = [];
    if (q) {
      // A name that starts with what was typed comes before one that only contains it.
      const hits = everything(atlas)
        .map((x) => {
          const words = x.words.toLowerCase();
          const rank = words.startsWith(q)
            ? 0
            : words.includes(` ${q}`)
              ? 1
              : words.includes(q)
                ? 2
                : 3;
          return { ...x, rank };
        })
        .filter((x) => x.rank < 3)
        .sort((a, b) => a.rank - b.rank);
      for (const label of GROUPS) {
        const entries = hits
          .filter((h) => h.group === label)
          .slice(0, 5)
          .map((h) => target(atlas, h.follow))
          .filter(defined)
          .map((t) => entryOf(board, t));
        if (entries.length) out.push({ label, entries });
      }
      // Chess players who are in no event Kiming has, from FIDE's own list.
      const others = fide
        .filter((p) => !atlas.player(p.id))
        .slice(0, 5)
        .map((p): Entry => ({
          key: `fide:${p.id}`,
          href: `/player/${encodeURIComponent(p.id)}`,
          disc: (
            <Disc
              size={32}
              side={standIn({
                name: p.name,
                short: p.family.slice(0, 2).toUpperCase(),
                image: p.image,
                person: true,
              })}
            />
          ),
          name: p.name,
          line: ["Chess", p.title, p.ratings[0] && `${p.ratings[0].value}`]
            .filter(Boolean)
            .join(" · "),
          follow: { kind: "player", id: p.id },
        }));
      if (others.length) out.push({ label: "Chess players", entries: others });
      return out;
    }
    const of = (list: Follow[]) =>
      list
        .map((f) => target(atlas, f))
        .filter(defined)
        .map((t) => entryOf(board, t));
    const recent = of(recents).slice(0, 4);
    if (recent.length) out.push({ label: "Recently looked at", entries: recent });
    const followed = of(atlas.world.follows).slice(0, 6);
    if (followed.length) out.push({ label: "Following", entries: followed });
    const tier = { S: 0, A: 1, B: 2 } as const;
    const events = of(
      atlas.world.tournaments
        .filter((t) => tournamentStatus(atlas, t, board.now) !== "completed")
        .sort((x, y) => tier[x.tier] - tier[y.tier] || x.start.localeCompare(y.start))
        .slice(0, 5)
        .map((t) => ({ kind: "tournament", id: t.id }) satisfies Follow),
    );
    if (events.length) out.push({ label: "Events on now and coming", entries: events });
    const rankings = atlas.world.rankings
      .filter((r) => r.entries.length)
      .map((r): Entry => ({
        key: `ranking:${r.discipline}`,
        href: `/ranking/${encodeURIComponent(r.discipline)}`,
        disc: (
          <span
            className="bx-disc bx-disc-plain"
            style={{ "--s": "32px" } as CSSProperties}
            aria-hidden
          >
            <ListOrdered size={15} />
          </span>
        ),
        name: rankingTitle(r, board),
        line: `${r.entries.length} places`,
      }));
    if (rankings.length) out.push({ label: "Rankings", entries: rankings });
    return out;
  }, [atlas, board, q, recents, fide]);

  const flat = groups.flatMap((g) => g.entries);
  const [at, setAt] = useState(0);
  useEffect(() => setAt(0), [q]);
  const chosen = flat[Math.min(at, flat.length - 1)];
  const list = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [at]);
  const open = (entry: Entry | undefined) => {
    if (!entry?.href) return;
    onClose?.();
    void router.navigate({ href: entry.href });
  };

  return (
    <div
      className="bx-pal"
      data-page={page ? "" : undefined}
      role={page ? undefined : "dialog"}
      aria-modal={page ? undefined : true}
      aria-label="Search"
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const n = flat.length || 1;
          setAt((i) => (i + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
        } else if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
          e.preventDefault();
          open(chosen);
        } else if (e.key === "Escape") onClose?.();
      }}
    >
      <label className="bx-pal-inp">
        <SearchIcon size={20} aria-hidden />
        <span className="bx-only">Search for a team, player or event</span>
        <input
          type="search"
          placeholder="Team, player or event"
          value={query}
          autoFocus={!page}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setQuery(e.target.value)}
        />
        {page ? null : <kbd className="bx-kbd">Esc</kbd>}
      </label>
      <div className="bx-pal-list" ref={list} aria-live="polite">
        {groups.map((g) => (
          <div key={g.label} role="group" aria-label={g.label}>
            <h4>{g.label}</h4>
            {g.entries.map((entry) => (
              <div
                key={entry.key}
                className="bx-res"
                aria-selected={entry === chosen}
                onPointerMove={() => setAt(flat.indexOf(entry))}
              >
                {entry.href ? (
                  <a
                    href={entry.href}
                    aria-label={entry.name}
                    tabIndex={-1}
                    onClick={(e) => {
                      e.preventDefault();
                      open(entry);
                    }}
                  />
                ) : null}
                {entry.disc}
                <span>
                  <b>
                    <Marked text={entry.name} query={q} />
                  </b>
                  <small>{entry.line}</small>
                </span>
                {entry.follow ? <FollowChip follow={entry.follow} name={entry.name} /> : <span />}
              </div>
            ))}
          </div>
        ))}
        {q && !flat.length ? (
          <p className="bx-pal-none">
            Nothing found for "{query.trim()}". Try a team's short name, such as "VIT", or a
            player's handle.
          </p>
        ) : null}
      </div>
      {page ? null : (
        <footer>
          <span>
            <kbd className="bx-kbd">↑</kbd>
            <kbd className="bx-kbd">↓</kbd>to move
          </span>
          <span>
            <kbd className="bx-kbd">Enter</kbd>to open
          </span>
        </footer>
      )}
    </div>
  );
}

/** The finder over the page, behind a veil; a click beside it closes it. */
export function FinderOver({ onClose }: { onClose: () => void }) {
  // The page behind does not scroll while it is open.
  useEffect(() => {
    const was = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = was;
    };
  }, []);
  return (
    <div
      className="bx-veil"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Finder onClose={onClose} />
    </div>
  );
}

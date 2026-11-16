import { useNavigate } from "@tanstack/react-router";
import { Search as SearchIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDir } from "../lib/dir";
import { useAtlas } from "../lib/world";
import { Mark } from "./mark";

interface Hit {
  kind: "Team" | "Player" | "Event" | "Game";
  id: string;
  title: string;
  sub: string;
  href: string;
}

/** Ctrl/Cmd K command palette over teams, players, events and games. */
export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const atlas = useAtlas();
  const dir = useDir();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const index = useMemo<Hit[]>(() => {
    const out: Hit[] = [];
    for (const c of atlas.world.competitors) {
      const d = atlas.discipline(c.discipline);
      if (c.kind === "team")
        out.push({
          kind: "Team",
          id: c.id,
          title: c.name,
          sub: `${d.name} · ${c.region}`,
          href: `/${dir}/team/${c.id}`,
        });
      else {
        const team = atlas.world.stints.find((s) => s.playerId === c.id && !s.to);
        out.push({
          kind: "Player",
          id: c.id,
          title: c.handle,
          sub: [c.name, team ? atlas.name(team.teamId) : d.name].filter(Boolean).join(" · "),
          href: `/${dir}/player/${c.id}`,
        });
      }
    }
    for (const t of atlas.world.tournaments)
      out.push({
        kind: "Event",
        id: t.id,
        title: t.name,
        sub: atlas.discipline(t.discipline).name,
        href: `/${dir}/event/${t.id}`,
      });
    for (const d of atlas.world.disciplines)
      out.push({
        kind: "Game",
        id: d.id,
        title: d.name,
        sub: "Game",
        href: `/${dir}/game/${d.id}`,
      });
    return out;
  }, [atlas, dir]);

  const hits = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return index.filter((h) => h.kind === "Event" || h.kind === "Game").slice(0, 8);
    return index
      .map((h) => {
        const t = h.title.toLowerCase();
        const score =
          t === term
            ? 0
            : t.startsWith(term)
              ? 1
              : t.includes(term)
                ? 2
                : h.sub.toLowerCase().includes(term)
                  ? 3
                  : 9;
        return { h, score };
      })
      .filter((x) => x.score < 9)
      .sort((a, b) => a.score - b.score || a.h.title.localeCompare(b.h.title))
      .slice(0, 12)
      .map((x) => x.h);
  }, [q, index]);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [open]);

  if (!open) return null;

  const go = (h: Hit) => {
    onClose();
    void navigate({ href: h.href });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/45 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-label="Search"
        className="w-full max-w-[560px] overflow-hidden rounded-[var(--radius)] border border-line bg-paper text-ink shadow-[0_30px_80px_rgb(0_0_0/0.45)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <SearchIcon className="size-4 text-muted" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(hits.length - 1, a + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              }
              if (e.key === "Enter" && hits[active]) go(hits[active]!);
            }}
            placeholder="Teams, players, events, games"
            className="h-14 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint"
            aria-label="Search"
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[10.5px] text-faint">
            Esc
          </kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
          {!q && <li className="px-3 pt-2 pb-1 text-[11.5px] text-faint">Jump to</li>}
          {hits.map((h, i) => (
            <li key={`${h.kind}-${h.id}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(h)}
                className={`flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-left ${i === active ? "bg-raised" : ""}`}
              >
                {h.kind === "Team" || h.kind === "Player" ? (
                  <Mark id={h.id} size={28} />
                ) : (
                  <span className="grid size-7 place-items-center rounded-md bg-raised text-[10px] font-bold text-muted">
                    {h.kind === "Event" ? "EV" : "G"}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium">{h.title}</span>
                  <span className="block truncate text-[12px] text-muted">{h.sub}</span>
                </span>
                <span className="text-[11px] text-faint">{h.kind}</span>
              </button>
            </li>
          ))}
          {hits.length === 0 && (
            <li className="px-3 py-6 text-center text-[14px] text-muted">Nothing matches "{q}".</li>
          )}
        </ul>
      </div>
    </div>
  );
}

/** Opens the palette on Ctrl/Cmd K. */
export function useSearchHotkey(open: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
}

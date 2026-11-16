import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useDir } from "../lib/dir";
import type { EventTab } from "../pages/event";
import { useAtlas } from "../lib/world";

type Props = { className?: string; children: ReactNode; title?: string };

/** A team or player, whichever the id is. */
export function CompetitorLink({ id, ...p }: Props & { id: string | null | undefined }) {
  const dir = useDir();
  const atlas = useAtlas();
  const c = atlas.competitor(id);
  if (!c) return <span className={p.className}>{p.children}</span>;
  return c.kind === "team" ? (
    <Link
      to="/$dir/team/$teamId"
      params={{ dir, teamId: c.id }}
      className={p.className}
      title={p.title}
    >
      {p.children}
    </Link>
  ) : (
    <Link
      to="/$dir/player/$playerId"
      params={{ dir, playerId: c.id }}
      className={p.className}
      title={p.title}
    >
      {p.children}
    </Link>
  );
}

export function PlayerLink({ id, ...p }: Props & { id: string }) {
  const dir = useDir();
  return (
    <Link
      to="/$dir/player/$playerId"
      params={{ dir, playerId: id }}
      className={p.className}
      title={p.title}
    >
      {p.children}
    </Link>
  );
}

export function EventLink({ id, tab, ...p }: Props & { id: string; tab?: EventTab }) {
  const dir = useDir();
  return (
    <Link
      to="/$dir/event/$eventId"
      params={{ dir, eventId: id }}
      search={tab ? { tab } : {}}
      className={p.className}
      title={p.title}
    >
      {p.children}
    </Link>
  );
}

export function MatchLink({ id, ...p }: Props & { id: string }) {
  const dir = useDir();
  return (
    <Link
      to="/$dir/match/$matchId"
      params={{ dir, matchId: id }}
      className={p.className}
      title={p.title}
    >
      {p.children}
    </Link>
  );
}

export function GameLink({ id, ...p }: Props & { id: string }) {
  const dir = useDir();
  return (
    <Link
      to="/$dir/game/$gameId"
      params={{ dir, gameId: id }}
      className={p.className}
      title={p.title}
    >
      {p.children}
    </Link>
  );
}

export type Section = "now" | "schedule" | "events" | "following";

export function SectionLink({ to, ...p }: Props & { to: Section; activeClassName?: string }) {
  const dir = useDir();
  const common = {
    className: p.className,
    title: p.title,
    activeProps: { "aria-current": "page" as const },
  };
  switch (to) {
    case "now":
      return (
        <Link to="/$dir" params={{ dir }} activeOptions={{ exact: true }} {...common}>
          {p.children}
        </Link>
      );
    case "schedule":
      return (
        <Link to="/$dir/schedule" params={{ dir }} {...common}>
          {p.children}
        </Link>
      );
    case "events":
      return (
        <Link to="/$dir/events" params={{ dir }} {...common}>
          {p.children}
        </Link>
      );
    case "following":
      return (
        <Link to="/$dir/following" params={{ dir }} {...common}>
          {p.children}
        </Link>
      );
  }
}

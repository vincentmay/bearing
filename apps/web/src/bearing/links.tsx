import type { Follow } from "@bearing/domain";
import { Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect } from "react";
import { visit } from "../lib/recents";
import { useAtlas } from "../lib/world";
import { useOrigin } from "./shell";
import { nameOf, usePrevious } from "./trail";

/**
 * A link to the page of a team, a player or an event. Organisations and whole games have no
 * page of their own, so for those it is plain text.
 */
export function Go({
  to,
  className,
  style,
  children,
}: {
  to: Pick<Follow, "kind" | "id">;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const rest = { className, style };
  if (to.kind === "team")
    return (
      <Link to="/team/$teamId" params={{ teamId: to.id }} {...rest}>
        {children}
      </Link>
    );
  if (to.kind === "player")
    return (
      <Link to="/player/$playerId" params={{ playerId: to.id }} {...rest}>
        {children}
      </Link>
    );
  if (to.kind === "tournament")
    return (
      <Link to="/tournament/$tournamentId" params={{ tournamentId: to.id }} {...rest}>
        {children}
      </Link>
    );
  return <span {...rest}>{children}</span>;
}

/**
 * Back to where the viewer came from, named: the event they opened this player from, the match
 * they opened this team from. Opened directly, a page leads back to what it belongs to (a match
 * to its event, a player to their team), and failing that to the tab it sits in.
 */
export function Back({ parent }: { parent?: Pick<Follow, "kind" | "id"> }) {
  const origin = useOrigin();
  const router = useRouter();
  const atlas = useAtlas();
  const previous = usePrevious();
  if (previous) {
    return (
      <a
        href={previous}
        className="bx-back"
        onClick={(event) => {
          // A plain click steps back, so that the page returns as it was left; a click that
          // asks for a new tab is left to the browser.
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          router.history.back();
        }}
      >
        <ChevronLeft size={18} />
        <span>{nameOf(atlas, previous)}</span>
      </a>
    );
  }
  if (parent) {
    return (
      <Go to={parent} className="bx-back">
        <ChevronLeft size={18} />
        <span>{nameOf(atlas, `/${parent.kind}/${parent.id}`)}</span>
      </Go>
    );
  }
  return (
    <Link to={origin.to} className="bx-back">
      <ChevronLeft size={18} />
      <span>{origin.label}</span>
    </Link>
  );
}

/** Remember that this page was opened, for "recently looked at" in search. */
export function useVisit(kind: Follow["kind"], id: string, found: boolean) {
  useEffect(() => {
    if (found) visit({ kind, id });
  }, [kind, id, found]);
}

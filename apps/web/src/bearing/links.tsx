import type { Follow } from "@bearing/domain";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect } from "react";
import { visit } from "../lib/recents";
import { useOrigin } from "./shell";

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

/** Back to the tab the viewer came from. */
export function Back() {
  const origin = useOrigin();
  return (
    <Link to={origin.to} className="bx-back">
      <ChevronLeft size={18} />
      {origin.label}
    </Link>
  );
}

/** Remember that this page was opened, for "recently looked at" in search. */
export function useVisit(kind: Follow["kind"], id: string, found: boolean) {
  useEffect(() => {
    if (found) visit({ kind, id });
  }, [kind, id, found]);
}

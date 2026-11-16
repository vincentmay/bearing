import { useQuery } from "@tanstack/react-query";

/**
 * The champions a League player has played this year, with games and wins: counted by
 * Leaguepedia (lol.fandom.com, CC BY-SA 3.0) and asked for by the viewer's own browser, which
 * the wiki allows from any page. Nothing of it is stored.
 */
export interface Played {
  champion: string;
  games: number;
  wins: number;
}

const quoted = (text: string) => `'${text.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

export function useChampionPool(
  handle: string | undefined,
  team: string | undefined,
  year: number,
): Played[] {
  const { data } = useQuery({
    queryKey: ["champion-pool", handle, team, year],
    enabled: !!handle && !!team,
    staleTime: 6 * 60 * 60_000,
    queryFn: async (): Promise<Played[]> => {
      const query = new URLSearchParams({
        action: "cargoquery",
        format: "json",
        origin: "*",
        tables: "ScoreboardPlayers",
        fields: "Champion=champion,COUNT(*)=games,SUM(PlayerWin='Yes')=wins",
        where: `Name=${quoted(handle ?? "")} AND Team=${quoted(team ?? "")} AND DateTime_UTC >= '${year}-01-01'`,
        group_by: "Champion",
        order_by: "COUNT(*) DESC",
        limit: "8",
      });
      const response = await fetch(`https://lol.fandom.com/api.php?${query.toString()}`).catch(
        () => null,
      );
      const body = response?.ok
        ? ((await response.json().catch(() => null)) as {
            cargoquery?: { title?: { champion?: string; games?: string; wins?: string } }[];
          } | null)
        : null;
      return (body?.cargoquery ?? []).flatMap((row) =>
        row.title?.champion
          ? [
              {
                champion: row.title.champion,
                games: Number(row.title.games) || 0,
                wins: Number(row.title.wins) || 0,
              },
            ]
          : [],
      );
    },
  });
  return data ?? [];
}

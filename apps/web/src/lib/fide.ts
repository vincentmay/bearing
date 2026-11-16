import { countryOfFederation } from "@bearing/domain/lichess";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

/**
 * Chess players Bearing does not have in an event right now, from the list FIDE keeps of every
 * rated player, as Lichess serves it (lichess.org/api, open to any page). A search here is the
 * viewer's own browser asking Lichess; nothing is stored.
 */
export interface FidePlayer {
  /** The id Bearing uses for chess players everywhere: `fide-<number>`. */
  id: string;
  name: string;
  family: string;
  country: string;
  title?: string;
  born?: number;
  ratings: { label: string; value: number }[];
  image?: string;
  imageLarge?: string;
  credit?: string;
}

interface Raw {
  id: number;
  name: string;
  federation?: string;
  year?: number;
  title?: string;
  standard?: number;
  rapid?: number;
  blitz?: number;
  photo?: { small?: string; medium?: string; credit?: string };
}

function read(raw: Raw): FidePlayer {
  const [family = raw.name, given] = raw.name.split(",").map((part) => part.trim());
  return {
    id: `fide-${raw.id}`,
    name: given ? `${given} ${family}` : family,
    family,
    country: countryOfFederation(raw.federation),
    title: raw.title,
    born: raw.year,
    ratings: [
      { label: "Classical", value: raw.standard },
      { label: "Rapid", value: raw.rapid },
      { label: "Blitz", value: raw.blitz },
    ].filter((r): r is { label: string; value: number } => !!r.value),
    image: raw.photo?.small,
    imageLarge: raw.photo?.medium,
    credit: raw.photo?.credit?.replace(/\s*<[^>]*>/g, ""),
  };
}

const BASE = "https://lichess.org/api/fide/player";

async function ask<T>(url: string): Promise<T | null> {
  const response = await fetch(url, { headers: { Accept: "application/json" } }).catch(() => null);
  return response?.ok ? ((await response.json().catch(() => null)) as T | null) : null;
}

/** Players whose name matches what was typed, strongest first. Asked once typing has paused. */
export function useFideSearch(typed: string): FidePlayer[] {
  const [term, setTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setTerm(typed.trim()), 320);
    return () => clearTimeout(timer);
  }, [typed]);
  const { data } = useQuery({
    queryKey: ["fide-search", term.toLowerCase()],
    queryFn: async () => (await ask<Raw[]>(`${BASE}?q=${encodeURIComponent(term)}`)) ?? [],
    enabled: term.length >= 3,
    staleTime: 10 * 60_000,
  });
  if (term.length < 3 || !data) return [];
  return data
    .map(read)
    .sort((x, y) => (y.ratings[0]?.value ?? 0) - (x.ratings[0]?.value ?? 0))
    .slice(0, 6);
}

/** One player by their Bearing id, or null while it is not known or when there is none. */
export function useFidePlayer(id: string): { player: FidePlayer | null; waiting: boolean } {
  const number = id.startsWith("fide-") ? id.slice("fide-".length) : "";
  const { data, isPending } = useQuery({
    queryKey: ["fide-player", number],
    queryFn: async () => ask<Raw>(`${BASE}/${number}`),
    enabled: /^\d+$/.test(number),
    staleTime: 60 * 60_000,
  });
  return { player: data ? read(data) : null, waiting: /^\d+$/.test(number) && isPending };
}

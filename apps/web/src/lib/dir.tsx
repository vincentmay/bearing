import { createContext, useContext, type ReactNode } from "react";

/** The six design directions. Every page exists in every direction. */
export const DIRECTIONS = [
  {
    id: "slate",
    name: "Slate",
    line: "The house style. Chalk and graphite, solid slabs, one flare for now. Clean, quiet, built to last.",
    tone: "Brand · solid · clean",
  },
  {
    id: "studio",
    name: "Studio",
    line: "A clean, light sports app. Big numbers, soft cards, team colour where it matters.",
    tone: "Light · calm · app-like",
  },
  {
    id: "arena",
    name: "Arena",
    line: "Cinematic and dark. Generated 3D stages per game and per team, broadcast-scale type.",
    tone: "Dark · cinematic · immersive",
  },
  {
    id: "broadcast",
    name: "Broadcast",
    line: "TV graphics energy. Angled team-colour panels, a live ticker, heavy italic type.",
    tone: "Bold · loud · energetic",
  },
  {
    id: "almanac",
    name: "Almanac",
    line: "Editorial. Paper and ink, serif headlines written from the data, typeset tables.",
    tone: "Light · literate · quiet",
  },
  {
    id: "signal",
    name: "Signal",
    line: "An instrument panel. Time as the interface, monospace data, one bright accent.",
    tone: "Dark · dense · precise",
  },
] as const;

export type DirectionId = (typeof DIRECTIONS)[number]["id"];

export function isDirection(s: string): s is DirectionId {
  return DIRECTIONS.some((d) => d.id === s);
}

const DirContext = createContext<DirectionId>("slate");

export function DirProvider({ dir, children }: { dir: DirectionId; children: ReactNode }) {
  return <DirContext.Provider value={dir}>{children}</DirContext.Provider>;
}

export function useDir(): DirectionId {
  return useContext(DirContext);
}

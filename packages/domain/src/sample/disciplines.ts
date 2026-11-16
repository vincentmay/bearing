import type { Discipline, Organization } from "../model.ts";

export const disciplines: Discipline[] = [
  {
    id: "cs2",
    name: "Counter-Strike 2",
    short: "CS2",
    competitor: "team",
    unit: { one: "map", many: "maps" },
    palette: { accent: "#f0a43a", glow: "#ffcf7a", deep: "#1a1208" },
  },
  {
    id: "lol",
    name: "League of Legends",
    short: "LoL",
    competitor: "team",
    unit: { one: "game", many: "games" },
    palette: { accent: "#c8aa6e", glow: "#0ac8b9", deep: "#071318" },
  },
  {
    id: "trackmania",
    name: "Trackmania",
    short: "TM",
    competitor: "player",
    unit: { one: "track", many: "tracks" },
    palette: { accent: "#2ef5a8", glow: "#3d7bff", deep: "#05110f" },
  },
  {
    id: "chess",
    name: "Chess",
    short: "Chess",
    competitor: "player",
    unit: { one: "game", many: "games" },
    palette: { accent: "#e9e1cf", glow: "#c08a52", deep: "#16120d" },
  },
  {
    id: "rocket-league",
    name: "Rocket League",
    short: "RL",
    competitor: "team",
    unit: { one: "game", many: "games" },
    palette: { accent: "#3d8bff", glow: "#ff8a2b", deep: "#060c1a" },
  },
];

export const organizations: Organization[] = [
  { id: "vitality", name: "Team Vitality", colors: { primary: "#f5e50a", secondary: "#0d0d0d" } },
  { id: "falcons", name: "Team Falcons", colors: { primary: "#00c26e", secondary: "#0b1a12" } },
  { id: "g2", name: "G2 Esports", colors: { primary: "#f03e3e", secondary: "#111111" } },
  { id: "furia", name: "FURIA", colors: { primary: "#e9e3d3", secondary: "#101010" } },
];

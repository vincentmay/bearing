import type { Colors } from "../model.ts";

/**
 * The colour a team is known by, for its disc and its dots. No source Bearing reads says what a
 * team's colours are, so the well-known ones are kept here by hand. They are approximate and
 * mean nothing beyond telling two teams apart. A team that is not listed has no colour, and
 * is drawn in ink.
 */
const KNOWN: Record<string, [primary: string, secondary: string]> = {
  vitality: ["#f5e50a", "#0d0d0d"],
  mouz: ["#e8343b", "#1a0b0c"],
  spirit: ["#d9d9de", "#18181b"],
  themongolz: ["#ff7a1a", "#13204d"],
  falcons: ["#00c26e", "#0b1a12"],
  faze: ["#e43d30", "#121212"],
  natusvincere: ["#ffe14d", "#0f1730"],
  navi: ["#ffe14d", "#0f1730"],
  aurora: ["#9b7bff", "#140f24"],
  g2: ["#f03e3e", "#111111"],
  furia: ["#e9e3d3", "#101010"],
  astralis: ["#ff3a3a", "#101a3a"],
  pain: ["#ff2e4c", "#0f0f10"],
  liquid: ["#3ea6ff", "#0b2e5c"],
  "3dmax": ["#ff5a1f", "#141414"],
  virtuspro: ["#ff8a00", "#121212"],
  heroic: ["#ff9e2e", "#151515"],
  legacy: ["#2bd4a4", "#0c1614"],
  fnatic: ["#ff5900", "#101010"],
  cloud9: ["#00aeef", "#0a1a24"],
  complexity: ["#1c5fb8", "#0a0f1a"],
  ence: ["#c8a25a", "#101010"],
  big: ["#b0b4ba", "#101010"],
  ninjasinpyjamas: ["#cfcfcf", "#111111"],
  nip: ["#cfcfcf", "#111111"],
  mibr: ["#2f7cff", "#0a1020"],
  imperial: ["#3fae49", "#0c140d"],
  saw: ["#e1b12c", "#141414"],
  gamerlegion: ["#7ed957", "#0f140d"],
  eternalfire: ["#ff6a00", "#141414"],
  "9z": ["#b388ff", "#120f1a"],
  flyquest: ["#3ddc84", "#0b1a12"],
  tyloo: ["#d32f2f", "#140a0a"],
  lynnvision: ["#7c4dff", "#0f0c1a"],
  rareatom: ["#ff7043", "#140e0c"],
  thunderdownunder: ["#00bcd4", "#0a1416"],
  b8: ["#ffd54f", "#141208"],
  betboom: ["#ff3d57", "#140a0c"],
  parivision: ["#ffe600", "#101010"],
  m80: ["#b2ff59", "#0f140a"],
  nrg: ["#ff5c00", "#121212"],
  wildcard: ["#7cf06a", "#101410"],
  // League of Legends
  t1: ["#e2012d", "#121212"],
  geng: ["#b8952c", "#141414"],
  hanwhalife: ["#f37321", "#191919"],
  bilibili: ["#36a3ff", "#0c1830"],
  topesports: ["#ff6c00", "#1a0f06"],
  anyoneslegend: ["#d6b56d", "#1b1712"],
  dpluskia: ["#00c4b3", "#0a1615"],
  ktrolster: ["#e53935", "#140a0a"],
  jdg: ["#c62828", "#140a0a"],
  weibo: ["#ff8f00", "#141008"],
  lng: ["#1e88e5", "#0a1018"],
  invictus: ["#eceff1", "#101214"],
  karminecorp: ["#00b4ff", "#0a0f1e"],
  heretics: ["#e0c38c", "#141210"],
  giantx: ["#f4511e", "#140c0a"],
  sk: ["#5c6bc0", "#0c0e18"],
  koi: ["#7e57c2", "#100c18"],
  movistarkoi: ["#7e57c2", "#100c18"],
  bds: ["#ff5fa2", "#160b12"],
  rogue: ["#29b6f6", "#0a1218"],
  "100thieves": ["#e53935", "#101010"],
  sentinels: ["#d81b60", "#140a0e"],
  // Rocket League
  spacestation: ["#ffd23f", "#141414"],
  gentlemates: ["#ff4fa3", "#160b12"],
  twistedminds: ["#b84cff", "#140a1c"],
  geekay: ["#e6c34a", "#141414"],
  dignitas: ["#ffcc00", "#1a1a1a"],
  theultimates: ["#4dd0ff", "#0d1218"],
  pwr: ["#ff3d6e", "#14080c"],
};

/** "Team Vitality", "Vitality" and "VITALITY Esports" are the same team. */
function key(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\b(team|esports?|e-sports|gaming|clan|club|academy)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function teamColors(name: string): Colors | undefined {
  const found = KNOWN[key(name)];
  return found ? { primary: found[0], secondary: found[1] } : undefined;
}

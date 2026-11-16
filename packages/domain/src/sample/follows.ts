import type { Follow } from "../model.ts";

/** What a first look at the sample follows, so that it shows a personal page. */
export const SAMPLE_FOLLOWS: Follow[] = [
  { kind: "organization", id: "vitality" },
  { kind: "team", id: "lol-t1" },
  { kind: "player", id: "chess-carlsen" },
  { kind: "tournament", id: "tm-cup-finals-2026" },
];

/** The instant the sample is pinned to. */
export { SAMPLE_NOW } from "./kit.ts";

# Bearing

What's on, what's next, and how everyone got here: schedules, events, teams and players across
esports (and later traditional sports), presented with the care of a broadcast rather than the
density of a wiki.

**Status:** the brand identity is settled and a first slice of the app uses it (`/`, `/match/…`,
`/schedule`, `/following`, `/search`). What is to be built is written down in
[docs/REQUIREMENTS.md](docs/REQUIREMENTS.md); the identity is in [docs/BRAND.md](docs/BRAND.md).
The rest of this file describes the six earlier design directions, which are still in the code
under `/old` and `/<dir>` and are due to be removed.

## Run it

```sh
pnpm install          # or: vp install
vp run @bearing/web#dev # http://localhost:5810
```

| Page                                | Path                                                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Direction picker                    | `/`                                                                                                       |
| Now · Schedule · Events · Following | `/<dir>`, `/<dir>/schedule`, `/<dir>/events`, `/<dir>/following`                                          |
| Match centre                        | `/<dir>/match/cs2-copenhagen-masters-2026-po-sf2` (chess `…-r6-b1`, Trackmania `tm-cup-finals-2026-qf-A`) |
| Event                               | `/<dir>/event/cs2-copenhagen-masters-2026?tab=bracket`                                                    |
| Team · Player · Game                | `/<dir>/team/cs2-vitality`, `/<dir>/player/cs2-zywoo`, `/<dir>/game/chess`                                |

`<dir>` is `slate`, `studio`, `arena`, `broadcast`, `almanac` or `signal`. The dock at the bottom of every
page switches the same page between directions. Search with Ctrl/Cmd K.

## Checks

```sh
vp check                 # format, lint, types
vp run -r test           # domain tests
vp run -r build          # production build
node scripts/shots.mjs .local/shots /studio /arena   # screenshots at 1440 and 390; flags overflow and console errors
```

On Git Bash, prefix the screenshot command with `MSYS_NO_PATHCONV=1` so `/studio` isn't rewritten
into a Windows path.

## Layout

```
apps/web
  src/routes        /$dir/... — one route tree shared by every direction
  src/pages         now, schedule, match, event, team, player, game, events, following, explore
  src/components    match rows, live cards, chessboard, round history, scoreboards, bracket,
                    swiss flow, crosstable, timeline, search, dock
  src/directions    the five shells, the per-direction match heroes, Arena's Three.js stage
  src/lib           world access (TanStack Query), follows, mood, view helpers, generated copy
  src/styles.css    the design system: tokens and primitives per direction
packages/domain     the model, derivations (standings, swiss records, player totals) and the
                    sample world (rosters, stats, round histories, events, rankings)
docs/               product, data sources, design directions
```

## Docs

- [Product](docs/PRODUCT.md): what Slate is for and what it must do well
- [Data sources](docs/DATA-SOURCES.md): where real data can come from, and what still needs checking
- [Brand](docs/BRAND.md): the name, mark, colour, type and voice
- [Design directions](docs/DESIGN-DIRECTIONS.md): the six directions and how to compare them

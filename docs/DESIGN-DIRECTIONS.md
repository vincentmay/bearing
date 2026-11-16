# Design directions — round 3

Round 1 was three separate half-products. Round 2 made it **one complete product**; round 3 adds
the brand ([BRAND.md](BRAND.md), `/brand`) and a sixth direction, **Slate**, the house style. All
six are design languages over the same product, so the choice is about how Slate looks and feels, not about which prototype
happens to have more features.

## The product (identical in every direction)

| Page         | What it does                                                                                                                                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Now          | Lead live match, everything else in play, your schedule (including "if Vitality win tonight"), where everything you follow stands, results, events                                                                                                                                   |
| Schedule     | Day strip with match counts, game filters, "only what I follow", matches grouped by event                                                                                                                                                                                            |
| Match centre | CS2: veto, per-map tabs, halves, round-by-round history, player scoreboard · LoL: objective bars, player lines · Chess: board, clocks, evaluation, the round's other boards · Trackmania: live cup race to the point limit · Upcoming: form, lineups, head-to-head · What's at stake |
| Event        | Overview, bracket / Swiss flow / crosstable + points race / cup bracket, matches by day, field, prize money with known placements                                                                                                                                                    |
| Team         | Status line, form, series/maps/ranking, lineup with event stats, map pool, results, achievements, same-organisation teams, roster table, roster history                                                                                                                              |
| Player       | Event stats (rating/ADR, KDA, chess score and tiebreak), match log, career, finishes                                                                                                                                                                                                 |
| Game hub     | Live, up next, events by status, ranking                                                                                                                                                                                                                                             |
| Events       | Every event by status, filterable by game                                                                                                                                                                                                                                            |
| Following    | Your follows with live status, suggestions, follow/unfollow everywhere (remembered in this browser)                                                                                                                                                                                  |
| Search       | Ctrl/Cmd K across teams, players, events and games                                                                                                                                                                                                                                   |

## The six directions

All share the same pages and data; each defines its own tokens, type, surfaces, shell and
signature moments (`apps/web/src/styles.css`, `apps/web/src/directions/`).

**Slate** — the house style, straight from the brand. Chalk and graphite, the featured match as a
solid graphite slab with team colour only as a thin edge, labels on small cleaved slabs, flare
reserved for live. Light and dark.

**Studio** — light, calm, app-like (dark mode follows the system). Segmented nav; bottom tab bar on
phones. Team-gradient score cards, big bold numerals, soft white cards.

**Arena** — cinematic dark. The generated Three.js stage follows the page: per game, and in team
colours on team and player pages. Condensed broadcast-scale type, glass panels.

**Broadcast** — TV graphics. Angled logo plate, a running live/results ticker, split-screen
scorebug in team colours, heavy italic type, slanted chips and buttons.

**Almanac** — editorial. Masthead, serif headlines written from match state, typeset tables,
hairline rules (dark variant available).

**Signal** — instrument panel. Sidebar with a running clock and live list; the home is a timeline
with a lane per follow; mono data, 24-hour time, one lime accent.

## How to compare

Open `/`, pick a direction, and use the dock to flip any page. The richest pages:

- `/<dir>/match/cs2-copenhagen-masters-2026-po-sf2` — the live semifinal
- `/<dir>/match/chess-fall-classic-2026-r6-b1` — a live board
- `/<dir>/match/tm-cup-finals-2026-qf-A` — the live cup race
- `/<dir>/event/cs2-copenhagen-masters-2026?tab=bracket` — Swiss flow and playoff bracket
- `/<dir>/event/chess-fall-classic-2026?tab=bracket` — crosstable and points race
- `/<dir>/team/cs2-vitality`, `/<dir>/player/cs2-zywoo`

Mixing is expected: e.g. Studio's app chrome with Signal's timeline, or Arena's stage behind
Studio's cards.

## Sample data

Real team and player handles; fictional events; generated results, stats, round histories and
chess positions. Real names are only included where confidently known, and birth dates are not
published. Every page footer says so.

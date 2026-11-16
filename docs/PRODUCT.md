# Product

## The problem

Following competitive games means doing research. To answer "is anything I care about on
tonight?" you check four sites, convert time zones in your head, and work out from a bracket
whether your team's next match is tomorrow or depends on a result that hasn't happened yet.
Liquipedia has most of the facts, but it is organised like a wiki — by page, not by the questions
people actually ask.

## The questions Slate answers first

1. **What's on now?** Live matches, with the state of play (map score, round score, move number).
2. **What's next for me?** A personal timeline from everything I follow, in my time zone —
   including matches that only happen _if_ my team wins tonight.
3. **What did I miss?** Results for what I follow since I last looked, including the bad news
   ("T1 are out; nothing else is scheduled for them this year").
4. **How does this event work, and where does it stand?** Format explained in plain language,
   the bracket or table as the centrepiece, the path each competitor took.
5. **Who is this team / player?** Current lineup, roster history as a timeline, form, results,
   map pool, and the same organisation in other games.

## Principles

- **One model, many views.** Every surface is a view over the same canonical entities
  (discipline, organisation, team, player, stint, tournament, stage, round, match, game).
  Source formats never reach the UI.
- **Formats are first-class.** Swiss, single/double elimination, round robin and cup (four-player
  Trackmania matches) each get a visualisation built for them, not a generic table.
- **Teams and individuals.** CS2, League and Rocket League are team games; chess and most of
  Trackmania are individual. A competitor is a team _or_ a player throughout.
- **Provenance on every fact.** Each record carries its source and when it was checked. Unknown
  stays unknown — nothing is guessed, and generated copy (headlines, decks) is derived strictly
  from match state.
- **Follow anything.** Teams, players, events, whole games, and organisations (follow Vitality →
  their CS2 and Rocket League teams).
- **Time is local.** Every time renders in the viewer's zone and locale; relative times
  ("in 1 h 20 min") sit next to absolute ones.
- **Care at every width.** Verified at 390 and 1440 CSS px; no horizontal page overflow;
  `prefers-reduced-motion` respected (the Arena stage renders a still frame).

## Launch scope

Disciplines: **CS2, League of Legends, Trackmania, chess, Rocket League** — the games the first
user actually follows. Football and other sports come later through the same model.

Surfaces: Now (home), Schedule, Event, Team, Player, Search, Follows.

## Later

Calendar export (.ics) and notifications for follows; match pages with per-map/per-game detail;
player pages with career arcs and head-to-heads; spoiler-free mode; VOD links; football.

# Data sources

State on 2026-11-16. Two sources are integrated and running; the rest are assessed below with what
each would add and what it costs. Prices and terms were read on that day from the pages named;
where a page could not be read, that is said.

Every adapter maps into the canonical model and records where a fact came from (`Provenance`), so
a source can be swapped for another without touching a screen. The screens only ever read
Bearing's own store.

## What runs today

| Game              | Source             | What Bearing gets                                                                                                       | What it does not get                                                              |
| ----------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Chess             | Lichess broadcasts | Events, rounds, pairings, results, the position and clocks of games in progress, players with title, rating, federation | Organiser, prize money, a format Bearing can draw (only "round robin" when named) |
| Counter-Strike 2  | PandaScore, free   | Events with stages, every match with its series score and the winner of each map, bracket links, teams, players, prize  | Map names, round scores, rounds, player statistics, when a player joined          |
| League of Legends | PandaScore, free   | The same, and the length of each game                                                                                   | Kills, objectives, gold, anything inside a game                                   |
| Rocket League     | PandaScore, free   | The same                                                                                                                | Goals, game scores                                                                |
| Trackmania        | none               |                                                                                                                         | Everything                                                                        |

Team colours come from no source. The well-known ones are kept by hand in
`packages/domain/src/sources/colors.ts`; a team that is not listed is drawn in ink.

How often: schedules every hour; anything live or due every thirty seconds, and only then. Which
events: Lichess broadcasts of tier 4 and 5 (up to eight at once); PandaScore tiers S, A and B (up
to ten editions per game). On real data, what ended more than sixty days ago is removed.

Because of the gaps in the right-hand column, a Counter-Strike map on real data shows who won it
and nothing more, where the sample shows every round. The full forms of section 5 of the
requirements need data that only paid plans carry (below).

## Lichess

- Access: open, no key. [API](https://lichess.org/api#tag/Broadcasts).
- Etiquette: one request at a time; on "too many requests" stop for a while. The adapter does both.
- Cost: none. Nothing to buy.

## PandaScore

Read from [the pricing page](https://pandascore.co/pricing) and
[the plan reference](https://developers.pandascore.co/docs/plan-reference.md).

| Plan                           | Price                           | Adds                                                                                                                   |
| ------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Schedules, results and context | free, 1,000 requests an hour    | What Bearing uses now                                                                                                  |
| Historical and post-match      | from 400 € per game per month   | After a game: detailed per-game data and statistics of players and teams. 10,000 requests an hour                      |
| Live Basic                     | from 1,000 € per game per month | During a game, for League and Counter-Strike only: scores in step with the stream, and frames and events of past games |
| Live Pro                       | on request                      | A play-by-play feed of every event                                                                                     |

What paying would change in Bearing:

- **Historical** would fill in map names, map scores and player lines after each map or game. It
  would not make anything live.
- **Live Basic** is the one that would bring back the full forms: every Counter-Strike round as
  it is won, and League objectives on the game clock. It exists for League and Counter-Strike
  only. For Rocket League no plan has goals.
- For two games that is 2,000 € a month and up. For a private tool that is not a sensible
  purchase; the free plan already answers "what is on, what is next, where does it stand".

Terms that matter: the stats plans are for uses that have nothing to do with betting, which fits.
The token lives on the Convex deployment as `PANDASCORE_TOKEN`.

## Liquipedia

Read from [the API terms](https://liquipedia.net/api-terms-of-use). The page with the plans
([liquipedia.net/api](https://liquipedia.net/api)) refuses automated readers; what follows about
plans is from a search result quoting it and from third-party summaries, and must be confirmed in
a browser.

- There are two APIs. The wiki's own (MediaWiki) API is **not allowed** for this: "Use of the API
  for non-editing purposes is not supported". Reading the HTML pages by program is forbidden too.
- The data API (LiquipediaDB) is granted "upon approved request", with a rate limit by plan.
- Plans, as far as could be established: only "Enterprise" is open to new customers at the
  moment; "Basic" and "Premium" are listed as temporarily unavailable. Free access is given case
  by case, usually for a limited time, and for the free plan the project's code must be open
  source. Third-party pages mention about 60 requests an hour for free access and 49 $ and 199 $
  a month for the two paid plans; none of that is confirmed.
- Licence: CC-BY-SA 3.0. Liquipedia must be named as the source, which the provenance line does.

What Liquipedia would add that nothing else has:

- **Trackmania**, which has no other source at all.
- Prize money by place, organisers and venues.
- Transfers and line-up history with dates, which the team page's "who played when" needs.
- For Counter-Strike: map names and map scores, without paying PandaScore.
- Swiss stages and groups as structures, not only as lists of matches.

What it needs from the owner: an application for access, made by a person. See the open
questions in the requirements.

## Considered and not used

| Source                                  | Why not, for now                                                                                                                                         |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LoL Esports API (behind lolesports.com) | It has live game state for League, free, but it is unofficial and its terms could not be confirmed. Worth a second look if live League matters most      |
| start.gg                                | Free with a token. It carries Rocket League's official brackets and could add game scores. PandaScore already covers the schedule                        |
| Nadeo's Trackmania services             | Official, needs a Ubisoft account. Whether third-party professional events are in it is not confirmed. The fallback for Trackmania if Liquipedia says no |
| HLTV                                    | No API, and reading its pages by program is against its terms                                                                                            |
| FIDE rating lists                       | Lichess broadcasts already carry title and rating for every player in an event                                                                           |

## Before going public

Licensing decides what can be shown publicly. PandaScore's free plan and Liquipedia's free access
are both for non-commercial use; a public, monetised Bearing would need paid agreements with both.
Team logos are licensed by nobody, which is why teams are discs.

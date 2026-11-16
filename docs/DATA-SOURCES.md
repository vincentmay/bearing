# Data sources

State on 2026-11-16. Four sources are integrated and running; the rest are assessed below with what
each would add and what it costs. Prices and terms were read on that day from the pages named;
where a page could not be read, that is said.

Every adapter maps into the canonical model and records where a fact came from (`Provenance`), so
a source can be swapped for another without touching a screen. The screens only ever read
Bearing's own store.

## What runs today

| Game              | Source                                                 | What Bearing gets                                                                                                                                                                                                                          | What it does not get                                                              |
| ----------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Chess             | Lichess broadcasts                                     | Events, rounds, pairings, results, the position and clocks of games in progress, players with title, rating, federation                                                                                                                    | Organiser, prize money, a format Bearing can draw (only "round robin" when named) |
| Counter-Strike 2  | PandaScore, free                                       | Events with stages, every match with its series score and the winner of each map, bracket links, teams, players, prize                                                                                                                     | Map names, round scores, rounds, player statistics, when a player joined          |
| League of Legends | PandaScore, free, the lolesports feed, and Leaguepedia | The same, the length of each game, from the feed what happened inside it (kills, towers, dragons and barons by the minute, during the game and afterwards), and from Leaguepedia every game's picks, bans and player lines once it is over | Gold over time as a drawing; player lines while a game is still being played      |
| Rocket League     | PandaScore, free                                       | The same as Counter-Strike                                                                                                                                                                                                                 | Goals, game scores                                                                |
| Trackmania        | none                                                   |                                                                                                                                                                                                                                            | Everything                                                                        |

Team colours come from no source. The well-known ones are kept by hand in
`packages/domain/src/sources/colors.ts`; a team that is not listed is drawn in ink.

How often: schedules every hour; anything live or due every thirty seconds, and only then;
League games that are over and still lack their detail every half hour, three games a run. Which
events: Lichess broadcasts of tier 4 and 5 (up to five at once, the top tier first); PandaScore
tiers S, A and B (up to ten editions per game). On real data, what ended more than sixty days ago
is removed.

Because of the gaps in the right-hand column, a Counter-Strike map on real data shows who won it
and nothing more, where the sample shows every round. League is the one team game whose full form
of section 5 of the requirements is drawn from real data. For the others the data is in paid plans
the owner has ruled out, or in Liquipedia (both below).

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
- For two games that is 2,000 € a month and up. **Decided by the owner on 2026-11-16: no.**
  Bearing stays on the free plan; what the free plan lacks is to come from sources that cost
  nothing (the lolesports feed, Liquipedia, start.gg).

Terms that matter: the stats plans are for uses that have nothing to do with betting, which fits.
The token lives on the Convex deployment as `PANDASCORE_TOKEN`.

## The lolesports feed

The pages of lolesports.com read two addresses: a schedule (`esports-api.lolesports.com`), which
wants a key that the site itself sends to every visitor, and a feed of game states
(`feed.lolesports.com/livestats`), which wants nothing. The feed gives, for any instant of a game,
both teams' kills, towers, dragons, barons, inhibitors and gold. Bearing asks it once a minute of
game time and takes an objective to have fallen between the two looks where its count went up.

- What it is used for: only what happened inside a League game. Schedule, teams and results stay
  with PandaScore; a game is matched to the feed by its two teams and its day.
- **Standing: unofficial, and that is settled, not open.** Riot publishes no documentation and no
  terms for these addresses; they are not part of the developer portal, whose rules and keys cover
  the game's own API and say nothing of esports data. No page was found that allows this use and
  none that forbids it. Others describe the feed the same way: undocumented, unsupported, able to
  change without notice. Riot's general policy for fan projects ("Legal Jibber Jabber") allows
  free, non-commercial community work with its material, which is the nearest thing to a footing.
- What follows from that: it is fine for a private and non-commercial Bearing, it can break on any
  day, and it is not something to earn money on. A paid Bearing would need Riot's word or a paid
  feed. Asking is free: the developer portal takes product registrations and has a support form.
- It is one switch. The key is the deployment variable `LOLESPORTS_KEY`; without it nothing is
  asked and League falls back to what PandaScore gives. The match page names the feed as a source.

## Leaguepedia

[lol.fandom.com](https://lol.fandom.com), the League of Legends wiki on Fandom. It is not
Liquipedia and has nothing to do with it. Found on 2026-11-16, after Liquipedia's refusal.

- Access: open, no key, through the wiki's query interface ("Cargo",
  `api.php?action=cargoquery`). Tables used: `ScoreboardGames` (teams, sides, picks, bans,
  totals, length) and `ScoreboardPlayers` (champion, kills, deaths, assists, gold, minions,
  damage, role).
- Licence: CC BY-SA 3.0, as the site states. That allows use in a product that earns money, as
  long as the source is named and what is taken stays under the same licence. Fandom's own
  terms of use could not be read by program and were not checked beyond that.
- Etiquette: a visitor without an account may ask only a few questions in a row; the wiki then
  answers "ratelimited". The adapter asks one question every three seconds, waits and asks
  again when told to, and needs about fifteen questions for twenty series.
- How it is used: every six hours, the finished League games of the last four days that still
  lack their lines are looked up by their two teams and their day. A series whose winners do
  not agree with what the store has is left alone. `npx convex run leaguepedia:enrich
  '{"days":60}'` fills in further back.
- Volunteers enter the games, usually within hours. Until then a game shows what the other
  sources give.
- The champions' pictures are Riot's own public files (Data Dragon,
  `ddragon.leagueoflegends.com`); only the name a picture is filed under is stored.
- Not used yet, and there: `RosterChanges` (who joined and left, with dates),
  `TournamentResults` (prize money by place), `Tenures`, and games going back years. This is
  what Liquipedia would have given for League.

## Liquipedia

Read from [the API terms](https://liquipedia.net/api-terms-of-use). The page with the plans
([liquipedia.net/api](https://liquipedia.net/api)) refuses automated readers; what follows about
plans is from a search result quoting it and from third-party summaries, and must be confirmed in
a browser.

- There are two APIs. The wiki's own (MediaWiki) API is **not allowed** for this: "Use of the API
  for non-editing purposes is not supported". Reading the HTML pages by program is forbidden too.
- The data API (LiquipediaDB) is granted "upon approved request", with a rate limit by plan.
- Plans, confirmed by the owner in a browser on 2026-11-16: only "Enterprise" is open to new
  customers; "Basic" and "Premium" are "temporarily unavailable". The application form offers two
  choices, "Free (check FAQ first)" and "Enterprise".
- The free plan is for educational use, for public websites that are not monetised and do not
  repeat what Liquipedia itself does, and for community features. The project's code must be open
  source. It is usually granted for a limited time. Never accepted: betting, and copies of
  Liquipedia. Bearing fits as long as it earns nothing; the owner has agreed to open the source.
- Licence: CC-BY-SA 3.0. Liquipedia must be named as the source, which the provenance line does.

What Liquipedia would add that nothing else has:

- **Trackmania**, which has no other source at all.
- Prize money by place, organisers and venues.
- Transfers and line-up history with dates, which the team page's "who played when" needs.
- For Counter-Strike: map names and map scores, without paying PandaScore.
- Swiss stages and groups as structures, not only as lists of matches.

**Refused on 2026-11-16.** The owner applied for the free plan that day; the answer came
within the hour: "Unfortunately, we do not provide free API access for projects looking to
replicate core features of Liquipedia." Schedules, brackets and results are what Liquipedia
itself is, so a free plan is not to be had for Bearing however it is worded. What is left is
the paid "Enterprise" plan, whose price is not published, and doing without:

- Trackmania has no source. Nadeo's services are the only other candidate.
- Counter-Strike map names and scores: no free source is known.
- Rocket League game scores: start.gg, with a token.
- Prize money by place and transfers: from no source for now.

## Considered and not used

| Source                       | Why not, for now                                                                                                                                                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| start.gg                     | Free with a token the owner makes in their start.gg account. It carries Rocket League's official brackets and would add game scores. The next source to add                                                                                                                                                  |
| Octane (octane.gg)           | Was the open source of Rocket League statistics, goals included. Its API no longer answers                                                                                                                                                                                                                   |
| Nadeo's Trackmania services  | Official, needs a Ubisoft account. Whether third-party professional events are in it is not confirmed. In 2026 the Trackmania World Tour is paused for the Esports World Cup, so there is little to show either way                                                                                          |
| GRID                         | Had a free "Open Access" programme for Counter-Strike and Dota 2, and since 2025 holds ESL's data exclusively. On 2026-11-16 the programme's address shows commercial plans only, "custom-priced". Asking costs one message through the contact form; a free answer is unlikely                              |
| BALLDONTLIE (Counter-Strike) | Not free: 39.99 US dollars a month. Has what nothing free has: map names and scores, every round with how it ended, economy, player lines per map. Its terms allow any use, paid products included, without naming it. Where it gets its data is not said. A week's trial needs a card. The owner's decision |
| ballchasing.com              | Rocket League replays with full statistics, free with a token. Whether the professional matches are there complete was not confirmed                                                                                                                                                                         |
| HLTV                         | No API, and reading its pages by program is against its terms                                                                                                                                                                                                                                                |
| FIDE rating lists            | Lichess broadcasts already carry title and rating for every player in an event                                                                                                                                                                                                                               |

## What the store costs to keep fresh

Convex's free plan counts what functions read. On 2026-11-16 the account was reported above
its limits. Two jobs read most and were cut down: the hourly PandaScore run compared every
match with the store, and now sends only the pieces whose fingerprint has changed
(`digests`); and the League feed looked through five days of matches every thirty seconds
while anything at all was live, and now does that only every half hour. Lichess's hourly run
still compares what it fetches.

## Before going public

Licensing decides what can be shown publicly, and every source Bearing has is free only while
Bearing earns nothing: PandaScore's free plan, Liquipedia's free plan, and the lolesports feed,
which has no terms at all. A Bearing behind `bearing.vincentmay.com`, free and open source, is
inside all of them. A Bearing that earns money is not, and would need a paid agreement with
PandaScore and Liquipedia and Riot's word on the feed; that is a cost to weigh against whatever it
would earn, when the time comes. Team logos are licensed by nobody, which is why teams are discs.

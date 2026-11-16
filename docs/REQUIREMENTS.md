# Bearing: requirements

Written on 2026-11-16 as a handover. It is meant to be enough for someone who was not part of the
design work to build the application with the agreed brand identity.

## 0. How to read this

**What is settled and what is not.** Every requirement is marked:

- **Agreed**: decided by the owner during the design rounds. Do not change without asking.
- **Proposed**: my recommendation, not yet confirmed by the owner. Build it this way unless told
  otherwise, and say so when you do.
- **Open**: needs a decision from the owner before it can be built. Listed again in section 14.

**Sources of truth, in order.** If two disagree, the earlier one wins.

1. This document.
2. `docs/BRAND.md`: the identity as a written spec (logo, colour, type, layout, dots, motion).
3. `docs/BRAND-CORE.md`: who it is for, the promise, the character, the principles.
4. `docs/identity/round-10.html`: the working prototype. Open it in a browser; it plays a live
   match in every game and is the reference for look, spacing and motion.
5. `apps/web/src/bearing/`: a first slice already built in the app (section 12).

Out of date, do not copy from them: `docs/identity/bearing-identity.html`, rounds 1 to 9 in
`docs/identity/`, `docs/DESIGN-DIRECTIONS.md`, and everything under `apps/web/src` outside
`bearing/` as far as appearance goes.

**The owner's standing rule (Agreed):** "If you want to introduce new tech, discuss it with me
first." This covers libraries, services and frameworks.

## 1. The product

**Promise (Agreed):** Everything you follow, in one clear view: what is on, what is next, where it
stands.

**Who it is for (Agreed):** someone who follows several competitive scenes at once and is tired of
piecing the picture together from wikis, league sites, social feeds and streams. It starts as a
private tool for its owner and goes public only "when it is amazing".

**The questions it answers (Agreed):**

1. What is on now? Live matches with the state of play.
2. What is next for me? A personal timeline from everything followed, in local time, including
   matches that only happen if a followed team wins first.
3. What did I miss? Results for followed things, including bad news.
4. How does this event work and where does it stand? The format in plain words, with the bracket
   or table as the centrepiece.
5. Who is this team or player? Line-up, history, form, results.

**What it is not (Agreed):** not a wiki, not a news site, not a betting product (no odds, ever),
not a social network, not a statistics lab.

**Character (Agreed):** clear, solid, alive. Calm by default; live sport is the one thing allowed
to move.

## 2. Scope of version 1

| Item        | Requirement                                                                     | Status   |
| ----------- | ------------------------------------------------------------------------------- | -------- |
| Games       | Counter-Strike 2, League of Legends, Rocket League, chess, Trackmania           | Agreed   |
| Later games | Football and other sports, through the same data model                          | Agreed   |
| Platform    | A web application that works on a phone and on a wide screen                    | Agreed   |
| Screens     | Today, Match, Schedule, Following, Search, Team, Player, Tournament, Settings   | Proposed |
| Language    | English                                                                         | Proposed |
| Accounts    | Optional accounts through Clerk, with follows synced through Convex (section 8) | Agreed   |
| Audience    | One private user first; nothing in the design may assume that                   | Agreed   |

Out of scope for version 1 (Proposed): notifications, calendar export, video links, a spoiler-free
mode, native apps, any editing of data by users.

## 3. Brand identity

`docs/BRAND.md` is binding. The points most often got wrong, all **Agreed**:

- **B1.** Black and white only: `#000` and `#FFF` with plain greys, in a light and a dark mode.
- **B2.** The brand has no accent colour. Nothing is red, including "live".
- **B3.** The only colour on a page belongs to a team or player, and it appears in two forms only:
  a flat disc with the short name on it, and a flat dot for a thing won. No team logos.
- **B4.** No gradients, colour fades, tints, glows or blurred colour, anywhere.
- **B5.** Nothing shaded or three-dimensional. No bevels, no glossy spheres.
- **B6.** Typeface Gabarito for everything read; Geist Mono for small technical labels. Names are
  ExtraBold, scores are Regular at the same size, numbers use tabular figures.
- **B7.** Logo: the ball seated in its ring, always in one colour. Files are in `docs/brand/`.
- **B8.** Layout: cards one level deep, following the six rules in `docs/BRAND.md`. Boxes never
  nest; headings and section labels lie on the page; inside a card only hairlines divide rows.
- **B9.** Navigation: on a phone, a small floating capsule at the bottom with four Lucide icons and
  no labels; on a wide screen see G1a. Icons everywhere are Lucide (`lucide-react`).
- **B10.** A score is drawn as dots on a line, never in a circle.
- **B11.** Sample and test data must rotate through several teams, so no colour reads as the
  brand's. Never show yellow against blue as the only example.

## 4. Screens

Requirement IDs are for reference in reviews. Unless marked, they are **Proposed**: the first five
screens exist in the prototype or the app slice and were seen by the owner; Team, Player,
Tournament and Settings were never designed.

### 4.1 Everywhere

- **G1 (Agreed).** The navigation is visible on every screen. Its four entries are Today,
  Schedule, Following and Search. A marker slides to the selected one.
- **G1a (Agreed on 2026-11-16).** The small capsule at the bottom is for phones. The owner: "the
  mobile navigation probably should not be used at full hd desktop sizing." From 900 px the same
  capsule sits at the top with its labels, between the mark with its name on the left and
  Settings on the right. The owner on this form and on the three new pages: "Yes, looks right i
  suppose."
- **G1b (Proposed).** The capsule is opaque. In the prototype it was translucent with a blur,
  which let team colours show through as a haze; B4 forbids blurred colour, and this document
  outranks the prototype. The owner asked to see both and has not answered yet.
- **G2.** Phone layout up to 600 px wide: one column. Wide layout from 900 px: the same content in
  a wider column, with the wide match header (4.3) and lists set side by side where that helps.
  Nothing scrolls sideways at any width from 320 px.
- **G3 (Agreed).** Light and dark follow the system setting. Settings can override it.
- **G4 (Agreed).** Every time is shown in the viewer's own time zone and locale, with a relative
  time next to an absolute one ("20:30", "in 50 min").
- **G5.** Every match, team, player and tournament shown anywhere is a link to its own page.
- **G6.** Every screen has a designed state for loading, for "nothing here" and for "could not
  load". None of them is a spinner alone.
- **G7 (Agreed).** Where a fact comes from, and when it was last checked, can be seen for every
  match and tournament (the domain model carries this as `Provenance`).

### 4.2 Today

The home screen. Answers questions 1 to 3.

- **T1 (Agreed).** The match to look at first is at the top, in the one larger card: the live
  match that matters most to the viewer (followed first, then the higher-tier event). When nothing
  is live, the next followed match takes that place.
- **T2 (Agreed).** That card shows: live status in words with the live dot, game and event, both
  sides as discs with names, the score, and the score's dots in the small form for that game
  (section 5).
- **T3.** "Also live": other live matches, one row each.
- **T4 (Agreed).** "Next": upcoming matches in time order. Each row has the two sides in one split
  disc, with a ring around it that fills as the start gets closer, the local time, the names, the
  game and event, and how long until it starts.
- **T5.** "Next" includes matches that depend on a result ("if Vitality beat Aurora"), said in
  those words. The logic exists in `apps/web/src/lib/view.ts` (`upcomingForYou`).
- **T6 (Agreed).** "Earlier": recent results, followed things first, each with its score and its
  dots.
- **T7.** With nothing followed yet, Today shows the biggest live and upcoming matches and one line
  inviting the viewer to follow something.

### 4.3 Match

- **M1 (Agreed).** The heading lies on the page, not in a card: both sides as discs with names,
  the score set large, and the status in words.
- **M2 (Agreed).** Under it, one card holds every map or game of the series as rows: the one being
  played first, finished ones newest first, those still to come last.
- **M3 (Agreed).** Each row uses the full form for its game (section 5).
- **M4 (Agreed).** On a wide screen the match header shows the series as a line of stops. Each stop
  is a map or game, filled with the colour of whoever won it; the one being played opens into its
  detail (rounds as dots, or events on a clock). See the prototype.
- **M5.** Where the match sits in its event and where the winner goes next, with a link to the
  tournament.
- **M6.** A field of more than two (a Trackmania cup) has no "a v b" header: the event name leads,
  and the standings are the main content.
- **M7.** A match that has not started shows its start time large, the countdown, and each side's
  recent form.
- **M8.** Line-ups and per-player lines where the data has them (the model has `PlayerLine`).

### 4.4 Schedule

- **S1.** A row of days; the selected day is a filled circle. Today is selected first.
- **S2.** All matches of that day in time order, across all games, with status (to come, live,
  final score).
- **S3.** A switch between "everything" and "what I follow".
- **S4.** Matches that overlap in time are recognisable as overlapping.

### 4.5 Following

- **F1.** Everything followed: teams, players, tournaments, whole games and organisations.
  Following an organisation follows its teams in every game.
- **F2 (Agreed).** A team or player row shows its disc, its name, its game and its last five
  results as dots: filled for a win, open for a loss, shared for a draw.
- **F3.** Each row says what is next for it, or says plainly that nothing is ("T1 are out. Nothing
  else is scheduled for them this year.").
- **F4.** Following and unfollowing is one tap on a star, from this screen, from search and from
  any team, player or tournament page.

### 4.6 Search

- **Q1.** One field that finds teams, players and tournaments by name as the viewer types.
- **Q2.** Results can be followed directly from the list.
- **Q3.** With an empty field it shows what is followed and what was looked at recently.

### 4.7 Team (not yet designed)

- **TE1.** Disc, name, game, region; the same organisation's teams in other games.
- **TE2.** What is next and what is live for this team.
- **TE3.** Current line-up, and line-up history as a time line (the model has `Stint`).
- **TE4.** Recent results with dots, form, and record by map where the game has maps.
- **TE5.** The owner's bar for this page and the two after it is high: they want team, player and
  tournament pages "displayed in a way that is just stunning". Design it, show it, then build it.

### 4.8 Player (not yet designed)

- **P1.** Name, handle, country, role or title, rating where the game has one.
- **P2.** Current team and career as a time line.
- **P3.** Recent matches and totals from the data (`playerTotals` in the domain package).

### 4.9 Tournament (not yet designed)

- **TO1.** Name, dates, place, organiser, prize, and where its facts come from.
- **TO2.** The format explained in plain language (the model has `Stage.explainer`).
- **TO3.** Each stage drawn for its format: single and double elimination as a bracket, Swiss as
  rounds with records, round robin as a table, Trackmania cup as heats. The logic for records and
  standings exists in the domain package; drawings exist in the old code under
  `apps/web/src/components/formats/` and can be reused for structure, not for appearance.
- **TO4.** Brackets follow the dot rule: a decided match shows the winner's dot.
- **TO5.** Final placements and prize money once known.

### 4.10 Settings

- **SE1.** Appearance: system, light or dark.
- **SE2.** Time: 12 or 24 hour clock, and the time zone if not the system's.
- **SE3.** Account and sync, once section 8 exists.

## 5. How a score is drawn, by game

**Agreed** as a principle ("that very much depends on the situation"); the split below was shown in
the prototype and not contested.

| Game              | Small: a card or a row                                | Full: the match page                                              |
| ----------------- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| Counter-Strike 2  | Every round of the live map, in two rows of twelve    | The same per map, plus rounds above and below a line for momentum |
| League of Legends | One dot per game; kills and the clock as numbers      | Objectives on the game clock, above and below a line, by size     |
| Rocket League     | Goals of the live game as the score; one dot per game | Goals on the five-minute clock; earlier games with goals in order |
| Chess             | One dot per game; a draw is one dot shared by both    | A row per player; the move count of the game in progress          |
| Trackmania        | One dot per round, in the colour of whoever won it    | A row per driver; the places the followed driver took             |

Dot states: won (filled with the winner's colour), being played (an ink outline that breathes, one
per match), to come (a pale outline, left out once the match is over).

**Data (closed on 2026-11-16):** `GameResult` now carries `events` (each Rocket League goal and
League objective with its second on the game clock), `clock` (seconds played) and, for a
Trackmania cup, `cup.rounds` (the finishing order of every round). The sample world fills all
three.

**Trackmania (Proposed, differs from the prototype):** the prototype showed "first to five
rounds". The model and the real cup format are points to a limit, then one more round win. The app
follows the real format: one dot per round in the colour of whoever won it, standings by points.

## 6. Motion and interaction

All **Agreed** in the prototype. Timings are in `docs/BRAND.md`.

- **A1.** Live is shown by position (first on the page), a dot that sends out a ring, and one open
  dot. Nothing else moves on its own.
- **A2.** When something is won, its dot lands with a small overshoot and the open dot moves on.
- **A3.** When a score changes, the new number rises into place.
- **A4.** When a match ends, it says so, then the next one takes its place.
- **A5.** Pressing a card or a row gives a slight press-in. The navigation marker slides.
- **A6.** With reduced motion set on the device, every loop stops and changes happen at once.
  Nothing depends on motion to be understood.
- **A7.** The owner called interaction and live behaviour "crucial". Do not judge a screen from a
  still image; show it working.

## 7. Data

- **D1 (Agreed).** One canonical model for every game, in `packages/domain/src/model.ts`. Source
  formats never reach the screens.
- **D2 (Agreed).** A generated sample world (`packages/domain/src/sample`) drives the app today.
  Keep it: it shows every state at once and is what the screenshot checks run against.
- **D2a (Proposed).** The sample world is played forward so that live behaviour can be seen:
  `advance` in `packages/domain/src/sample/play.ts` is a pure function from one world to the next
  (a round is won, a goal goes in, a match ends, the winner moves on in the bracket). The app
  calls it every 2.4 seconds and writes the result into the query cache; a backend can call the
  same function on a schedule. It runs faster than real time, and Settings says so.
- **D3 (Agreed).** Unknown stays unknown. Nothing is guessed, and any generated sentence is derived
  strictly from match state.
- **D4.** Real data arrives through one adapter per source, each mapping into the model with
  provenance. The screens only ever read Bearing's own store. Candidates and their licence terms
  are in `docs/DATA-SOURCES.md`; several items there are marked "verify".
- **D5 (Agreed on 2026-11-16).** Real data, from the best source for each game. The owner: "We
  should make use of all the information we can get and have, the best stuff." Running today:
  Lichess broadcasts for chess, and PandaScore's free plan for Counter-Strike 2, League of Legends
  and Rocket League. Trackmania has no source until Liquipedia grants access.
  `docs/DATA-SOURCES.md` says what each source gives, what it lacks, and what paid plans would
  add.
- **D5a (Proposed).** A deployment is on sample data or on real data, never a mixture, because
  the sample lives at a pinned instant and real data in real time. `npx convex run
  sample:useLive` switches to real data and `sample:reset` back. The owner's deployment is on
  real data.
- **D5b (Proposed).** Where a source does not say something, the model leaves it out and the
  screens draw less: a stage known only as rounds is a list of rounds; a map of which only the
  winner is known is one row saying who won; a team without a known colour is drawn in ink; a
  line-up without join dates has no "who played when". Team colours are kept by hand for the
  well-known teams, because no source has them.
- **D5c (Proposed).** Which events: Lichess broadcasts of tier 4 and 5, PandaScore tiers S, A and
  B. What ended more than sixty days ago is removed.
- **D6.** Freshness: a live match is at most 30 seconds behind its source; schedules at most an
  hour. Built: schedules every hour; once a minute a check looks for anything live or due, and
  only then are the sources asked, now and thirty seconds later. Every match and event shows
  when its source was last checked. Not built: a warning on the screen when a source has been
  unreachable for long.
- **D7 (Agreed).** Licensing decides what can go public. Several sources are free only for
  non-commercial use, and team logos are not licensed at all, which is why teams are discs.

## 8. Accounts, sync and the backend

**Agreed** on 2026-11-16. The owner raised both ("we should probably go for clerk no?", "Would
convex make sense?"), I recommended Convex now and Clerk later, and the owner decided on both now:
"convex and clerk, since we can just make it ready for production anyway". Build this part to
production standard, not as a demo.

- **K1 (Agreed). Backend: Convex.** It fits this product for three reasons. Queries are live, so a score
  that changes on the server reaches every open screen without extra plumbing. Its scheduled and
  cron functions can run the source adapters of section 7. It is TypeScript end to end and has an
  adapter for TanStack Query, which this app already uses. Costs to accept: the data model and
  queries are Convex's own and not SQL; the TanStack Query adapter is documented as beta; and at
  public scale the bill follows function calls, which a live product makes many of. The backend is
  open source and can be self-hosted, which limits the lock-in.
- **K2 (Agreed). Accounts: Clerk.** Sign-up, sign-in and the user profile go through Clerk, joined
  to Convex through Clerk's documented Convex integration. Clerk's screens must be restyled to the
  identity (black and white, Gabarito, cards one level deep); the default look does not fit.
- **K3.** The app stays fully usable without an account: follows are then kept on the device,
  behind the small interface they already have (`apps/web/src/lib/follows.ts`). Signing in adds
  sync; it is never a wall in front of the content.
- **K4.** Follows made on the device before signing in are carried into the account on first
  sign-in, and from then on are the same on every device.
- **K5.** Keys and secrets for Convex and Clerk never go into the repository. `.env` files are
  already ignored; document the variables that are needed in a `.env.example`. The owner creates
  the Convex and Clerk projects and supplies the keys: ask for them, do not invent placeholders
  that look real.
- **K6.** No tracking, no advertising identifiers, no selling of data. An account holds an email
  address and the list of follows, nothing else.

Figures I found on 2026-11-16 and did not verify at the source: Clerk's free plan covers 50,000
monthly returning users; Convex's free plan about 1 million function calls a month and 0.5 GB of
data. Check both pricing pages before relying on them.

## 9. Later

Proposed order once version 1 stands: notifications for followed things; calendar export; links to
official streams and recordings; a spoiler-free mode; football.

## 10. Quality

- **Y1.** Works from 320 px to 1920 px with no sideways scrolling. Verified at 390 and 1440.
- **Y2.** Text contrast of at least 4.5 to 1 in both modes. A team's colour is never the only
  carrier of meaning: dots have labels, discs have names.
- **Y3.** Everything can be reached and operated by keyboard; icon-only buttons have names for
  screen readers.
- **Y4.** First screen usable in under two seconds on a mid-range phone on a normal connection.
- **Y5.** `vp check` (format, lint, types) and `vp run -r test` pass before anything is called
  done.
- **Y6.** Every screen is looked at in a real browser, in light and dark, at phone and wide width,
  before it is shown to the owner. `scripts/app-shots.mjs` does this for the current screens.
- **Y7.** Diagrams and drawings are checked against their own guides before they are shown. One
  was not, during the design rounds, and it cost a round.

## 11. Technology

| Area      | Requirement                                                                 | Status   |
| --------- | --------------------------------------------------------------------------- | -------- |
| Packages  | pnpm workspace; Vite+ (`vp`) for dev, build, check and test                 | Agreed   |
| Interface | React 19, TanStack Router (file routes), TanStack Query                     | Agreed   |
| Styling   | Plain CSS scoped to `.bx` in `bearing.css`. Tailwind was unused and removed | Proposed |
| Icons     | `lucide-react`                                                              | Agreed   |
| Fonts     | `@fontsource-variable/gabarito`, `@fontsource-variable/geist-mono`          | Agreed   |
| Three.js  | Removed with the earlier directions on 2026-11-16                           | Done     |
| Backend   | Convex (section 8)                                                          | Agreed   |
| Accounts  | Clerk (section 8)                                                           | Agreed   |

Anything not in this table needs the owner's agreement first.

## 12. State of the repository

Location: `C:\Users\vmay1\Code\playground\bearing`. The repository has one commit, made on
2026-11-16 with the owner's agreement. It holds everything as it stood at handover, the six old
directions included, so removing them later loses nothing. There is no remote. Commit or push
further work only when the owner asks.

**State on 2026-11-16, after steps 2 to 5 and the code for step 6:**

- `apps/web/src/bearing/`: `bearing.css` (tokens and components), `model.ts` (turns a domain match
  into what a screen needs: sides, colours, score, dots, stops, sentences), `time.ts` (every time
  on a screen goes through it), `board.ts` (what each screen starts from), `ui.tsx` (mark, disc,
  split disc, live dot, dots that land, ticking score, clock line, star, segmented control,
  waiting and problem states), `forms.tsx` (the full form of each game, the line of stops),
  `stages.tsx` (bracket, Swiss table, cross table, cup heats, the generic line of stops),
  `live.tsx` (keeps the sample moving), `shell.tsx`, `links.tsx`, and the screens `today.tsx`,
  `match.tsx`, `lists.tsx` (Schedule, Following, Search), `settings.tsx`, `team.tsx`,
  `player.tsx`, `tournament.tsx`.
- `apps/web/src/lib/`: `world.tsx` (the world from the browser's sample or from Convex),
  `backend.ts`, `account.tsx` (Clerk, follows in the account, carrying device follows over),
  `follows.ts`, `prefs.ts`, `recents.ts`, `view.ts`.
- `apps/web/convex/`: `schema.ts` and `validators.ts` (the canonical model as validators, with a
  compile-time check that they match `packages/domain`), `world.ts` (three live queries),
  `sample.ts` (the sample loaded in batches and played forward on the server while anyone is
  looking), `ingest.ts` (where every real source writes, and the once-a-minute check for live
  matches), `lichess.ts`, `pandascore.ts`, `retention.ts`, `crons.ts`, `follows.ts`,
  `auth.config.ts`.
- Sections 4.1 to 4.10, 5 and 6 are built at phone and wide width with motion.
- The six earlier directions, their fonts, Three.js and Tailwind are removed. They are in the
  first commit.
- Verified in the owner's Convex project and Clerk application: two browsers seeing the same
  moment, real data from Lichess and PandaScore end to end, signing in, device follows carried
  into the account (K4), a change reaching a second browser, signing out, and Clerk's dialog in
  the identity (K2). The backend's functions have their own tests (`apps/web/convex/*.test.ts`).
- **Not done:** Liquipedia (needs the owner's application), hosting of the web app, a Clerk
  production instance (needs a domain), and Y4 (first-screen speed) has not been measured.
- Readings and choices made while building, all **Proposed**:
  - M1 and M4: on Today the lead card carries the line of stops at wide width, as in the
    prototype. On the match page the heading and the stops lie on the page, not in a card.
  - Settings is reached through a gear: in the Today header on a phone, at the top right on a
    wide screen.
  - Appearance, clock and time zone stay on the device and are not synced (K6).
  - A match with four sides is drawn as one disc in quarters, and named by its heat
    ("Quarterfinal B").
  - Schedule shows seven days on a phone (two back, four ahead) and ten on a wide screen. A
    line joins matches that may be on at the same time, judged from typical lengths.
  - A second colour that is nearly black or nearly white counts as no second colour, because
    it cannot be seen on one of the two grounds; the team then takes ink.
  - Chess: ink goes to the player the page is about, else to the one the viewer follows, else
    to the first named.
  - A bracket is drawn as a tree on a phone too, with short names. It fits three rounds;
    a fourth round will need another answer.
  - Team: the year as a line of events. Player: the career as a line of teams, or the run
    through the current event for someone who plays alone. Tournament: each stage drawn for
    its format.
  - The sample on the server rests ninety seconds after the last screen stopped looking, and
    is loaded afresh after three hours, so that function calls are only spent while someone
    watches.
  - An account can follow up to 500 things.

**Commands:**

```sh
vp install
vp run @bearing/web#dev            # http://localhost:5810
vp check                           # format, lint, types
vp run -r test                     # domain tests
node scripts/app-shots.mjs         # every screen, light and dark, phone and wide; needs the dev server
node scripts/app-motion.mjs        # plays the sample forward and checks the live behaviour
node scripts/app-states.mjs        # waiting, could not load, nothing followed, nothing found
node scripts/app-backend.mjs       # the app against its backend, on the sample
node scripts/app-account.mjs       # signing in and follows in the account; needs a Clerk test user
```

In development `window.bearing.pause()` and `window.bearing.step(n)` drive the sample by hand, and
`?world=slow` or `?world=fail` on any address shows the waiting and the failed state.

## 13. Order of work

Proposed. Each step ends with the owner seeing it working.

1. **Commit** the repository as it stands. Done on 2026-11-16.
2. **Finish the five existing screens** against sections 4.1 to 4.6, 5 and 6, on the sample world,
   at phone and wide width, with motion. Done on 2026-11-16.
3. **Design, show, then build** Team, Player and Tournament. Built on 2026-11-16 and accepted by
   the owner the same day ("Yes, looks right i suppose").
4. **Remove the old directions** and the leftovers listed in section 12. Done on 2026-11-16.
5. **Backend**: Convex. Done on 2026-11-16 in the owner's Convex project `bearing`, on real data
   from Lichess and PandaScore. Liquipedia waits for the owner's application.
6. **Accounts and sync** with Clerk. Done on 2026-11-16 in the owner's Clerk application
   `Bearing` (development instance), and checked signed in by `scripts/app-account.mjs`. A
   production instance needs a domain the owner controls.

## 14. Open questions for the owner

1. Liquipedia: will you apply for data API access? It has to be a person, through
   liquipedia.net/api or their Discord. It is the only source for Trackmania and would add prize
   money by place, transfers and map scores. Free access appears to need open-source code; is
   publishing Bearing's code acceptable?
2. Round-by-round live state (every Counter-Strike round, League objectives on the clock) is only
   in PandaScore's Live plan, from 1,000 € per game per month. The app is built to show it when
   the data is there and to do without it when it is not. Is doing without it acceptable?
3. English only, or German as well?
4. The domain: nothing is bought. Within budget the clean options found were bearinglive.com and
   watchbearing.com. A production Clerk instance and a public address both wait for it.
5. Before any public launch: an EU trade mark check on the name "Bearing", a check of the logo
   against existing marks, and paid data agreements (the free plans are for non-commercial use).
6. The navigation capsule: opaque (as built, following B4) or translucent with a blur (as in
   the prototype)? See G1b.
7. Where should Bearing be hosted? The backend is deployed; the web app itself only runs on the
   owner's machine so far.

Settled on 2026-11-16 and no longer open: the card layout of round 10 ("Yes it is perfect now"),
Convex and Clerk, and the first git commit.

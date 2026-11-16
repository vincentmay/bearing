# Data sources

Status: research notes from 15 November 2026. Nothing here is integrated yet; the app runs on a
generated sample world (`packages/domain/src/sample`). Items marked **verify** were not confirmed
from a primary source and must be checked before building on them.

Slate is personal-first, with going public as a possible later goal. That matters: several
sources are free only for non-commercial use. Every adapter keeps provenance so a source can be
swapped for a licensed one without touching the UI.

## Candidates

| Source                                      | Covers                                                    | Access                                   | Notes                                                                                                                                                                                                                                            |
| ------------------------------------------- | --------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Liquipedia (LPDB API, `api.liquipedia.net`) | CS2, LoL, Trackmania, Rocket League (and most esports)    | Registration / API key                   | Richest structure: brackets, rosters, transfers, placements. Content is CC-BY-SA, which requires attribution and share-alike (fits the provenance model). **Verify** current API terms, pricing and whether personal/non-commercial use is free. |
| Liquipedia MediaWiki API                    | Same                                                      | Public, rate-limited                     | Strict limits and a required identifying User-Agent; parsing wikitext is fragile. Fallback only. **Verify** current limits.                                                                                                                      |
| PandaScore                                  | CS2, LoL, Rocket League, others (not chess or Trackmania) | Free tier: 1,000 requests/hour, fixtures | Structured schedules and results; deeper stats are paid; betting use is prohibited. Good schedule cross-check.                                                                                                                                   |
| LoL Esports API (used by lolesports.com)    | League                                                    | Unofficial, public key                   | Live schedules and game state. Unofficial; **verify** terms before relying on it.                                                                                                                                                                |
| Lichess API (broadcasts)                    | Chess (elite events relayed with live moves)              | Open, free                               | The best chess source: official broadcasts with live PGN, round structure and players.                                                                                                                                                           |
| FIDE ratings                                | Chess                                                     | Public downloads                         | Official ratings and titles.                                                                                                                                                                                                                     |
| Nadeo / Trackmania.io                       | Trackmania                                                | Ubisoft account auth                     | Official competition and player data. **Verify** terms for third-party use.                                                                                                                                                                      |
| start.gg                                    | Grassroots events                                         | API key, free                            | Useful for smaller Rocket League and community events.                                                                                                                                                                                           |

## Recommendation

1. **Ingestion service** (a later `apps/ingest`): one adapter per source, each mapping into the
   canonical model with `Provenance` (source, checked-at, note). The web app only ever reads
   Slate's own database.
2. **First adapters:** Lichess broadcasts (chess: open, live, free), then Liquipedia for CS2,
   League, Trackmania and Rocket League once API access and terms are confirmed. PandaScore's
   free fixtures act as a schedule cross-check.
3. **Before any public launch:** settle licensing per source. Commercial use of Liquipedia or
   PandaScore data likely needs a paid agreement.

## Open questions for you

- Are you happy to apply for Liquipedia API access as a personal, non-commercial project?
- Is live game state needed at launch (round-by-round), or are schedules and results enough at first?

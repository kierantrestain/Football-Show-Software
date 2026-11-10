# Football data evidence · 10 November 2026

This review includes the 2026/27 season snapshot. The Premier League is the default and the rehearsal dataset requires an explicit selection. The supported UEFA schedules cover their published league phases. The fixture bundle is a coverage preview.

| Competition | Fixture coverage | Final scores | Last complete round in snapshot | Latest completed round checked | Clubs with usable sourced squads | Both confirmed XIs | Current metrics |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Premier League | 380/380 | 72/100 played | 7 | 10, incomplete | 0/20 | 0 | Played, W/D/L, goals for and against, difference, points from available results |
| Champions League | 144/144 league-phase | 72/72 played | 4 | 4, all 18 results matched | 0/36 | 0 | Same result-derived totals |
| Europa League | 144/144 league-phase | 72/72 played | 4 | 4, all 18 results matched | 0/36 | 0 | Same result-derived totals |

The bundle was retrieved 10 November 2026 at 01:13 UTC. The latest available scored kickoffs were 8 November at 16:30 UTC in the Premier League, 4 November at 20:00 UTC in the Champions League, and 5 November at 20:00 UTC in the Europa League. The Premier League snapshot has 28 past fixtures awaiting verification. Reported feed scores are labelled separately from independently checked results. Only checked results settle real predictions and queue result graphics. Current player totals require an authorised pack. The comparison desk keeps the existing 2023/24 archive separate.

## Independent checks

- Premier League Matchweek 10 completed 8 November. Manchester United's calendar, both clubs' reports and the league agreed on United 4–4 Villa. The fixture list places it on Sunday 8 November at 16:30 GMT. Matchweek 11 Manchester City–Fulham was independently checked for 21 November at 12:30 GMT. [Premier League fixture list](https://www.premierleague.com/en/news/4675097) · [United November calendar](https://www.manutd.com/en/matches/mens-team/fixtures?competition=premier-league-international-cup&month=2026-11) · [United 4–4 report and both XIs](https://www.manutd.com/en/news/manchester-united-4-aston-villa-4-match-report-8-nov-2026) · [Villa 4–4 report](https://www.avfc.co.uk/news/2026/november/08/report-manchester-united-4-4-aston-villa/) · [Premier League results](https://www.premierleague.com/en/news/4757019/what-we-learned-from-sundays-matches/)
- Both published United–Villa starting XIs and nine listed substitutes per side were checked against the club match centre, post-match report and the league's September squad-number reference. These verify the identities for the audit. An authorised structured copy is needed to populate the review's XI or exercise an on-air segment with those identities. The regression pins fixture identity, date, score and the two unresolved teams. [Published XIs](https://www.manutd.com/en/matches/mens-team/manchester-united-v-aston-villa-fc-premier-league-20261108?tab=live) · [Official squad numbers](https://www.premierleague.com/en/news/4725682) · [League squad lists](https://www.premierleague.com/en/news/4706139/see-all-the-202627-premier-league-squad-lists)
- All 18 Champions League Matchday 4 results agreed, including Manchester United 3–2 Roma and Bodø/Glimt 0–0 Lille. UEFA's schedule lists Manchester City–Napoli on 24 November at 21:00 CET, corresponding to 20:00 UTC. [UEFA Champions League results and fixtures](https://www.uefa.com/uefachampionsleague/news/02a8-2174c9e9019d-f909a77bd77a-1000--2026-27-champions-league-all-the-league-phase-fixtures-a/)
- All 18 Europa League Matchday 4 results agreed, including Sunderland 0–2 Dinamo Zagreb and Rennes 0–0 Olympiacos. UEFA lists Dinamo Zagreb–Leverkusen on 26 November at 18:45 CET, corresponding to 17:45 UTC. [UEFA Europa League results and fixtures](https://www.uefa.com/uefaeuropaleague/news/02a8-2174cafa5bb6-82bbc20c9b92-1000--2026-27-europa-league-all-the-league-phase-fixtures-and-results/)

## Feed and reuse review

| Feed | Actual check | Use in the review |
| --- | --- | --- |
| OpenLigaDB | 380 PL rows and 71 finals through one Matchweek 9 result, 144 CL rows with 72 finals, 144 EL rows with 72 finals. The separate `ucl2026` endpoint returned 32 different fixtures and zero results. | `pl`, `ucl` and `uel2026` provide the fixture spine. OpenLigaDB explicitly permits commercial use under ODbL with attribution. Cached and redistributed derivative fixture data retains ODbL. |
| OpenFootball | 380 PL rows and 50 scores through 20 September. United–Villa remained on 7 November with no score. | CC0 candidate source. The older result and changed kickoff ruled it out as the default. |
| open-matchday | Documentation advertises free non-commercial use and preserves upstream terms. | Excluded from the commercial review bundle. |
| TheSportsDB | Offers a free API and reserves a dedicated production key and expanded limits for Premium. Terms allow applications within rate limits, require attribution and reserve third-party rights and reselling. | No separate evidence of permitted persistent caching and database redistribution for this release. Excluded from the review bundle. |
| Official league and club pages | Used to compare fixture facts and verify published line-up and registration references. | Cross-check evidence. The single United–Villa correction uses the independently checked factual result supplied in the release brief. Squad lists, team sheets, crests and photography require their own authority. |
| football-data.org | Existing optional adapter uses a server-side token. Its route returns the dated bundled snapshot when an available licensed fixture or standings request fails. | A producer may enable a provider after confirming subscription scope. The review uses the keyless snapshot by default. |

[OpenLigaDB licence](https://www.openligadb.de/lizenz) · [OpenLigaDB API terms](https://www.openligadb.de/nutzungsbedingungen) · [OpenLigaDB API reference](https://api.openligadb.de/index.html) · [OpenFootball CC0](https://github.com/openfootball/football.json) · [OpenFootball 2026/27 raw PL file](https://raw.githubusercontent.com/openfootball/football.json/master/2026-27/en.1.json) · [Open-matchday licence](https://github.com/oladeeayo/open-matchday#license-and-attribution) · [TheSportsDB API tiers](https://www.thesportsdb.com/api.php) · [TheSportsDB terms](https://www.thesportsdb.com/docs_terms_of_use.php) · [Premier League data permission contact](https://www.premierleague.com/en/news/102426)

OpenLigaDB does not grant rights to club identities or its external image links. The app uses name text and original colour treatments as identifiers, with no club crests or sourced stills in the bundled season. Clear the planned use of marks, footage and stills with their owners before a public broadcast.

## Refresh and import

Run a single central refresh daily, after 06:00 Europe/London, and after a scheduled round if the production desk needs an earlier check. Review coverage changes and rebuild the review branch when deploying a new snapshot.

```sh
npx tsx scripts/refresh-football.ts
```

The server-side script checks expected schedules, duplicate fixture identities, the club aliases and required score fields. It refuses a refresh that drops a fixture or a previously available score. It writes a temporary file and atomically renames it after successful validation. The previous valid source file is retained next to the output as `footballSnapshot.generated.ts.previous`. The app reads the bundled revision without accessing OpenLigaDB from the browser. After a failed refresh, the last revision retains its original retrieval date and result coverage.

In **Match Data → Import authorised football records**, choose a JSON pack. The preview reports counts, required-field and duplicate failures, unknown numbers, fixture changes and the replaced revision. The producer acknowledges permission before publication. The current and prior valid imported packs are stored in the preparing browser. Each finished fixture override requires a verified result record, and imported conflicting scores against a pinned check are held for review. Matchday sheets distinguish starters and substitutes from club registrations. Registrations have dates for transfers and eligibility. Cue and session content carries the prepared fixture and roster, while the browsing dataset stays with the preparing device.

The version 1 pack has a `revision` and `source` with `kind: "pack"`, `label`, HTTPS `url`, `permission`, `checkedAt` and `updatedAt` (zoned timestamps). Supply any relevant arrays.

| Array | Required record fields |
| --- | --- |
| `fixtures` | Stable fixture ID, revision, competition ID and label, season, zoned kickoff, status, home and away club identities, source, verification for finals |
| `players` | Stable ID, display name, sourced position |
| `registrations` | Player ID, club ID, competition ID, season, inclusive `eligibleFrom` and optional `eligibleUntil`, optional shirt number |
| `lineups` | Fixture and club ID, formation, 11 unique `starters` and a `bench`; each selection has `playerId`, optional matchday `number` and tactical `role` |
| `events` | Fixture, club and event IDs, minute, optional stoppage time, stable `order`, kind, title, description and relevant player identity or ID |
| `metrics` | Competition, season and subject ID, player or team kind, date range, metric totals, optional minutes |

To clear the data and team gates, supply the remaining 28 verified Premier League finals and authorised season registrations for all participating clubs, plus a cleared confirmed XI and bench for at least one played fixture in each target competition. The United–Villa pack must match both published XIs. Include ordered substitutions and dismissals and licensed player metrics with compatible minutes. Repeat the latest round and upcoming fixture checks before release.

See [snapshot licence and attribution](../../src/data/FOOTBALL-DATA-LICENSE.md).

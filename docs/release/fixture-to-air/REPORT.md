# Fixture to air · review release

Review branch `release/fixture-to-air`. Baseline production and main both served `6e254064e173633a35fa5782af1f08b6c8e2afc2` on 10 November 2026. The baseline was reproduced in a clean browser. Premier League returned zero rows when the token was missing, the fictional project was the default, and a reduced roster could pick up a demo player on formation change. The six before captures are from the public baseline.

## Gate status

| Gate | Result | Evidence and clearance |
| --- | --- | --- |
| Data | **Fail** | A clean profile opens the keyless 2026/27 snapshot. PL has 380 fixtures and 72 scores, with 28 past fixtures awaiting verification and complete results through MW7. CL and EL each have 144 league-phase fixtures and 72 scores through MD4. The United–Villa date and 4–4 result are pinned. Bring the PL results up to the latest completed round and add permitted season records, lineups and metrics. |
| Teams | **Fail** | The published United–Villa XIs were checked, but redistribution clearance was unavailable. Bundled usable squad and confirmed XI coverage is zero. Authorised-pack mechanics passed with synthetic identities, including 22 active identities, substitutions, dismissals, formation and reload. Incomplete real boards stay in repair and the verified result can be cued separately. Supply cleared records for 20 PL clubs and the supported UEFA competitions, with both confirmed XIs for the pinned fixture. |
| Operator | **Pass in browser** | Cached fixture row to a populated board took two clicks and 110 ms in the clean archived Chrome run using the synthetic QA pack. The touch-emulated select, Pass, reception and scrub check took 101 ms in that run. The viewport transform remained fixed across pass and run. Bend, reverse, undo and replay were exercised. The real-XI production rehearsal depends on the data clearance above. |
| Stills and TV | **Pass in browser** | Independent producer, two presenters and TV exercised distinct staged images, advance, pitch, graphics, hold, clear, revoke and reconnect. The media regression exercised a failed frame read while keeping the previous TV picture and a retry. Annotated PNGs were decoded at 1920 × 1080 and 3840 × 2160, and the test checked the image and mark geometry. |
| Visual | **Pass in browser** | Desktop, laptop, tablet landscape and portrait, 1080p and 4K captures were inspected. The 1280 × 800 editor fits the full board and primary controls. A synthetic 4K stress result kept long club names and separate 12–12 and 10–9 shootout figures inside the title-safe area. Repeat on the two production tablets and the OBS/TV hardware before sign-off. |

The fixture coverage and independent source and permission checks are in [football data evidence](../football-data.md). The separated frame upload, cache, viewer authority and recovery are in [still playout evidence](../still-playout.md).

## Build and deployment evidence

The clean Node 22.22.2 run used a Git archive of `16c2484d307cd92cd08a4e03c06a8b33036206b1` on macOS arm64 with Chrome 157.0.8103.40 and `FOOTBALL_DATA_TOKEN` unset. The baseline passed 18 unit/API tests and 14 browser tests. The upgraded archive passed 31 unit/API tests across six files and 22 browser scenarios in 43.5 seconds. Lint, TypeScript and Vite build passed. The short editor playback measurement was 60.3 FPS for the typical scene and 60.0 FPS for the stress scene on this machine.

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
CI=1 npm run test:e2e -- --workers=1 --output=/tmp/touchline-review-final-results
```

The protected Vercel review deployment was Ready at `16c2484`. An authenticated Chrome smoke check used fresh independent producer, tablet A, tablet B and TV contexts. The clean profile found the verified 4–4 fixture and the roster gap. Two different frame dimensions arrived from the private staging service. The presenters switched the TV between them in both directions. The verified result, Hold across TV reload and Clear passed. [Vercel review deployment](https://football-show-software-a4nqthxew-kierantrestain-9646s-projects.vercel.app)

The production alias was checked separately and still served `6e254064e173633a35fa5782af1f08b6c8e2afc2`.

## Timed rehearsal

The final timed LAN rehearsal ran from a clean archive of commit `94a622731836be1655a5ba5932304299a89228b3`. All ten checkpoints and the final Clear assertions passed. Playwright reported one passing scenario in 10.1 minutes. The environment was Node 22.22.2, macOS arm64 and Chrome 157.0.8103.40, with the football token unset and an independent viewer at 1920 × 1080 and 3840 × 2160.

```sh
npm ci
npm run build
STUDIO_REHEARSAL_SOAK=1 CI=1 npm run test:e2e -- --workers=1 --output=/tmp/touchline-committed-soak-results session.spec.ts
```

The four browser contexts used the explicit fictional XI for the tactical scenes. They exercised press cues, a pass and curved movement, an outage and TV reload, and presenter revocation. The producer then staged and took the independently verified United–Villa result and historical player comparison, followed by separate landscape and portrait stills. An intentionally unavailable candidate still left the decoded frame on the TV through an offline reload. The viewer then recovered the correct still, returned to the pitch, and cleared at the end. This rehearsal verifies the programme mechanics. Its tactical identities remain rehearsal data pending the rights and XI gate.

## Captures

The paired editor, still and result captures use the same explicit rehearsal match and original synthetic still. The second set shows the independently checked United–Villa result and a separate board populated with synthetic QA identities. No club imagery or match photographs are included in the snapshot.

- Laptop editor [before](before/editor-1280.png) and [after](after/comparison-editor-1280.png)
- Still editing [before](before/still-1280.png) and [after](after/comparison-still-1280.png)
- Graphic workbench [before](before/result-graphic-1280.png) and [after](after/comparison-result-graphic-1280.png)
- 1080p TV still [before](before/tv-still-1080.png) and [after](after/comparison-tv-still-1080.png)
- 1080p TV result [before](before/tv-result-1080.png) and [after](after/comparison-tv-result-1080.png)
- [Real fixture desk](after/real-match-1280.png), [scorebug with QA pack](after/real-fixture-qa-board-1280.png), [United–Villa on the independent TV during the timed rehearsal](after/real-result-1080.png) and [United–Villa at 4K](after/real-result-4k.png)
- [Presenter landscape](../after/rehearsal-presenter-landscape.png), [presenter portrait](../after/rehearsal-presenter-portrait.png) and [4K TV still](../after/rehearsal-still-tv-4k.png)
- [1920 × 1080 desktop editor](after/editor-1920.png), [1440 × 900 desktop editor](after/editor-1440.png), [tablet landscape](after/editor-touch-landscape.png), [tablet portrait](after/editor-touch-portrait.png), and [portrait still](after/still-portrait-1280.png)

## Local workflow

Run from the branch with Node 22.

```sh
npm ci
npm run build
npm run studio
```

Open the Studio home at `http://localhost:8787`. Choose a cached fixture or use **Find a fixture**. **Open rehearsal** explicitly loads the fictional production. For production rosters, review an authorised JSON pack in Match Data. If a fixture has no eligible XI, **Roster repair** preserves any sourced identities already selected. It shows the exact gaps and can import a fixture-specific candidate pack.

The staging step uploads each referenced still or video frame separately before publishing preview. If the producer's frame is missing or the TV cannot decode the new frame, the last good on-air picture stays visible. The OBS browser source uses the independent viewer URL. [OBS Browser Source](https://obsproject.com/kb/browser-source)

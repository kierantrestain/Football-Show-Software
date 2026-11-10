# Verification

Run the checks with Node.js 22. The browser suite starts the LAN service against the production build.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e -- --workers=1
```

## Coverage

Lint, TypeScript and the production build passed. Vitest passed 18 tests across four files. Playwright passed 14 browser scenarios, followed by the separate timed rehearsal.

| Check | What was exercised |
| --- | --- |
| Model and APIs | All 11 formations, player grouping, ball possession, reversible motion and interpolation, calibration and versioned project validation, match-provider normalisation and cache, prediction scoring, revision conflicts, payload limits, restart persistence, conditional Blob writes |
| Editor in Chrome | 22 players, drag and group drag, formation presets, pass and curved run, reverse and deterministic scrub, undo and redo, scene create/reorder, IndexedDB recovery, footage import and frame stepping, four-corner calibration and marking transfer |
| Media and exports | Annotated still, valid WebM and MP4 containers in the test Chrome build, transparent 3840 × 2160 PNG, project bundle with media import, offline shell and project recovery |
| Data desk | Full demo XIs and substituted line-up reconstruction, official three-player comparison, five-team comparison, saved predictions and cutoff, graphic templates and clean output |
| LAN browser rehearsal | Producer, two separately isolated tablet contexts, and 1920 × 1080 TV. Cues, movement, rewind, controller lease and revoke, hold, resume, refresh and clear, reconnect, match graphic, three-player comparison, media annotation, portrait and transparent output, and a pitch inset |
| Hosted browser smoke | Same four roles on the Vercel production URL. Creation in private Blob, 22-player take, presenter scene and highlight updates, competing writes returning one success and one conflict, hold through TV refresh, retake, clear and no editing controls |

The first hosted rehearsal found a conditional-write failure when the delivery ETag differed from the Blob metadata ETag. The store now reads the canonical metadata ETag before the uncached snapshot for conditional writes. The first timed LAN run found an outstanding long poll could commit a frame after the browser reported offline. The connection now aborts and invalidates that poll before retaining the frame. The short four-client rehearsal passed after both fixes. The final hosted check showed that a recent presenter update could leave the producer with an old revision when pressing Hold. Producer Hold, Clear and Revoke now apply to the latest authoritative revision through conditional writes. Ordinary edits still reject stale revisions.

## Ten-minute studio rehearsal

The corrected LAN run passed all ten minute marks. Playwright measured 10.1 minutes. Four independent Chrome contexts ran the producer desk, two touch-enabled tablets, and 1920 × 1080 output. The opening formation, pressing trigger, progression and recovery scenes used both starting XIs and exercised the passing sequence and curved movement.

The TV retained its previous frame through the forced disconnect and offline reload, caught up on reconnect, and kept the held image during preview changes. The rehearsal took a match result, a sourced three-player comparison and a telestrated still to air, then checked pitch inset, portrait framing, transparent output and clear. The captured on-air feed remained free of editing controls.

```sh
STUDIO_REHEARSAL_SOAK=1 npm run test:e2e -- session.spec.ts
```

## Playback performance

Measured in headless Chrome at 1440 × 900 on an Apple-silicon Mac14,2 with 8 GB of memory. Each scene played for 3.5 seconds. These figures describe the test machine and short sample.

| Scene | Content | FPS | 95th-percentile frame time |
| --- | --- | ---: | ---: |
| Typical | 22 players, ball, 20 arrows, 10 zones, 4 labels, 6 movement paths | 58.9–60.3 | 16.7–16.8 ms |
| Stress | 22 players, ball, 80 arrows, 40 zones, 12 labels, 22 movement paths | 60.0 | 16.7 ms |

## Screenshots

Actual Chrome captures are in [docs/screenshots](docs/screenshots). Desktop review covers 1920 × 1080, 1440 × 900 and 1280 × 800. Tablet review covers 1180 × 820 landscape and 820 × 1180 portrait. The TV view and graphics were checked at 1920 × 1080.

The visual review scored the editor, match centre, comparison, graphics library, remote, and TV output approximately 9/10. The studio home and dense prediction form scored 8.5/10. These are subjective visual assessments. The browser tablet tests used touch-enabled Chrome contexts.

## Integration limits

- Live football coverage requires a server-side provider token. Adapter tests used a simulated provider response. Metric availability, feed freshness, publication rights, badges, and footage depend on coverage and licences.
- Hosted presenter sessions use periodic updates and Vercel Blob operation quotas. LAN runs from a single Node process and uses disk persistence.
- An open output retains its latest frame during connection loss. Offline refresh requires a previously installed service worker on a secure origin. Ordinary LAN HTTP addresses generally lack that capability.
- Predictions, templates, media assets, and local project versions live in the current browser profile. Shared sessions retain the staged project and on-air snapshot. Shared media output uses a still or selected video frame.
- Frame stepping uses a 30 fps approximation. Camera alignment requires visible pitch corners and manual input. Advanced data feeds, tracking, and commercial footage have separate coverage and licence requirements.

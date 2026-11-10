# Verification

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and `npm run test:e2e` with Node 22. Browser tests start the LAN server against the production build.

The test suite exercises the deterministic football model, media and project exports, offline recovery, and the multi-client session path. The LAN browser rehearsal uses distinct producer, tablet A, tablet B, and television browser contexts. Automated tablet checks simulate touch in Chrome.

Performance sampling uses real editor playback at 1440 × 900. On an Apple-silicon Mac14,2 with 8 GB RAM, the first sequential headless Chrome run measured 58.9 FPS for 22 players, 20 arrows, 10 zones, 4 labels, and 6 movement paths. A larger 22-player scene with 80 arrows, 40 zones, 12 labels, and 22 paths measured 60 FPS. These are short measurements on one machine.

See the Playwright specs in [tests/e2e](tests/e2e) for the exact scenarios and screenshot capture.

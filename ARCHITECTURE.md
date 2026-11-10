# Architecture

The browser application uses React, TypeScript, and Vite. A portable, versioned project owns the scenes. Pitch positions are canonical metres and SVG renders the same geometry in the editor, television output and image export. Scene evaluation derives positions from time and cue index, so scrubbing does not require replaying earlier frames.

- `src/domain.ts` defines football and production entities, presets, sample scenes, and evaluation.
- `src/Pitch.tsx` and `src/TacticsEditor.tsx` separate rendering from gestures and inspector controls.
- `src/storage.ts` persists projects, local media, templates, and versions in IndexedDB.
- `src/data/` normalises football records, handles comparisons and predictions, and defines graphics.
- `src/Presentation.tsx` separates producer and tablet controls from the clean output renderer.
- `src/session.ts`, `server/`, and `api/session.ts` synchronise a revisioned preview and a separate last valid on-air state.
- `api/football.ts` is a server-side provider boundary. Provider tokens stay outside the browser bundle.

For LAN production, a single Node process serves the app and persists session snapshots to disk. For Vercel, use a connected private Blob store and conditional writes. A presenter writes through a scoped invite and conflicting revisions are rejected. The output reads the on-air copy and retains its last known snapshot during an interruption.

Browser storage is scoped to a browser profile. JSON project exports can carry media, and project-file validation checks the scene schema before import. A service worker retains the production shell and static assets after a successful online visit. Time-based playback uses a scene offset and clock anchor rather than sending a message for every frame.

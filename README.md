# Touchline Studio

Touchline is a football analysis and broadcast production workspace. Open the bundled Northbridge–Southbank production to rehearse five scenes with both starting XIs. The clubs, match result and reconstructed positions in the demo are fictional.

## Run the studio

Use Node.js 22.

```sh
npm ci
npm run build
npm run studio
```

Open [the local studio](http://localhost:8787). The terminal also prints a LAN address. For separate devices, open that LAN address on the producer's computer before generating invite links, and connect the tablets and television to the same network.

For development, run `npm run studio` and `npm run dev` in separate terminals. Vite proxies API requests to the local service on port 8787.

## Prepare and broadcast

1. Open a scene in **Tactics**. Drag players or select a movement tool and a destination. Use the scene rundown to switch or scrub through scenes.
2. Use **Match data** to load a line-up, reconstruct a moment, or compare players and teams. Use **Graphics** to queue a TV card.
3. Open **Present**, choose **Start shared session**, then **Connect devices**. Scan a presenter QR code on each tablet and open the TV link in a separate browser or an OBS browser source. Use 1920 × 1080 or 3840 × 2160 for landscape output.
4. Select **Take live** to publish the preview. **Hold output** freezes the last valid on-air state. **Rehearse** stages changes separately. **Clear output** sends a blank frame.
5. Use **Export** for an annotated still, a browser-supported animation format, or a project JSON file. Studio Home imports project files and restores saved versions as copies.

The output link grants read-only access. Producer controls stay in the browser where the session was started. Keep presenter links within the production team. A separate **Local preview** works within one browser profile without a session service.

## Configure data and hosting

Copy `.env.example` to `.env` for optional local settings. `FOOTBALL_DATA_TOKEN` enables the server-side football-data.org adapter. Coverage, match details, refresh rates, and commercial usage depend on the provider plan. The demo and historical archive open without credentials. Use footage, badges and data only where you have permission for the intended broadcast.

The Vercel deployment uses the Vite build and two Node API routes. For hosted presenter sessions, connect a private Vercel Blob store with read/write credentials exposed only to the server. Build a fresh deployment after connecting the store. For sustained rehearsals or live studio use, the LAN server avoids cloud polling and storage operation quotas. LAN sessions persist in `.studio-sessions` by default.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Browser checks use desktop Chrome by default. Set `PLAYWRIGHT_CHANNEL=chromium` and install bundled Chromium with `npx playwright install chromium` on systems without Chrome.

See [Product](PRODUCT.md), [Architecture](ARCHITECTURE.md), [Design system](DESIGN.md), and [Testing](TESTING.md).

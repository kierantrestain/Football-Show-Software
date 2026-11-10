# Still playout

Import JPG, PNG or WebP beside the Pitch and Still switch. The editor checks the file signature, decodes the image and records its dimensions. Import footage remains a separate control and saves a selected frame for shared output. All captures in this rehearsal use synthetic test images generated on a canvas.

A still mark belongs to its asset ID. The existing media SVG uses an affine reference from 0 to 105 across and from 0 to 68 down. Dividing by those extents gives the normalized image coordinates. Retaining that representation preserves earlier saves, undo records and calibrated reconstructions. The editor's centred zoom changes only the viewing window. The complete image fits at its own aspect ratio in TV and PNG composition. Project import remaps attached media and marks together.

Stage preview prepares every referenced still or video frame before writing the new session revision. Each prepared image keeps its source proportions and uses up to a 3,840-pixel long edge. Compression may reduce the rendition size to stay under the 4 MiB transport limit. The original remains in the producer's browser storage for export. A shared rundown accepts up to 32 prepared media scenes. [Vercel function payload limit](https://vercel.com/docs/functions/limitations)

Media uploads use a producer-authorized endpoint. Only content-addressed frame references travel with session commands. The LAN server writes immutable files beside the session records. Hosted sessions use the existing private Blob store. Presenters can preload preview and live frame references. The TV can fetch the live programme's entire rundown and switch between preloaded images. A bounded browser cache retains the last frame that actually decoded, including across an offline reload when a newer frame failed.

Take verifies the candidate board and staged media. A missing or invalid frame fails before the session replaces the existing programme. A viewer with a failed decode retains the last good composition until a valid frame arrives. Take can follow a concurrent presenter update within the same staged rundown. A newer Stage, Hold, Rehearse or Clear command invalidates an older pending Take. Clear, Hold and revocation keep their producer-only authority.

For OBS, use the session's TV link as a Browser Source and set its dimensions to the desired 1920 × 1080 or 3840 × 2160 output. The rehearsal verified the browser output in an independent Chrome context. Physical studio hardware verification remains pending. [OBS Browser Source](https://obsproject.com/kb/Browser-Source)

## Verified cases

The short four-context rehearsal used a 1,800 × 1,000 landscape still and a 900 × 1,350 portrait still. One tablet advanced to the second image, a failed TV asset request preserved the first picture, and the second tablet returned to the first image. The already decoded image survived an offline TV reload while the new frame was unavailable. The independent TV reported identical image and annotation bounds at 3,840 × 2,160. The 1,280 × 800 editor regression checked explicit Fit and Zoom, a curve edit and undo, three distinct marks, a Pitch and Still round trip, reload and decoded 1080p and 4K PNG exports. Both exports matched the expected image and gutter colour and the line position.

- [Landscape still on the 1080p TV](after/rehearsal-still-tv-landscape-1080p.png)
- [Portrait still on the 1080p TV](after/rehearsal-still-tv-portrait-1080p.png)
- [Landscape still on the 4K TV](after/rehearsal-still-tv-4k.png)
- [Landscape presenter](after/rehearsal-presenter-landscape.png)
- [Portrait presenter](after/rehearsal-presenter-portrait.png)

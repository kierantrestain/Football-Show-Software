# Bang On Sports Hub · Touchline Studio

The fixture and scene sit above a full-width analysis surface. Preview and On Air are separate, written states. The surface switch and import controls sit together. Move, Pass, Run, Shot, Spotlight and Draw stay visible at the canvas edge. The current action step is directly underneath. Camera and still framing sit apart from the movement tools.

Details opens a contextual overlay for properties, team setup, layers and timing. The drawer never changes the canvas scale. The scene strip below the canvas remains available for cueing and playback. Pitch edits and still marks belong to separate surfaces within the same scene.

## Colour and type

| Role | Token |
| --- | --- |
| Studio graphite | `#141615` |
| Primary text | `#f4efe4` |
| Tactics controls | `#1b1e1d` |
| Tactics secondary text | `#b2b6ae` |
| Active step background | `#171c19` |
| Selection and primary action | `#f6cb59` |
| Live indicator | `#ff645c` |
| Pitch | `#254638` with low-contrast `#2b4c3e` mowing stripes |

Inter handles controls and names. Barlow Condensed gives editorial headlines a narrower footprint. JetBrains Mono labels status, scene timing and field coordinates. Score cells use tabular numbers. Primary editor labels are 12 CSS px and 650 weight. The layout uses a 4 px spacing rhythm, a 48 px surface header, a 50 px tool row and an inline action step on a wide desk. Primary touch buttons have at least 44 × 44 CSS px targets. An offset amber outline indicates focus.

Key text pair contrast ratios are 15.85:1 for warm text on the studio graphite, 8.38:1 for muted tactics text on the step strip and 7.87:1 for amber text on a selected tool. The live scorebug state uses pale text on scarlet with a measured 5.64:1 ratio. These pairs exceed the 4.5:1 minimum for normal text. [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) · [W3C enhanced target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)

## Analysis surfaces

The pitch uses circles for the home side and rounded squares for the away side in number, name and compact views. A highlighted player carries an amber ring. Surname tags try positions around the marker and avoid other markers, labels and the viewport edge. A name is prioritised for a selected or highlighted player. A marker with an unknown shirt number has an empty face.

A pass is a playable amber ball path. A drawn arrow defaults to warm off-white and remains an annotation. Runs start curved, with a draggable amber bend. The selected path exposes Curve, Reverse and Preview move at the canvas edge. A pointer gesture commits once on release. Cancelling the gesture discards its transient preview. Cue time and scrub time use the same evaluator.

Stills fit their native aspect ratio. The 125% and 150% centred views zoom the editor surface and overlay together. They are inspection views, so exported and on-air stills retain fit framing. A still mark is stored by asset ID. Its fixed 105 × 68 SVG coordinate plane represents the image fractions `x / 105` and `y / 68` across aspect ratios. Hit tests invert the same SVG transform. The still drawer hides video-only range fields.

## Clean feed

The 16:9 programme composition keeps key text within its title-safe inset. The scorebug balances two club strips around a fixed-width score cell and a separate clock or status cell. The result card puts club names beside a large score, with competition, stage and source in secondary tiers. Club text and colour identifiers remain legible independently. The viewer receives the staged programme content and shows no selection handles, controls or editor overlays.

Reduced-motion settings suppress decorative interface transitions. Analyst-initiated replay remains an explicit control. [OBS Browser Source](https://obsproject.com/kb/browser-source)

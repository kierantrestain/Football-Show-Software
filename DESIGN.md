# Touchline Studio Design System

## Design intent

Touchline borrows the density of a vision mixer and the clear hierarchy of a match-day graphics package. The canvas carries the visual weight. Production controls occupy shallow fixed strips and contextual panels.

| Token | Value | Use |
| --- | --- | --- |
| Background | `#101313` | App shell |
| Surface | `#171b1a` | Inspector and controls |
| Raised surface | `#202624` | Hover and selection base |
| Line | `#2b3230` | Boundaries and section dividers |
| Text | `#f0f2ea` | Primary labels |
| Muted | `#9ca8a0` | Metadata |
| Accent | `#dbfb48` | Selection, primary action and analysis |
| Danger | `#ff706d` | On-air and destructive actions |
| Home | Coral | Home team and badge accent |
| Away | Ice blue | Away team and badge accent |

The tokens are implemented in `src/studio.css`. Inter handles controls, Barlow Condensed gives scene names and match graphics a narrow sports editorial character, and JetBrains Mono supplies timing and technical metadata. Control type is 12–14px, panel titles 14–16px, and editor headlines 36–48px. Broadcast headings scale with the stage. Uppercase is reserved for channels, modes, and short identifiers.

Spacing follows a 4px unit. Navigation and command strips are 57px and 54px. Desktop icon controls are 34px, and tablet controls use 44–64px touch targets. The focused element gets a lime outline. Muted labels pair with an icon or written status. Reduced motion turns off chrome transitions.

Markers stay high-contrast on pitch themes and retain numbers or labels across crops. Lines use round caps and wide invisible hit areas. Passes and runs use distinct stroke and dash treatments. Present and output use broadcast-safe framing. Output displays no selection handles, cursor, transport buttons, or connection overlays.

The studio collapses at tablet widths into a canvas-first flow. Presenter layouts stack in portrait and use a large stage with a separate cue column in landscape.

## Research

Design guidance was reviewed for hierarchy, focused contrast, visual audits, and motion restraint. The reference broadcast and telestration tools informed the division between preparation, drawing, and delivery. Touchline uses original visuals and geometry.

- [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), [Google DESIGN.md](https://github.com/google-labs-code/design.md), [Awesome DESIGN.md](https://github.com/VoltAgent/awesome-design-md)
- [Taste Skill](https://github.com/Leonxlnx/taste-skill), [Impeccable](https://github.com/pbakaus/impeccable), [Hallmark](https://github.com/Nutlope/hallmark)
- [Emil Kowalski’s design skills](https://github.com/emilkowalski/skills), [GSAP Skills](https://github.com/greensock/gsap-skills)
- [Coach Paint](https://www.coachpaint.com/), [Metrica](https://www.metrica-sports.com/), [TacticalPad](https://www.tacticalpad.com/), [Nacsport](https://www.nacsport.com/)

# Intimacy Position Illustrations

## Folder Structure

Each position gets one SVG per variant × body type combo.
Naming convention: `{positionId}-{variant}-{bodyType}.svg`

Example:
```
ip001-him-her-average.svg
ip001-him-her-curvy.svg
ip001-him-her-athletic.svg
ip001-her-her-average.svg
ip001-her-her-curvy.svg
ip001-him-him-average.svg
ip001-him-him-athletic.svg
```

## SVG Requirements

1. **Two separate `<path>` groups** per file — one per figure
2. **No hardcoded colors** — use `currentColor` or leave fills blank
   - The component applies colors programmatically:
     - Sexy Red `#D2121A` for the featured figure
     - Muted silver `rgba(229,229,231,0.40)` for the other
3. **ViewBox**: `0 0 400 250` (landscape, fits card width)
4. **Faceless silhouettes only** — no facial features
5. **Solid fill style** — like the reference image (no line art, no outlines)
6. **Diverse body types**: average, curvy, athletic, slim, plus-size

## How to Prepare SVGs

1. Get a silhouette image (Midjourney, Freepik, etc.)
2. Open in Inkscape (free) or Figma
3. Auto-trace to vector paths
4. Separate the two figures into `<g id="figureA">` and `<g id="figureB">`
5. Remove all fill/stroke color attributes
6. Set viewBox to `0 0 400 250`
7. Export as plain SVG

## Color Mapping (applied by component)

| Variant   | Figure A color          | Figure B color         |
|-----------|------------------------|------------------------|
| Him & Her | accentMuted (silver)   | primary (#D2121A red)  |
| Her & Her | primary (#D2121A)      | primaryMuted (#900C0F) |
| Him & Him | accentMuted (silver)   | accent (light silver)  |

## Free Sources

- **Freepik** (free w/ attribution): "couple silhouette vector", "diverse body couple"
- **SVGRepo**: "couple", "embrace silhouette"
- **Openclipart.org**: public domain, "couple silhouette"
- **Pixabay**: free SVG downloads, "couple silhouette vector"
- **Midjourney + Vectorizer.ai**: custom body types, then auto-vectorize
- **Inkscape**: manual trace from any reference

# Prompt QA Checklist

## Structural Checks

- Confirm every prompt has a unique `id`.
- Confirm every prompt has non-empty `text`.
- Confirm every prompt has a valid `category` from catalog metadata.
- Confirm every prompt has a valid `heat` from 1 to 5.
- Confirm every prompt has at least one valid `relationshipDuration`.
- Confirm placeholder syntax is balanced and intentional.

## Heat Calibration

- Heat 1: emotional, affectionate, non-sexual, safe for nearly any couple.
- Heat 2: flirty, lightly charged, romantic, suggestive but not sexual-detail heavy.
- Heat 3: sensual, physically intimate, more body-aware, still not steamy/graphic.
- Heat 4: clearly sexual, steamy, adventurous, stronger erotic conversation without graphic explicit detail.
- Heat 5: explicit, graphic, highly detailed, strongest tier in the catalog.

## Editorial Review Questions

- Does the wording match the assigned heat level?
- Is the prompt category the best fit for the actual text?
- Is the prompt usable as written, without requiring extra explanation?
- Does the prompt avoid accidental ambiguity that softens or overstates the intended heat?
- Is the prompt respectful of consent and boundaries in phrasing?
- Does the prompt avoid repetitive wording already used elsewhere?

## Regression Checks

- Verify the prompt can be loaded through `contentLoader`.
- Verify prompt heat is displayed from metadata, not inferred from ID.
- Verify saved prompt answers show the correct heat in the archive.
- Verify premium gating still aligns with the assigned heat.

## Catalog Hygiene

- Do not use `hX_` ID prefixes as a source of truth for heat.
- If a prompt is reclassified, update only `heat` unless an ID migration plan is actively being executed.
- Record any intentional reclassification in the prompt audit report.

## Release Checklist

- Run targeted prompt catalog tests.
- Run prompt persistence tests.
- Update audit documentation for any editorial heat changes.
- Spot-check the Moments/Prompts archive for correct heat labels.

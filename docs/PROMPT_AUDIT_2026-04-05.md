# Prompt Audit — 2026-04-05

## Scope

- Audited the full prompt catalog in `content/prompts.json`.
- Verified structural integrity, metadata consistency, and heat-level calibration.
- Reviewed all heat 4 and heat 5 prompts for obvious editorial misclassification.

## Structural Results

- Total prompts: 697
- Duplicate IDs: 0
- Duplicate prompt texts: 0
- Invalid heat values: 0
- Invalid categories: 0
- Invalid relationship durations: 0
- Missing prompt text: 0
- Broken placeholder syntax: 0

## Heat Distribution

- Heat 1: 183
- Heat 2: 98
- Heat 3: 107
- Heat 4: 161
- Heat 5: 149

## Editorial Reclassifications Applied

These prompts were reclassified during two editorial passes to tighten the boundary between heat 3, heat 4, and heat 5.

| Prompt ID | Old Heat | New Heat | Reason |
| --- | --- | --- | --- |
| h5_024 | 5 | 4 | Broad intimacy framing, not graphically explicit |
| h5_048 | 5 | 4 | Detailed but still steamy rather than explicit |
| h5_052 | 5 | 4 | Too brief and indirect for explicit tier |
| h5_071 | 5 | 4 | Strong scenario prompt, but not explicit enough for tier 5 |
| h5_086 | 5 | 4 | Direct touch guidance, but not graphic |
| h5_121 | 5 | 4 | Sensual bath scenario reads steamy rather than explicit |
| h4_054 | 4 | 3 | Playful intimacy tuning prompt reads discussion-oriented rather than steamy |
| h4_056 | 4 | 3 | Communication-format prompt is better placed in sensual/discussion tier |
| h4_058 | 4 | 3 | Boundary-setting prompt is intimate but not steamy |
| h4_061 | 4 | 3 | Initiation ideas prompt reads sensual rather than explicitly sexual |
| h1_029 | 1 | 2 | Light physical-charge moment fits flirty tier better than fully emotional tier |
| h3_016 | 3 | 2 | Tender kissing prompt reads flirty rather than sensual |
| h3_019 | 3 | 2 | Affection-through-touch prompt fits flirty tier better than sensual tier |
| h3_091 | 3 | 2 | Almost-kiss tension prompt is classic flirty energy |
| h3_095 | 3 | 2 | Palpable tension prompt reads flirty/location-based rather than sensual |
| h3_096 | 3 | 2 | Explicitly framed as a flirty weekend |
| h3_099 | 3 | 2 | Seasonal flirty-activity prompt belongs in level 2 |

## ID Prefix Review

The `heat` field is the authoritative value. The legacy `hX_` ID prefix is not authoritative and should not be used for runtime heat logic.

Because IDs were not renamed, there are still legacy prefix mismatches. After the editorial heat adjustments above, there are 65 prompt IDs whose `hX_` prefix does not match the current `heat` field.

### Rename ID Only

These prompts look correctly classified by their current `heat` value. If ID hygiene matters later, rename only when migration of saved prompt IDs is planned.

- h4_068
- h4_090
- h4_091
- h4_093
- h5_024
- h5_034
- h5_048
- h5_052
- h4_095
- h4_097
- h5_071
- h5_074
- h4_103
- h5_086
- h5_121
- h5_138
- h5_139
- h5_140
- h5_141
- h5_142
- h5_143
- h5_144
- h5_145
- h5_146
- h5_147
- h5_149
- h5_151
- h5_153
- h5_155
- h5_156
- h5_157
- h5_158
- h5_159
- h5_160
- h5_161
- h5_162
- h5_163
- h5_164
- h5_165
- h5_166
- h5_167
- h5_168

### Keep Current Heat

These prompts appear correctly softened despite having older higher-heat prefixes.

- h4_038
- h4_113
- h4_120
- h4_122
- h4_125
- h4_126
- h4_128
- h4_130
- h4_131
- h4_133
- h4_134
- h4_135
- h4_136
- h4_137
- h4_138
- h4_141
- h4_054
- h4_056
- h4_058
- h4_061
- h5_148
- h5_150

### Manual Review Edge Case

- h3_059
  Current heat is 4 while the legacy prefix suggests 3. The wording uses edible accessories and reads closer to steamy than sensual, so current heat 4 is defensible.

## Calibration Notes

- Heat 4 is currently being used for strong sexual conversation, steamy scenarios, and adventurous prompts that are not graphically explicit.
- Heat 5 is now more tightly reserved for clearly explicit, graphic, or strongly detailed sexual prompts.
- Heat 3 now includes more discussion-first intimacy prompts about initiation, boundaries, and preference expression where the wording is sensual but not steamy.
- Heat 2 now has broader coverage for playful romantic tension, almost-kiss energy, affectionate touch, and lightly charged weekend/location prompts.
- A number of legacy `h5_` IDs now point to heat 4 prompts. This is not a runtime problem as long as code continues to trust `heat` instead of the ID prefix.

## Recommended Follow-Up

1. If stable references matter more than naming hygiene, leave IDs alone and keep treating `heat` as canonical.
2. If catalog cleanliness matters more, plan an ID migration with compatibility handling for saved answers, favorites, and analytics.
3. Keep the current read/write normalization in `DataLayer` so old saved prompt records continue to display the canonical heat.
4. Use [docs/PROMPT_QA_CHECKLIST.md](docs/PROMPT_QA_CHECKLIST.md) for future prompt imports and edits.
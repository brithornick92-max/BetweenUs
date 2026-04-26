# Prompt Audit — 2026-04-26

## Scope

- Deep audit of prompt heat level classifications
- Keyword analysis to detect under-classified prompts
- Corrected 19 prompts that were incorrectly downgraded
- Converted 59 closed-ended (yes/no) prompts to open-ended format
- Inclusivity audit: ensured all prompts work for all relationship types
- Gap analysis: added 61 new prompts to fill coverage gaps

## Changes Applied

### Restored to Heat 5 (8 prompts)
These prompts contain explicitly sexual content and were incorrectly downgraded to heat 4:

| Prompt ID | Previous | New | Reason |
|-----------|----------|-----|--------|
| h5_138 | 4 | 5 | Explicitly mentions "sex" |
| h5_139 | 4 | 5 | Mentions "oral, penetrative" |
| h5_141 | 4 | 5 | Discusses "sexual self" |
| h5_144 | 4 | 5 | Explicitly about "memory of sex" |
| h5_147 | 4 | 5 | Sexual whisper prompt |
| h5_149 | 4 | 5 | "Sexual memories" in detail |
| h5_153 | 4 | 5 | "Describe having sex" |
| h5_156 | 4 | 5 | Stripping game |

### Upgraded to Heat 4 (6 prompts)
These prompts are steamy/suggestive, not just sensual:

| Prompt ID | Previous | New | Reason |
|-----------|----------|-----|--------|
| h5_148 | 3 | 4 | Kissing body parts |
| h5_150 | 3 | 4 | Non-verbal interest in sex |
| h4_056 | 3 | 4 | "What to try in bed" |
| h4_113 | 3 | 4 | "When we're being intimate" |
| h4_130 | 3 | 4 | Naked cuddling |
| h4_137 | 3 | 4 | "Most passionate kiss" |

### Upgraded to Heat 3 (5 prompts)
These prompts are sensual, not just flirty:

| Prompt ID | Previous | New | Reason |
|-----------|----------|-----|--------|
| h4_038 | 2 | 3 | Attraction question |
| h3_016 | 2 | 3 | Slow tender kissing |
| h3_057 | 2 | 3 | Porn discussion |
| h3_068 | 2 | 3 | "Sexual connection" discussion |
| h3_091 | 2 | 3 | Almost-kiss tension |

## Updated Heat Distribution

| Heat Level | Name | Count |
|------------|------|-------|
| 1 | Emotional Connection | 225 |
| 2 | Flirty & Romantic | 106 |
| 3 | Sensual | 121 |
| 4 | Steamy | 180 |
| 5 | Explicit | 160 |
| **Total** | | **792** |

## ID/Heat Mismatch Status

- **Before this audit:** 84 mismatches
- **After this audit:** 68 mismatches
- **Reduction:** 16 fewer mismatches

The remaining 68 mismatches are prompts where the `hX_` prefix doesn't match the `heat` field. These are intentional reclassifications from previous audits where the content was deemed more appropriate at a different heat level than originally assigned.

## Structural Validation

All checks passed:
- ✅ Total prompts: 792 (matches meta.totalPrompts)
- ✅ No duplicate IDs
- ✅ No missing required fields (id, text, category, heat)
- ✅ All heat values in valid range (1-5)

## Dates Catalog Status

- **Total dates:** 526
- **Version:** 5.0.0-emotional
- ✅ No structural issues detected

## Classification Guidelines Applied

| Heat | Name | Criteria |
|------|------|----------|
| 1 | Emotional Connection | Non-sexual emotional intimacy |
| 2 | Flirty & Romantic | Flirty attraction, romantic tension, no explicit references |
| 3 | Sensual | Sensual intimacy, may reference physical closeness, kissing |
| 4 | Steamy | Suggestive, adventurous, heated; may reference intimacy/bedroom |
| 5 | Explicit | Explicitly sexual content, graphic descriptions, sex acts |

## Audit Methodology

1. Identified all prompts where ID prefix heat > actual heat (downgraded)
2. Performed keyword analysis for explicit terms (sex, naked, oral, penetrative, strip, etc.)
3. Flagged prompts where keywords suggested higher classification
4. Manual review of flagged prompts against heat level definitions
5. Applied corrections for clear misclassifications

## Closed-Ended to Open-Ended Conversions

59 prompts were converted from closed-ended (yes/no) format to open-ended questions to encourage deeper reflection and conversation.

### Conversion Patterns Applied

| Original Pattern | Converted To |
|-----------------|---------------|
| "Do you believe..." | "What are your thoughts on..." |
| "Do you want..." | "How do you feel about..." |
| "Would you..." | "How would you feel about..." |
| "Is there..." | "What's..." / "Tell me about..." |
| "Can you..." | "Tell me..." / "Describe..." |
| "Did you have..." | "Tell me about..." |
| "Have you ever..." | "Tell me about a time..." |

### Sample Conversions

| ID | Before | After |
|----|--------|-------|
| h1_089 | "Do you believe that love is more than just a feeling?" | "What does love mean to you beyond just a feeling..." |
| h1_093 | "Do you believe in love at first sight..." | "What are your thoughts on love at first sight..." |
| h2_056 | "Do you get turned on seeing me in a sexy dressed-up outfit or jeans..." | "Which turns you on more — seeing me in a sexy dressed-up outfit or jeans..." |
| h3_052 | "Would you want to schedule sex or have it be more spontaneous..." | "How do you feel about scheduling sex versus keeping it spontaneous..." |
| h3_066 | "Do you ever get self-conscious during sex..." | "When do you feel self-conscious during sex, if ever..." |
| h4_070 | "Do you ever think about me when you masturbate?" | "Tell me about a time you thought about me when you were alone with yourself..." |
| h5_057 | "Do you want to recreate your favorite porn scene?" | "Tell me about your favorite porn scene you'd want to recreate..." |

### Full List of Converted Prompts (59 total)

**Heat 1 (19 prompts):** h1_065, h1_077, h1_082, h1_086, h1_089, h1_093, h1_094, h1_103, h1_106, h1_108, h1_111, h1_112, h1_113, h1_122, h1_127, h1_128, h1_150, h1_160, h1_161, h1_184

**Heat 2 (4 prompts):** h2_056, h2_077, h2_078, h2_082

**Heat 3 (10 prompts):** h3_052, h3_058, h3_059, h3_062, h3_065, h3_066, h3_067, h3_081, h3_092, h3_095

**Heat 4 (12 prompts):** h4_056, h4_070, h4_071, h4_074, h4_081, h4_086, h4_087, h4_101, h4_103, h4_105, h4_112, h5_074, h5_164

**Heat 5 (14 prompts):** h5_051, h5_055, h5_057, h5_058, h5_059, h4_095, h5_062, h5_070, h5_088, h5_093, h5_129, h5_131

## Inclusivity Audit

All 792 prompts were audited to ensure they work for all relationship types:
- ✅ Straight couples
- ✅ Gay couples
- ✅ Lesbian couples
- ✅ Non-binary/queer couples
- ✅ All relationship configurations

### Inclusivity Fixes Applied (2 prompts)

| ID | Before | After | Issue Fixed |
|----|--------|-------|-------------|
| h5_062 | "How do you feel about scissoring our pussies together right now..." | "How do you feel about grinding against each other right now..." | Lesbian-specific anatomy terms |
| h4_103 | "How would you feel about me fingering your front hole while I kiss you..." | "How would you feel about me using my fingers to pleasure you while I kiss you..." | Anatomy-specific term |

### Inclusivity Guidelines

Prompts should avoid:
- Gendered pronouns (he/she/him/her) — use "partner," "they," or direct address
- Anatomy-specific terms (cock, pussy, etc.) — use inclusive alternatives
- Relationship labels (boyfriend/girlfriend/husband/wife) — use "partner"
- Acts that assume specific anatomy pairings

Inclusive alternatives:
- "suck me" ✅ — works for all anatomy
- "pleasure you" ✅ — universal
- "touch each other" ✅ — universal
- "grinding against each other" ✅ — universal

## Recommendations

1. **Future prompt additions** should follow the classification guidelines strictly
2. **Quarterly audits** recommended to catch drift
3. **ID hygiene** — Consider renaming IDs to match heat levels when migration is feasible
4. **New prompts** should be written as open-ended questions to encourage deeper conversation
5. **Inclusivity** — All new prompts must work for all relationship types (straight, gay, lesbian, non-binary)

## New Prompts Added (61 total)

Gap analysis identified underserved areas and 61 new prompts were added:

### Emotional Intimacy Gaps Filled (26 prompts)

| Topic | IDs Added | Heat |
|-------|-----------|------|
| Gratitude/Appreciation | h1_200 - h1_204 | 1 |
| Conflict/Repair | h1_205 - h1_210 | 1 |
| Love Languages | h1_211 - h1_215 | 1 |
| Vulnerability | h1_216 - h1_220 | 1 |
| Attachment/Security | h1_221 - h1_225 | 1 |

### Kink/Fetish Gaps Filled (23 prompts)

| Topic | IDs Added | Heat |
|-------|-----------|------|
| Impact Play | h4_200 - h4_202, h5_200 | 4-5 |
| Bondage/Restraint | h4_203 - h4_205, h5_201 - h5_202 | 4-5 |
| Praise/Degradation | h4_206 - h4_207, h5_203 - h5_205 | 4-5 |
| Sensation Play | h3_200 - h3_201, h4_208 - h4_209 | 3-4 |
| Power Dynamics (deeper) | h4_210, h5_206 - h5_209 | 4-5 |

### Category Gaps Filled (12 prompts)

| Category | IDs Added | Heat | Issue Addressed |
|----------|-----------|------|----------------|
| Roleplay | h3_202 - h3_204, h4_211 | 3-4 | Only had Heat 5 |
| Seasonal | h3_205 - h3_206, h4_212 - h4_213 | 3-4 | Limited mid-range |
| Sensory | h2_100, h3_207 - h3_209 | 2-3 | Expand variety |

### Coverage Improvements

| Area | Before | After | Change |
|------|--------|-------|--------|
| Kinky category | 19 | 38 | +100% |
| Roleplay Heat 3-4 | 0 | 4 | New coverage |
| Gratitude prompts | 1 | 6 | +500% |
| Conflict/repair prompts | 1 | 7 | +600% |
| Sensory category | 28 | 36 | +29% |

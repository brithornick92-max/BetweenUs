# Prompt ID Migration Plan

## Goal

Clean up legacy `hX_` prompt IDs whose prefix no longer matches the canonical `heat` field, without breaking saved answers, favorites, analytics, or prompt allocator history.

## Current State

- Prompt heat is authoritative from `content/prompts.json` `heat`.
- Prompt IDs are persisted in saved answers, favorites, and prompt history.
- There are legacy prompt IDs whose `hX_` prefix no longer matches the canonical `heat` field.
- Runtime code should continue to trust `heat`, not the ID prefix.

## Risks

- Saved prompt answers may no longer resolve to a prompt if IDs are changed blindly.
- Favorite prompt references can break.
- Any analytics or export logic keyed by prompt ID can fragment historical data.
- Daily prompt allocator state may point at IDs that no longer exist.

## Recommended Migration Strategy

### Phase 1: Compatibility Layer

1. Add a static alias map from old prompt ID to new prompt ID.
2. Update prompt lookup helpers to resolve both canonical IDs and legacy aliases.
3. Keep `heat` as canonical and do not infer it from ID prefixes.

### Phase 2: Read-Time Remapping

1. When loading saved answers, favorites, or allocator history, map any legacy ID through the alias table.
2. Use the canonical ID for display and prompt metadata resolution.
3. Preserve the original stored value until write-back migration is complete.

### Phase 3: Write-Back Migration

1. On save or update of any prompt-linked record, rewrite the stored ID to the canonical ID.
2. Add a one-time local migration for prompt answers, favorites, and allocator storage.
3. If remote sync depends on prompt IDs, migrate synced records carefully and idempotently.

### Phase 4: Cleanup

1. Once legacy IDs are no longer present in storage, remove alias compatibility only after a release grace period.
2. Keep the audit doc updated so future prompt imports do not reintroduce prefix drift.

## Storage Surfaces To Review

- `prompt_answers.prompt_id`
- favorites stored via `promptStorage`
- allocator / daily prompt history in `PromptAllocator`
- any analytics or export structures carrying prompt IDs

## Implementation Notes

- Prefer adding alias resolution in `contentLoader` or a prompt registry utility rather than scattering remap logic across screens.
- Do not rename IDs in bulk until the compatibility layer is merged first.
- Continue normalizing saved prompt heat from prompt metadata in `DataLayer`.

## Success Criteria

- Old saved answers still open the correct prompt after ID cleanup.
- Favorites still resolve correctly.
- Daily prompt history still excludes previously used prompts.
- Exports remain understandable and consistent.

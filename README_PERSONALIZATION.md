# Smart Personalization

This document summarizes the smart personalization modules and how they fit together.

## Modules
- utils/personalizationEngine.js
- utils/mlModelManager.js
- utils/recommendationSystem.js
- utils/contentCurator.js
- utils/achievementEngine.js
- utils/challengeSystem.js
- utils/privacyEngine.js

## Data Flow
1) User profile + behavior metrics
2) Privacy processing
3) Model inference
4) Recommendations + curation
5) Gamification hooks

## Notes
All processing is client-side unless explicitly stated.

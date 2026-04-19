// hooks/useProgressiveDisclosure.js — Progressive home screen disclosure
// Surfaces secondary features gradually based on days since first open
// and number of completed prompt answers, keeping day-one experience clean.

import { useState, useEffect } from 'react';
import { RelationshipMilestones } from '../services/PolishEngine';

/**
 * Feature visibility thresholds.
 * Each key maps to { days, answers } — the feature appears once
 * the user passes EITHER the day threshold OR the answer threshold.
 */
const THRESHOLDS = {
  quickActions:        { days: 0, answers: 0 },
  relationshipClimate: { days: 5, answers: 5 },
  memoryLane:          { days: 5, answers: 4 },
  momentSignal:        { days: 7, answers: 6 },
  surpriseTonight:     { days: 10, answers: 8 },
  yearReflection:      { days: 14, answers: 10 },
  softNudge:           { days: 3, answers: 3 },
};

/**
 * Returns a map of feature keys → boolean indicating whether each
 * secondary home-screen section should be visible yet.
 *
 * @param {number} answeredCount — total prompt answers the user has saved
 * @returns {{ [key: string]: boolean, ready: boolean }}
 */
export default function useProgressiveDisclosure(answeredCount = 0) {
  const [daysSinceJoin, setDaysSinceJoin] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stats = await RelationshipMilestones._getStats();
        if (!active) return;
        if (!stats?.firstOpenDate) {
          // Brand-new user — everything hidden except core prompt
          setDaysSinceJoin(0);
          return;
        }
        const days = Math.floor(
          (Date.now() - new Date(stats.firstOpenDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        setDaysSinceJoin(days);
      } catch {
        // If we can't read stats, show everything (safe fallback)
        setDaysSinceJoin(Infinity);
      }
    })();
    return () => { active = false; };
  }, []);

  if (daysSinceJoin === null) {
    // Still loading — hide everything to avoid flash
    const hidden = {};
    for (const key of Object.keys(THRESHOLDS)) hidden[key] = false;
    hidden.ready = false;
    return hidden;
  }

  const result = {};
  for (const [key, { days, answers }] of Object.entries(THRESHOLDS)) {
    result[key] = daysSinceJoin >= days || answeredCount >= answers;
  }
  result.ready = true;
  return result;
}

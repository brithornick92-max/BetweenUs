export function resolveWeeklyDeckItems(weeklySet) {
  return Array.isArray(weeklySet?.items) ? weeklySet.items : [];
}

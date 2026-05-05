function normalizeAnchorDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function getSignupAnchorDate({ user = null, userProfile = null } = {}) {
  return normalizeAnchorDate(
    userProfile?.created_at ||
    userProfile?.createdAt ||
    userProfile?.created ||
    user?.metadata?.creationTime ||
    user?.created_at ||
    user?.createdAt ||
    user?.creationTime ||
    null
  );
}

export function resolveWeeklyContentAnchorDate({
  isPremium = false,
  premiumStartedAt = null,
  user = null,
  userProfile = null,
} = {}) {
  if (isPremium) {
    return normalizeAnchorDate(premiumStartedAt);
  }

  return getSignupAnchorDate({ user, userProfile });
}

export { normalizeAnchorDate };

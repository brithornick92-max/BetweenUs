export function getProfileCoupleId(profile = null) {
  return profile?.coupleId || profile?.couple_id || null;
}

export function getProfileCoupleCreatedAt(profile = null) {
  return profile?.coupleCreatedAt || profile?.couple_created_at || null;
}

export function resolveActiveCoupleId({ appState = null, userProfile = null } = {}) {
  return appState?.coupleId || getProfileCoupleId(userProfile);
}

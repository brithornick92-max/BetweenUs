function normalizeName(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function getMyDisplayName(primaryProfile, fallbackProfile, defaultName = null) {
  const myName =
    normalizeName(primaryProfile?.partnerNames?.myName) ||
    normalizeName(fallbackProfile?.partnerNames?.myName) ||
    normalizeName(primaryProfile?.display_name) ||
    normalizeName(primaryProfile?.displayName) ||
    normalizeName(primaryProfile?.name) ||
    normalizeName(fallbackProfile?.display_name) ||
    normalizeName(fallbackProfile?.displayName) ||
    normalizeName(fallbackProfile?.name);

  return myName || defaultName;
}

export function getPartnerDisplayName(primaryProfile, fallbackProfile, defaultName = 'Partner') {
  const partnerName =
    normalizeName(primaryProfile?.partnerNames?.partnerName) ||
    normalizeName(fallbackProfile?.partnerNames?.partnerName);

  if (!partnerName || partnerName === 'A') {
    return defaultName;
  }

  return partnerName;
}
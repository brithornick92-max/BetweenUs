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
    normalizeName(fallbackProfile?.partnerNames?.partnerName) ||
    normalizeName(primaryProfile?.partnerProfile?.display_name) ||
    normalizeName(primaryProfile?.partnerProfile?.displayName) ||
    normalizeName(primaryProfile?.partnerProfile?.name) ||
    normalizeName(fallbackProfile?.partnerProfile?.display_name) ||
    normalizeName(fallbackProfile?.partnerProfile?.displayName) ||
    normalizeName(fallbackProfile?.partnerProfile?.name);

  if (!partnerName || partnerName === 'A') {
    return defaultName;
  }

  return partnerName;
}

function possessiveName(name) {
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

export function personalizePartnerText(text, partnerName) {
  if (typeof text !== 'string') return text;

  const name = normalizeName(partnerName);
  if (!name || /^your partner$/i.test(name)) return text;

  return text
    .replace(/\byour partner’s\b/gi, possessiveName(name))
    .replace(/\byour partner's\b/gi, possessiveName(name))
    .replace(/\byour partner\b/gi, name)
    .replace(/\{partner\}/gi, name)
    .replace(/\{partnerName\}/gi, name);
}

const EXPORT_LIMIT = 10000;

export const EXPORT_SECTIONS = [
  { key: 'journalEntries', label: 'Journal', method: 'getJournalEntries', args: { limit: EXPORT_LIMIT } },
  { key: 'promptAnswers', label: 'Prompts', method: 'getPromptAnswers', args: { limit: EXPORT_LIMIT } },
  { key: 'memories', label: 'Memories', method: 'getMemories', args: { limit: EXPORT_LIMIT } },
  { key: 'rituals', label: 'Rituals', method: 'getRituals', args: { limit: EXPORT_LIMIT } },
  { key: 'checkIns', label: 'Check-ins', method: 'getCheckIns', args: { limit: EXPORT_LIMIT } },
  { key: 'vibes', label: 'Vibes', method: 'getVibes', args: { limit: EXPORT_LIMIT } },
  { key: 'loveNotes', label: 'Love Notes', method: 'getLoveNotes', args: { limit: EXPORT_LIMIT } },
  { key: 'calendarEvents', label: 'Calendar', method: 'getCalendarEvents', args: { limit: EXPORT_LIMIT } },
  { key: 'myDates', label: 'Dates', method: 'getDatePlans', args: { limit: EXPORT_LIMIT } },
];

const INTERNAL_EXPORT_KEYS = new Set([
  'sync_status',
  'sync_version',
  'sync_source',
  'locked',
]);

const hasValue = (value) => value !== undefined && value !== null;

const compactObject = (source = {}) => Object.entries(source).reduce((acc, [key, value]) => {
  if (hasValue(value)) acc[key] = value;
  return acc;
}, {});

export const sanitizeExportRows = (rows) => (Array.isArray(rows) ? rows : []).map((row) => {
  if (!row || typeof row !== 'object') return row;

  const clean = { ...row };
  for (const key of Object.keys(clean)) {
    if (INTERNAL_EXPORT_KEYS.has(key)) {
      delete clean[key];
    }
  }

  return clean;
});

export async function gatherExportData(dataLayer, { onPartialError } = {}) {
  const loadErrors = [];
  const sectionEntries = await Promise.all(EXPORT_SECTIONS.map(async (section) => {
    const loader = dataLayer?.[section.method];

    if (typeof loader !== 'function') {
      return [section.key, []];
    }

    try {
      const rows = await loader.call(dataLayer, section.args);
      return [section.key, sanitizeExportRows(rows)];
    } catch (_error) {
      loadErrors.push(section.label);
      return [section.key, []];
    }
  }));

  if (loadErrors.length > 0 && typeof onPartialError === 'function') {
    onPartialError(loadErrors);
  }

  return Object.fromEntries(sectionEntries);
}

export function buildAccountExport({ user, userProfile } = {}) {
  const preferences = userProfile?.preferences && typeof userProfile.preferences === 'object'
    ? userProfile.preferences
    : null;

  return compactObject({
    id: user?.uid || user?.id || userProfile?.uid || userProfile?.id || userProfile?.user_id || null,
    email: user?.email || userProfile?.email || null,
    displayName: userProfile?.displayName || userProfile?.display_name || user?.displayName || null,
    relationshipStartDate:
      userProfile?.relationshipStartDate
      || preferences?.relationshipStartDate
      || null,
    createdAt:
      userProfile?.createdAt
      || userProfile?.created_at
      || user?.metadata?.creationTime
      || user?.created_at
      || null,
    coupleId: userProfile?.coupleId || userProfile?.couple_id || null,
    partnerNames: userProfile?.partnerNames || preferences?.partnerNames || null,
    heatLevelPreference:
      userProfile?.heatLevelPreference
      ?? preferences?.heatLevelPreference
      ?? null,
    onboardingCompleted:
      userProfile?.onboardingCompleted
      ?? preferences?.onboardingCompleted
      ?? null,
    relationshipSeason: userProfile?.relationshipSeason || preferences?.relationshipSeason || null,
    relationshipClimate: userProfile?.relationshipClimate || preferences?.relationshipClimate || null,
    energyLevel: userProfile?.energyLevel || preferences?.energyLevel || null,
    softBoundaries: userProfile?.softBoundaries || preferences?.softBoundaries || null,
    nicknameConfig: userProfile?.nicknameConfig || preferences?.nicknameConfig || null,
    quiz: userProfile?.quiz || preferences?.quiz || null,
    preferences,
  });
}

export function buildExportTotals(allData = {}) {
  return EXPORT_SECTIONS.reduce((totals, section) => {
    totals[section.key] = Array.isArray(allData[section.key]) ? allData[section.key].length : 0;
    return totals;
  }, {});
}

export function buildExportPayload({
  allData = {},
  includeAccountDetails = false,
  user = null,
  userProfile = null,
  appVersion = '1.0.0',
  exportDate = new Date(),
} = {}) {
  const resolvedDate = exportDate instanceof Date ? exportDate : new Date(exportDate);

  return {
    exportDate: resolvedDate.toISOString(),
    appVersion,
    user: includeAccountDetails ? buildAccountExport({ user, userProfile }) : null,
    ...allData,
    totals: buildExportTotals(allData),
  };
}

export function isShareCancellation(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('cancelled')
    || message.includes('canceled')
    || message.includes('dismissed')
    || message.includes('user cancelled')
    || message.includes('user canceled')
  );
}

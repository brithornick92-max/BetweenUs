/**
 * DeepLinkHandler.js — Centralized deep link & notification routing
 *
 * Maps notification payloads and deep link URLs to navigation actions.
 * Keeps all routing logic in one place instead of scattered across screens.
 *
 * Deep link format: betweenus://<route>?<params>
 *
 * Supported routes:
 *   betweenus://vibe                    → VibeSignal
 *   betweenus://prompt/:promptId        → PromptAnswer
 *   betweenus://calendar                → Calendar
 *   betweenus://date-ideas              → DatePlans tab
 *   betweenus://date/:dateId            → DateNightDetail
 *   betweenus://intimacy                → IntimacyPositions
 *   betweenus://journal                 → JournalHome
 *   betweenus://pair                    → ConnectPartner
 *   betweenus://join/:code              → ConnectPartner with invite code
 *   betweenus://quiz                    → CouplesQuiz
 *   betweenus://auth-callback           → AuthCallback (existing)
 *   betweenus://widget                  → MainTabs (widget home tap)
 *   betweenus://widget/prompt           → Prompts tab (widget prompt tap)
 */

import CrashReporting from './CrashReporting';

let _navigationRef = null;
// Set by AppContext/Tabs when day-2 tabs are mounted so deep links can guard accordingly
let _showSecondaryTabs = false;

const ID_REQUIRED_ROUTES = new Set(['prompt', 'date', 'join']);
const TYPE_ROUTE_FALLBACKS = {
  calendar_event: 'calendar',
  calendar_event_created: 'calendar',
  calendar_event_reminder: 'calendar',
  date_planned: 'calendar',
  journal_shared: 'journal',
  memory_saved: 'our-story',
  moment_signal: 'vibe',
  prompt_answered: 'prompt',
  quiz_answered: 'quiz',
  streak_at_risk: 'home',
  thinking_of_you_photo: 'our-story',
  vibe_sent: 'vibe',
  weekly_recap: 'home',
};

// Only allow safe characters in deep link ID parameters
const SAFE_ID_RE = /^[a-zA-Z0-9_\-:.]{1,128}$/;
const SAFE_DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const _sanitizeId = (id) => {
  if (!id || typeof id !== 'string') return null;
  return SAFE_ID_RE.test(id) ? id : null;
};

const _sanitizeDateKey = (dateKey) => {
  if (!dateKey || typeof dateKey !== 'string') return null;
  return SAFE_DATE_KEY_RE.test(dateKey) ? dateKey : null;
};

const _parseMaybeJsonObject = (value) => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const _normalizeNotificationData = (rawData) => {
  const data = _parseMaybeJsonObject(rawData);
  const nestedParams = _parseMaybeJsonObject(data.params || data.routeParams);

  return {
    ...data,
    params: nestedParams,
  };
};

const _firstPresent = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');

const _getNotificationId = (data = {}) => {
  const params = data.params || {};

  return _firstPresent(
    data.id,
    data.promptId,
    data.prompt_id,
    data.dateId,
    data.date_id,
    data.noteId,
    data.note_id,
    data.journalId,
    data.journal_id,
    data.memoryId,
    data.memory_id,
    data.eventId,
    data.event_id,
    params.id,
    params.promptId,
    params.prompt_id,
    params.dateId,
    params.date_id
  );
};

const _getNotificationDateKey = (data = {}) => {
  const params = data.params || {};

  return _firstPresent(
    data.dateKey,
    data.date_key,
    params.dateKey,
    params.date_key
  );
};

const _withPromptRouteParams = ({ id, dateKey } = {}) => {
  const params = { promptId: _sanitizeId(id) };
  const sanitizedDateKey = _sanitizeDateKey(dateKey);
  if (sanitizedDateKey) params.dateKey = sanitizedDateKey;
  return params;
};

// Navigate, falling back to MainTabs home if a secondary tab isn't mounted yet
const _navigateSafe = (screen, params) => {
  if (screen === 'MainTabs' && params?.screen && ['Calendar', 'DatePlans'].includes(params.screen)) {
    if (!_showSecondaryTabs) {
      _navigationRef.navigate('MainTabs', {});
      return;
    }
  }
  _navigationRef.navigate(screen, params);
};

const ROUTE_MAP = {
  'vibe': () => ({
    screen: 'VibeSignal',
    params: {},
  }),
  'prompt': (params) => ({
    screen: 'PromptAnswer',
    params: _withPromptRouteParams(params),
  }),
  'prompts': () => ({
    screen: 'MainTabs',
    params: { screen: 'Prompts' },
  }),
  'calendar': () => ({
    screen: 'MainTabs',
    params: { screen: 'Calendar' },
  }),
  'date': (params) => ({
    screen: 'DateNightDetail',
    params: { dateId: _sanitizeId(params.id) },
  }),
  'date-ideas': () => ({
    screen: 'MainTabs',
    params: { screen: 'DatePlans' },
  }),
  'dates': () => ({
    screen: 'MainTabs',
    params: { screen: 'DatePlans' },
  }),
  'intimacy': () => ({
    screen: 'IntimacyPositions',
    params: {},
  }),
  'journal': () => ({
    screen: 'JournalHome',
    params: {},
  }),
  'quiz': () => ({
    screen: 'CouplesQuiz',
    params: {},
  }),
  'pair': () => ({
    screen: 'ConnectPartner',
    params: {},
  }),
  'join': (params) => ({
    screen: 'ConnectPartner',
    params: { code: _sanitizeId(params.id) },
  }),
  'connect-partner': () => ({
    screen: 'ConnectPartner',
    params: {},
  }),
  'auth-callback': (params) => ({
    screen: 'AuthCallback',
    params: { url: params.url || null },
  }),
  'home': () => ({
    screen: 'MainTabs',
    params: {},
  }),
  'our-story': () => ({
    screen: 'OurStory',
    params: {},
  }),
  'saved-moments': () => ({
    screen: 'OurStory',
    params: {},
  }),
  'widget': (params) => ({
    screen: 'MainTabs',
    params: params.id === 'prompt' ? { screen: 'Prompts' } : {},
  }),
};

const DeepLinkHandler = {
  /**
   * Set the navigation ref (call from App.js when NavigationContainer is ready).
   */
  setNavigationRef(ref) {
    _navigationRef = ref;
  },

  /**
   * Called by navigation/Tabs.js (or AppContext) when the day-2 secondary tabs
   * become available, so Calendar/DatePlans deep links can safely resolve.
   * @param {boolean} value
   */
  setShowSecondaryTabs(value) {
    _showSecondaryTabs = !!value;
  },

  /**
   * Handle a deep link URL.
   * @param {string} url - e.g. "betweenus://calendar"
   * @returns {boolean} true if handled
   */
  handleUrl(url) {
    if (!url || !_navigationRef?.isReady()) return false;
    if (!url.startsWith('betweenus://')) return false;

    try {
      const parsed = new URL(url);
      const hostRoute = parsed.host || null;
      const pathParts = parsed.pathname.replace(/^\/+/, '').split('/').filter(Boolean);
      const route = hostRoute || pathParts[0];
      const queryId = parsed.searchParams?.get('id') || (route === 'join' ? parsed.searchParams?.get('code') : null);
      const queryDateKey = parsed.searchParams?.get('dateKey') || parsed.searchParams?.get('date_key') || null;
      const id = hostRoute
        ? (pathParts[0] || queryId || null)
        : (pathParts[1] || queryId || null);
      const extraPathParts = hostRoute ? pathParts.slice(1) : pathParts.slice(2);

      const handler = ROUTE_MAP[route];
      if (!handler) {
        CrashReporting.captureMessage(`Unknown deep link route: ${route}`, 'warning');
        return false;
      }

      const sanitizedId = id ? _sanitizeId(String(id)) : null;
      if (ID_REQUIRED_ROUTES.has(route)) {
        if (!sanitizedId || extraPathParts.length > 0) {
          CrashReporting.captureMessage(`Deep link route '${route}' has invalid id`, 'warning');
          return false;
        }
      }

      const { screen, params } = handler({ id: sanitizedId, dateKey: queryDateKey, url });
      _navigateSafe(screen, params);
      return true;
    } catch (err) {
      CrashReporting.captureException(err, { source: 'deepLinkUrl' });
      return false;
    }
  },

  /**
   * Handle a push notification response (user tapped a notification).
   * The notification data should include a `route` and optional `params`.
   *
   * @param {Object} response - Expo notification response
   * @returns {boolean} true if handled
   */
  handleNotificationResponse(response) {
    if (!_navigationRef?.isReady()) return false;

    try {
      const data = _normalizeNotificationData(response?.notification?.request?.content?.data);
      const url = typeof data.url === 'string' ? data.url : null;
      const route = data.route || data.screen || TYPE_ROUTE_FALLBACKS[data.type] || null;

      if (!route) {
        return url ? this.handleUrl(url) : false;
      }

      const handler = ROUTE_MAP[route];
      if (!handler) {
        if (url && this.handleUrl(url)) return true;
        CrashReporting.captureMessage(`Unknown notification route: ${route}`, 'warning');
        return false;
      }

      const rawId = _getNotificationId(data);
      const sanitizedId = rawId ? _sanitizeId(String(rawId)) : null;
      const rawDateKey = _getNotificationDateKey(data);

      // Routes that require an ID — bail if ID is missing or failed sanitization
      if (ID_REQUIRED_ROUTES.has(route) && !sanitizedId) {
        if (url && this.handleUrl(url)) return true;
        CrashReporting.captureMessage(`Notification route '${route}' missing required id`, 'warning');
        return false;
      }

      const { screen, params } = handler({
        id: sanitizedId,
        dateKey: rawDateKey ? String(rawDateKey) : null,
        url,
      });
      // Only merge known-safe params — don't pass arbitrary notification data to screens
      _navigateSafe(screen, params);
      return true;
    } catch (err) {
      CrashReporting.captureException(err, { source: 'deepLinkNotification' });
      return false;
    }
  },

  /**
   * Build a notification payload with deep link data.
   * Use this when scheduling notifications so they route correctly on tap.
   *
   * @param {string} route - Route key from ROUTE_MAP
   * @param {Object} [params] - Route params (id, etc.)
   * @returns {Object} - Data object for notification content
   */
  buildNotificationData(route, params = {}) {
    const query = params.dateKey || params.date_key
      ? `?dateKey=${encodeURIComponent(params.dateKey || params.date_key)}`
      : '';
    return {
      route,
      ...params,
      url: `betweenus://${route}${params.id ? '/' + params.id : ''}${query}`,
    };
  },
};

export default DeepLinkHandler;

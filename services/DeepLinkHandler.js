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
 *   betweenus://calendar                → Calendar (tab, day 2+)
 *   betweenus://date-ideas              → DatePlans tab
 *   betweenus://date/:dateId            → DateNightDetail
 *   betweenus://intimacy                → IntimacyPositions
 *   betweenus://journal                 → JournalHome
 *   betweenus://pair                    → ConnectPartner
 *   betweenus://quiz                    → CouplesQuiz
 *   betweenus://auth-callback           → AuthCallback (existing)
 *   betweenus://widget                  → MainTabs (widget home tap)
 *   betweenus://widget/prompt           → Prompts tab (widget prompt tap)
 */

import CrashReporting from './CrashReporting';

let _navigationRef = null;
// Set by AppContext/Tabs when day-2 tabs are mounted so deep links can guard accordingly
let _showSecondaryTabs = false;

const ID_REQUIRED_ROUTES = new Set(['prompt', 'date']);

// Only allow safe characters in deep link ID parameters
const SAFE_ID_RE = /^[a-zA-Z0-9_\-:.]{1,128}$/;
const _sanitizeId = (id) => {
  if (!id || typeof id !== 'string') return null;
  return SAFE_ID_RE.test(id) ? id : null;
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
    params: { promptId: _sanitizeId(params.id) },
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
      const id = hostRoute
        ? (pathParts[0] || parsed.searchParams?.get('id') || null)
        : (pathParts[1] || parsed.searchParams?.get('id') || null);

      const handler = ROUTE_MAP[route];
      if (!handler) {
        CrashReporting.captureMessage(`Unknown deep link route: ${route}`, 'warning');
        return false;
      }

      const { screen, params } = handler({ id });
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
      const data = response?.notification?.request?.content?.data;
      if (!data?.route) return false;

      const handler = ROUTE_MAP[data.route];
      if (!handler) {
        CrashReporting.captureMessage(`Unknown notification route: ${data.route}`, 'warning');
        return false;
      }

      const rawId = data.id || data.noteId || data.promptId || data.dateId;
      const sanitizedId = rawId ? _sanitizeId(String(rawId)) : null;

      // Routes that require an ID — bail if ID is missing or failed sanitization
      if (ID_REQUIRED_ROUTES.has(data.route) && !sanitizedId) {
        CrashReporting.captureMessage(`Notification route '${data.route}' missing required id`, 'warning');
        return false;
      }

      const { screen, params } = handler({
        id: sanitizedId,
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
    return {
      route,
      ...params,
      url: `betweenus://${route}${params.id ? '/' + params.id : ''}`,
    };
  },
};

export default DeepLinkHandler;

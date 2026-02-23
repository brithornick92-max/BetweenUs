/**
 * DeepLinkHandler.js — Centralized deep link & notification routing
 *
 * Maps notification payloads and deep link URLs to navigation actions.
 * Keeps all routing logic in one place instead of scattered across screens.
 *
 * Deep link format: betweenus://<route>?<params>
 *
 * Supported routes:
 *   betweenus://love-note/:noteId       → LoveNoteDetail
 *   betweenus://vibe                    → VibeSignal
 *   betweenus://prompt/:promptId        → PromptAnswer
 *   betweenus://ritual                  → NightRitual
 *   betweenus://calendar                → Calendar (tab)
 *   betweenus://date/:dateId            → DateNightDetail
 *   betweenus://journal                 → JournalEntry
 *   betweenus://pair                    → PairingQRCode
 *   betweenus://auth-callback           → AuthCallback (existing)
 */

let _navigationRef = null;

const ROUTE_MAP = {
  'love-note': (params) => ({
    screen: 'LoveNoteDetail',
    params: { noteId: params.id },
  }),
  'vibe': () => ({
    screen: 'VibeSignal',
    params: {},
  }),
  'prompt': (params) => ({
    screen: 'PromptAnswer',
    params: { promptId: params.id },
  }),
  'ritual': () => ({
    screen: 'NightRitual',
    params: {},
  }),
  'calendar': () => ({
    screen: 'MainTabs',
    params: { screen: 'Calendar' },
  }),
  'date': (params) => ({
    screen: 'DateNightDetail',
    params: { dateId: params.id },
  }),
  'journal': () => ({
    screen: 'JournalEntry',
    params: {},
  }),
  'pair': () => ({
    screen: 'PairingQRCode',
    params: {},
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
   * Handle a deep link URL.
   * @param {string} url - e.g. "betweenus://love-note/abc123"
   * @returns {boolean} true if handled
   */
  handleUrl(url) {
    if (!url || !_navigationRef?.isReady()) return false;

    try {
      const parsed = new URL(url);
      const pathParts = parsed.pathname.replace(/^\/+/, '').split('/');
      const route = pathParts[0];
      const id = pathParts[1] || parsed.searchParams?.get('id') || null;

      const handler = ROUTE_MAP[route];
      if (!handler) return false;

      const { screen, params } = handler({ id });
      _navigationRef.navigate(screen, params);
      return true;
    } catch {
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
        // No fallback — only allowlisted routes are navigable via notifications
        if (__DEV__) console.warn('[DeepLink] Unrecognized notification route:', data.route);
        return false;
      }

      const { screen, params } = handler({
        id: data.id || data.noteId || data.promptId || data.dateId,
      });
      _navigationRef.navigate(screen, { ...params, ...(data.params || {}) });
      return true;
    } catch {
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

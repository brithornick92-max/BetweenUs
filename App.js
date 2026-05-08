import "react-native-get-random-values";
import "./polyfills"; // MUST be first
import { GestureHandlerRootView } from "react-native-gesture-handler";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  NavigationContainer,
  createNavigationContainerRef,
  getStateFromPath,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { AppState, View, Text, StyleSheet } from "react-native";
import { useFonts } from "expo-font";
import { Lato_400Regular, Lato_700Bold } from "@expo-google-fonts/lato";
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";

import RootNavigator from "./navigation/RootNavigator";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { AppProvider, useAppContext } from "./context/AppContext";
import { MemoryProvider } from "./context/MemoryContext";
import { AuthProvider } from "./context/AuthContext";
import { ContentProvider } from "./context/ContentContext";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import {
  EntitlementsProvider,
  useEntitlements,
} from "./context/EntitlementsContext";
import { DataProvider } from "./context/DataContext";
import LockScreen from "./components/LockScreen";
import ErrorBoundary from "./components/ErrorBoundary";
import CrashReporting from "./services/CrashReporting";
import { impact, ImpactFeedbackStyle } from "./utils/haptics";
import { addNotificationResponseListener } from "./utils/notifications";
import { SupabaseAuthService } from "./services/supabase/SupabaseAuthService";
import StorageRouter from "./services/storage/StorageRouter";
import { supabase } from "./config/supabase";
import { cloudSyncStorage, storage, STORAGE_KEYS } from "./utils/storage";
import ExpoUpdateService from "./services/ExpoUpdateService";

// Keep splash visible until fonts + init complete
SplashScreen.preventAutoHideAsync();

const isLightweightDevMode =
  __DEV__ && process.env.EXPO_PUBLIC_LIGHTWEIGHT_DEV === "1";
const SAFE_DEEP_LINK_ID_RE = /^[a-zA-Z0-9_\-:.]{1,128}$/;

let analyticsServiceInstance = null;
let experimentServiceInstance = null;
let deepLinkHandlerInstance = null;
let revenueCatServiceInstance = null;
let pushNotificationServiceInstance = null;
let connectionReminderServiceInstance = null;

function getAnalyticsService() {
  if (!analyticsServiceInstance) {
    analyticsServiceInstance = require("./services/AnalyticsService").default;
  }
  return analyticsServiceInstance;
}

function getExperimentService() {
  if (!experimentServiceInstance) {
    experimentServiceInstance = require("./services/ExperimentService").default;
  }
  return experimentServiceInstance;
}

function getDeepLinkHandler() {
  if (!deepLinkHandlerInstance) {
    deepLinkHandlerInstance = require("./services/DeepLinkHandler").default;
  }
  return deepLinkHandlerInstance;
}

function getRevenueCatService() {
  if (!revenueCatServiceInstance) {
    revenueCatServiceInstance = require("./services/RevenueCatService").default;
  }
  return revenueCatServiceInstance;
}

function getPushNotificationService() {
  if (!pushNotificationServiceInstance) {
    pushNotificationServiceInstance =
      require("./services/PushNotificationService").default;
  }
  return pushNotificationServiceInstance;
}

function getConnectionReminderService() {
  if (!connectionReminderServiceInstance) {
    connectionReminderServiceInstance =
      require("./services/ConnectionReminderService").default;
  }
  return connectionReminderServiceInstance;
}

// Initialize Sentry early — this is fast (synchronous config, no network).
// Sentry.wrap() at module scope requires init() to have been called first.
if (!isLightweightDevMode) {
  CrashReporting.init();
}

// ── Global error handlers (production + dev) ──────────────────────
// Catches fatal JS errors and unhandled promise rejections in release builds
// so they are reported to Sentry instead of silently dying.
if (global?.ErrorUtils?.setGlobalHandler) {
  const defaultHandler = global.ErrorUtils.getGlobalHandler?.();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    CrashReporting.captureException(error, {
      isFatal,
      source: "globalHandler",
    });
    // Always forward to the default handler so the system can show
    // a crash dialog / restart the app instead of silently swallowing.
    defaultHandler?.(error, isFatal);
  });
}

// Dev error helpers: keep helpful console.error behavior in DEV only
if (__DEV__) {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    try {
      const msg = args
        .map((a) =>
          a instanceof Error ? `${a.name}: ${a.message}` : String(a ?? "")
        )
        .join(" ");
      if (
        msg.includes("Cannot read property 'map'") ||
        msg.includes("Cannot read properties of undefined (reading 'map')")
      ) {
        console.log(
          "[map_error] Full args:",
          JSON.stringify(
            args.map((a) =>
              a instanceof Error
                ? { name: a.name, message: a.message, stack: a.stack }
                : a
            ),
            null,
            2
          )
        );
        console.log("[map_error] Call site:", new Error().stack);
      }
    } catch (_error) {
      // ignore logging helper failures
    }
    originalConsoleError(...args);
  };
}

// Do NOT override console.log in production — keep SDKs and platform logging working.

// Safe global error handler for development only
if (__DEV__ && global?.ErrorUtils?.setGlobalHandler) {
  const defaultHandler = global.ErrorUtils.getGlobalHandler?.();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    try {
      const msg = String(error?.message || "");
      console.error("[global_error]", error?.name, msg.slice(0, 200), {
        isFatal,
      });
      if (
        msg.includes("map") ||
        msg.includes("undefined") ||
        msg.includes("doesn't exist") ||
        isFatal
      ) {
        console.log("[global_crash] full stack:");
        console.log(error?.stack);
        console.log(
          "[global_crash] Component stack (if any):",
          error?.componentStack || "(none)"
        );
      }
    } catch (_error) {
      // ignore
    }
    defaultHandler?.(error, isFatal);
  });
}

// Utility helpers for consistent, non-sensitive logging
const isDev = __DEV__;

function logError(context, err) {
  if (isDev) {
    console.error(`[${context}]`, err?.name, err?.message);
  }
}

function getInvalidDeepLinkReason(path) {
  const cleanPath = String(path || "").split(/[?#]/)[0].replace(/^\/+/, "");
  const parts = cleanPath.split("/").filter(Boolean);
  const route = parts[0] || "";

  if ((route === "prompt" || route === "date") && (
    parts.length !== 2 ||
    !SAFE_DEEP_LINK_ID_RE.test(parts[1] || "")
  )) {
    return `invalid_${route}_id`;
  }

  return null;
}

function normalizeDeepLinkPath(path) {
  const rawPath = String(path || "");
  const suffix = rawPath.match(/[?#].*$/)?.[0] || "";
  const cleanPath = rawPath.split(/[?#]/)[0].replace(/^\/+/, "");
  const parts = cleanPath.split("/").filter(Boolean);
  const route = parts[0] || "";
  const rest = parts.slice(1);
  const aliases = {
    pair: "connect-partner",
    join: "connect-partner",
    "date-ideas": "dates",
    home: "",
    "saved-moments": "our-story",
  };

  if (route === "widget") {
    return `${rest[0] === "prompt" ? "prompts" : ""}${suffix}`;
  }

  if (route === "join" && rest[0]) {
    const codeParam = `code=${encodeURIComponent(rest[0])}`;
    if (!suffix) return `connect-partner?${codeParam}`;
    if (suffix.startsWith("?")) return `connect-partner${suffix}&${codeParam}`;
    return `connect-partner?${codeParam}${suffix}`;
  }

  if (!route) return rawPath;

  const normalizedRoute = Object.prototype.hasOwnProperty.call(aliases, route)
    ? aliases[route]
    : route;
  return [normalizedRoute, ...rest].filter(Boolean).join("/") + suffix;
}

const initializeRevenueCat = async () => {
  if (isLightweightDevMode) return;

  try {
    await getRevenueCatService().init();
    if (isDev) console.log("RevenueCat initialized via service");
  } catch (error) {
    logError("revenuecat_init", error);
  }
};

const navigationRef = createNavigationContainerRef();

// Module-level guard — prevents cold-start notification from being handled twice
// if navReady state ever bounces (e.g., StrictMode double-invoke in dev).
let _coldStartNotificationHandled = false;

function AppContent() {
  const { state } = useAppContext();
  const {
    isPremiumEffective: isPremium,
    paywallVisible,
    paywallFeature,
    hidePaywall,
  } = useEntitlements();
  const { navigationTheme, isDark, colors } = useTheme();
  const navTheme = useMemo(
    () => ({
      dark: navigationTheme.dark,
      colors: navigationTheme.colors,
      fonts: navigationTheme.fonts,
    }),
    [navigationTheme]
  );

  const [isLocked, setIsLocked] = useState(false);
  const [navReady, setNavReady] = useState(false);
  const [appStateVisible, setAppStateVisible] = useState(AppState.currentState);
  const backgroundTimeRef = useRef(null);
  const lockGracePeriodMs = Math.max(0, Number(state.appLockAutoLockTime ?? 5)) * 60 * 1000;
  const hideAppPreview = !!state.hidePreview && appStateVisible !== "active";

  useEffect(() => {
    if (state.appLockEnabled && appStateVisible === "active") {
      const lastBackgroundTime = backgroundTimeRef.current;
      if (
        !lastBackgroundTime ||
        Date.now() - lastBackgroundTime > lockGracePeriodMs
      ) {
        setIsLocked(true);
      }
    }
  }, [appStateVisible, lockGracePeriodMs, state.appLockEnabled]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (state.appLockEnabled) {
        if (nextAppState.match(/inactive|background/)) {
          backgroundTimeRef.current = Date.now();
        } else if (
          nextAppState === "active" &&
          appStateVisible.match(/inactive|background/)
        ) {
          const backgroundTime = backgroundTimeRef.current;
          if (
            backgroundTime &&
            Date.now() - backgroundTime > lockGracePeriodMs
          ) {
            setIsLocked(true);
          }
        }
      }

      if (
        !isLightweightDevMode &&
        nextAppState === "active" &&
        appStateVisible.match(/inactive|background/) &&
        !isLocked
      ) {
        ExpoUpdateService.checkForUpdate({ reason: "foreground" }).catch(() => {});
        getConnectionReminderService().scheduleConnectionReminders().catch(() => {});
      }

      setAppStateVisible(nextAppState);
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );
    return () => subscription?.remove();
  }, [appStateVisible, isLocked, lockGracePeriodMs, state.appLockEnabled]);

  useEffect(() => {
    if (isLightweightDevMode || !navReady) return;
    getConnectionReminderService().scheduleConnectionReminders().catch(() => {});
  }, [navReady]);

  useEffect(() => {
    if (isLightweightDevMode || !navReady || isLocked) return undefined;

    const timeoutId = setTimeout(() => {
      ExpoUpdateService.checkForUpdate({ reason: "launch" }).catch(() => {});
    }, 4000);

    return () => clearTimeout(timeoutId);
  }, [navReady, isLocked]);

  useEffect(() => {
    let unsubscribe = null;
    let active = true;

    const subscribe = async () => {
      try {
        const result = SupabaseAuthService.onAuthStateChange(
          async (session) => {
            try {
              const status = await cloudSyncStorage.getSyncStatus();
              const syncEnabled = !!status?.enabled && !!isPremium;
              if (!active) return;

              await StorageRouter.setSupabaseSession(session);
              await StorageRouter.configureSync({
                isPremium: !!isPremium,
                syncEnabled,
                supabaseSessionPresent: !!session,
              });
            } catch (syncErr) {
              CrashReporting.captureException(syncErr, {
                source: "auth_state_sync",
              });
            }
          }
        );

        unsubscribe =
          result?.data?.subscription?.unsubscribe ||
          result?.unsubscribe ||
          (typeof result === "function" ? result : null);
      } catch (subErr) {
        // Supabase not configured — log but don't crash
        CrashReporting.captureException(subErr, { source: "auth_subscribe" });
      }
    };

    subscribe();

    return () => {
      active = false;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [isPremium]);

  // Keep Expo push token state aligned with the current Supabase session.
  useEffect(() => {
    if (isLightweightDevMode) return undefined;

    let active = true;
    let unsubscribe = null;

    const syncPushRegistration = async (session) => {
      try {
        const { supabase } = require("./config/supabase");
        if (!supabase || !active) return;

        const notificationSettings = await storage.get(
          STORAGE_KEYS.NOTIFICATION_SETTINGS,
          {}
        );
        if (notificationSettings?.notificationsEnabled === false) {
          await getPushNotificationService().removeToken(supabase);
          return;
        }

        if (session && active) {
          const shouldRequestPermissions =
            notificationSettings?.notificationsEnabled !== false;
          await getPushNotificationService().initialize(supabase, {
            requestPermissions: shouldRequestPermissions,
          });
        } else {
          await getPushNotificationService().removeToken(supabase);
        }
      } catch (pushErr) {
        CrashReporting.captureException(pushErr, {
          source: "push_registration",
        });
      }
    };

    const registerPush = async () => {
      try {
        const { supabase } = require("./config/supabase");
        if (!supabase || !active) return;

        const {
          data: { session },
        } = await supabase.auth.getSession();
        await syncPushRegistration(session);

        const authListener = supabase.auth.onAuthStateChange(
          async (_event, nextSession) => {
            await syncPushRegistration(nextSession);
          }
        );

        unsubscribe =
          authListener?.data?.subscription?.unsubscribe ||
          authListener?.subscription?.unsubscribe ||
          authListener?.unsubscribe ||
          null;
      } catch (pushErr) {
        CrashReporting.captureException(pushErr, {
          source: "push_registration_subscribe",
        });
      }
    };

    registerPush();

    return () => {
      active = false;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  const paywallNavPending = useRef(false);
  useEffect(() => {
    if (!navReady || !paywallVisible || !navigationRef.isReady()) return;
    if (paywallNavPending.current) return;
    const currentRoute = navigationRef.getCurrentRoute()?.name;
    if (currentRoute !== "RevenueCatPaywall") {
      paywallNavPending.current = true;
      navigationRef.navigate("RevenueCatPaywall", {
        feature: paywallFeature || null,
      });
      setTimeout(() => {
        paywallNavPending.current = false;
      }, 800);
    }
  }, [navReady, paywallVisible, paywallFeature]);

  // When the user swipes/back-gestures away from RevenueCatPaywall without going
  // through our dismiss() handler (e.g. native back gesture), clear paywallState
  // so it cannot re-trigger the navigation effect.
  useEffect(() => {
    if (!navReady || !navigationRef.isReady()) return;
    return navigationRef.addListener("state", () => {
      if (paywallVisible) {
        const currentRoute = navigationRef.getCurrentRoute()?.name;
        if (currentRoute !== "RevenueCatPaywall") {
          hidePaywall?.();
        }
      }
    });
  }, [navReady, paywallVisible, hidePaywall]);

  // Wire up notification tap → deep link routing
  useEffect(() => {
    if (isLightweightDevMode) return undefined;

    const sub = addNotificationResponseListener((response) => {
      // Fire a haptic burst when the partner taps a heartbeat notification
      // (covers the background/killed-app case where Realtime isn't running)
      const notifData = response?.notification?.request?.content?.data;
      if (notifData?.type === "moment_signal") {
        impact(ImpactFeedbackStyle.Heavy).catch(() => {});
      }
      // Clear iOS badge count when user taps a notification
      try {
        const Notifications = require("expo-notifications");
        Notifications.setBadgeCountAsync(0).catch(() => {});
      } catch {}
      getDeepLinkHandler().handleNotificationResponse(response);
    });
    return () => sub?.remove();
  }, []);

  // Handle notification that launched the app from killed state (cold start)
  useEffect(() => {
    if (isLightweightDevMode || !navReady) return undefined;

    let handled = false;
    const checkInitialNotification = async () => {
      try {
        const Notifications = require("expo-notifications");
        const response = await Notifications.getLastNotificationResponseAsync();
        if (response && !handled && !_coldStartNotificationHandled) {
          handled = true;
          _coldStartNotificationHandled = true;
          // Brief delay to ensure navigation stack is fully mounted
          setTimeout(() => {
            getDeepLinkHandler().handleNotificationResponse(response);
          }, 500);
        }
      } catch {
        // expo-notifications not available — ignore
      }
    };
    checkInitialNotification();
  }, [navReady]);

  const handleUnlock = () => {
    setIsLocked(false);
    backgroundTimeRef.current = null;
  };

  if (state.appLockEnabled && isLocked) {
    return <LockScreen onUnlock={handleUnlock} lockMode={state.appLockMode} />;
  }

  const linking = {
    prefixes: ["betweenus://"],
    config: {
      screens: {
        AuthCallback: "auth-callback",
        ConnectPartner: "connect-partner",
        VibeSignal: "vibe",
        PromptAnswer: "prompt/:promptId",
        JournalHome: "journal",
        JournalEntry: "journal/new",
        OurStory: "our-story",
        DateNightDetail: "date/:dateId",
        IntimacyPositions: "intimacy",
        CouplesQuiz: "quiz",
        MainTabs: {
          path: "",
          screens: {
            Calendar: "calendar",
            DatePlans: "dates",
            Prompts: "prompts",
          },
        },
      },
    },
    getStateFromPath(path, options) {
      const invalidReason = getInvalidDeepLinkReason(path);
      if (invalidReason) {
        CrashReporting.captureMessage(
          `Rejected malformed deep link: ${invalidReason}`,
          "warning"
        );
        return undefined;
      }

      return getStateFromPath(normalizeDeepLinkPath(path), options);
    },
  };

  return (
    <View style={styles.appShell}>
      <NavigationContainer
        linking={linking}
        theme={navTheme}
        ref={navigationRef}
        onReady={() => {
          setNavReady(true);
          if (!isLightweightDevMode) {
            getDeepLinkHandler().setNavigationRef(navigationRef);
          }
        }}
        onUnhandledAction={(action) => {
          CrashReporting.captureMessage(
            `Unhandled nav action: ${action?.type}`,
            "warning"
          );
        }}
      >
        <StatusBar style={isDark ? "light" : "dark"} />
        <RootNavigator />
      </NavigationContainer>

      {hideAppPreview ? (
        <View
          pointerEvents="none"
          style={[
            styles.privacyPreviewOverlay,
            { backgroundColor: colors?.background || (isDark ? "#070509" : "#FFF8F5") },
          ]}
        >
          <Text style={[styles.privacyPreviewTitle, { color: colors?.text || (isDark ? "#F2E9E6" : "#1F1720") }]}>
            Between Us
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
  },
  privacyPreviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  privacyPreviewTitle: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0,
  },
});

function App() {
  const [fontsLoaded] = useFonts({
    "Lato-Regular": Lato_400Regular,
    Lato_400Regular: Lato_400Regular,
    "Lato-Bold": Lato_700Bold,
    Lato_700Bold: Lato_700Bold,
    "DMSerifDisplay-Regular": DMSerifDisplay_400Regular,
    DMSerifDisplay_400Regular: DMSerifDisplay_400Regular,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    if (isLightweightDevMode) {
      return () => {};
    }

    // Parallelize independent startup tasks with a timeout guard
    // so a hung SDK can't block the app indefinitely.
    const STARTUP_TIMEOUT_MS = 15000;
    let timeoutId;
    const startupTasks = Promise.all([
      getAnalyticsService()
        .init({})
        .catch((e) =>
          CrashReporting.captureException(e, { source: "analytics_init" })
        ),
      getExperimentService()
        .init({ supabase })
        .catch((e) =>
          CrashReporting.captureException(e, { source: "experiments_init" })
        ),
      initializeRevenueCat(),
    ]);
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error("Startup tasks timed out (15s)")),
        STARTUP_TIMEOUT_MS
      );
    });
    Promise.race([startupTasks, timeout])
      .catch((e) =>
        CrashReporting.captureException(e, { source: "startup_init" })
      )
      .finally(() => clearTimeout(timeoutId));
    return () => {
      getAnalyticsService().destroy();
    };
  }, []);

  if (!fontsLoaded) return null;

  try {
    return (
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
          <AuthProvider>
            <SubscriptionProvider>
              <EntitlementsProvider>
                <AppProvider>
                  <DataProvider>
                    <ContentProvider>
                      <MemoryProvider>
                        <ThemeProvider>
                          <AppContent />
                        </ThemeProvider>
                      </MemoryProvider>
                    </ContentProvider>
                  </DataProvider>
                </AppProvider>
              </EntitlementsProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    );
  } catch (error) {
    logError("app_init", error);
    SplashScreen.hideAsync().catch(() => {});
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#070509",
        }}
      >
        <Text style={{ color: "#F2E9E6", padding: 20 }}>
          Something didn’t work. Please restart the app.
        </Text>
      </View>
    );
  }
}

export default CrashReporting.wrap(App);

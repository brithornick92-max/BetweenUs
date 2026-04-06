import "./polyfills"; // MUST be first — crypto polyfill for tweetnacl/Supabase
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { AppState, View, Text } from "react-native";

// Keep splash visible until fonts + init complete
SplashScreen.preventAutoHideAsync();
import { useFonts } from "expo-font";
import {
  Lato_400Regular,
  Lato_700Bold,
} from "@expo-google-fonts/lato";
import {
  DMSerifDisplay_400Regular,
} from "@expo-google-fonts/dm-serif-display";

import RootNavigator from "./navigation/RootNavigator";
import { registerAutoClearDecryptedCache } from "./services/autoClearDecryptedCache";
import BiometricVault from "./services/security/BiometricVault";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { AppProvider, useAppContext } from "./context/AppContext";
import { MemoryProvider } from "./context/MemoryContext";
import { RitualProvider } from "./context/RitualContext";
import { AuthProvider } from "./context/AuthContext";
import { ContentProvider } from "./context/ContentContext";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import { EntitlementsProvider, useEntitlements } from "./context/EntitlementsContext";
import { DataProvider } from "./context/DataContext";
import LockScreen from "./components/LockScreen";
import ErrorBoundary from "./components/ErrorBoundary";
import CrashReporting from "./services/CrashReporting";
import AnalyticsService from "./services/AnalyticsService";
import ExperimentService from "./services/ExperimentService";
import DeepLinkHandler from "./services/DeepLinkHandler";
import { impact, ImpactFeedbackStyle } from "./utils/haptics";
import { addNotificationResponseListener } from "./utils/notifications";
import revenueCatService from "./services/RevenueCatService";
import PushNotificationService from "./services/PushNotificationService";
import SupabaseAuthService from "./services/supabase/SupabaseAuthService";
import StorageRouter from "./services/storage/StorageRouter";
import { cloudSyncStorage, storage, STORAGE_KEYS } from "./utils/storage";

// Initialize Sentry early — this is fast (synchronous config, no network).
// Sentry.wrap() at module scope requires init() to have been called first.
CrashReporting.init();

// ── Global error handlers (production + dev) ──────────────────────
// Catches fatal JS errors and unhandled promise rejections in release builds
// so they are reported to Sentry instead of silently dying.
if (global?.ErrorUtils?.setGlobalHandler) {
  const defaultHandler = global.ErrorUtils.getGlobalHandler?.();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    CrashReporting.captureException(error, { isFatal, source: 'globalHandler' });
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
      const msg = args.map(a => (a instanceof Error ? `${a.name}: ${a.message}` : String(a ?? ''))).join(' ');
      if (msg.includes("Cannot read property 'map'") || msg.includes("Cannot read properties of undefined (reading 'map')")) {
        console.log("🔴 MAP ERROR! Full args:", JSON.stringify(args.map(a => a instanceof Error ? { name: a.name, message: a.message, stack: a.stack } : a), null, 2));
        console.log("🔴 Call site:", new Error().stack);
      }
    } catch (e) {
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
      const msg = String(error?.message || '');
      console.error('[global_error]', error?.name, msg.slice(0, 200), { isFatal });
      if (msg.includes("map") || msg.includes("undefined") || msg.includes("doesn't exist") || isFatal) {
        console.log('🔴 GLOBAL CRASH — full stack:');
        console.log(error?.stack);
        console.log('🔴 Component stack (if any):', error?.componentStack || '(none)');
      }
    } catch (e) {
      // ignore
    }
    defaultHandler?.(error, isFatal);
  });
}

// Utility helpers for consistent, non-sensitive logging
const isDev = __DEV__;

function safeErrorMessage(err) {
  if (!err) return 'unknown';
  if (typeof err === 'string') return err.slice(0, 120);
  const name = err.name ? String(err.name) : 'Error';
  const msg = err.message ? String(err.message) : 'Something went wrong';
  return `${name}: ${msg}`.slice(0, 160);
}

function logError(context, err) {
  if (isDev) {
    console.error(`[${context}]`, err?.name, err?.message);
    return;
  }
  console.error(`[${context}] failed`);
}

const initializeRevenueCat = async () => {
  try {
    await revenueCatService.init();
    if (isDev) console.log('✅ RevenueCat initialized via service');
  } catch (error) {
    logError('revenuecat_init', error);
  }
};

const navigationRef = createNavigationContainerRef();

function AppContent() {
  const { state } = useAppContext();
  const { isPremiumEffective: isPremium, paywallVisible, paywallFeature } = useEntitlements();
  const { navigationTheme, isDark } = useTheme();

  const [isLocked, setIsLocked] = useState(false);
  const [navReady, setNavReady] = useState(false);
  const [appStateVisible, setAppStateVisible] = useState(AppState.currentState);
  const backgroundTimeRef = useRef(null);

  const LOCK_GRACE_PERIOD = 5 * 60 * 1000;

  useEffect(() => {
    if (state.appLockEnabled && appStateVisible === "active") {
      const lastBackgroundTime = backgroundTimeRef.current;
      if (!lastBackgroundTime || Date.now() - lastBackgroundTime > LOCK_GRACE_PERIOD) {
        setIsLocked(true);
      }
    }
  }, [state.appLockEnabled]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (state.appLockEnabled) {
        if (nextAppState.match(/inactive|background/)) {
          backgroundTimeRef.current = Date.now();
          BiometricVault.lock();
        } else if (nextAppState === "active" && appStateVisible.match(/inactive|background/)) {
          const backgroundTime = backgroundTimeRef.current;
          if (backgroundTime && Date.now() - backgroundTime > LOCK_GRACE_PERIOD) {
            setIsLocked(true);
          }
        }
      }
      setAppStateVisible(nextAppState);
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription?.remove();
  }, [appStateVisible, state.appLockEnabled]);

  useEffect(() => {
    let unsubscribe = null;
    let active = true;

    const subscribe = async () => {
      try {
        const result = SupabaseAuthService.onAuthStateChange(async (session) => {
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
            CrashReporting.captureException(syncErr, { source: 'auth_state_sync' });
          }
        });

        unsubscribe =
          result?.data?.subscription?.unsubscribe ||
          result?.unsubscribe ||
          (typeof result === "function" ? result : null);
      } catch (subErr) {
        // Supabase not configured — log but don't crash
        CrashReporting.captureException(subErr, { source: 'auth_subscribe' });
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
    let active = true;
    let unsubscribe = null;

    const syncPushRegistration = async (session) => {
      try {
        const { supabase } = require("./config/supabase");
        if (!supabase || !active) return;

        const notificationSettings = await storage.get(STORAGE_KEYS.NOTIFICATION_SETTINGS, {});
        if (notificationSettings?.notificationsEnabled === false) {
          await PushNotificationService.removeToken(supabase);
          return;
        }

        if (session && active) {
          const shouldRequestPermissions = notificationSettings?.notificationsEnabled !== false;
          await PushNotificationService.initialize(supabase, {
            requestPermissions: shouldRequestPermissions,
          });
        } else {
          await PushNotificationService.removeToken(supabase);
        }
      } catch (pushErr) {
        CrashReporting.captureException(pushErr, { source: 'push_registration' });
      }
    };

    const registerPush = async () => {
      try {
        const { supabase } = require("./config/supabase");
        if (!supabase || !active) return;

        const { data: { session } } = await supabase.auth.getSession();
        await syncPushRegistration(session);

        const authListener = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
          await syncPushRegistration(nextSession);
        });

        unsubscribe =
          authListener?.data?.subscription?.unsubscribe ||
          authListener?.subscription?.unsubscribe ||
          authListener?.unsubscribe ||
          null;
      } catch (pushErr) {
        CrashReporting.captureException(pushErr, { source: 'push_registration_subscribe' });
      }
    };

    registerPush();

    return () => {
      active = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const paywallNavPending = useRef(false);
  useEffect(() => {
    if (!navReady || !paywallVisible || !navigationRef.isReady()) return;
    if (paywallNavPending.current) return;
    const currentRoute = navigationRef.getCurrentRoute()?.name;
    if (currentRoute !== "Paywall") {
      paywallNavPending.current = true;
      navigationRef.navigate("Paywall", { feature: paywallFeature || null });
      setTimeout(() => { paywallNavPending.current = false; }, 500);
    }
  }, [navReady, paywallVisible, paywallFeature]);

  // Wire up notification tap → deep link routing
  useEffect(() => {
    const sub = addNotificationResponseListener((response) => {
      // Fire a haptic burst when the partner taps a heartbeat notification
      // (covers the background/killed-app case where Realtime isn't running)
      const notifData = response?.notification?.request?.content?.data;
      if (notifData?.type === 'moment_signal') {
        impact(ImpactFeedbackStyle.Heavy).catch(() => {});
      }
      DeepLinkHandler.handleNotificationResponse(response);
    });
    return () => sub?.remove();
  }, []);

  // Handle notification that launched the app from killed state (cold start)
  useEffect(() => {
    if (!navReady) return;
    let handled = false;
    const checkInitialNotification = async () => {
      try {
        const Notifications = require('expo-notifications');
        const response = await Notifications.getLastNotificationResponseAsync();
        if (response && !handled) {
          handled = true;
          // Brief delay to ensure navigation stack is fully mounted
          setTimeout(() => {
            DeepLinkHandler.handleNotificationResponse(response);
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
    return <LockScreen onUnlock={handleUnlock} />;
  }

  const linking = {
    prefixes: ["betweenus://"],
    config: {
      screens: {
        AuthCallback: "auth-callback",
        PairingQRCode: "pairing-qr",
        PairingScan: "pairing-scan",
        LoveNoteDetail: "love-note/:noteId",
        VibeSignal: "vibe",
        PromptAnswer: "prompt/:promptId",
        NightRitual: "ritual",
        JournalHome: "journal",
        JournalEntry: "journal/new",
        DateNightDetail: "date/:dateId",
        MainTabs: {
          screens: {
            Calendar: "calendar",
            DatePlans: "dates",
            Prompts: "prompts",
          },
        },
      },
    },
  };

  const navTheme = useMemo(
    () => ({
      dark: navigationTheme.dark,
      colors: navigationTheme.colors,
      fonts: navigationTheme.fonts,
    }),
    [navigationTheme]
  );

  return (
    <NavigationContainer
      linking={linking}
      theme={navTheme}
      ref={navigationRef}
      onReady={() => {
        setNavReady(true);
        DeepLinkHandler.setNavigationRef(navigationRef);
      }}
      onUnhandledAction={(action) => {
        CrashReporting.captureMessage(`Unhandled nav action: ${action?.type}`, 'warning');
      }}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <RootNavigator />
    </NavigationContainer>
  );
}

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
    // Parallelize independent startup tasks with a timeout guard
    // so a hung SDK can't block the app indefinitely.
    const STARTUP_TIMEOUT_MS = 15000;
    let timeoutId;
    const startupTasks = Promise.all([
      AnalyticsService.init({}).catch((e) => CrashReporting.captureException(e, { source: 'analytics_init' })),
      ExperimentService.init({}).catch((e) => CrashReporting.captureException(e, { source: 'experiments_init' })),
      initializeRevenueCat(),
      registerAutoClearDecryptedCache(),
    ]);
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Startup tasks timed out (15s)')), STARTUP_TIMEOUT_MS);
    });
    Promise.race([startupTasks, timeout])
      .catch((e) => CrashReporting.captureException(e, { source: 'startup_init' }))
      .finally(() => clearTimeout(timeoutId));
    return () => AnalyticsService.destroy();
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
                      <RitualProvider>
                        <ThemeProvider>
                          <AppContent />
                        </ThemeProvider>
                      </RitualProvider>
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
    logError('app_init', error);
    SplashScreen.hideAsync().catch(() => {});
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: '#070509' }}>
        <Text style={{ color: '#F2E9E6', padding: 20 }}>Something didn’t work. Please restart the app.</Text>
      </View>
    );
  }
}

export default CrashReporting.wrap(App);
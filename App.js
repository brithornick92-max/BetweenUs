import "./polyfills"; // MUST be first — crypto polyfill for CryptoJS/Supabase
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
  PlayfairDisplay_700Bold,
} from "@expo-google-fonts/playfair-display";
import {
  DMSerifDisplay_400Regular,
} from "@expo-google-fonts/dm-serif-display";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

import RootNavigator from "./navigation/RootNavigator";
import { registerAutoClearDecryptedCache } from "./services/autoClearDecryptedCache";
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
import DeepLinkHandler from "./services/DeepLinkHandler";
import { addNotificationResponseListener } from "./utils/notifications";
import revenueCatService from "./services/RevenueCatService";
import PushNotificationService from "./services/PushNotificationService";
import SupabaseAuthService from "./services/supabase/SupabaseAuthService";
import StorageRouter from "./services/storage/StorageRouter";
import { cloudSyncStorage } from "./utils/storage";

// Initialize Sentry BEFORE the component tree mounts
CrashReporting.init();

// ── Global error handlers (production + dev) ──────────────────────
// Catches fatal JS errors and unhandled promise rejections in release builds
// so they are reported to Sentry instead of silently dying.
if (global?.ErrorUtils?.setGlobalHandler) {
  const defaultHandler = global.ErrorUtils.getGlobalHandler?.();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    CrashReporting.captureException(error, { isFatal, source: 'globalHandler' });
    if (__DEV__) {
      // In dev, still show the red box
      defaultHandler?.(error, isFatal);
    }
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
      if (msg.includes("map") || msg.includes("undefined")) {
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
  const { isDark, navigationTheme } = useTheme();

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
          } catch {
            // ignore
          }
        });

        unsubscribe =
          result?.data?.subscription?.unsubscribe ||
          result?.unsubscribe ||
          (typeof result === "function" ? result : null);
      } catch {
        // Supabase not configured; ignore
      }
    };

    subscribe();

    return () => {
      active = false;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [isPremium]);

  // Register Expo push token when Supabase session is available
  useEffect(() => {
    let active = true;
    const registerPush = async () => {
      try {
        const { supabase } = require("./config/supabase");
        if (!supabase || !active) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (session && active) {
          await PushNotificationService.initialize(supabase);
        }
      } catch {
        // Push registration is non-critical
      }
    };
    registerPush();
    return () => { active = false; };
  }, [isPremium]);

  useEffect(() => {
    if (!navReady || !paywallVisible || !navigationRef.isReady()) return;
    const currentRoute = navigationRef.getCurrentRoute()?.name;
    if (currentRoute !== "Paywall") {
      navigationRef.navigate("Paywall", { feature: paywallFeature || null });
    }
  }, [navReady, paywallVisible, paywallFeature]);

  // Wire up notification tap → deep link routing
  useEffect(() => {
    const sub = addNotificationResponseListener((response) => {
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
        JournalEntry: "journal",
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
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <RootNavigator />
    </NavigationContainer>
  );
}

function App() {
  const [fontsLoaded] = useFonts({
    "PlayfairDisplay-Bold": PlayfairDisplay_700Bold,
    PlayfairDisplay_700Bold: PlayfairDisplay_700Bold,
    "DMSerifDisplay-Regular": DMSerifDisplay_400Regular,
    DMSerifDisplay_400Regular: DMSerifDisplay_400Regular,
    "Inter-Regular": Inter_400Regular,
    "Inter-Medium": Inter_500Medium,
    "Inter-SemiBold": Inter_600SemiBold,
    "Inter-Bold": Inter_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    // CrashReporting.init() already called at module scope above
    AnalyticsService.init({}).catch(() => {});
    initializeRevenueCat();
    registerAutoClearDecryptedCache();
    return () => AnalyticsService.destroy();
  }, []);

  if (!fontsLoaded) return null;

  try {
    return (
      <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <ErrorBoundary>
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
        </ErrorBoundary>
      </GestureHandlerRootView>
    );
  } catch (error) {
    logError('app_init', error);
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: '#070509' }}>
        <Text style={{ color: '#E8E0EC', padding: 20 }}>App initialization error. Please restart the app.</Text>
      </View>
    );
  }
}

export default CrashReporting.wrap(App);
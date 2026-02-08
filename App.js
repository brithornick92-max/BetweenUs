// App.js
// Between Us — App Entry Point (production-ready)
// ✅ AppProvider + ThemeProvider + MemoryProvider + RitualProvider
// ✅ RootNavigator handles onboarding/linking/tabs/deep routes
// ✅ Biometric App Lock Integration
// ✅ RevenueCat Subscription Integration

import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import React, { useState, useEffect, useRef } from "react";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { AppState, View, Text } from "react-native";

import RootNavigator from "./navigation/RootNavigator";
import { ThemeProvider } from "./context/ThemeContext";
import { AppProvider, useAppContext } from "./context/AppContext";
import { MemoryProvider } from "./context/MemoryContext";
import { RitualProvider } from "./context/RitualContext";
import { AuthProvider } from "./context/AuthContext";
import { ContentProvider } from "./context/ContentContext";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import { EntitlementsProvider, useEntitlements } from "./context/EntitlementsContext";
import { DataProvider } from "./context/DataContext";
import LockScreen from "./components/LockScreen";
import revenueCatService from "./services/RevenueCatService";
import SupabaseAuthService from "./services/supabase/SupabaseAuthService";
import StorageRouter from "./services/storage/StorageRouter";
import { cloudSyncStorage } from "./utils/storage";

// Global error handler to catch the exact error location
if (__DEV__) {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    if (args[0] && args[0].includes && args[0].includes("Cannot read property 'text'")) {
      console.log('🔴 ERROR CAUGHT! Stack trace:');
      console.log(new Error().stack);
    }
    originalConsoleError(...args);
  };
}

if (!__DEV__) {
  console.log = () => {};
  console.warn = () => {};
}

// Enhanced global error catcher to reveal the file (dev only)
if (__DEV__ && global.ErrorUtils?.setGlobalHandler) {
  const defaultHandler = global.ErrorUtils.getGlobalHandler?.();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.log("🔴 GLOBAL ERROR CAUGHT:", error?.message);
    console.log("📍 Stack trace:");
    console.log(error?.stack);
    console.log("🔍 Error details:", JSON.stringify(error, null, 2));
    defaultHandler?.(error, isFatal);
  });
}

// Initialize RevenueCat SDK using the service
const initializeRevenueCat = async () => {
  try {
    await revenueCatService.init();
    console.log('✅ RevenueCat initialized via service');
  } catch (error) {
    console.error('❌ Failed to initialize RevenueCat:', error);
  }
};

// Main App Component with Lock Screen Logic
function AppContent() {
  const { state } = useAppContext();
  const { isPremiumEffective: isPremium } = useEntitlements();
  const [isLocked, setIsLocked] = useState(false);
  const [appStateVisible, setAppStateVisible] = useState(AppState.currentState);
  const backgroundTimeRef = useRef(null);

  // Grace period before locking (5 minutes)
  const LOCK_GRACE_PERIOD = 5 * 60 * 1000; // 5 minutes in milliseconds

  useEffect(() => {
    // Only lock on initial load if app lock is enabled and app was closed
    if (state.appLockEnabled && appStateVisible === 'active') {
      // Check if this is a fresh app start (not just coming from background)
      const lastBackgroundTime = backgroundTimeRef.current;
      if (!lastBackgroundTime || (Date.now() - lastBackgroundTime) > LOCK_GRACE_PERIOD) {
        setIsLocked(true);
      }
    }
  }, [state.appLockEnabled]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (state.appLockEnabled) {
        if (nextAppState.match(/inactive|background/)) {
          // App going to background - record the time
          backgroundTimeRef.current = Date.now();
        } else if (nextAppState === 'active' && appStateVisible.match(/inactive|background/)) {
          // App coming back from background
          const backgroundTime = backgroundTimeRef.current;
          if (backgroundTime && (Date.now() - backgroundTime) > LOCK_GRACE_PERIOD) {
            setIsLocked(true);
          }
        }
      }
      setAppStateVisible(nextAppState);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
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
          } catch (error) {
            // ignore sync update errors
          }
        });

        unsubscribe =
          result?.data?.subscription?.unsubscribe ||
          result?.unsubscribe ||
          (typeof result === 'function' ? result : null);
      } catch (error) {
        // Supabase not configured; ignore
      }
    };

    subscribe();

    return () => {
      active = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [isPremium]);

  const handleUnlock = () => {
    setIsLocked(false);
    backgroundTimeRef.current = null; // Reset background time
  };

  // Show lock screen if app lock is enabled and app is locked
  if (state.appLockEnabled && isLocked) {
    return <LockScreen onUnlock={handleUnlock} />;
  }

  // Show main app
  const linking = {
    prefixes: ["betweenus://"],
    config: {
      screens: {
        AuthCallback: "auth-callback",
        PairingQRCode: "pairing-qr",
        PairingScan: "pairing-scan",
      },
    },
  };

  return (
    <NavigationContainer linking={linking} theme={DarkTheme}>
      <StatusBar style="light" />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  // Initialize RevenueCat on app start
  useEffect(() => {
    initializeRevenueCat();
  }, []);

  // Wrap everything in error boundary
  try {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
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
    );
  } catch (error) {
    console.error('🔴 APP INITIALIZATION ERROR:', error);
    console.error('Stack:', error.stack);
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <Text style={{ color: '#fff', padding: 20 }}>
          App initialization error. Check console for details.
        </Text>
      </View>
    );
  }
}

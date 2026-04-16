import React from "react";
import { Platform, StatusBar, View, ActivityIndicator, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { TYPOGRAPHY } from "../utils/theme";
import ConnectionMemory from "../utils/connectionMemory";
import AnalyticsService from "../services/AnalyticsService";
import { withScreenErrorBoundary } from "../components/ScreenErrorBoundary";

// Eagerly-loaded screens (critical path — auth, onboarding, main tabs)
import AuthScreen from "../screens/AuthScreen";
import OnboardingScreen from "../screens/OnboardingScreen";
import AuthCallbackScreen from "../screens/AuthCallbackScreen";
import Tabs from "./Tabs";

// Lazy-loaded screens — see lazyScreens.js for the deferred require() registry.
// ⚠️  Do NOT add screen imports here. Add them to lazyScreens.js instead.
import * as Screens from "./lazyScreens";

// Lazy-load debug screen so it's excluded from production bundles
const RevenueCatDebugScreen = __DEV__
  ? require("../screens/RevenueCatDebugScreen").default
  : () => null;

const Stack = createNativeStackNavigator();

/** Walk the navigation state tree to find the deepest active route name. */
function getActiveRouteName(state) {
  if (!state || !state.routes) return null;
  const route = state.routes[state.index ?? 0];
  if (route?.state) return getActiveRouteName(route.state);
  return route?.name ?? null;
}

function FullScreenLoader({ colors }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export default function RootNavigator() {
  const { state } = useAppContext();
  const { user, initializing, requiresOnboarding } = useAuth();
  const { colors, isDark } = useTheme();

  // ✅ Never return null. Null causes tree churn and keyboard dismissal.
  if (initializing || state?.isLoading) {
    return <FullScreenLoader colors={colors} />;
  }

  // If no user, show auth
  if (!user) {
    return (
      <>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            keyboardHandlingEnabled: false,
          }}
        >
          <Stack.Screen name="Auth" component={AuthScreen} />
          <Stack.Screen name="AuthCallback" component={AuthCallbackScreen} options={{ animation: "fade", animationDuration: 300 }} />
          <Stack.Screen name="ResetPassword" getComponent={Screens.ResetPassword} />
          <Stack.Screen name="Terms" getComponent={Screens.Terms} />
          <Stack.Screen name="PrivacyPolicy" getComponent={Screens.PrivacyPolicy} />
        </Stack.Navigator>
      </>
    );
  }

  const isNewUser = !!requiresOnboarding;

  const globalScreenOptions = {
    headerStyle: {
      backgroundColor: `${colors.background}F0`,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerShadowVisible: false,
    headerTintColor: colors.text,
    headerTitleStyle: {
      ...TYPOGRAPHY.h3,
      fontSize: 18,
      fontWeight: "700",
      letterSpacing: -0.5,
      color: colors.text,
    },
    headerBackTitleVisible: false,
    headerLeftContainerStyle: {
      paddingLeft: Platform.OS === "ios" ? 0 : 16,
      paddingTop: Platform.OS === "ios" ? 8 : 0,
    },
    animation: "slide_from_right",
    animationDuration: 400,
    contentStyle: { backgroundColor: colors.background },
    headerBlurEffect: Platform.OS === "ios" ? (isDark ? "dark" : "light") : undefined,
    headerTransparent: Platform.OS === "ios",
    keyboardHandlingEnabled: false,
  };

  // Haptics handled per-interaction in Tabs.js — no global listener needed

  // Screens that should NOT trigger "continue where you left off"
  const IGNORED_CONTINUITY_SCREENS = new Set([
    'Home', 'Prompts', 'Calendar', 'DatePlans', 'Settings',
    'MainTabs', 'Auth', 'Onboarding', 'Paywall',
    'RevenueCatPaywall', 'CustomerCenter', 'AuthCallback',
  ]);

  const handleStateChange = (state) => {
    if (state) {
      const currentRoute = getActiveRouteName(state);
      if (currentRoute && !IGNORED_CONTINUITY_SCREENS.has(currentRoute)) {
        ConnectionMemory.recordScreenVisit(currentRoute).catch(() => {});
      }
      // Track screen views for analytics
      if (currentRoute) {
        AnalyticsService.trackScreen(currentRoute);
      }
    }
  };

  return (
    <>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <Stack.Navigator
        screenOptions={globalScreenOptions}
        screenListeners={{
          state: (e) => {
            handleStateChange(e.data?.state);
          },
        }}
      >
        {isNewUser ? (
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{
              headerShown: false,
              gestureEnabled: false,
              animation: "fade",
              animationDuration: 600,
            }}
          />
        ) : (
          <Stack.Screen
            name="MainTabs"
            component={Tabs}
            options={{
              headerShown: false,
              animation: "fade",
              animationDuration: 400,
            }}
          />
        )}

        <Stack.Screen
          name="DateNightDetail"
          getComponent={Screens.DateNightDetail}
          options={{
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 400,
          }}
        />

        <Stack.Screen name="HeatLevel" getComponent={Screens.HeatLevel} options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="JournalHome" getComponent={Screens.JournalHome} options={{ headerShown: false }} />
        <Stack.Screen name="JournalEntry" getComponent={Screens.JournalEntry} options={{ headerShown: false }} />
        <Stack.Screen name="VibeSignal" getComponent={Screens.VibeSignal} options={{ headerShown: false }} />
        <Stack.Screen name="EditorialPrompt" getComponent={Screens.EditorialPrompt} options={{ headerShown: false }} />
        <Stack.Screen name="NightRitual" getComponent={Screens.NightRitual} options={{ headerShown: false }} />
        <Stack.Screen name="Settings" getComponent={Screens.Settings} options={{ headerShown: false }} />
        <Stack.Screen name="AdaptiveHome" getComponent={Screens.AdaptiveHome} options={{ headerShown: false }} />
        <Stack.Screen name="SavedMoments" getComponent={Screens.SavedMoments} options={{ headerShown: false }} />

        <Stack.Screen name="Terms" getComponent={Screens.Terms} options={{ headerShown: false }} />
        <Stack.Screen name="PrivacyPolicy" getComponent={Screens.PrivacyPolicy} options={{ headerShown: false }} />
        <Stack.Screen name="FAQ" getComponent={Screens.FAQ} options={{ headerShown: false }} />
        <Stack.Screen name="EULA" getComponent={Screens.EULA} options={{ headerShown: false }} />
        <Stack.Screen name="ExportData" getComponent={Screens.ExportData} options={{ headerShown: false }} />
        <Stack.Screen name="DeleteAccount" getComponent={Screens.DeleteAccount} options={{ headerShown: false }} />

        <Stack.Screen name="PartnerNamesSettings" getComponent={Screens.PartnerNamesSettings} options={{ headerShown: false }} />
        <Stack.Screen name="HeatLevelSettings" getComponent={Screens.HeatLevelSettings} options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="IllustrationPreview" getComponent={Screens.IllustrationPreview} options={{ headerShown: false }} />
        <Stack.Screen name="NotificationSettings" getComponent={Screens.NotificationSettings} options={{ headerShown: false }} />
        <Stack.Screen name="RitualReminders" getComponent={Screens.RitualReminders} options={{ headerShown: false }} />
        <Stack.Screen name="PrivacySecuritySettings" getComponent={Screens.PrivacySecuritySettings} options={{ headerShown: false }} />
        <Stack.Screen name="SetPin" getComponent={Screens.SetPin} options={{ headerShown: false }} />
        <Stack.Screen name="SyncSetup" getComponent={Screens.SyncSetup} options={{ headerShown: false }} />
        <Stack.Screen name="ResetPassword" getComponent={Screens.ResetPassword} options={{ headerShown: false }} />
        <Stack.Screen name="AuthCallback" component={AuthCallbackScreen} options={{ headerShown: false, animation: "fade", animationDuration: 300 }} />
        <Stack.Screen name="PairingQRCode" getComponent={Screens.PairingQRCode} options={{ headerShown: false }} />
        <Stack.Screen name="PairingScan" getComponent={Screens.PairingScan} options={{ headerShown: false }} />
        <Stack.Screen name="JoinWithCode" getComponent={Screens.JoinWithCode} options={{ headerShown: false }} />

        {__DEV__ && (
          <Stack.Screen
            name="RevenueCatDebug"
            component={RevenueCatDebugScreen}
            options={{ headerShown: true, animation: "slide_from_right", animationDuration: 400 }}
          />
        )}

        <Stack.Screen name="Achievements" getComponent={Screens.Achievements} options={{ headerShown: false }} />
        <Stack.Screen name="LoveNotesInbox" getComponent={Screens.LoveNotesInbox} options={{ headerShown: false }} />
        <Stack.Screen name="ComposeLoveNote" getComponent={Screens.ComposeLoveNote} options={{ headerShown: false }} />
        <Stack.Screen name="LoveNoteDetail" getComponent={Screens.LoveNoteDetail} options={{ headerShown: false }} />

        <Stack.Screen name="PromptLibrary" getComponent={Screens.PromptLibrary} options={{ headerShown: false }} />
        <Stack.Screen name="Paywall" getComponent={Screens.Paywall} options={{ headerShown: false }} />
        <Stack.Screen name="Premium" getComponent={Screens.Premium} options={{ headerShown: false, animation: "fade", animationDuration: 500 }} />
        <Stack.Screen name="InsideJokes" getComponent={Screens.InsideJokes} options={{ headerShown: false }} />
        <Stack.Screen name="YearReflection" getComponent={Screens.YearReflection} options={{ headerShown: false }} />

        <Stack.Group
          screenOptions={{
            presentation: "modal",
            animation: "slide_from_bottom",
            animationDuration: 500,
            gestureEnabled: true,
            contentStyle: { backgroundColor: colors.background },
            keyboardHandlingEnabled: false,
          }}
        >
          <Stack.Screen name="PromptAnswer" getComponent={Screens.PromptAnswer} options={{ headerShown: false }} />
          <Stack.Screen name="Reveal" getComponent={Screens.Reveal} options={{ headerShown: false, animation: "fade", animationDuration: 600 }} />
          <Stack.Screen name="RevenueCatPaywall" getComponent={Screens.RevenueCatPaywall} options={{ headerShown: false }} />
          <Stack.Screen name="CustomerCenter" getComponent={Screens.CustomerCenter} options={{ headerShown: false }} />
        </Stack.Group>
      </Stack.Navigator>
    </>
  );
}

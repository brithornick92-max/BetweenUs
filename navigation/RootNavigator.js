import React from "react";
import { Platform, StatusBar, View, ActivityIndicator, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { TYPOGRAPHY } from "../utils/theme";
import ConnectionMemory from "../utils/connectionMemory";
import AnalyticsService from "../services/AnalyticsService";

// Eagerly-loaded screens (critical path — auth, onboarding, main tabs)
import AuthScreen from "../screens/AuthScreen";
import OnboardingScreen from "../screens/OnboardingScreen";
import AuthCallbackScreen from "../screens/AuthCallbackScreen";

// Deferred require helpers — each uses a string literal so Metro can resolve statically

// Tabs
import Tabs from "./Tabs";

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
  const { user, initializing } = useAuth();
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
          <Stack.Screen name="Terms" getComponent={() => require("../screens/TermsScreen").default} />
          <Stack.Screen name="PrivacyPolicy" getComponent={() => require("../screens/PrivacyPolicyScreen").default} />
        </Stack.Navigator>
      </>
    );
  }

  const isNewUser = !state?.onboardingCompleted;

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
          getComponent={() => require("../screens/DateNightDetailScreen").default}
          options={{
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 400,
          }}
        />

        <Stack.Screen name="HeatLevel" getComponent={() => require("../screens/HeatLevelScreen").default} options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="JournalEntry" getComponent={() => require("../screens/JournalEntryScreen").default} options={{ headerShown: false }} />
        <Stack.Screen name="VibeSignal" getComponent={() => require("../screens/VibeSignalScreen").default} options={{ headerShown: false }} />
        <Stack.Screen name="EditorialPrompt" getComponent={() => require("../screens/EditorialPromptScreen").default} options={{ headerShown: false }} />
        <Stack.Screen name="NightRitual" getComponent={() => require("../screens/NightRitualScreen").default} options={{ headerShown: false }} />
        <Stack.Screen name="Settings" getComponent={() => require("../screens/SettingsScreen").default} options={{ headerShown: false }} />
        <Stack.Screen name="AdaptiveHome" getComponent={() => require("../components/AdaptiveHomeScreen").default} options={{ headerShown: false }} />

        <Stack.Screen name="Terms" getComponent={() => require("../screens/TermsScreen").default} options={{ headerShown: false }} />
        <Stack.Screen name="PrivacyPolicy" getComponent={() => require("../screens/PrivacyPolicyScreen").default} options={{ headerShown: false }} />
        <Stack.Screen name="FAQ" getComponent={() => require("../screens/FAQScreen").default} options={{ headerShown: false }} />
        <Stack.Screen name="EULA" getComponent={() => require("../screens/EULAScreen").default} options={{ headerShown: false }} />
        <Stack.Screen name="ExportData" getComponent={() => require("../screens/ExportDataScreen").default} options={{ headerShown: false }} />
        <Stack.Screen name="DeleteAccount" getComponent={() => require("../screens/DeleteAccountScreen").default} options={{ headerShown: false }} />

        <Stack.Screen name="PartnerNamesSettings" getComponent={() => require("../screens/PartnerNamesSettingsScreen").default} options={{ headerShown: false }} />
        <Stack.Screen name="HeatLevelSettings" getComponent={() => require("../screens/HeatLevelSettingsScreen").default} options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="NotificationSettings" getComponent={() => require("../screens/NotificationSettingsScreen").default} options={{ headerShown: false }} />
        <Stack.Screen name="RitualReminders" getComponent={() => require("../screens/RitualRemindersScreen").default} options={{ headerShown: false }} />
        <Stack.Screen name="PrivacySecuritySettings" getComponent={() => require("../screens/PrivacySecuritySettingsScreen").default} options={{ headerShown: false }} />
        <Stack.Screen name="SetPin" getComponent={() => require("../screens/SetPinScreen").default} options={{ headerShown: false }} />
        <Stack.Screen name="SyncSetup" getComponent={() => require("../screens/SyncSetupScreen").default} options={{ headerShown: false }} />
        <Stack.Screen name="AuthCallback" component={AuthCallbackScreen} options={{ headerShown: false, animation: "fade", animationDuration: 300 }} />
        <Stack.Screen name="PairingQRCode" getComponent={() => require("../screens/PairingQRCodeScreen").default} options={{ headerShown: false }} />
        <Stack.Screen name="PairingScan" getComponent={() => require("../screens/PairingScanScreen").default} options={{ headerShown: false }} />
        <Stack.Screen name="JoinWithCode" getComponent={() => require("../screens/JoinWithCodeScreen").default} options={{ headerShown: false }} />

        {__DEV__ && (
          <Stack.Screen
            name="RevenueCatDebug"
            component={RevenueCatDebugScreen}
            options={{ headerShown: true, animation: "slide_from_right", animationDuration: 400 }}
          />
        )}

        <Stack.Screen name="LoveNotesInbox" getComponent={() => require("../screens/LoveNotesInboxScreen").default} options={{ headerShown: false }} />
        <Stack.Screen name="ComposeLoveNote" getComponent={() => require("../screens/ComposeLoveNoteScreen").default} options={{ headerShown: false }} />
        <Stack.Screen name="LoveNoteDetail" getComponent={() => require("../screens/LoveNoteDetailScreen").default} options={{ headerShown: false }} />

        <Stack.Screen name="PromptLibrary" getComponent={() => require("../screens/PromptLibraryScreen").default} options={{ headerShown: false }} />
        <Stack.Screen name="Paywall" getComponent={() => require("../screens/PaywallScreen").default} options={{ headerShown: false }} />
        <Stack.Screen name="Premium" getComponent={() => require("../screens/PremiumScreen").default} options={{ headerShown: false, animation: "fade", animationDuration: 500 }} />
        <Stack.Screen name="InsideJokes" getComponent={() => require("../screens/InsideJokesScreen").default} options={{ headerShown: false }} />
        <Stack.Screen name="YearReflection" getComponent={() => require("../screens/YearReflectionScreen").default} options={{ headerShown: false }} />

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
          <Stack.Screen name="PromptAnswer" getComponent={() => require("../screens/PromptAnswerScreen").default} options={{ headerShown: false }} />
          <Stack.Screen name="Reveal" getComponent={() => require("../screens/RevealScreen").default} options={{ headerShown: false, animation: "fade", animationDuration: 600 }} />
          <Stack.Screen name="RevenueCatPaywall" getComponent={() => require("../components/RevenueCatPaywall").default} options={{ headerShown: false }} />
          <Stack.Screen name="CustomerCenter" getComponent={() => require("../components/CustomerCenter").default} options={{ headerShown: false }} />
        </Stack.Group>
      </Stack.Navigator>
    </>
  );
}

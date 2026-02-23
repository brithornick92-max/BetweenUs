import React from "react";
import { Platform, StatusBar, View, ActivityIndicator, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { TYPOGRAPHY } from "../utils/theme";
import ConnectionMemory from "../utils/connectionMemory";
import AnalyticsService from "../services/AnalyticsService";

// Screens
import AuthScreen from "../screens/AuthScreen";
import OnboardingScreen from "../screens/OnboardingScreen";
import PromptAnswerScreen from "../screens/PromptAnswerScreen";
import RevealScreen from "../screens/RevealScreen";
import DateNightDetailScreen from "../screens/DateNightDetailScreen";
import PaywallScreen from "../screens/PaywallScreen";
import RevenueCatPaywall from "../components/RevenueCatPaywall";
import CustomerCenter from "../components/CustomerCenter";
import HeatLevelScreen from "../screens/HeatLevelScreen";
import JournalEntryScreen from "../screens/JournalEntryScreen";
import VibeSignalScreen from "../screens/VibeSignalScreen";
import EditorialPromptScreen from "../screens/EditorialPromptScreen";
import NightRitualScreen from "../screens/NightRitualScreen";
import SettingsScreen from "../screens/SettingsScreen";
import AdaptiveHomeScreen from "../components/AdaptiveHomeScreen";
import TermsScreen from "../screens/TermsScreen";
import PrivacyPolicyScreen from "../screens/PrivacyPolicyScreen";
import FAQScreen from "../screens/FAQScreen";
import ExportDataScreen from "../screens/ExportDataScreen";
import DeleteAccountScreen from "../screens/DeleteAccountScreen";
import PartnerNamesSettingsScreen from "../screens/PartnerNamesSettingsScreen";
import HeatLevelSettingsScreen from "../screens/HeatLevelSettingsScreen";
import NotificationSettingsScreen from "../screens/NotificationSettingsScreen";
import PrivacySecuritySettingsScreen from "../screens/PrivacySecuritySettingsScreen";
import PromptLibraryScreen from "../screens/PromptLibraryScreen";
import SyncSetupScreen from "../screens/SyncSetupScreen";
import AuthCallbackScreen from "../screens/AuthCallbackScreen";
import PairingQRCodeScreen from "../screens/PairingQRCodeScreen";
import PairingScanScreen from "../screens/PairingScanScreen";
import SetPinScreen from "../screens/SetPinScreen";
import RitualRemindersScreen from "../screens/RitualRemindersScreen";
import ComposeLoveNoteScreen from "../screens/ComposeLoveNoteScreen";
import LoveNoteDetailScreen from "../screens/LoveNoteDetailScreen";
import LoveNotesInboxScreen from "../screens/LoveNotesInboxScreen";
import PremiumScreen from "../screens/PremiumScreen";
import InsideJokesScreen from "../screens/InsideJokesScreen";
import YearReflectionScreen from "../screens/YearReflectionScreen";

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
          component={DateNightDetailScreen}
          options={{
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 400,
          }}
        />

        <Stack.Screen name="HeatLevel" component={HeatLevelScreen} options={{ headerShown: false }} />
        <Stack.Screen name="JournalEntry" component={JournalEntryScreen} options={{ headerShown: false }} />
        <Stack.Screen name="VibeSignal" component={VibeSignalScreen} options={{ headerShown: false }} />
        <Stack.Screen name="EditorialPrompt" component={EditorialPromptScreen} options={{ headerShown: false }} />
        <Stack.Screen name="NightRitual" component={NightRitualScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AdaptiveHome" component={AdaptiveHomeScreen} options={{ headerShown: false }} />

        <Stack.Screen name="Terms" component={TermsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ headerShown: false }} />
        <Stack.Screen name="FAQ" component={FAQScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ExportData" component={ExportDataScreen} options={{ headerShown: false }} />
        <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={{ headerShown: false }} />

        <Stack.Screen name="PartnerNamesSettings" component={PartnerNamesSettingsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="HeatLevelSettings" component={HeatLevelSettingsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="RitualReminders" component={RitualRemindersScreen} options={{ headerShown: false }} />
        <Stack.Screen name="PrivacySecuritySettings" component={PrivacySecuritySettingsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="SetPin" component={SetPinScreen} options={{ headerShown: false }} />
        <Stack.Screen name="SyncSetup" component={SyncSetupScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AuthCallback" component={AuthCallbackScreen} options={{ headerShown: false, animation: "fade", animationDuration: 300 }} />
        <Stack.Screen name="PairingQRCode" component={PairingQRCodeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="PairingScan" component={PairingScanScreen} options={{ headerShown: false }} />

        {__DEV__ && (
          <Stack.Screen
            name="RevenueCatDebug"
            component={RevenueCatDebugScreen}
            options={{ headerShown: true, animation: "slide_from_right", animationDuration: 400 }}
          />
        )}

        <Stack.Screen name="LoveNotesInbox" component={LoveNotesInboxScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ComposeLoveNote" component={ComposeLoveNoteScreen} options={{ headerShown: false }} />
        <Stack.Screen name="LoveNoteDetail" component={LoveNoteDetailScreen} options={{ headerShown: false }} />

        <Stack.Screen name="PromptLibrary" component={PromptLibraryScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Paywall" component={PaywallScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Premium" component={PremiumScreen} options={{ headerShown: false, animation: "fade", animationDuration: 500 }} />
        <Stack.Screen name="InsideJokes" component={InsideJokesScreen} options={{ headerShown: false }} />
        <Stack.Screen name="YearReflection" component={YearReflectionScreen} options={{ headerShown: false }} />

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
          <Stack.Screen name="PromptAnswer" component={PromptAnswerScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Reveal" component={RevealScreen} options={{ headerShown: false, animation: "fade", animationDuration: 600 }} />
          <Stack.Screen name="RevenueCatPaywall" component={RevenueCatPaywall} options={{ headerShown: false }} />
          <Stack.Screen name="CustomerCenter" component={CustomerCenter} options={{ headerShown: false }} />
        </Stack.Group>
      </Stack.Navigator>
    </>
  );
}

import React, { useMemo } from "react";
import { Platform, StatusBar } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { COLORS, TYPOGRAPHY } from "../utils/theme";
import * as Haptics from "expo-haptics";

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
import RevenueCatDebugScreen from "../screens/RevenueCatDebugScreen";
import SyncSetupScreen from "../screens/SyncSetupScreen";
import AuthCallbackScreen from "../screens/AuthCallbackScreen";
import PairingQRCodeScreen from "../screens/PairingQRCodeScreen";
import PairingScanScreen from "../screens/PairingScanScreen";
import SetPinScreen from "../screens/SetPinScreen";
import RitualRemindersScreen from "../screens/RitualRemindersScreen";

// Tab Navigator
import Tabs from "./Tabs";

const Stack = createNativeStackNavigator();

/**
 * Premium Root Navigator
 * ✅ Luxury navigation experience with premium transitions
 * ✅ Sophisticated header styling with glassmorphism effects
 * ✅ Haptic feedback for premium feel
 * ✅ Always registers screens so navigation never breaks
 * ✅ Still enforces Onboarding -> Link -> Main entry logic
 */
export default function RootNavigator() {
  const { state } = useAppContext();
  const { user, loading } = useAuth();

  // Show loading screen while checking auth
  if (loading || state.isLoading) {
    return null; // Or a loading component
  }

  // If no user, show auth screen
  if (!user) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.warmCharcoal} />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Auth" component={AuthScreen} />
        </Stack.Navigator>
      </>
    );
  }

  const isNewUser = !state.onboardingCompleted;

  // Premium header styling with glassmorphism
  const globalScreenOptions = {
    headerStyle: { 
      backgroundColor: `${COLORS.warmCharcoal}F0`, // 94% opacity for glass effect
      borderBottomWidth: 0.5,
      borderBottomColor: `${COLORS.blushRose}30`, // 19% opacity border
    },
    headerShadowVisible: false,
    headerTintColor: COLORS.softCream,
    headerTitleStyle: {
      ...TYPOGRAPHY.h3,
      fontSize: 18,
      fontWeight: "700",
      letterSpacing: -0.5,
      color: COLORS.softCream,
    },
    headerBackTitleVisible: false,
    headerLeftContainerStyle: {
      paddingLeft: Platform.OS === "ios" ? 0 : 16,
      paddingTop: Platform.OS === "ios" ? 8 : 0, // Add top padding for iOS to move back arrow down
    },
    animation: Platform.OS === "ios" ? "slide_from_right" : "slide_from_right",
    animationDuration: 400, // Smooth 400ms transitions
    contentStyle: { backgroundColor: COLORS.warmCharcoal },
    // Premium blur effect for iOS
    headerBlurEffect: Platform.OS === "ios" ? "dark" : undefined,
    headerTransparent: Platform.OS === "ios" ? true : false,
  };

  // Haptic feedback for navigation
  const handleNavigationStateChange = () => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.warmCharcoal} />
      <Stack.Navigator
        screenOptions={globalScreenOptions}
        screenListeners={{
          state: handleNavigationStateChange,
        }}
      >
        {isNewUser ? (
          // Onboarding Flow
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
          // Main Application
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

        {/* Always available screens */}
        <Stack.Screen
          name="DateNightDetail"
          component={DateNightDetailScreen}
          options={{
            title: "Date Invitation",
            headerTransparent: true,
            headerShadowVisible: false,
            animation: "slide_from_right",
            animationDuration: 400,
            headerStyle: {
              backgroundColor: `${COLORS.warmCharcoal}CC`,
            },
          }}
        />

        <Stack.Screen
          name="HeatLevel"
          component={HeatLevelScreen}
          options={{
            title: "Choose Heat Level",
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 400,
          }}
        />

        <Stack.Screen
          name="JournalEntry"
          component={JournalEntryScreen}
          options={{
            title: "Journal Entry",
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 400,
          }}
        />

        <Stack.Screen
          name="VibeSignal"
          component={VibeSignalScreen}
          options={{
            title: "Vibe Signal",
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 400,
          }}
        />

        <Stack.Screen
          name="EditorialPrompt"
          component={EditorialPromptScreen}
          options={{
            title: "Editorial Prompts",
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 400,
          }}
        />

        <Stack.Screen
          name="NightRitual"
          component={NightRitualScreen}
          options={{
            title: "Night Ritual",
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 400,
          }}
        />

        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: "Settings",
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 400,
          }}
        />

        <Stack.Screen
          name="AdaptiveHome"
          component={AdaptiveHomeScreen}
          options={{
            title: "Home",
            headerShown: false,
            animation: "fade",
            animationDuration: 400,
          }}
        />

        {/* Legal & Account Screens */}
        <Stack.Screen
          name="Terms"
          component={TermsScreen}
          options={{
            title: "Terms of Service",
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 400,
          }}
        />

        <Stack.Screen
          name="PrivacyPolicy"
          component={PrivacyPolicyScreen}
          options={{
            title: "Privacy Policy",
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 400,
          }}
        />

        <Stack.Screen
          name="FAQ"
          component={FAQScreen}
          options={{
            title: "Help & FAQ",
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 400,
          }}
        />

        <Stack.Screen
          name="ExportData"
          component={ExportDataScreen}
          options={{
            title: "Export My Data",
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 400,
          }}
        />

        <Stack.Screen
          name="DeleteAccount"
          component={DeleteAccountScreen}
          options={{
            title: "Delete Account",
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 400,
          }}
        />

        {/* Settings Screens */}
        <Stack.Screen
          name="PartnerNamesSettings"
          component={PartnerNamesSettingsScreen}
          options={{
            title: "Partner Names",
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 400,
          }}
        />

        <Stack.Screen
          name="HeatLevelSettings"
          component={HeatLevelSettingsScreen}
          options={{
            title: "Heat Level",
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 400,
          }}
        />

        <Stack.Screen
          name="NotificationSettings"
          component={NotificationSettingsScreen}
          options={{
            title: "Notifications",
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 400,
          }}
        />

        <Stack.Screen
          name="RitualReminders"
          component={RitualRemindersScreen}
          options={{
            title: "Ritual Reminders",
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 400,
          }}
        />

        <Stack.Screen
          name="PrivacySecuritySettings"
          component={PrivacySecuritySettingsScreen}
          options={{
            title: "Privacy & Security",
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 400,
          }}
        />

        <Stack.Screen
          name="SetPin"
          component={SetPinScreen}
          options={{
            title: "Set PIN",
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 400,
          }}
        />

        <Stack.Screen
          name="SyncSetup"
          component={SyncSetupScreen}
          options={{
            title: "Cloud Sync",
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 400,
          }}
        />

        <Stack.Screen
          name="AuthCallback"
          component={AuthCallbackScreen}
          options={{
            title: "Auth Callback",
            headerShown: false,
            animation: "fade",
            animationDuration: 300,
          }}
        />

        <Stack.Screen
          name="PairingQRCode"
          component={PairingQRCodeScreen}
          options={{
            title: "Link Partner",
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 400,
          }}
        />

        <Stack.Screen
          name="PairingScan"
          component={PairingScanScreen}
          options={{
            title: "Scan QR",
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 400,
          }}
        />

        <Stack.Screen
          name="RevenueCatDebug"
          component={RevenueCatDebugScreen}
          options={{
            title: "RevenueCat Debug",
            headerShown: true,
            animation: "slide_from_right",
            animationDuration: 400,
          }}
        />

        <Stack.Screen
          name="PromptLibrary"
          component={PromptLibraryScreen}
          options={{
            title: "Prompt Library",
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 400,
          }}
        />

        {/* Premium Modal Presentations */}
        <Stack.Group 
          screenOptions={{ 
            presentation: "modal",
            animation: "slide_from_bottom",
            animationDuration: 500,
            gestureEnabled: true,
            cardStyle: {
              backgroundColor: COLORS.warmCharcoal,
            },
          }}
        >
          <Stack.Screen
            name="PromptAnswer"
            component={PromptAnswerScreen}
            options={{
              headerShown: false,
              animation: "slide_from_bottom",
              animationDuration: 400,
            }}
          />
          <Stack.Screen
            name="Reveal"
            component={RevealScreen}
            options={{
              headerShown: false,
              animation: "fade",
              animationDuration: 600,
            }}
          />
          <Stack.Screen
            name="Paywall"
            component={PaywallScreen}
            options={{
              headerShown: false,
              gestureEnabled: true,
              animation: "slide_from_bottom",
              animationDuration: 500,
              cardStyle: {
                backgroundColor: COLORS.deepCharcoal || COLORS.warmCharcoal,
              },
            }}
          />
          <Stack.Screen
            name="RevenueCatPaywall"
            component={RevenueCatPaywall}
            options={{
              headerShown: false,
              gestureEnabled: true,
              animation: "slide_from_bottom",
              animationDuration: 500,
              cardStyle: {
                backgroundColor: COLORS.deepCharcoal || COLORS.warmCharcoal,
              },
            }}
          />
          <Stack.Screen
            name="CustomerCenter"
            component={CustomerCenter}
            options={{
              headerShown: false,
              gestureEnabled: true,
              animation: "slide_from_bottom",
              animationDuration: 500,
              cardStyle: {
                backgroundColor: COLORS.deepCharcoal || COLORS.warmCharcoal,
              },
            }}
          />
        </Stack.Group>
      </Stack.Navigator>
    </>
  );
}

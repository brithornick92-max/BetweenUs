import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Alert, ActivityIndicator, Text } from "react-native";
import Constants from "expo-constants";
import { RevenueCatUI } from "react-native-purchases-ui";
import { useSubscription } from "../context/SubscriptionContext";
import { useTheme } from "../context/ThemeContext";

/**
 * RevenueCat Paywall Component
 * Uses RevenueCat's pre-built paywall UI with customization
 * Automatically handles purchases, restore, and customer info
 */
const FALLBACK_COLORS = {
  background: "#0B0B0B",
  primary: "#D4AF37",
  text: "#FFFFFF",
};

const RevenueCatPaywall = ({ onDismiss, onPurchaseSuccess }) => {
  const { checkSubscriptionStatus } = useSubscription();

  // ✅ Guard ThemeContext being undefined during boot
  const themeContext = useTheme?.() ?? {};
  const colors = themeContext?.colors ?? FALLBACK_COLORS;

  const [isLoading, setIsLoading] = useState(true);

  // ✅ Prevent double-present in React 18 / dev re-renders
  const didPresentRef = useRef(false);

  useEffect(() => {
    if (didPresentRef.current) return;
    didPresentRef.current = true;

    // ✅ Expo Go cannot run RevenueCat paywall UI reliably
    if (Constants.appOwnership === "expo") {
      Alert.alert(
        "Requires Dev Build",
        "RevenueCat Paywall UI can't run inside Expo Go. Build a Development Client (expo-dev-client) to test purchases.",
        [{ text: "OK", onPress: () => onDismiss?.() }]
      );
      setIsLoading(false);
      return;
    }

    // Defer one tick so providers/layouts finish mounting
    const t = setTimeout(() => {
      presentPaywall();
    }, 0);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const presentPaywall = async () => {
    try {
      setIsLoading(true);

      const result = await RevenueCatUI.presentPaywall({
        displayCloseButton: true,
      });

      if (result === RevenueCatUI.PAYWALL_RESULT.PURCHASED) {
        await checkSubscriptionStatus();

        Alert.alert(
          "🎉 Welcome to Premium!",
          "You now have full access to all Between Us Pro features. Your partner will automatically get premium access too when you link accounts!",
          [
            {
              text: "Start Exploring",
              onPress: () => {
                onPurchaseSuccess?.();
                onDismiss?.();
              },
            },
          ]
        );
        return;
      }

      if (result === RevenueCatUI.PAYWALL_RESULT.RESTORED) {
        await checkSubscriptionStatus();

        Alert.alert("Purchases Restored!", "Your premium subscription has been restored.", [
          {
            text: "Continue",
            onPress: () => onDismiss?.(),
          },
        ]);
        return;
      }

      if (result === RevenueCatUI.PAYWALL_RESULT.CANCELLED) {
        onDismiss?.();
        return;
      }

      // Some versions return a string; treat anything unexpected as an error
      if (result === RevenueCatUI.PAYWALL_RESULT.ERROR) {
        Alert.alert("Error", "Something went wrong. Please try again.", [
          { text: "OK", onPress: () => onDismiss?.() },
        ]);
        return;
      }

      // Fallback: if we get an unknown result, just dismiss gracefully
      onDismiss?.();
    } catch (error) {
      console.error("Failed to present paywall:", error);
      Alert.alert("Error", "Failed to load paywall. Please try again.", [
        { text: "OK", onPress: () => onDismiss?.() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          Loading premium options...
        </Text>
      </View>
    );
  }

  // Paywall is native UI; when it closes we dismiss via callbacks.
  return null;
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 16, fontSize: 16 },
});

export default RevenueCatPaywall;

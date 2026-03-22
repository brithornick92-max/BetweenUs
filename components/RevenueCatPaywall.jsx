import React, { useEffect, useRef, useState, useMemo } from "react";
import { View, StyleSheet, Alert, ActivityIndicator, Text, Platform, StatusBar } from "react-native";
import Constants from "expo-constants";
import { RevenueCatUI } from "react-native-purchases-ui";
import { LinearGradient } from "expo-linear-gradient";
import { useSubscription } from "../context/SubscriptionContext";
import { useTheme } from "../context/ThemeContext";
import { SPACING } from "../utils/theme";
import Icon from "../components/Icon";

/**
 * RevenueCat Paywall Component
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 * Handles the bridge to native iOS/Android purchase UI.
 */
const FALLBACK_COLORS = {
  background: "#070509",
  primary: "#D2121A",
  text: "#F2E9E6",
};

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

const RevenueCatPaywall = ({ onDismiss, onPurchaseSuccess }) => {
  const { checkSubscriptionStatus } = useSubscription();
  const { colors, isDark } = useTheme();

  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    background: colors?.background || FALLBACK_COLORS.background,
    primary: colors?.primary || FALLBACK_COLORS.primary,
    text: colors?.text || FALLBACK_COLORS.text,
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
  }), [colors, isDark]);

  const [isLoading, setIsLoading] = useState(true);
  const didPresentRef = useRef(false);

  useEffect(() => {
    if (didPresentRef.current) return;
    didPresentRef.current = true;

    // Expo Go cannot run native RevenueCat UI
    if (Constants.appOwnership === "expo") {
      Alert.alert(
        "Pro Feature",
        "The Pro experience requires a native build. Please use the TestFlight version to explore premium features.",
        [{ text: "OK", onPress: () => onDismiss?.() }]
      );
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      presentPaywall();
    }, 500); // Slight delay for a smoother visual transition

    return () => clearTimeout(timer);
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
          "🎉 Welcome to Between Us Pro",
          "Full access is now yours. Your partner will automatically receive Pro access once you link your accounts.",
          [
            {
              text: "Begin Pro Journey",
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

        Alert.alert("Purchases Restored", "Your premium membership has been successfully restored.", [
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

      if (result === RevenueCatUI.PAYWALL_RESULT.ERROR) {
        Alert.alert("Connection Issue", "We couldn't connect to the store. Please check your connection and try again.", [
          { text: "OK", onPress: () => onDismiss?.() },
        ]);
        return;
      }

      onDismiss?.();
    } catch (error) {
      console.error("Failed to present paywall:", error);
      onDismiss?.();
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={[t.background, "#120206", t.background]}
          style={StyleSheet.absoluteFillObject}
        />
        
        <View style={styles.loadingContent}>
          <View style={styles.iconContainer}>
            <Icon name="sparkles-outline" size={42} color={t.primary} />
          </View>
          
          <ActivityIndicator size="small" color={t.primary} />
          
          <Text style={[styles.loadingText, { color: t.text }]}>
            Preparing your Pro experience...
          </Text>
          <Text style={[styles.loadingSubtext, { color: t.subtext }]}>
            Intimacy is just a moment away.
          </Text>
        </View>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center" 
  },
  loadingContent: {
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  iconContainer: {
    marginBottom: 32,
    shadowColor: "#D2121A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  loadingText: { 
    fontFamily: SYSTEM_FONT,
    marginTop: 24, 
    fontSize: 18, 
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center'
  },
  loadingSubtext: {
    fontFamily: SYSTEM_FONT,
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.8
  }
});

export default RevenueCatPaywall;

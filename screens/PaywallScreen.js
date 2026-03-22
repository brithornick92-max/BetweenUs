// screens/PaywallScreen.js
import React, { useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  Platform,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { useAppContext } from "../context/AppContext";
import { usePremiumFeatures } from "../hooks/usePremiumFeatures";
import PremiumPaywall from "../components/PremiumPaywall";
import { useTheme } from "../context/ThemeContext";

export default function PaywallScreen({ navigation, route }) {
  const { colors, isDark } = useTheme();
  const { actions } = useAppContext();
  const { handleSubscribe, hidePaywall } = usePremiumFeatures();
  const { feature } = route?.params || {};

  // STRICT Apple Editorial Theme Map 
  const t = useMemo(() => ({
    background: isDark ? '#000000' : '#F2F2F7', 
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    primary: colors.primary,
    text: isDark ? '#FFFFFF' : '#000000',
  }), [colors, isDark]);

  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    // Upgraded to native Apple spring physics for the entrance
    Animated.parallel([
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnimation, {
        toValue: 0,
        friction: 9,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnimation, slideAnimation]);

  useEffect(() => {
    return () => {
      hidePaywall();
    };
  }, [hidePaywall]);

  const handleClose = async () => {
    impact(ImpactFeedbackStyle.Light);
    hidePaywall();
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // no-op
    }
  };

  const handleSubscribeComplete = async (tier) => {
    await actions.refreshPremiumStatus();
    handleClose();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />

      {/* Subtle Velvet Gradient underneath the native Apple surfaces */}
      <LinearGradient
        colors={
          isDark
            ? [t.background, "#0F0A1A", "#0D081A", t.background]
            : [t.background, "#EBEBF5", t.background]
        }
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnimation,
            transform: [{ translateY: slideAnimation }],
          },
        ]}
      >
        <PremiumPaywall
          feature={feature}
          onSubscribe={handleSubscribeComplete}
          onClose={handleClose}
          showCloseButton={true}
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});

// screens/PaywallScreen.js
import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useAppContext } from "../context/AppContext";
import { usePremiumFeatures } from "../hooks/usePremiumFeatures";
import PremiumPaywall from "../components/PremiumPaywall";
import { useTheme } from "../context/ThemeContext";

export default function PaywallScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { actions } = useAppContext();
  const { handleSubscribe, hidePaywall } = usePremiumFeatures();
  const { feature } = route?.params || {};

  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    return () => {
      hidePaywall();
    };
  }, [hidePaywall]);

  const handleClose = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[colors.background, colors.surface, colors.background]}
        style={StyleSheet.absoluteFill}
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

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, 
  StyleSheet, 
  Alert, 
  ActivityIndicator, 
  Text, 
  Platform,
  Animated,
  StatusBar
} from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscription } from '../context/SubscriptionContext';
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import AnalyticsService from '../services/AnalyticsService';
import RevenueCatService from '../services/RevenueCatService';
import { impact, notification, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { SPACING } from '../utils/theme';

/**
 * RevenueCat Customer Center Component
 * Provides subscription management UI for existing subscribers
 * Handles: View subscription, manage billing, cancel, restore, contact support
 */
export default function CustomerCenter({ onDismiss, navigation }) {
  const { checkSubscriptionStatus } = useSubscription();
  const { colors, isDark } = useTheme();
  const { hidePaywall } = useEntitlements();

  const dismiss = useCallback(() => {
    hidePaywall?.();
    if (onDismiss) { onDismiss(); return; }
    navigation?.goBack?.();
  }, [hidePaywall, navigation, onDismiss]);

  // STRICT Apple Editorial Theme Map
  const t = useMemo(() => ({
    background: isDark ? '#000000' : '#F2F2F7', 
    primary: colors.primary,
    text: isDark ? '#FFFFFF' : '#000000',
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);
  
  // Entrance Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 9,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    let active = true;

    const presentCustomerCenter = async () => {
      try {
        await RevenueCatService.init();
        RevenueCatService.ensureConfigured();

        await RevenueCatUI.presentCustomerCenter({
          callbacks: {
            onShowingManageSubscriptions: () => {
              impact(ImpactFeedbackStyle.Medium);
            },
            onRestoreCompleted: () => {
              AnalyticsService.trackPurchase('restore_completed', { source: 'customerCenter' });
              notification(NotificationFeedbackType.Success);
              Alert.alert(
                'Purchases Restored',
                'Your purchases have been restored successfully.',
                [{ text: 'OK' }]
              );
              checkSubscriptionStatus();
            },
            onRestoreFailed: () => {
              notification(NotificationFeedbackType.Error);
              Alert.alert('Restore Failed', 'Please try again in a moment.');
            },
            onRefundRequestStarted: () => {
              impact(ImpactFeedbackStyle.Light);
            },
            onRefundRequestCompleted: () => {
              notification(NotificationFeedbackType.Success);
              Alert.alert(
                'Refund Requested',
                'Your refund request has been submitted. You\'ll receive an email confirmation shortly.',
                [{ text: 'OK' }]
              );
              checkSubscriptionStatus();
            },
          },
        });

        if (active) dismiss();
      } catch (error) {
        if (__DEV__) console.error('Failed to present customer center:', error);
        notification(NotificationFeedbackType.Error);
        const diagnostics = RevenueCatService.getDiagnostics?.();
        const message = diagnostics?.configIssue?.reason === 'missing_api_key'
          ? 'Subscription management is unavailable because this build is missing RevenueCat configuration.'
          : 'Failed to load subscription management. Please try again.';
        Alert.alert(
          'Subscription Management Unavailable',
          message,
          [{ text: 'OK', onPress: () => dismiss() }]
        );
      }
    };

    presentCustomerCenter();

    return () => {
      active = false;
    };
  }, [checkSubscriptionStatus, dismiss]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
      
      {/* Velvet background gradient bridging the loading state */}
      <LinearGradient
        colors={isDark 
          ? [t.background, '#0F0A1A', '#0D081A', t.background] 
          : [t.background, '#EBEBF5', t.background]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <Animated.View 
        style={[
          styles.content, 
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}
      >
        <ActivityIndicator size="large" color={t.primary} style={styles.spinner} />
        <Text style={styles.title}>
          Securing Connection
        </Text>
        <Text style={styles.subtitle}>
          Loading subscription management...
        </Text>
      </Animated.View>
    </View>
  );
}

// ------------------------------------------------------------------
// STYLES - Apple Editorial
// ------------------------------------------------------------------
const createStyles = (t, isDark) => {
  const systemFont = Platform.select({ ios: "System", android: "Roboto" });

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.background,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: SPACING.xl,
    },
    spinner: {
      marginBottom: SPACING.lg,
    },
    title: {
      fontFamily: systemFont,
      fontSize: 20,
      fontWeight: '700',
      color: t.text,
      letterSpacing: -0.3,
      marginBottom: SPACING.xs,
    },
    subtitle: {
      fontFamily: systemFont,
      fontSize: 15,
      fontWeight: '500',
      color: t.subtext,
      textAlign: 'center',
    },
  });
};

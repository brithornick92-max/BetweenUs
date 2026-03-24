// screens/NightRitualScreen.js
import React, { useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../components/Icon';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import NightRitualMode, { getNightRitualColors } from '../components/NightRitualMode';
import { useEntitlements } from '../context/EntitlementsContext';
import { useTheme } from '../context/ThemeContext';
import { PremiumFeature } from '../utils/featureFlags';
import { SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../utils/theme';

export default function NightRitualScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const NIGHT_COLORS = useMemo(() => getNightRitualColors(colors), [colors]);
  const blockedAccessHandledRef = useRef(false);
  
  // STRICT Apple Editorial Theme Map (Forced Dark for Night Ritual)
  const t = useMemo(() => ({
    background: '#000000', 
    surface: '#1C1C1E',
    surfaceSecondary: '#2C2C2E',
    primary: colors.primary,
    accent: NIGHT_COLORS.moonGlow || '#5856D6',
    text: '#FFFFFF',
    subtext: 'rgba(235, 235, 245, 0.6)',
    border: 'rgba(255,255,255,0.08)',
  }), [colors, NIGHT_COLORS]);

  const styles = useMemo(() => createStyles(t, NIGHT_COLORS), [t, NIGHT_COLORS]);
  const {
    isPremiumEffective: isPremium,
    isLoading: entitlementsLoading,
    showPaywall,
  } = useEntitlements();

  // Wait for entitlements to resolve before gating to avoid false paywall flashes.
  useEffect(() => {
    if (entitlementsLoading || isPremium || blockedAccessHandledRef.current) {
      return;
    }

    blockedAccessHandledRef.current = true;
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace('MainTabs');
    }
    showPaywall(PremiumFeature.NIGHT_RITUAL_MODE);
  }, [entitlementsLoading, isPremium, navigation, showPaywall]);

  // Clean, fast Apple entrance animations
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(30)).current;

  useEffect(() => {
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

  const handleRitualComplete = async (ritual, responses) => {
    impact(ImpactFeedbackStyle.Medium);
    if (__DEV__) {
      console.log('Night ritual completed:', ritual?.id);
    }
    // Navigate back after a short delay so the completion overlay is visible
    setTimeout(() => navigation.goBack(), 3200);
  };

  const handleElementComplete = async (elementId, response) => {
    impact(ImpactFeedbackStyle.Light);
    if (__DEV__) {
      console.log(`Element ${elementId} completed`);
    }
  };

  const handleBackPress = async () => {
    impact(ImpactFeedbackStyle.Light);
    selection();
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Deep Velvet Apple Editorial Background */}
      <LinearGradient
        colors={[
          t.background,
          '#0F0A1A', // Very subtle plum vignette
          '#0D081A',
          t.background,
        ]}
        style={StyleSheet.absoluteFillObject}
        locations={[0, 0.3, 0.7, 1]}
      />

      {/* Floating back button (Crisp Native iOS Style) */}
      <Animated.View 
        style={[
          styles.backRow, 
          { 
            opacity: fadeAnimation, 
            transform: [{ translateY: slideAnimation }] 
          }
        ]}
      >
        <TouchableOpacity
          onPress={handleBackPress}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon
            name="chevron-left"
            size={32}
            color={t.text}
          />
        </TouchableOpacity>
      </Animated.View>

      {/* The ritual component owns all content: header, steps, input, footer */}
      <Animated.View 
        style={[
          styles.ritualContainer, 
          { 
            opacity: fadeAnimation,
            transform: [{ translateY: slideAnimation }]
          }
        ]}
      >
        <NightRitualMode
          onRitualComplete={handleRitualComplete}
          onElementComplete={handleElementComplete}
        />
      </Animated.View>
    </SafeAreaView>
  );
}

// ------------------------------------------------------------------
// STYLES - Pure Apple Editorial 
// ------------------------------------------------------------------
const createStyles = (t, NIGHT_COLORS) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.background,
    },
    backRow: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 60 : 24,
      left: SPACING.lg,
      zIndex: 20,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.border,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
        android: { elevation: 4 },
      }),
    },
    ritualContainer: {
      flex: 1,
    },
  });
  
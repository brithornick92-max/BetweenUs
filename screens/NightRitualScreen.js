// screens/NightRitualScreen.js
import React, { useRef, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import NightRitualMode from '../components/NightRitualMode';
import { useAppContext } from '../context/AppContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useTheme } from '../context/ThemeContext';
import { getNightRitualColors } from '../components/NightRitualMode';
import { SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../utils/theme';

const NightRitualScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const NIGHT_COLORS = useMemo(() => getNightRitualColors(colors), [colors]);
  const styles = useMemo(() => createStyles(NIGHT_COLORS), [NIGHT_COLORS]);
  const { state } = useAppContext();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();

  // Gate: Night Ritual is a premium-only feature
  useEffect(() => {
    if (!isPremium) {
      showPaywall('NIGHT_RITUAL_MODE');
    }
  }, [isPremium, showPaywall]);

  // Animation values
  const fadeAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnimation, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

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
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={[
          NIGHT_COLORS.deepNight,
          NIGHT_COLORS.plumVignette,
          NIGHT_COLORS.deepNight,
        ]}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.5, 1]}
      />

      {/* Floating back button */}
      <View style={styles.backRow}>
        <TouchableOpacity
          onPress={handleBackPress}
          style={styles.backButton}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <BlurView intensity={20} tint="dark" style={styles.backButtonBlur}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={22}
              color={NIGHT_COLORS.moonGlow}
            />
          </BlurView>
        </TouchableOpacity>
      </View>

      {/* The ritual component owns all content: header, steps, input, footer */}
      <Animated.View style={[styles.ritualContainer, { opacity: fadeAnimation }]}>
        <NightRitualMode
          onRitualComplete={handleRitualComplete}
          onElementComplete={handleElementComplete}
        />
      </Animated.View>
    </SafeAreaView>
  );
};

const createStyles = (NIGHT_COLORS) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: NIGHT_COLORS.deepNight,
    },
    backRow: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 56 : 16,
      left: SPACING.screen,
      zIndex: 20,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      overflow: 'hidden',
    },
    backButtonBlur: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: NIGHT_COLORS.border,
    },
    ritualContainer: {
      flex: 1,
    },
  });

export default NightRitualScreen;

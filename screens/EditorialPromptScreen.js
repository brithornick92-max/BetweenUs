/**
 * EditorialPromptScreen — Thoughtful reflection surface
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 * Deep immersive gradients and heavy editorial typography.
 */

// screens/EditorialPromptScreen.js
import React, { useRef, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  SafeAreaView,
  Text,
  TouchableOpacity,
  Animated,
  Platform,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Icon from '../components/Icon';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import EditorialPrompt from "../components/EditorialPrompt";
import { useEntitlements } from "../context/EntitlementsContext";
import { useTheme } from "../context/ThemeContext";
import { SPACING, withAlpha } from "../utils/theme";

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

const EditorialPromptScreen = ({ route, navigation }) => {
  const { promptId, category } = route?.params || {};
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const { colors, isDark } = useTheme();

  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    background: colors.background,
    surface: isDark ? '#131016' : '#FFFFFF',
    surfaceSecondary: isDark ? '#1C1520' : '#F2F2F7',
    primary: colors.primary || '#C3113D', // Sexy Red
    text: colors.text,
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnimation, {
        toValue: 0,
        friction: 9,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleBackPress = () => {
    selection();
    navigation.goBack();
  };

  const renderHeader = () => (
    <Animated.View
      style={[
        styles.header,
        {
          opacity: fadeAnimation,
          transform: [{ translateY: slideAnimation }],
        },
      ]}
    >
      <TouchableOpacity
        onPress={handleBackPress}
        style={styles.backButton}
        activeOpacity={0.8}
      >
        <BlurView intensity={25} tint={isDark ? "dark" : "light"} style={[styles.backButtonBlur, { borderColor: t.border }]}>
          <Icon name="chevron-back" size={24} color={t.text} />
        </BlurView>
      </TouchableOpacity>

      <View style={styles.headerContent}>
        <View style={[styles.headerIcon, { backgroundColor: withAlpha(t.primary, 0.12) }]}>
          <Icon
            name={category === "daily_life" ? "calendar-outline" : "chatbubble-ellipses-outline"}
            size={28}
            color={t.primary}
          />
        </View>

        <Text style={[styles.headerTitle, { color: t.text }]}>
          {category === "daily_life" ? "Daily Reflection" : "Shared Wisdom"}
        </Text>
        <Text style={[styles.headerSubtitle, { color: t.subtext }]}>
          {category === "daily_life"
            ? "Connect through the quiet moments of your day."
            : "Thoughtful prompts designed to deepen your intimacy."}
        </Text>

        {isPremium && (
          <View style={[styles.premiumBadge, { backgroundColor: withAlpha(t.primary, 0.1) }]}>
            <Text style={[styles.premiumBadgeText, { color: t.primary }]}>PRO EXPERIENCE</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );

  const renderCategoryInfo = () => {
    const info = {
      reflection: { icon: "eye-outline", name: "Reflection", description: "Deep questions about your inner world" },
      connection: { icon: "heart-outline", name: "Connection", description: "Prompts to strengthen your bond" },
      growth: { icon: "trending-up-outline", name: "Growth", description: "Questions about development and aspirations" },
      intimacy: { icon: "heart-circle-outline", name: "Intimacy", description: "Vulnerable prompts for deeper connection" },
      dreams: { icon: "star-outline", name: "Dreams", description: "Explore hopes and future together" },
    };
    const categoryInfo = info[category] || info.reflection;

    return (
      <Animated.View
        style={[
          styles.categoryInfo,
          {
            opacity: fadeAnimation,
            transform: [{ translateY: slideAnimation }],
          },
        ]}
      >
        <View style={[styles.categoryCard, { backgroundColor: withAlpha(t.primary, 0.06), borderColor: t.border }]}>
          <View style={[styles.categoryIconContainer, { backgroundColor: withAlpha(t.primary, 0.12) }]}>
            <Icon name={categoryInfo.icon} size={22} color={t.primary} />
          </View>
          <View style={styles.categoryTextContainer}>
            <Text style={[styles.categoryName, { color: t.text }]}>{categoryInfo.name}</Text>
            <Text style={[styles.categoryDescription, { color: t.subtext }]}>{categoryInfo.description}</Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  if (!isPremium) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.background }]}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={[t.background, "#120206", t.background]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.paywallContainer}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Icon name="chevron-back" size={24} color={t.text} />
          </TouchableOpacity>

          <View style={styles.paywallContent}>
            <View style={[styles.paywallIconWrap, { backgroundColor: withAlpha(t.primary, 0.12) }]}>
              <Icon name="lock-closed-outline" size={32} color={t.primary} />
            </View>
            <Text style={[styles.paywallTitle, { color: t.text }]}>
              {category === "daily_life" ? "Daily Reflection" : "Editorial Prompts"}
            </Text>
            <Text style={[styles.paywallDescription, { color: t.subtext }]}>
              Unlock the full library of curated intimacy prompts and daily check-ins.
            </Text>

            <View style={styles.paywallFeatures}>
              <PaywallFeatureRow text="5 unique reflection categories" color={t.primary} textColor={t.text} />
              <PaywallFeatureRow text="Privacy-first answer sharing" color={t.primary} textColor={t.text} />
              <PaywallFeatureRow text="Unlimited connection history" color={t.primary} textColor={t.text} />
            </View>

            <TouchableOpacity
              onPress={() => showPaywall?.('EDITORIAL_PROMPTS')}
              style={[styles.upgradeButton, { backgroundColor: t.primary }]}
              activeOpacity={0.9}
            >
              <Icon name="sparkles" size={18} color="#FFFFFF" />
              <Text style={styles.upgradeButtonText}>Unlock Pro Reflection</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[t.background, withAlpha(t.primary, 0.05), t.background]}
        style={StyleSheet.absoluteFill}
      />

      {renderHeader()}
      {category && renderCategoryInfo()}

      <Animated.View
        style={[
          styles.promptContainer,
          {
            opacity: fadeAnimation,
            transform: [{ translateY: slideAnimation }],
          },
        ]}
      >
        <EditorialPrompt
          promptId={promptId}
          category={category}
          onAnswerSubmit={() => impact(ImpactFeedbackStyle.Medium)}
          onPartnerAnswerRevealed={() => impact(ImpactFeedbackStyle.Light)}
        />
      </Animated.View>
    </SafeAreaView>
  );
};

function PaywallFeatureRow({ text, color, textColor }) {
  return (
    <View style={styles.paywallFeature}>
      <Icon name="checkmark-circle" size={20} color={color} />
      <Text style={[styles.paywallFeatureText, { color: textColor }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  backButton: {
    position: "absolute",
    top: SPACING.xl,
    left: SPACING.xl,
    zIndex: 10,
  },
  backButtonBlur: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  headerContent: {
    alignItems: "center",
    paddingTop: 50,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
  },
  headerTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 42,
    textAlign: "center",
    marginBottom: 8,
  },
  headerSubtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: SPACING.lg,
    paddingHorizontal: 20,
    fontWeight: "500",
  },
  premiumBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  categoryInfo: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: SPACING.lg,
    borderWidth: 1,
  },
  categoryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  categoryTextContainer: {
    flex: 1,
  },
  categoryName: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  categoryDescription: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
  },
  promptContainer: { flex: 1 },
  paywallContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  paywallContent: { alignItems: "center" },
  paywallIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  paywallTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -1,
  },
  paywallDescription: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 40,
    fontWeight: "500",
  },
  paywallFeatures: {
    alignSelf: "stretch",
    marginBottom: 48,
  },
  paywallFeature: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  paywallFeatureText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: "600",
  },
  upgradeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: 28,
    paddingHorizontal: 32,
    gap: 10,
    width: "100%",
    ...Platform.select({
      ios: {
        shadowColor: "#C3113D",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
      },
      android: { elevation: 4 },
    }),
  },
  upgradeButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: -0.2,
  },
});

export default EditorialPromptScreen;

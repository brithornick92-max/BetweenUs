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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import EditorialPrompt from "../components/EditorialPrompt";
import { useAppContext } from "../context/AppContext";
import { useEntitlements } from "../context/EntitlementsContext";
import { useTheme } from "../context/ThemeContext";
import {
  SPACING,
  TYPOGRAPHY,
  BORDER_RADIUS,
  ICON_SIZES,
} from "../utils/theme";

const EditorialPromptScreen = ({ route, navigation }) => {
  const { promptId, category } = route?.params || {};
  const { state } = useAppContext();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const { colors, isDark } = useTheme();

  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(30)).current;

  const styles = useMemo(() => createStyles(colors), [colors]);

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

  const handleAnswerSubmit = async (prompt, answer) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handlePartnerAnswerRevealed = async (prompt, partnerAnswer) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBackPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        activeOpacity={0.85}
      >
        <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={styles.backButtonBlur}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={ICON_SIZES.lg}
            color={colors.text}
          />
        </BlurView>
      </TouchableOpacity>

      <View style={styles.headerContent}>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons
            name={category === "daily_life" ? "calendar-heart" : "feather"}
            size={32}
            color={colors.primary}
          />
        </View>

        <Text style={styles.headerTitle}>
          {category === "daily_life" ? "Daily Reflection" : "Editorial Prompts"}
        </Text>
        <Text style={styles.headerSubtitle}>
          {category === "daily_life"
            ? "Share about your day and connect through daily moments"
            : "Thoughtful questions designed to deepen your connection through meaningful reflection"}
        </Text>

        {isPremium && (
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumBadgeText}>PREMIUM</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );

  const renderCategoryInfo = () => {
    const info = {
      reflection: { icon: "mirror", name: "Reflection", description: "Deep questions about your inner world" },
      connection: { icon: "heart-multiple", name: "Connection", description: "Prompts to strengthen your bond" },
      growth: { icon: "trending-up", name: "Growth", description: "Questions about development and aspirations" },
      intimacy: { icon: "heart-pulse", name: "Intimacy", description: "Vulnerable prompts for deeper connection" },
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
        <View style={styles.categoryCard}>
          <View style={styles.categoryIconContainer}>
            <MaterialCommunityIcons
              name={categoryInfo.icon}
              size={ICON_SIZES.lg}
              color={colors.primary}
            />
          </View>
          <View style={styles.categoryTextContainer}>
            <Text style={styles.categoryName}>{categoryInfo.name}</Text>
            <Text style={styles.categoryDescription}>{categoryInfo.description}</Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  if (!isPremium) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={[colors.background, colors.surface + "80", colors.background]}
          style={StyleSheet.absoluteFill}
          locations={[0, 0.5, 1]}
        />

        <View style={styles.paywallContainer}>
          <TouchableOpacity
            onPress={handleBackPress}
            style={styles.backButton}
            activeOpacity={0.85}
          >
            <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={styles.backButtonBlur}>
              <MaterialCommunityIcons
                name="arrow-left"
                size={ICON_SIZES.lg}
                color={colors.text}
              />
            </BlurView>
          </TouchableOpacity>

          <View style={styles.paywallContent}>
            <View style={styles.paywallIconWrap}>
              <MaterialCommunityIcons
                name={category === "daily_life" ? "calendar-heart" : "feather"}
                size={48}
                color={colors.primary}
              />
            </View>
            <Text style={styles.paywallTitle}>
              {category === "daily_life" ? "Daily Reflection" : "Editorial Prompts"}
            </Text>
            <Text style={styles.paywallDescription}>
              {category === "daily_life"
                ? "Connect with your partner by sharing daily moments, thoughts, and feelings."
                : "Discover thoughtfully crafted questions designed to spark meaningful conversations."}
            </Text>

            <View style={styles.paywallFeatures}>
              <PaywallFeatureRow text="5 unique categories of prompts" color={colors.primary} />
              <PaywallFeatureRow text="Privacy-first answer sharing" color={colors.primary} />
              <PaywallFeatureRow text="Magazine-style interface" color={colors.primary} />
            </View>

            <TouchableOpacity
              onPress={showPaywall}
              style={styles.upgradeButton}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="crown" size={18} color={colors.text} />
              <Text style={[styles.upgradeButtonText, { color: colors.text }]}>Discover the full experience</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[colors.background, colors.surface + "60", colors.background]}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.5, 1]}
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
          onAnswerSubmit={handleAnswerSubmit}
          onPartnerAnswerRevealed={handlePartnerAnswerRevealed}
        />
      </Animated.View>
    </SafeAreaView>
  );
};

function PaywallFeatureRow({ text, color }) {
  return (
    <View style={styles.paywallFeature}>
      <MaterialCommunityIcons name="check-circle" size={18} color={color} />
      <Text style={styles.paywallFeatureText}>{text}</Text>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    position: "relative",
  },

  backButton: {
    position: "absolute",
    top: SPACING.xl,
    left: SPACING.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    zIndex: 10,
  },

  backButtonBlur: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },

  headerContent: {
    alignItems: "center",
    paddingTop: SPACING.xl,
    position: "relative",
  },

  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary + "18",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
  },

  headerTitle: {
    ...TYPOGRAPHY.display,
    color: colors.text,
    textAlign: "center",
    marginBottom: SPACING.sm,
    fontSize: 28,
    fontWeight: "300",
  },

  headerSubtitle: {
    ...TYPOGRAPHY.body,
    color: colors.text + "CC",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.md,
    fontSize: 14,
  },

  premiumBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.accent + "25",
  },

  premiumBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    color: colors.accent,
  },

  categoryInfo: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },

  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },

  categoryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + "18",
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },

  categoryTextContainer: {
    flex: 1,
  },

  categoryName: {
    ...TYPOGRAPHY.h3,
    color: colors.text,
    marginBottom: 2,
    fontSize: 16,
  },

  categoryDescription: {
    ...TYPOGRAPHY.caption,
    color: colors.text + "CC",
    fontSize: 13,
    lineHeight: 18,
  },

  promptContainer: {
    flex: 1,
  },

  paywallContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
  },

  paywallContent: {
    alignItems: "center",
    maxWidth: 320,
  },

  paywallIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary + "18",
    alignItems: "center",
    justifyContent: "center",
  },

  paywallTitle: {
    ...TYPOGRAPHY.display,
    color: colors.text,
    textAlign: "center",
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
    fontSize: 28,
    fontWeight: "300",
  },

  paywallDescription: {
    ...TYPOGRAPHY.body,
    color: colors.text + "CC",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: SPACING.xl,
    fontSize: 14,
  },

  paywallFeatures: {
    alignSelf: "stretch",
    marginBottom: SPACING.xl,
  },

  paywallFeature: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },

  paywallFeatureText: {
    ...TYPOGRAPHY.body,
    color: colors.text + "E6",
    marginLeft: SPACING.md,
    fontSize: 14,
  },

  upgradeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
    width: "100%",
  },

  upgradeButtonText: {
    ...TYPOGRAPHY.button,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    textTransform: "none",
  },
});

export default EditorialPromptScreen;

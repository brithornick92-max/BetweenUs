// screens/PremiumScreen.js — Between Us Premium
// "A quiet conversation, not a pitch."

import React, { useRef, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  Alert,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../context/ThemeContext";
import { useSubscription } from "../context/SubscriptionContext";
import { usePremiumFeatures } from "../hooks/usePremiumFeatures";
import { useAppContext } from "../context/AppContext";
import { TYPOGRAPHY, SPACING, BORDER_RADIUS } from "../utils/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Features checklist ───────────────────────────────────────────────────────
const FEATURES = [
  { icon: "chat-processing-outline", text: "Unlimited prompts across all heat levels" },
  { icon: "email-heart-outline",     text: "Send & receive encrypted love notes" },
  { icon: "calendar-heart",          text: "Schedule date nights with reminders" },
  { icon: "link-variant",            text: "Secure partner linking — one sub covers both" },
  { icon: "book-open-variant",       text: "Year reflection & relationship milestones" },
  { icon: "shield-lock-outline",     text: "End-to-end encrypted local storage" },
];

// ─── Animated section wrapper ─────────────────────────────────────────────────
function FadeInSection({ index = 0, children, style }) {
  const opacity   = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 600, delay: 150 + index * 80, useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0, duration: 600, delay: 150 + index * 80, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function PremiumScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { offerings, purchasePackage, restorePurchases, isLoading, isPremium } =
    useSubscription();
  const { hidePaywall } = usePremiumFeatures();
  const { actions } = useAppContext();

  const [selectedPlan, setSelectedPlan] = useState("yearly");
  const [purchasing, setPurchasing] = useState(false);

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const packages  = offerings?.packages || [];
  const monthlyPkg  = packages.find((p) => p.packageType === "MONTHLY");
  const yearlyPkg   = packages.find((p) => p.packageType === "ANNUAL");
  const lifetimePkg = packages.find((p) => p.packageType === "LIFETIME");
  const planMap = { monthly: monthlyPkg, yearly: yearlyPkg, lifetime: lifetimePkg };

  useEffect(() => () => hidePaywall(), [hidePaywall]);

  // ── Selected package's price string ─────────────────────────────────────────
  const selectedPkg = planMap[selectedPlan];
  const selectedPriceStr = selectedPkg?.product?.priceString;

  const ctaLabel = (() => {
    if (selectedPlan === "lifetime") return selectedPriceStr ? `Get Lifetime — ${selectedPriceStr}` : "Get Lifetime Access";
    return selectedPriceStr ? `Start Premium — ${selectedPriceStr}` : "Start Premium";
  })();

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handlePurchase = async () => {
    const pkg = planMap[selectedPlan];
    if (!pkg || purchasing) return;
    setPurchasing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const result = await purchasePackage(pkg);
      if (result.success) {
        await actions?.refreshPremiumStatus?.();
        Alert.alert(
          "Welcome to Premium",
          "You and your partner now have full access.",
          [{ text: "Continue", onPress: () => navigation.goBack() }]
        );
      } else if (!result.cancelled) {
        Alert.alert("Something went wrong", result.error || "Please try again.");
      }
    } catch {
      Alert.alert("Error", "Purchase could not be completed.");
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (purchasing) return;
    setPurchasing(true);
    try {
      const result = await restorePurchases();
      if (result.success && result.isPremium) {
        Alert.alert("Restored", "Your premium access has been restored.", [
          { text: "Continue", onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert("Nothing found", "We couldn't find a previous purchase.");
      }
    } catch {
      Alert.alert("Error", "Restore failed. Please try again.");
    } finally {
      setPurchasing(false);
    }
  };

  const handleDismiss = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    hidePaywall();
    if (navigation.canGoBack()) navigation.goBack();
  };

  // ── Plan card ────────────────────────────────────────────────────────────────
  const PlanCard = ({ id, label, price, detail, badge }) => {
    const isSelected = selectedPlan === id;
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => { Haptics.selectionAsync(); setSelectedPlan(id); }}
        style={[styles.planCard, isSelected && styles.planCardSelected]}
      >
        {badge ? (
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>{badge}</Text>
          </View>
        ) : null}
        <View style={styles.planCardInner}>
          <View style={styles.planTextWrap}>
            <Text style={[styles.planLabel, isSelected && styles.planLabelSelected]}>{label}</Text>
            <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>{price}</Text>
            {detail ? <Text style={styles.planDetail}>{detail}</Text> : null}
          </View>
          <View style={[styles.planRadio, isSelected && styles.planRadioSelected]}>
            {isSelected && <View style={styles.planRadioDot} />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={
          isDark
            ? [colors.background, "#0E0A12", "#130E18", colors.background]
            : [colors.background, colors.surface2, colors.background]
        }
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        {/* Close button */}
        <TouchableOpacity
          onPress={handleDismiss}
          style={styles.closeButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── HERO ───────────────────────────────────────────── */}
          <FadeInSection index={0} style={styles.hero}>
            <Text style={styles.heroOverline}>Between Us Premium</Text>
            <Text style={styles.heroHeadline}>
              Make space for{"\n"}what matters most.
            </Text>
            <Text style={styles.heroSubheadline}>
              Unlimited prompts, love notes, shared calendar, and partner
              connection — one subscription covers both of you.
            </Text>
          </FadeInSection>

          {/* ─── FEATURES ───────────────────────────────────────── */}
          <FadeInSection index={1} style={styles.featuresSection}>
            {FEATURES.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <View style={styles.featureIconWrap}>
                  <MaterialCommunityIcons
                    name={f.icon}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </FadeInSection>

          {!isPremium && (
            <>
              {/* ─── PRICING ────────────────────────────────────── */}
              <FadeInSection index={2} style={styles.pricingSection}>
                <Text style={styles.pricingTitle}>Choose your plan</Text>

                <PlanCard
                  id="monthly"
                  label="Monthly"
                  price={monthlyPkg?.product?.priceString || "$7.99 / mo"}
                  detail="Flexible · cancel anytime"
                />
                <PlanCard
                  id="yearly"
                  label="Yearly"
                  price={yearlyPkg?.product?.priceString || "$49.99 / yr"}
                  detail="Save over 45% · best value"
                  badge="Most Popular"
                />
                <PlanCard
                  id="lifetime"
                  label="Lifetime"
                  price={lifetimePkg?.product?.priceString || "$69.99"}
                  detail="One payment, yours forever"
                />

                <Text style={styles.coupleNote}>
                  One subscription unlocks premium for both partners.
                </Text>
              </FadeInSection>

              {/* ─── CTA ────────────────────────────────────────── */}
              <FadeInSection index={3} style={styles.ctaSection}>
                <TouchableOpacity
                  style={[styles.ctaButton, (purchasing || isLoading) && styles.ctaButtonDisabled]}
                  activeOpacity={0.85}
                  onPress={handlePurchase}
                  disabled={purchasing || isLoading}
                >
                  {purchasing ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.ctaButtonText}>{ctaLabel}</Text>
                  )}
                </TouchableOpacity>

                {/* 24-hour cancellation notice — required by App Store */}
                {selectedPlan !== "lifetime" && (
                  <Text style={styles.renewalNotice}>
                    {Platform.OS === "ios"
                      ? "Payment charged to your Apple ID at confirmation. Subscription renews automatically unless cancelled at least 24 hours before the end of the current period. Manage in your Apple ID subscription settings."
                      : "Payment processed through Google Play. Subscription renews automatically unless cancelled at least 24 hours before the end of the current period. Manage in Google Play subscription settings."}
                  </Text>
                )}

              </FadeInSection>

              {/* ─── SECONDARY ACTIONS ──────────────────────────── */}
              <View style={styles.secondaryActions}>
                <TouchableOpacity
                  onPress={handleRestore}
                  activeOpacity={0.7}
                  style={styles.secondaryBtn}
                >
                  <Text style={styles.secondaryBtnText}>Restore purchases</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDismiss}
                  activeOpacity={0.6}
                  style={styles.secondaryBtn}
                >
                  <Text style={styles.secondaryBtnText}>Maybe later</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {isPremium && (
            <FadeInSection index={2} style={styles.alreadyPremium}>
              <MaterialCommunityIcons name="check-circle-outline" size={40} color={colors.primary} />
              <Text style={styles.alreadyPremiumText}>You're already on Premium.</Text>
              <Text style={styles.alreadyPremiumSub}>Manage your subscription in your device settings.</Text>
            </FadeInSection>
          )}

          {/* ─── LEGAL FOOTER ───────────────────────────────────── */}
          <View style={styles.legalFooter}>
            <TouchableOpacity
              onPress={() => navigation.navigate("PrivacyPolicy")}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={styles.legalSep}>·</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Terms")}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.legalLink}>Terms of Use</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const createStyles = (colors, isDark) => {
  const textColor  = isDark ? "#F2E9E6" : colors.text;
  const mutedColor = isDark ? "rgba(242,233,230,0.5)" : colors.textMuted;
  const subtleColor = isDark ? "rgba(242,233,230,0.35)" : colors.textMuted + "99";

  const serif = Platform.select({
    ios: "Playfair Display",
    android: "PlayfairDisplay_300Light",
    default: "System",
  });
  const sans = Platform.select({
    ios: "Inter",
    android: "Inter_400Regular",
    default: "System",
  });
  const sansBold = Platform.select({
    ios: "Inter-SemiBold",
    android: "Inter_600SemiBold",
    default: "System",
  });

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    safeArea: { flex: 1 },

    closeButton: {
      position: "absolute",
      top: Platform.OS === "ios" ? 16 : 16,
      right: SPACING.lg,
      zIndex: 10,
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 18,
      backgroundColor: colors.surface + "CC",
    },

    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.xxl + 8,
      paddingBottom: SPACING.lg,
    },

    // ── Hero ─────────────────────────────────────────────────────
    hero: {
      alignItems: "center",
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.xl,
    },
    heroOverline: {
      fontFamily: sansBold,
      fontSize: 11,
      letterSpacing: 2,
      textTransform: "uppercase",
      color: colors.primary,
      marginBottom: SPACING.md,
    },
    heroHeadline: {
      fontFamily: serif,
      fontSize: 32,
      lineHeight: 42,
      fontWeight: "300",
      color: textColor,
      textAlign: "center",
      letterSpacing: -0.3,
      marginBottom: SPACING.md,
    },
    heroSubheadline: {
      fontFamily: sans,
      fontSize: 15,
      lineHeight: 24,
      color: mutedColor,
      textAlign: "center",
      maxWidth: 300,
    },

    // ── Features ─────────────────────────────────────────────────
    featuresSection: {
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.lg,
      marginBottom: SPACING.xl,
    },
    featureRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: SPACING.sm + 1,
    },
    featureIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.primary + "18",
      alignItems: "center",
      justifyContent: "center",
      marginRight: SPACING.md,
      flexShrink: 0,
    },
    featureText: {
      fontFamily: sans,
      fontSize: 14,
      lineHeight: 20,
      color: textColor,
      flex: 1,
    },

    // ── Pricing ───────────────────────────────────────────────────
    pricingSection: {
      marginBottom: SPACING.lg,
    },
    pricingTitle: {
      fontFamily: serif,
      fontSize: 20,
      lineHeight: 28,
      fontWeight: "300",
      color: textColor,
      textAlign: "center",
      marginBottom: SPACING.lg,
    },
    planCard: {
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      marginBottom: SPACING.sm,
      overflow: "hidden",
    },
    planCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + "0A",
    },
    planBadge: {
      backgroundColor: colors.primary,
      paddingVertical: 4,
      alignItems: "center",
    },
    planBadgeText: {
      fontFamily: sansBold,
      fontSize: 10,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: "#FFFFFF",
    },
    planCardInner: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: SPACING.md + 2,
      paddingHorizontal: SPACING.lg,
    },
    planTextWrap: { flex: 1 },
    planLabel: {
      fontFamily: sansBold,
      fontSize: 15,
      color: textColor,
      marginBottom: 2,
    },
    planLabelSelected: {
      color: colors.primary,
    },
    planPrice: {
      fontFamily: sans,
      fontSize: 14,
      color: mutedColor,
      marginBottom: 2,
    },
    planPriceSelected: {
      color: textColor,
    },
    planDetail: {
      fontFamily: sans,
      fontSize: 12,
      color: mutedColor,
    },
    planRadio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: SPACING.md,
      flexShrink: 0,
    },
    planRadioSelected: { borderColor: colors.primary },
    planRadioDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.primary,
    },
    coupleNote: {
      fontFamily: sans,
      fontSize: 12,
      color: mutedColor,
      textAlign: "center",
      marginTop: SPACING.md,
    },

    // ── CTA ───────────────────────────────────────────────────────
    ctaSection: {
      alignItems: "center",
      marginBottom: 0,
    },
    ctaButton: {
      width: "100%",
      height: 54,
      backgroundColor: colors.primary,
      borderRadius: BORDER_RADIUS.md,
      alignItems: "center",
      justifyContent: "center",
    },
    ctaButtonDisabled: { opacity: 0.55 },
    ctaButtonText: {
      fontFamily: sansBold,
      fontSize: 15,
      letterSpacing: 0.5,
      color: "#FFFFFF",
    },

    // Required App Store renewal / cancellation disclosure
    renewalNotice: {
      fontFamily: sans,
      fontSize: 10,
      lineHeight: 15,
      color: subtleColor,
      textAlign: "center",
      marginTop: SPACING.md,
      paddingHorizontal: SPACING.sm,
    },

    // ── Secondary actions (Restore, then Maybe later) ────────────
    secondaryActions: {
      alignItems: "center",
      marginTop: SPACING.lg,
      marginBottom: SPACING.xl,
      gap: SPACING.xs,
    },
    secondaryBtn: {
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
    },
    secondaryBtnText: {
      fontFamily: sans,
      fontSize: 13,
      color: mutedColor,
      textDecorationLine: "underline",
      textAlign: "center",
    },

    // ── Already premium ───────────────────────────────────────────
    alreadyPremium: {
      alignItems: "center",
      paddingVertical: SPACING.xxl,
      gap: SPACING.sm,
    },
    alreadyPremiumText: {
      fontFamily: serif,
      fontSize: 20,
      fontWeight: "300",
      color: textColor,
      textAlign: "center",
    },
    alreadyPremiumSub: {
      fontFamily: sans,
      fontSize: 14,
      color: mutedColor,
      textAlign: "center",
    },

    // ── Legal footer ──────────────────────────────────────────────
    legalFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.xl,
      gap: SPACING.sm,
    },
    legalLink: {
      fontFamily: sans,
      fontSize: 12,
      color: mutedColor,
      textDecorationLine: "underline",
    },
    legalSep: {
      fontFamily: sans,
      fontSize: 12,
      color: subtleColor,
    },
  });
};

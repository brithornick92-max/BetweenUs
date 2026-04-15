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
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Icon from '../components/Icon';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { useTheme } from "../context/ThemeContext";
import { useSubscription } from "../context/SubscriptionContext";
import { useEntitlements } from "../context/EntitlementsContext";
import { usePremiumFeatures } from "../hooks/usePremiumFeatures";
import { useAppContext } from "../context/AppContext";
import AnalyticsService from "../services/AnalyticsService";
import { PremiumSource } from "../utils/featureFlags";
import { SPACING } from "../utils/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Features checklist ───────────────────────────────────────────────────────
const FEATURES = [
  { icon: "chatbubble-ellipses-outline", text: "Unlimited prompts across all heat levels" },
  { icon: "mail-outline",                text: "Send & receive encrypted love notes" },
  { icon: "calendar-outline",            text: "Schedule date nights with reminders" },
  { icon: "infinite-outline",            text: "One subscription can extend premium to your linked partner" },
  { icon: "book-outline",                text: "Year reflection & relationship milestones" },
  { icon: "shield-checkmark-outline",    text: "Encrypted storage for sensitive content" },
];

// ─── Animated section wrapper ─────────────────────────────────────────────────
function FadeInSection({ index = 0, children, style }) {
  const opacity   = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 500, delay: 100 + index * 80, useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0, friction: 8, tension: 50, delay: 100 + index * 80, useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, index]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

function PlanCard({ id, label, price, detail, badge, isSelected, onSelect, styles, primaryColor }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => {
        selection();
        onSelect(id);
      }}
      style={[
        styles.planCard,
        isSelected && styles.planCardSelected,
        isSelected && { borderColor: primaryColor },
      ]}
    >
      <View style={styles.planCardInner}>
        <View style={styles.planTextWrap}>
          <View style={styles.planLabelRow}>
            <Text style={styles.planLabel}>{label}</Text>
            {badge && (
              <View style={[styles.planBadge, { backgroundColor: primaryColor + '15' }]}>
                <Text style={[styles.planBadgeText, { color: primaryColor }]}>{badge}</Text>
              </View>
            )}
          </View>
          <Text style={styles.planPrice}>{price}</Text>
          {detail ? <Text style={styles.planDetail}>{detail}</Text> : null}
        </View>
        <View style={[styles.planRadio, isSelected && { borderColor: primaryColor }]}>
          {isSelected && <View style={[styles.planRadioDot, { backgroundColor: primaryColor }]} />}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function PremiumScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { offerings, purchasePackage, restorePurchases, isLoading } =
    useSubscription();
  const { isPremiumEffective: isPremium, premiumSource } = useEntitlements();
  const { hidePaywall } = usePremiumFeatures();
  const { actions } = useAppContext();

  const [selectedPlan, setSelectedPlan] = useState("yearly");
  const [purchasing, setPurchasing] = useState(false);

  // STRICT Apple Editorial Theme Map 
  const t = useMemo(() => ({
    background: isDark ? '#000000' : '#F2F2F7', 
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    surfaceSecondary: isDark ? '#2C2C2E' : '#E5E5EA',
    primary: colors.primary,
    text: isDark ? '#FFFFFF' : '#000000',
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  const packages  = offerings?.packages || [];
  const monthlyPkg  = packages.find((p) => p.packageType === "MONTHLY");
  const yearlyPkg   = packages.find((p) => p.packageType === "ANNUAL");
  const planMap = { monthly: monthlyPkg, yearly: yearlyPkg };

  useEffect(() => () => hidePaywall(), [hidePaywall]);

  // Track paywall shown when screen mounts (may not come through showPaywall())
  useEffect(() => {
    AnalyticsService.trackPaywall('PremiumScreen', 'shown');
  }, []);

  // ── Selected package's price string ─────────────────────────────────────────
  const selectedPkg = planMap[selectedPlan];
  const selectedPriceStr = selectedPkg?.product?.priceString;

  const ctaLabel = (() => {
    return selectedPriceStr ? `Start Premium — ${selectedPriceStr}` : "Start Premium";
  })();

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handlePurchase = async () => {
    const pkg = planMap[selectedPlan];
    if (purchasing) return;
    if (!pkg) {
      const reason = offerings?.reason;
      let message = 'Subscription plans are not available right now.';
      if (reason === 'missing_api_key') {
        message = __DEV__
          ? `Development build: RevenueCat API key not set (${offerings.missingKeyName}). Add it to eas.json env or a local .env file.`
          : 'Subscription plans are not available right now. Please try again later.';
      } else if (reason === 'no_offerings' || reason === 'offerings_unavailable') {
        message = 'No subscription products are configured yet. Please check back soon or contact support.';
      } else if (reason === 'not_configured') {
        message = __DEV__
          ? 'Development build: RevenueCat is not configured. Add your API key to eas.json env or a local .env file.'
          : 'Subscription plans are not available right now. Please try again later.';
      } else {
        message = 'Unable to load subscription options right now. Please check your connection and try again.';
      }
      Alert.alert("Store Unavailable", message);
      return;
    }
    setPurchasing(true);
    try {
      impact(ImpactFeedbackStyle.Medium);
      AnalyticsService.trackPurchase('started', { tier: selectedPlan, packageType: pkg?.packageType, source: 'PremiumScreen' });
      const result = await purchasePackage(pkg);
      if (result.success) {
        AnalyticsService.trackPurchase('completed', { tier: selectedPlan, packageType: pkg?.packageType, source: 'PremiumScreen' });
        await actions?.refreshPremiumStatus?.();
        notification(NotificationFeedbackType.Success);
        Alert.alert(
          "Welcome to Premium",
          "Your premium access is active. If you're linked, your partner can receive shared premium access too.",
          [{ text: "Continue", onPress: () => navigation.goBack() }]
        );
      } else if (!result.cancelled) {
        AnalyticsService.trackPurchase('failed', { tier: selectedPlan, reason: result.error || 'unknown', source: 'PremiumScreen' });
        notification(NotificationFeedbackType.Error);
        Alert.alert("Something went wrong", result.error || "Please try again.");
      }
    } catch {
      AnalyticsService.trackPurchase('failed', { tier: selectedPlan, reason: 'exception', source: 'PremiumScreen' });
      notification(NotificationFeedbackType.Error);
      Alert.alert("Error", "Purchase could not be completed.");
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (purchasing) return;
    setPurchasing(true);
    try {
      impact(ImpactFeedbackStyle.Light);
      AnalyticsService.trackPurchase('restore_started', { source: 'PremiumScreen' });
      const result = await restorePurchases();
      if (result.success && result.isPremium) {
        AnalyticsService.trackPurchase('restore_completed', { source: 'PremiumScreen' });
        notification(NotificationFeedbackType.Success);
        Alert.alert("Restored", "Your premium access has been restored.", [
          { text: "Continue", onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert("Nothing found", "We couldn't find a previous purchase.");
      }
    } catch {
      AnalyticsService.trackPurchase('restore_failed', { source: 'PremiumScreen' });
      Alert.alert("Error", "Restore failed. Please try again.");
    } finally {
      setPurchasing(false);
    }
  };

  const handleDismiss = async () => {
    impact(ImpactFeedbackStyle.Light);
    hidePaywall();
    if (navigation.canGoBack()) navigation.goBack();
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />

      {/* Subtle Velvet Gradient underneath the native Apple surfaces */}
      <LinearGradient
        colors={
          isDark
            ? [t.background, "#0F0A1A", "#0D081A", t.background]
            : [t.background, "#EBEBF5", t.background]
        }
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        {/* Close button */}
        <TouchableOpacity
          onPress={handleDismiss}
          style={styles.closeButton}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          activeOpacity={0.7}
        >
          <Icon name="close-outline" size={24} color={t.text} />
        </TouchableOpacity>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {/* ─── HERO ───────────────────────────────────────────── */}
          <FadeInSection index={0} style={styles.hero}>
            <Text style={[styles.heroOverline, { color: t.primary }]}>Between Us Premium</Text>
            <Text style={styles.heroHeadline}>
              Make space for{"\n"}what matters most.
            </Text>
            <Text style={styles.heroSubheadline}>
              Unlimited prompts, love notes, shared calendar, and encrypted sync for linked premium couples.
            </Text>
          </FadeInSection>

          {/* ─── FEATURES (Apple Native List Style) ──────────────── */}
          <FadeInSection index={1} style={styles.featuresSection}>
            {FEATURES.map((f, i) => (
              <View key={i} style={[styles.featureRow, i === FEATURES.length - 1 && styles.featureRowLast]}>
                <View style={[styles.featureIconWrap, { backgroundColor: t.primary + "15" }]}>
                  <Icon
                    name={f.icon}
                    size={18}
                    color={t.primary}
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
                  isSelected={selectedPlan === "monthly"}
                  onSelect={setSelectedPlan}
                  styles={styles}
                  primaryColor={t.primary}
                />
                <PlanCard
                  id="yearly"
                  label="Yearly"
                  price={yearlyPkg?.product?.priceString || "$49.99 / yr"}
                  detail="Save over 45% · best value"
                  badge="Most Popular"
                  isSelected={selectedPlan === "yearly"}
                  onSelect={setSelectedPlan}
                  styles={styles}
                  primaryColor={t.primary}
                />
                <View style={styles.coupleNoteContainer}>
                  <Icon name="heart-outline" size={14} color={t.primary} />
                  <Text style={styles.coupleNote}>
                    One subscription can share premium access with your linked partner.
                  </Text>
                </View>
              </FadeInSection>

              {/* ─── CTA ────────────────────────────────────────── */}
              <FadeInSection index={3} style={styles.ctaSection}>
                <TouchableOpacity
                  style={[
                    styles.ctaButton, 
                    { backgroundColor: t.text },
                    (purchasing || isLoading) && styles.ctaButtonDisabled
                  ]}
                  activeOpacity={0.85}
                  onPress={handlePurchase}
                  disabled={purchasing || isLoading}
                >
                  {purchasing ? (
                    <ActivityIndicator color={t.background} size="small" />
                  ) : (
                    <Text style={[styles.ctaButtonText, { color: t.background }]}>{ctaLabel}</Text>
                  )}
                </TouchableOpacity>

                {/* 24-hour cancellation notice — required by App Store */}
                <Text style={styles.renewalNotice}>
                  Payment charged to your Apple ID at confirmation. Subscription renews automatically unless cancelled at least 24 hours before the end of the current period. Manage in your Apple ID subscription settings.
                </Text>
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
              </View>
            </>
          )}

          {isPremium && (
            <FadeInSection index={2} style={styles.alreadyPremium}>
              <Icon name="checkmark-circle-outline" size={56} color={t.primary} />
              <Text style={styles.alreadyPremiumText}>You're on Premium.</Text>
              <Text style={styles.alreadyPremiumSub}>
                {premiumSource === PremiumSource.PARTNER
                  ? "Your linked partner's subscription gives you both full access."
                  : "Manage your subscription in your device settings."}
              </Text>
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
            <Text style={styles.legalSep}>·</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("EULA")}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.legalLink}>EULA</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles - Pure Apple Editorial ─────────────────────────────────────────────
const createStyles = (t, isDark) => {
  const systemFont = Platform.select({ ios: "System", android: "Roboto" });

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.background },
    safeArea: { flex: 1 },

    closeButton: {
      position: "absolute",
      top: Platform.OS === "ios" ? 16 : 32,
      right: SPACING.xl,
      zIndex: 10,
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 20,
      backgroundColor: t.surface,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.08, shadowRadius: 12 },
        android: { elevation: 4 },
      }),
    },

    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.xxxl + 20,
      paddingBottom: SPACING.xxxl,
    },

    // ── Hero ─────────────────────────────────────────────────────
    hero: {
      alignItems: "flex-start", // Left-aligned for Editorial feel
      paddingBottom: SPACING.xl,
    },
    heroOverline: {
      fontFamily: systemFont,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 2,
      textTransform: "uppercase",
      marginBottom: SPACING.sm,
    },
    heroHeadline: {
      fontFamily: systemFont,
      fontSize: 38,
      fontWeight: "800",
      color: t.text,
      letterSpacing: -0.5,
      lineHeight: 44,
      marginBottom: SPACING.md,
    },
    heroSubheadline: {
      fontFamily: systemFont,
      fontSize: 16,
      lineHeight: 24,
      fontWeight: "500",
      color: t.subtext,
      maxWidth: '90%',
    },

    // ── Features (Solid Apple Health List Style) ─────────────────
    featuresSection: {
      backgroundColor: t.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: SPACING.lg,
      marginBottom: SPACING.xl,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 16 },
        android: { elevation: 3 },
      }),
    },
    featureRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: SPACING.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    },
    featureRowLast: {
      borderBottomWidth: 0,
    },
    featureIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      marginRight: SPACING.md,
    },
    featureText: {
      fontFamily: systemFont,
      fontSize: 15,
      fontWeight: "600",
      color: t.text,
      flex: 1,
    },

    // ── Pricing ───────────────────────────────────────────────────
    pricingSection: {
      marginBottom: SPACING.xl,
    },
    pricingTitle: {
      fontFamily: systemFont,
      fontSize: 22,
      fontWeight: "700",
      color: t.text,
      letterSpacing: -0.5,
      marginBottom: SPACING.lg,
      paddingHorizontal: 4,
    },
    planCard: {
      backgroundColor: t.surface,
      borderRadius: 24,
      borderWidth: 2, // Slightly thicker border for unselected state to match Apple's crispness
      borderColor: t.border,
      marginBottom: SPACING.md,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.04, shadowRadius: 8 },
        android: { elevation: 2 },
      }),
    },
    planCardSelected: {
      backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: isDark ? 0 : 0.08, shadowRadius: 16 },
        android: { elevation: 4 },
      }),
    },
    planCardInner: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: SPACING.lg,
      paddingHorizontal: SPACING.lg,
    },
    planTextWrap: { flex: 1 },
    planLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
      gap: 8,
    },
    planLabel: {
      fontFamily: systemFont,
      fontSize: 18,
      fontWeight: "700",
      letterSpacing: -0.2,
      color: t.text,
    },
    planBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    planBadgeText: {
      fontFamily: systemFont,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    planPrice: {
      fontFamily: systemFont,
      fontSize: 15,
      fontWeight: "600",
      color: t.text,
      marginBottom: 2,
    },
    planDetail: {
      fontFamily: systemFont,
      fontSize: 13,
      fontWeight: "500",
      color: t.subtext,
    },
    planRadio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: t.subtext,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: SPACING.md,
    },
    planRadioDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    coupleNoteContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: SPACING.md,
    },
    coupleNote: {
      fontFamily: systemFont,
      fontSize: 13,
      fontWeight: "600",
      color: t.subtext,
    },

    // ── CTA ───────────────────────────────────────────────────────
    ctaSection: {
      alignItems: "center",
      marginBottom: SPACING.xl,
    },
    ctaButton: {
      width: "100%",
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: SPACING.md,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: isDark ? 0 : 0.15, shadowRadius: 12 },
        android: { elevation: 4 },
      }),
    },
    ctaButtonDisabled: { opacity: 0.7 },
    ctaButtonText: {
      fontFamily: systemFont,
      fontSize: 17,
      fontWeight: "700",
      letterSpacing: -0.3,
    },
    renewalNotice: {
      fontFamily: systemFont,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "500",
      color: t.subtext,
      textAlign: "center",
      paddingHorizontal: SPACING.md,
    },

    // ── Secondary actions ────────────
    secondaryActions: {
      alignItems: "center",
      marginBottom: SPACING.xl,
    },
    secondaryBtn: {
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.lg,
      backgroundColor: t.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: t.border,
    },
    secondaryBtnText: {
      fontFamily: systemFont,
      fontSize: 14,
      fontWeight: "600",
      color: t.text,
    },

    // ── Already premium ───────────────────────────────────────────
    alreadyPremium: {
      alignItems: "center",
      paddingVertical: SPACING.xxl,
      gap: SPACING.sm,
      backgroundColor: t.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: t.border,
    },
    alreadyPremiumText: {
      fontFamily: systemFont,
      fontSize: 22,
      fontWeight: "700",
      color: t.text,
      letterSpacing: -0.5,
      textAlign: "center",
      marginTop: SPACING.md,
    },
    alreadyPremiumSub: {
      fontFamily: systemFont,
      fontSize: 15,
      fontWeight: "500",
      color: t.subtext,
      textAlign: "center",
      paddingHorizontal: SPACING.xl,
    },

    // ── Legal footer ──────────────────────────────────────────────
    legalFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: SPACING.xl,
      gap: SPACING.md,
    },
    legalLink: {
      fontFamily: systemFont,
      fontSize: 13,
      fontWeight: "600",
      color: t.subtext,
    },
    legalSep: {
      fontFamily: systemFont,
      fontSize: 13,
      color: t.border,
    },
  });
};

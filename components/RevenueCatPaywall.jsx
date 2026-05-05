import React, { useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Text,
  Platform,
  StatusBar,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { useSubscription } from "../context/SubscriptionContext";
import { useTheme } from "../context/ThemeContext";
import { useEntitlements } from "../context/EntitlementsContext";
import AnalyticsService from "../services/AnalyticsService";
import RevenueCatService from "../services/RevenueCatService";
import { PremiumFeature } from "../utils/featureFlags";
import { SPACING, withAlpha } from "../utils/theme";
import Icon from "../components/Icon";
import GlowOrb from "../components/GlowOrb";
import FilmGrain from "../components/FilmGrain";
import CloseScreenHeader from "../components/CloseScreenHeader";

const FALLBACK_COLORS = {
  background: "#070509",
  primary: "#D2121A",
  text: "#F2E9E6",
};

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });
const SERIF_FONT = Platform.select({ ios: "Georgia", android: "serif" });

const FEATURE_COPY = {
  [PremiumFeature.UNLIMITED_PROMPTS]: {
    eyebrow: "PROMPTS",
    title: "Keep the conversation going.",
    body: "Free already gives you 20 prompts each week. Premium opens the larger prompt library right away, with more new prompts added every week.",
    benefits: [
      ["copy-outline", "A larger prompt library right away"],
      ["sparkles-outline", "More new prompts added every week"],
      ["heart-outline", "Shared access for both linked partners"],
    ],
  },
  [PremiumFeature.UNLIMITED_DATE_IDEAS]: {
    eyebrow: "DATES",
    title: "More plans for the two of you.",
    body: "Free already gives you 20 date ideas each week. Premium opens the larger date library right away, with more new date ideas added every week.",
    benefits: [
      ["calendar-outline", "A larger date library right away"],
      ["map-outline", "More new date ideas every week"],
      ["bookmark-outline", "Shared access for both linked partners"],
    ],
  },
  [PremiumFeature.UNLIMITED_JOURNAL_HISTORY]: {
    eyebrow: "KEEPSAKE",
    title: "Keep the full story.",
    body: "Free Keepsake shows the last 30 days. Premium unlocks your full archive of prompt answers, notes, date memories, sex positions, photos, and videos.",
    benefits: [
      ["archive-outline", "Your full keepsake timeline"],
      ["images-outline", "Photos, videos, and saved moments"],
      ["book-outline", "Older notes and reflections stay visible"],
    ],
  },
  default: {
    eyebrow: "PREMIUM",
    title: "Keep more of what you start.",
    body: "Free already gives you the full core experience. Premium adds more prompts, more date ideas, more sex positions, and the full Keepsake archive.",
    benefits: [
      ["copy-outline", "More prompts every week"],
      ["calendar-outline", "More date ideas every week"],
      ["archive-outline", "Your full keepsake archive"],
    ],
  },
};

function getFeatureCopy(feature) {
  return FEATURE_COPY[feature] || FEATURE_COPY.default;
}

function getPackageLabel(pkg) {
  const type = String(pkg?.packageType || pkg?.identifier || "").toLowerCase();
  if (type.includes("annual") || type.includes("year")) return "Yearly";
  if (type.includes("month")) return "Monthly";
  if (type.includes("week")) return "Weekly";
  return pkg?.product?.title || "Premium";
}

function getPackageSubtitle(pkg) {
  const product = pkg?.product || {};
  if (product.description) return product.description;
  const type = String(pkg?.packageType || pkg?.identifier || "").toLowerCase();
  if (type.includes("annual") || type.includes("year")) return "Best for building a shared habit.";
  if (type.includes("month")) return "Flexible access, billed monthly.";
  return "Adds more prompts, dates, and keepsake history.";
}

function isRecommendedPackage(pkg) {
  const type = String(pkg?.packageType || pkg?.identifier || "").toLowerCase();
  return type.includes("annual") || type.includes("year");
}

function isRecurringPackage(pkg) {
  const type = String(pkg?.packageType || pkg?.identifier || pkg?.product?.identifier || "").toLowerCase();
  const productType = String(pkg?.product?.productType || pkg?.product?.productCategory || "").toLowerCase();

  if (type.includes("lifetime") || type.includes("life_time")) return false;
  if (type.includes("non_subscription") || type.includes("non-subscription")) return false;
  if (productType.includes("non_subscription") || productType.includes("non-subscription")) return false;

  return true;
}

const SUBSCRIPTION_DISCLOSURE = "Payment is charged to your Apple ID at confirmation. Subscriptions renew automatically unless canceled at least 24 hours before the end of the current period. Your account may be charged for renewal within 24 hours before the current period ends. You can manage or cancel your subscription in App Store account settings.";

const RevenueCatPaywall = ({ onDismiss, onPurchaseSuccess, navigation, route }) => {
  const { checkSubscriptionStatus } = useSubscription();
  const { colors, isDark } = useTheme();
  const { hidePaywall } = useEntitlements();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [packages, setPackages] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState(null);
  const feature = route?.params?.feature || null;

  const dismiss = () => {
    hidePaywall?.();
    if (onDismiss) {
      onDismiss();
      return;
    }
    navigation?.goBack?.();
  };

  const t = useMemo(() => ({
    background: colors?.background || FALLBACK_COLORS.background,
    surface: colors?.surface || (isDark ? "#131016" : "#FFFFFF"),
    surface2: colors?.surface2 || (isDark ? "#1C151B" : "#F2F2F7"),
    primary: colors?.primary || FALLBACK_COLORS.primary,
    text: colors?.text || FALLBACK_COLORS.text,
    subtext: colors?.textMuted || (isDark ? "rgba(242,233,230,0.62)" : "rgba(60,60,67,0.62)"),
    border: colors?.border || (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"),
    accent: colors?.accent || "#D4AA7E",
  }), [colors, isDark]);

  const copy = getFeatureCopy(feature);

  const openLegalScreen = (screenName) => {
    navigation?.navigate?.(screenName, { fromPaywall: true });
  };

  const selectedPackage = useMemo(
    () => packages.find((pkg) => (pkg.identifier || pkg.product?.identifier) === selectedPackageId) || packages[0] || null,
    [packages, selectedPackageId]
  );

  const loadPlans = async () => {
    if (isLoadingPlans) return;

    try {
      setIsLoadingPlans(true);
      const offerings = await RevenueCatService.getOfferings();
      const available = (offerings?.packages || []).filter(isRecurringPackage);

      if (!available.length) {
        Alert.alert(
          "Plans unavailable",
          "We couldn't load purchase options right now. Please try again in the TestFlight or production build."
        );
        return;
      }

      const recommended = available.find(isRecommendedPackage) || available[0];
      setPackages(available);
      setSelectedPackageId(recommended?.identifier || recommended?.product?.identifier || null);
      setShowPlans(true);
      AnalyticsService.trackPaywall("plans", "shown");
    } catch (error) {
      if (__DEV__) console.warn("Failed to load plans:", error?.message);
      Alert.alert("Plans unavailable", "We couldn't load purchase options. Please check your connection and try again.");
    } finally {
      setIsLoadingPlans(false);
    }
  };

  const purchaseSelectedPlan = async () => {
    if (isPurchasing || !selectedPackage) return;

    try {
      setIsPurchasing(true);
      const result = await RevenueCatService.purchasePackage(selectedPackage);

      if (result?.cancelled) {
        AnalyticsService.trackPaywall("plans", "dismissed");
        return;
      }

      if (result?.success && result?.isPremium) {
        AnalyticsService.trackPurchase("completed", { source: "inAppPlans" });
        await checkSubscriptionStatus();
        onPurchaseSuccess?.();
        Alert.alert("Premium is active", "You are all set.", [
          { text: "Continue", onPress: dismiss },
        ]);
        return;
      }

      Alert.alert("Purchase incomplete", result?.error || "We couldn't complete the purchase. Please try again.");
    } catch (error) {
      if (__DEV__) console.warn("Purchase failed:", error?.message);
      Alert.alert("Purchase failed", "Please try again in a moment.");
    } finally {
      setIsPurchasing(false);
    }
  };

  const handlePrimaryAction = () => {
    if (!showPlans) {
      loadPlans();
      return;
    }

    purchaseSelectedPlan();
  };

  const restorePurchases = async () => {
    if (isPurchasing) return;

    try {
      setIsPurchasing(true);
      const result = await RevenueCatService.restorePurchases();
      await checkSubscriptionStatus();

      if (result?.isPremium) {
        Alert.alert("Purchases restored", "Your premium membership has been restored.", [
          { text: "Continue", onPress: dismiss },
        ]);
        return;
      }

      Alert.alert("No active purchase found", "We couldn't find an active premium purchase for this account.");
    } catch {
      Alert.alert("Restore failed", "Please try again in a moment.");
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <LinearGradient
        colors={isDark
          ? [t.background, "#120206", "#070509", t.background]
          : [t.background, "#FFF7F7", "#F9F6F4", t.background]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <GlowOrb color={t.primary} size={420} top={-150} left={180} opacity={isDark ? 0.14 : 0.08} />
      <GlowOrb color={t.accent} size={260} top={600} left={-90} opacity={isDark ? 0.08 : 0.05} />
      <FilmGrain opacity={0.045} />

      <SafeAreaView style={styles.safe}>
        <CloseScreenHeader
          title={showPlans ? "Plans" : "Premium"}
          subtitle={showPlans ? "CHOOSE ACCESS" : copy.eyebrow}
          titleColor={t.text}
          subtitleColor={t.primary}
          closeColor={t.text}
          onClose={dismiss}
        />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {showPlans ? (
            <View style={styles.plansBlock}>
              <TouchableOpacity
                style={styles.backToBenefits}
                onPress={() => setShowPlans(false)}
                activeOpacity={0.75}
              >
                <Icon name="chevron-back-outline" size={18} color={t.primary} />
                <Text style={[styles.backToBenefitsText, { color: t.primary }]}>Benefits</Text>
              </TouchableOpacity>

              <Text style={[styles.title, { color: t.text }]}>Choose your rhythm.</Text>
              <Text style={[styles.body, { color: t.subtext }]}>
                Choose monthly or yearly access for your couple. Premium adds more prompts, more date ideas, more sex positions, and the full Keepsake archive for both linked partners.
              </Text>

              <View style={styles.planList}>
                {packages.map((pkg) => {
                  const id = pkg.identifier || pkg.product?.identifier;
                  const selected = id === selectedPackageId;
                  const recommended = isRecommendedPackage(pkg);

                  return (
                    <TouchableOpacity
                      key={id}
                      style={[
                        styles.planCard,
                        {
                          borderColor: selected ? t.primary : t.border,
                          backgroundColor: selected ? withAlpha(t.primary, 0.08) : withAlpha(t.surface, isDark ? 0.34 : 0.72),
                        },
                      ]}
                      onPress={() => setSelectedPackageId(id)}
                      activeOpacity={0.82}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                    >
                      <View style={styles.planCardMain}>
                        <View style={styles.planTitleRow}>
                          <Text style={[styles.planTitle, { color: t.text }]}>{getPackageLabel(pkg)}</Text>
                          {recommended ? (
                            <View style={[styles.recommendedPill, { backgroundColor: withAlpha(t.primary, 0.12) }]}>
                              <Text style={[styles.recommendedText, { color: t.primary }]}>Best Value</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={[styles.planSubtitle, { color: t.subtext }]}>{getPackageSubtitle(pkg)}</Text>
                      </View>

                      <View style={styles.planPriceBlock}>
                        <Text style={[styles.planPrice, { color: t.text }]}>
                          {pkg?.product?.priceString || pkg?.product?.price_string || ""}
                        </Text>
                        <Text style={[styles.planPriceMeta, { color: t.subtext }]}>per couple</Text>
                        <View style={[
                          styles.radioMark,
                          { borderColor: selected ? t.primary : t.border, backgroundColor: selected ? t.primary : "transparent" },
                        ]}>
                          {selected ? <Icon name="checkmark-outline" size={14} color="#FFFFFF" /> : null}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={[styles.legalBlock, { borderColor: t.border }]}>
                <Text style={[styles.legalText, { color: t.subtext }]}>
                  {SUBSCRIPTION_DISCLOSURE}
                </Text>
                <View style={styles.legalLinksRow}>
                  <TouchableOpacity onPress={() => openLegalScreen("Terms")} activeOpacity={0.75}>
                    <Text style={[styles.legalLink, { color: t.primary }]}>Terms</Text>
                  </TouchableOpacity>
                  <Text style={[styles.legalSeparator, { color: t.subtext }]}>/</Text>
                  <TouchableOpacity onPress={() => openLegalScreen("PrivacyPolicy")} activeOpacity={0.75}>
                    <Text style={[styles.legalLink, { color: t.primary }]}>Privacy</Text>
                  </TouchableOpacity>
                  <Text style={[styles.legalSeparator, { color: t.subtext }]}>/</Text>
                  <TouchableOpacity onPress={() => openLegalScreen("EULA")} activeOpacity={0.75}>
                    <Text style={[styles.legalLink, { color: t.primary }]}>Apple EULA</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.heroBlock}>
                <View style={[styles.iconMark, { borderColor: withAlpha(t.primary, 0.24), backgroundColor: withAlpha(t.primary, 0.1) }]}>
                  <Icon name="sparkles-outline" size={28} color={t.primary} />
                </View>
                <Text style={[styles.title, { color: t.text }]}>{copy.title}</Text>
                <Text style={[styles.body, { color: t.subtext }]}>{copy.body}</Text>
              </View>

              <View style={styles.benefitList}>
                {copy.benefits.map(([icon, label]) => (
                  <BlurView
                    key={label}
                    intensity={36}
                    tint={isDark ? "dark" : "light"}
                    style={[styles.benefitRow, { borderColor: t.border, backgroundColor: withAlpha(t.surface, isDark ? 0.34 : 0.72) }]}
                  >
                    <View style={[styles.benefitIcon, { backgroundColor: withAlpha(t.primary, 0.1) }]}>
                      <Icon name={icon} size={18} color={t.primary} />
                    </View>
                    <Text style={[styles.benefitText, { color: t.text }]}>{label}</Text>
                  </BlurView>
                ))}
              </View>

              <View style={[styles.sharedNote, { borderColor: t.border }]}>
                <Icon name="people-outline" size={18} color={t.primary} />
                <Text style={[styles.sharedText, { color: t.subtext }]}>
                  One subscription can share premium access once your accounts are linked and the entitlement sync completes.
                </Text>
              </View>

              <View style={[styles.legalBlock, { borderColor: t.border }]}>
                <Text style={[styles.legalText, { color: t.subtext }]}>
                  Auto-renewing subscription. Cancel at least 24 hours before renewal in App Store account settings.
                </Text>
                <View style={styles.legalLinksRow}>
                  <TouchableOpacity onPress={() => openLegalScreen("Terms")} activeOpacity={0.75}>
                    <Text style={[styles.legalLink, { color: t.primary }]}>Terms</Text>
                  </TouchableOpacity>
                  <Text style={[styles.legalSeparator, { color: t.subtext }]}>/</Text>
                  <TouchableOpacity onPress={() => openLegalScreen("PrivacyPolicy")} activeOpacity={0.75}>
                    <Text style={[styles.legalLink, { color: t.primary }]}>Privacy</Text>
                  </TouchableOpacity>
                  <Text style={[styles.legalSeparator, { color: t.subtext }]}>/</Text>
                  <TouchableOpacity onPress={() => openLegalScreen("EULA")} activeOpacity={0.75}>
                    <Text style={[styles.legalLink, { color: t.primary }]}>Apple EULA</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </ScrollView>

        <View style={[styles.footer, { borderColor: t.border, backgroundColor: withAlpha(t.background, isDark ? 0.82 : 0.9) }]}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: t.primary, opacity: isPurchasing ? 0.65 : 1 }]}
            activeOpacity={0.86}
            onPress={handlePrimaryAction}
            disabled={isPurchasing || isLoadingPlans || (showPlans && !selectedPackage)}
            accessibilityRole="button"
            accessibilityLabel="View premium plans"
          >
            {isPurchasing || isLoadingPlans ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>
                  {showPlans ? "Continue For Both" : "View Plans"}
                </Text>
                <Icon name="arrow-forward-outline" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.restoreButton}
            onPress={restorePurchases}
            disabled={isPurchasing}
            activeOpacity={0.75}
            accessibilityRole="button"
          >
            <Text style={[styles.restoreText, { color: t.subtext }]}>Restore purchase</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: 180,
  },
  heroBlock: {
    marginTop: SPACING.lg,
  },
  plansBlock: {
    marginTop: SPACING.sm,
  },
  backToBenefits: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    minHeight: 36,
    marginBottom: SPACING.lg,
  },
  backToBenefitsText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  iconMark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.xl,
  },
  title: {
    fontFamily: SERIF_FONT,
    fontSize: 42,
    lineHeight: 46,
    letterSpacing: 0,
  },
  body: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    marginTop: SPACING.md,
  },
  benefitList: {
    gap: 10,
    marginTop: 34,
  },
  planList: {
    gap: 12,
    marginTop: 30,
  },
  planCard: {
    minHeight: 104,
    borderRadius: 8,
    borderWidth: 1.5,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  planCardMain: {
    flex: 1,
    minWidth: 0,
  },
  planTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  planTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
  },
  recommendedPill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  recommendedText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  planSubtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    marginTop: 8,
  },
  planPriceBlock: {
    alignItems: "flex-end",
    justifyContent: "flex-start",
    alignSelf: "stretch",
    gap: 14,
  },
  planPrice: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
    textAlign: "right",
  },
  planPriceMeta: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    textAlign: "right",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginTop: -8,
  },
  radioMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto",
  },
  benefitRow: {
    minHeight: 64,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 12,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  sharedNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderTopWidth: 1,
    marginTop: 32,
    paddingTop: 18,
  },
  sharedText: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  legalBlock: {
    borderTopWidth: 1,
    marginTop: 24,
    paddingTop: 16,
  },
  legalText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
  },
  legalLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  legalLink: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  legalSeparator: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: "700",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: 16,
    paddingBottom: 28,
  },
  primaryButton: {
    height: 58,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    fontFamily: SYSTEM_FONT,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  restoreButton: {
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  restoreText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: "800",
  },
});

export default RevenueCatPaywall;

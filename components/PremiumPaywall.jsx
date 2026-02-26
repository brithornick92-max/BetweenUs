// components/PremiumPaywall.jsx
import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Linking,
} from "react-native";
import Animated, { FadeInDown, FadeIn, FadeInUp } from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { useSubscription } from "../context/SubscriptionContext";
import { useTheme } from "../context/ThemeContext";
import {
  TYPOGRAPHY,
  SPACING,
  BORDER_RADIUS,
  ICON_SIZES,
} from "../utils/theme";
import { getPaywallFeatures, PremiumFeature } from "../utils/featureFlags";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config/supabase";

const PremiumPaywall = ({
  feature = null,
  onSubscribe,
  onClose,
  showCloseButton = true,
}) => {
  const { offerings, purchasePackage, restorePurchases, isLoading } = useSubscription();
  const { colors } = useTheme();
  const [isSubscribing, setIsSubscribing] = useState(false);
  const nav = useNavigation();

  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleSubscribe = async (pkg) => {
    if (isSubscribing || !pkg) return;
    setIsSubscribing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const purchaseResult = await purchasePackage(pkg);
      if (purchaseResult.success && onSubscribe) {
        onSubscribe();
      }
    } catch (error) {
      console.error("Subscription failed:", error);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleRestore = async () => {
    if (isSubscribing) return;
    setIsSubscribing(true);
    try {
      await restorePurchases();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Restore failed:", error);
    } finally {
      setIsSubscribing(false);
    }
  };

  const packages = offerings?.packages || [];
  const monthlyPkg = packages.find((p) => p.packageType === "MONTHLY");
  const yearlyPkg = packages.find((p) => p.packageType === "ANNUAL");
  const lifetimePkg = packages.find((p) => p.packageType === "LIFETIME");

  const premiumFeatures = useMemo(() => {
    const features = getPaywallFeatures();
    const syncAvailable = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
    if (!syncAvailable) {
      return features.filter((feature) => feature.id !== PremiumFeature.CLOUD_SYNC);
    }
    return features;
  }, []);

  const BenefitItem = ({ icon, title, body, index = 0 }) => (
    <Animated.View entering={FadeInDown.delay(200 + index * 80).duration(400)} style={styles.benefitItem}>
      <View style={styles.benefitIconContainer}>
        <Text style={styles.benefitEmoji}>{icon}</Text>
      </View>
      <View style={styles.benefitTextContainer}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitBody}>{body}</Text>
      </View>
    </Animated.View>
  );

  const PricingCard = ({ pkg, title, priceText, subtext, isPopular, index = 0 }) => {
    const isPlanAvailable = !!pkg;
    return (
    <Animated.View
      entering={FadeInUp.delay(100 + index * 120).duration(500).springify().damping(16)}
      style={[
        styles.pricingCard,
        isPopular && styles.pricingCardPopular,
        !isPlanAvailable && styles.pricingCardDisabled,
      ]}
    >
      {isPopular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
        </View>
      )}
      <View style={styles.pricingCardContent}>
        <Text style={styles.pricingCardTitle}>{title}</Text>
        <Text style={styles.pricingCardPrice}>{priceText}</Text>
        <Text style={styles.pricingCardSubtext}>{subtext}</Text>
        <TouchableOpacity
          style={[styles.subscribeButton, (!isPlanAvailable || isLoading) && styles.subscribeButtonDisabled]}
          onPress={() => handleSubscribe(pkg)}
          activeOpacity={0.85}
          disabled={isSubscribing || !isPlanAvailable || isLoading}
        >
          <Text style={styles.subscribeButtonText}>
            {isLoading
              ? "Loading plans..."
              : !isPlanAvailable
                ? "Not available"
                : title === "Lifetime"
                  ? "Unlock forever"
                  : `Start ${title.toLowerCase()}`}
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.header}>
          {showCloseButton && (
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="close"
                size={ICON_SIZES.lg}
                color={colors.text}
              />
            </TouchableOpacity>
          )}
          <Text style={styles.title}>Premium</Text>
          <Text style={styles.subtitle}>
            Protect and grow your love story.
          </Text>
        </Animated.View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What Premium unlocks</Text>

          {premiumFeatures.map((feature, index) => (
            <BenefitItem
              key={feature.id}
              icon={feature.icon}
              title={feature.name}
              body={feature.description}
              index={index}
            />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose your plan</Text>
          {!packages.length && (
            <Text style={styles.planStatusText}>
              {isLoading
                ? "Fetching plans from the store..."
                : "Plans are unavailable right now. Please try again."}
            </Text>
          )}

          <PricingCard
            pkg={monthlyPkg}
            title="Monthly"
            priceText={monthlyPkg?.product?.priceString || "$7.99 / month"}
            subtext="Per couple · both partners included"
            index={0}
          />

          <PricingCard
            pkg={yearlyPkg}
            title="Yearly"
            priceText={yearlyPkg?.product?.priceString || "$49.99 / year"}
            subtext="Most popular · per couple · both partners included"
            isPopular={true}
            index={1}
          />

          <PricingCard
            pkg={lifetimePkg}
            title="Lifetime"
            priceText={
              lifetimePkg?.product?.priceString || "$69.99 one-time"
            }
            subtext="Per couple · both partners included"
            index={2}
          />
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.maybeLaterButton}
            activeOpacity={0.7}
          >
            <Text style={styles.maybeLaterText}>Maybe Later</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleRestore}
            style={styles.restoreButton}
            activeOpacity={0.8}
          >
            <Text style={styles.restoreButtonText}>Restore purchases</Text>
          </TouchableOpacity>

          {/* App Store Required Subscription Disclosure */}
          <Text style={styles.subscriptionDisclosure}>
            Payment will be charged to your Apple ID account at confirmation of purchase.
            Subscription automatically renews unless auto-renew is turned off at least
            24 hours before the end of the current period. Your account will be charged
            for renewal within 24 hours prior to the end of the current period at the
            same price. You can manage your subscriptions and turn off auto-renewal in
            your Account Settings after purchase.
          </Text>
          {(monthlyPkg?.product?.introPrice || yearlyPkg?.product?.introPrice) && (
            <Text style={styles.subscriptionDisclosure}>
              Any unused portion of a free trial period, if offered, will be forfeited
              when you purchase a subscription.
            </Text>
          )}

          {/* Legal Links (App Store Required) */}
          <View style={styles.legalLinks}>
            <TouchableOpacity
              onPress={() => { try { nav.navigate('Terms'); } catch {} }}
              activeOpacity={0.7}
            >
              <Text style={styles.legalLinkText}>Terms of Use</Text>
            </TouchableOpacity>
            <Text style={styles.legalSeparator}>·</Text>
            <TouchableOpacity
              onPress={() => { try { nav.navigate('PrivacyPolicy'); } catch {} }}
              activeOpacity={0.7}
            >
              <Text style={styles.legalLinkText}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.xxxl,
  },
  header: {
    paddingTop: SPACING.xxxl,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxl,
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: SPACING.md,
    left: SPACING.lg,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: colors.surface2,
    zIndex: 10,
  },
  benefitEmoji: {
    fontSize: 22,
  },
  title: {
    fontFamily: Platform.select({
      ios: "Playfair Display",
      android: "PlayfairDisplay_300Light",
    }),
    fontSize: 36,
    fontWeight: "300",
    color: colors.text,
    textAlign: "center",
    marginBottom: SPACING.sm,
    letterSpacing: -0.3,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 16,
    color: colors.text + "AA",
    textAlign: "center",
    lineHeight: 24,
  },
  section: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xxl,
  },
  sectionTitle: {
    ...TYPOGRAPHY.label,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: SPACING.lg,
  },
  planStatusText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: SPACING.md,
  },
  benefitItem: {
    flexDirection: "row",
    marginBottom: SPACING.md + 2,
    alignItems: "center",
    paddingVertical: SPACING.xs,
  },
  benefitIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface2,
    marginRight: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitTextContainer: {
    flex: 1,
  },
  benefitTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 15,
    color: colors.text,
    marginBottom: 4,
  },
  benefitBody: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  pricingCard: {
    backgroundColor: colors.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: SPACING.sm,
    overflow: "hidden",
  },
  pricingCardDisabled: {
    opacity: 0.5,
  },
  pricingCardPopular: {
    borderColor: colors.primary + "60",
    borderWidth: 1.5,
  },
  popularBadge: {
    backgroundColor: colors.primary + "18",
    paddingVertical: 8,
    alignItems: "center",
  },
  popularBadgeText: {
    ...TYPOGRAPHY.label,
    fontSize: 10,
    color: colors.primary,
    letterSpacing: 2,
  },
  pricingCardContent: {
    padding: SPACING.lg,
    alignItems: "center",
  },
  pricingCardTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 17,
    color: colors.text,
    marginBottom: 6,
  },
  pricingCardPrice: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  pricingCardSubtext: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: SPACING.lg,
    textAlign: "center",
  },
  subscribeButton: {
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: BORDER_RADIUS.md,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  subscribeButtonDisabled: {
    backgroundColor: colors.border,
  },
  subscribeButtonText: {
    ...TYPOGRAPHY.button,
    fontSize: 14,
    color: "#FFFFFF",
    letterSpacing: 0.8,
  },
  footer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
    alignItems: "center",
  },
  footerTrustText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: SPACING.md,
    textAlign: "center",
    lineHeight: 18,
  },
  maybeLaterButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginBottom: 4,
  },
  maybeLaterText: {
    ...TYPOGRAPHY.caption,
    fontSize: 15,
    color: colors.textMuted,
  },
  restoreButton: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  restoreButtonText: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: colors.primary,
  },
  subscriptionDisclosure: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 16,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  legalLinks: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  legalLinkText: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: colors.primary,
    textDecorationLine: "underline",
  },
  legalSeparator: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: colors.textMuted,
    marginHorizontal: SPACING.sm,
  },
});

export default PremiumPaywall;

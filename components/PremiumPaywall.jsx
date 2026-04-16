// components/PremiumPaywall.jsx
// Velvet Glass & Apple Editorial High-End Updates Integrated.
// Palette: Deep Crimson, Obsidian, Liquid Silver (Strictly No Gold).
// Free trial language restored for conversion lift.

import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Dimensions,
  StatusBar,
  Alert,
  ActivityIndicator,
} from "react-native";
import Animated, { 
  FadeInDown, 
  FadeIn, 
  FadeInUp,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Icon from './Icon';
import GlowOrb from './GlowOrb';
import FilmGrain from './FilmGrain';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { useNavigation } from "@react-navigation/native";
import { useSubscription } from "../context/SubscriptionContext";
import { useTheme } from "../context/ThemeContext";
import CrashReporting from "../services/CrashReporting";
import AnalyticsService from "../services/AnalyticsService";
import { getPaywallFeatures, PremiumFeature } from "../utils/featureFlags";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config/supabase";

const { width } = Dimensions.get('window');

const PremiumPaywall = ({
  onSubscribe,
  onClose,
  showCloseButton = true,
}) => {
  const { offerings, purchasePackage, restorePurchases, isLoading } = useSubscription();
  const { colors, isDark } = useTheme();
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [selectedTier, setSelectedTier] = useState('ANNUAL');
  const nav = useNavigation();

  // High-End Color Logic (No Gold)
  const theme = useMemo(() => ({
    crimson: '#D2121A',
    silver: isDark ? '#E5E5E7' : '#8E8E93',
    obsidian: '#0A0A0C',
    glass: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
  }), [isDark]);

  const styles = useMemo(() => createStyles(colors, isDark, theme), [colors, isDark, theme]);

  const handleSubscribe = async (pkg) => {
    if (isSubscribing) return;
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
        message = 'Unable to connect to the App Store. Please check your internet connection and try again.';
      }
      Alert.alert('Store Unavailable', message);
      return;
    }
    setIsSubscribing(true);
    try {
      impact(ImpactFeedbackStyle.Medium);
      AnalyticsService.trackPurchase('started', { tier: selectedTier, packageType: pkg?.packageType });
      const purchaseResult = await purchasePackage(pkg);
      if (purchaseResult.success && onSubscribe) {
        AnalyticsService.trackPurchase('completed', { tier: selectedTier, packageType: pkg?.packageType });
        onSubscribe();
      } else if (!purchaseResult.success && !purchaseResult.cancelled) {
        AnalyticsService.trackPurchase('failed', { tier: selectedTier, reason: purchaseResult.error || 'unknown' });
      }
    } catch (error) {
      CrashReporting.captureException(error, { source: 'premium_subscribe', packageType: pkg?.packageType });
      AnalyticsService.trackPurchase('failed', { tier: selectedTier, reason: error?.message || 'exception' });
      Alert.alert('Purchase Failed', 'Something went wrong. Please try again.');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleRestore = async () => {
    if (isSubscribing) return;
    setIsSubscribing(true);
    try {
      AnalyticsService.trackPurchase('restore_started');
      await restorePurchases();
      AnalyticsService.trackPurchase('restore_completed');
      notification(NotificationFeedbackType.Success);
    } catch (error) {
      AnalyticsService.trackPurchase('restore_failed', { reason: error?.message || 'exception' });
      CrashReporting.captureException(error, { source: 'premium_restore' });
    } finally {
      setIsSubscribing(false);
    }
  };

  const packages = offerings?.packages || [];
  const monthlyPkg = packages.find((p) => p.packageType === "MONTHLY");
  const yearlyPkg = packages.find((p) => p.packageType === "ANNUAL");

  const FALLBACK_PRICES = { monthly: '$7.99', yearly: '$49.99' };

  // Detect intro/trial pricing from RevenueCat product metadata
  const trialInfo = useMemo(() => {
    const annualIntro = yearlyPkg?.product?.introPrice;
    const monthlyIntro = monthlyPkg?.product?.introPrice;
    const intro = annualIntro || monthlyIntro;
    if (!intro) return null;
    const period = intro.periodNumberOfUnits;
    const unit = intro.periodUnit === 'DAY' ? 'day' : intro.periodUnit === 'WEEK' ? 'week' : 'month';
    const isFree = intro.price === 0;
    return { period, unit, isFree, priceString: intro.priceString };
  }, [yearlyPkg, monthlyPkg]);

  const FEATURE_IONICONS = {
    [PremiumFeature.UNLIMITED_PROMPTS]: 'flame',
    [PremiumFeature.UNLIMITED_DATE_IDEAS]: 'rose',
    [PremiumFeature.LOVE_NOTES]: 'heart-half',
    [PremiumFeature.NIGHT_RITUAL_MODE]: 'moon',
    [PremiumFeature.CLOUD_SYNC]: 'shield-checkmark',
  };

  const premiumFeatures = useMemo(() => {
    const features = getPaywallFeatures();
    const syncAvailable = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
    return syncAvailable ? features : features.filter((f) => f.id !== PremiumFeature.CLOUD_SYNC);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <LinearGradient
        colors={isDark ? ['#0A0A0C', '#1A0205', '#0A0A0C'] : ['#FFFFFF', '#F9F4F4', '#FFFFFF']}
        style={StyleSheet.absoluteFillObject}
      />
      <GlowOrb color={theme.crimson} size={width * 1.2} top={-200} left={-100} opacity={0.12} />
      <FilmGrain opacity={0.03} />

      {showCloseButton && (
        <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
          <BlurView intensity={20} tint="dark" style={styles.closeBlur}>
            <Icon name="close" size={24} color="#FFF" />
          </BlurView>
        </TouchableOpacity>
      )}

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(800)} style={styles.header}>
          {trialInfo?.isFree && (
            <View style={styles.trialBadge}>
              <Icon name="gift-outline" size={16} color="#FFF" />
              <Text style={styles.trialBadgeText}>
                {trialInfo.period} {trialInfo.unit}{trialInfo.period > 1 ? 's' : ''} free — cancel anytime
              </Text>
            </View>
          )}
          <Text style={[styles.headerEye, { color: theme.crimson, marginTop: trialInfo?.isFree ? 16 : 0 }]}>Elevate Your Connection</Text>
          <Text style={[styles.title, { color: colors.text }]}>Unlock the Full Experience</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Deeper prompts, unlimited date planning, and encrypted intimacy for your most meaningful relationship.
          </Text>
          <View style={styles.socialProofRow}>
            <Icon name="people-outline" size={15} color={theme.crimson} />
            <Text style={[styles.socialProofText, { color: colors.textMuted }]}>
              Joined by 10,000+ couples deepening their connection
            </Text>
          </View>
        </Animated.View>

        <View style={styles.benefitSection}>
          {premiumFeatures.map((f, i) => (
            <BenefitItem
              key={f.id}
              iconName={FEATURE_IONICONS[f.id] || 'sparkles'}
              title={f.name}
              body={f.description}
              index={i}
            />
          ))}
        </View>

        <View style={styles.pricingSection}>
          <PricingOption
            pkg={monthlyPkg}
            title="Monthly"
            price={monthlyPkg?.product?.priceString || FALLBACK_PRICES.monthly}
            subtext="One payment per month"
            index={0}
            onPress={() => { selection(); setSelectedTier('MONTHLY'); }}
            isDisabled={isSubscribing}
            isSelected={selectedTier === 'MONTHLY'}
          />
          <PricingOption
            pkg={yearlyPkg}
            title="Annual"
            price={yearlyPkg?.product?.priceString || FALLBACK_PRICES.yearly}
            subtext="One payment per year"
            isPopular={true}
            index={1}
            onPress={() => { selection(); setSelectedTier('ANNUAL'); }}
            isDisabled={isSubscribing}
            isSelected={selectedTier === 'ANNUAL'}
          />
          <Animated.View entering={FadeIn.delay(800).duration(600)} style={styles.perCoupleWrapper}>
            <Text style={[styles.perCoupleText, { color: colors.textMuted }]}>
              All prices are per couple.
            </Text>
          </Animated.View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore}>
            <Text style={[styles.restoreText, { color: colors.textMuted }]}>Restore Previous Purchases</Text>
          </TouchableOpacity>

          <Text style={[styles.disclosure, { color: colors.textMuted }]}>
            Subscriptions will be charged to your Apple ID. Renewal occurs automatically 24 hours before the end of the period. Manage in Settings.
          </Text>

          <View style={styles.legalRow}>
            <TouchableOpacity onPress={() => nav.navigate('Terms')}>
              <Text style={styles.legalText}>Terms of Service</Text>
            </TouchableOpacity>
            <View style={styles.legalDot} />
            <TouchableOpacity onPress={() => nav.navigate('PrivacyPolicy')}>
              <Text style={styles.legalText}>Privacy Policy</Text>
            </TouchableOpacity>
            <View style={styles.legalDot} />
            <TouchableOpacity onPress={() => nav.navigate('EULA')}>
              <Text style={styles.legalText}>EULA</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <BlurView intensity={30} tint={isDark ? "dark" : "light"} style={styles.bottomBar}>
        <TouchableOpacity 
          style={styles.mainActionBtn} 
          onPress={() => handleSubscribe(
            selectedTier === 'MONTHLY' ? monthlyPkg :
            yearlyPkg || monthlyPkg
          )}
          disabled={isSubscribing}
        >
          <LinearGradient colors={[theme.crimson, '#900C0F']} style={styles.mainActionGrad}>
            {isSubscribing ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.mainActionText}>
                {trialInfo?.isFree ? `Start ${trialInfo.period}-${trialInfo.unit} Free Trial` : 'Unlock Full Access — From $49.99/yr'}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </BlurView>
    </View>
  );
};

const createStyles = (colors, isDark, theme) => StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 160 },
  
  header: {
    paddingTop: 80,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 32,
  },
  headerEye: {
    fontFamily: Platform.select({ ios: 'Lato-Bold', android: 'Lato_700Bold' }),
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  title: {
    fontFamily: Platform.select({ ios: 'DMSerifDisplay-Regular', android: 'serif' }),
    fontSize: 34,
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    opacity: 0.8,
    paddingHorizontal: 10,
  },

  benefitSection: { paddingHorizontal: 24, gap: 24, marginBottom: 40 },
  benefitItem: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  benefitIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTextContainer: { flex: 1 },
  benefitTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, marginBottom: 2 },
  benefitBody: { fontSize: 14, lineHeight: 20, opacity: 0.7 },

  pricingSection: { paddingHorizontal: 24, gap: 12 },
  pricingOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: theme.glass,
    backgroundColor: theme.glass,
  },
  pricingOptionPopular: {
    borderColor: theme.crimson + '40',
    backgroundColor: theme.crimson + '05',
  },
  pricingLeft: { flex: 1 },
  pricingTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  pricingSubtext: { fontSize: 13, marginTop: 2 },
  pricingRight: { alignItems: 'flex-end' },
  pricingPrice: { fontSize: 20, fontWeight: '900' },
  popularTag: {
    backgroundColor: theme.crimson,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  popularTagText: { color: '#FFF', fontSize: 9, fontWeight: '900' },

  perCoupleWrapper: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  perCoupleText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    opacity: 0.6,
  },

  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.crimson,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 4,
  },
  trialBadgeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  socialProofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 8,
  },
  socialProofText: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.75,
    flexShrink: 1,
  },

  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 100,
  },
  closeBlur: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  footer: { paddingHorizontal: 40, marginTop: 40, alignItems: 'center', gap: 16 },
  restoreBtn: { padding: 8 },
  restoreText: { fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  disclosure: { textAlign: 'center', fontSize: 11, lineHeight: 16, opacity: 0.5 },
  legalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legalText: { fontSize: 12, fontWeight: '700', color: theme.crimson },
  legalDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#888' },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderColor: theme.glass,
  },
  mainActionBtn: {
    height: 60,
    borderRadius: 22,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: theme.crimson, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  mainActionGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mainActionText: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
});

// ─── Module-level sub-components (stable references, no remount on parent re-render) ─
const BenefitItem = ({ iconName, title, body, index = 0 }) => {
  const { colors, isDark } = useTheme();
  const theme = useMemo(() => ({
    crimson: '#D2121A',
    silver: isDark ? '#E5E5E7' : '#8E8E93',
    obsidian: '#0A0A0C',
    glass: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
  }), [isDark]);
  const styles = useMemo(() => createStyles(colors, isDark, theme), [colors, isDark, theme]);
  return (
    <Animated.View entering={FadeInDown.delay(300 + index * 60).duration(500)} style={styles.benefitItem}>
      <View style={[styles.benefitIconCircle, { backgroundColor: theme.crimson + '10' }]}>
        <Icon name={iconName} size={20} color={theme.crimson} />
      </View>
      <View style={styles.benefitTextContainer}>
        <Text style={[styles.benefitTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.benefitBody, { color: colors.textMuted }]}>{body}</Text>
      </View>
    </Animated.View>
  );
};

const PricingOption = ({ pkg, title, price, subtext, isPopular, isSelected, index, onPress, isDisabled }) => {
  const { colors, isDark } = useTheme();
  const theme = useMemo(() => ({
    crimson: '#D2121A',
    silver: isDark ? '#E5E5E7' : '#8E8E93',
    obsidian: '#0A0A0C',
    glass: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
  }), [isDark]);
  const styles = useMemo(() => createStyles(colors, isDark, theme), [colors, isDark, theme]);
  return (
    <Animated.View entering={FadeInUp.delay(500 + index * 100).duration(600)}>
      <TouchableOpacity
        onPress={onPress}
        style={[styles.pricingOption, (isPopular || isSelected) && styles.pricingOptionPopular]}
        activeOpacity={0.9}
        disabled={isDisabled}
      >
        <View style={styles.pricingLeft}>
          <Text style={[styles.pricingTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.pricingSubtext, { color: colors.textMuted }]}>{subtext}</Text>
        </View>
        <View style={styles.pricingRight}>
          <Text style={[styles.pricingPrice, { color: isPopular ? theme.crimson : colors.text }]}>{price}</Text>
          {isPopular && (
            <View style={styles.popularTag}>
              <Text style={styles.popularTagText}>SAVINGS</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default PremiumPaywall;

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSubscription } from '../context/SubscriptionContext';
import { useTheme } from '../context/ThemeContext';
import { TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../utils/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PaywallScreen = ({ navigation, onDismiss }) => {
  const { offerings, purchasePackage, restorePurchases, isLoading } = useSubscription();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [purchasing, setPurchasing] = useState(false);

  const features = [
    {
      icon: 'people',
      title: 'Partner Connection',
      description: 'Secure linking with a private couple code & encrypted syncing',
    },
    {
      icon: 'infinite',
      title: 'Unlimited Prompts',
      description: 'All heat levels 1–5, responses, history, favorites & Surprise Me',
    },
    {
      icon: 'mail',
      title: 'Love Notes',
      description: 'Private, encrypted love notes that persist across devices',
    },
    {
      icon: 'calendar',
      title: 'Full Calendar Control',
      description: 'Schedule date nights, anniversaries & special moments',
    },
    {
      icon: 'lock-closed',
      title: 'Privacy & Security',
      description: 'End-to-end encryption, secure cloud sync & encrypted backups',
    },
    {
      icon: 'flame',
      title: 'All 5 Heat Levels',
      description: 'Explore Adventurous and Unrestrained levels',
    },
    {
      icon: 'moon',
      title: 'Night Ritual Mode',
      description: 'Guided bedtime connection rituals',
    },
    {
      icon: 'sparkles',
      title: 'Ongoing Benefits',
      description: 'New prompts, seasonal experiences & premium features over time',
    },
  ];

  const handlePurchase = async (pkg) => {
    try {
      setPurchasing(true);
      const result = await purchasePackage(pkg);

      if (result.success) {
        Alert.alert(
          'Welcome to Premium',
          'You now have full access to all features. Your partner will automatically get premium access too when you link accounts!',
          [
            {
              text: 'Start Exploring',
              onPress: () => {
                if (onDismiss) onDismiss();
                if (navigation) navigation.goBack();
              },
            },
          ]
        );
      } else if (!result.cancelled) {
        Alert.alert(
          'Purchase Failed',
          result.error || 'Something went wrong. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to complete purchase. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      setPurchasing(true);
      const result = await restorePurchases();

      if (result.success && result.isPremium) {
        Alert.alert(
          'Purchases Restored!',
          'Your premium subscription has been restored.',
          [
            {
              text: 'Continue',
              onPress: () => {
                if (onDismiss) onDismiss();
                if (navigation) navigation.goBack();
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'No Purchases Found',
          'We couldn\'t find any previous purchases to restore.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  if (isLoading || !offerings) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading premium options...</Text>
      </View>
    );
  }

  const packages = offerings.packages || [];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              if (onDismiss) onDismiss();
              if (navigation) navigation.goBack();
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>

          <Text style={styles.title}>
            Discover the Full
          </Text>
          <Text style={styles.titleAccent}>
            Experience
          </Text>
          <Text style={styles.subtitle}>
            Private. Intimate. Limitless.
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={styles.iconContainer}>
                <Ionicons name={feature.icon} size={22} color={colors.primary} />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>
                  {feature.title}
                </Text>
                <Text style={styles.featureDescription}>
                  {feature.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Pricing Packages */}
        <View style={styles.packagesContainer}>
          <Text style={styles.sectionLabel}>CHOOSE YOUR PLAN</Text>
          {packages.map((pkg) => {
            const isSelected = selectedPackage?.identifier === pkg.identifier;
            const isPopular = pkg.packageType === 'ANNUAL';

            return (
              <TouchableOpacity
                key={pkg.identifier}
                style={[
                  styles.packageCard,
                  isSelected && styles.packageCardSelected,
                  isPopular && !isSelected && styles.packageCardPopular,
                ]}
                onPress={() => setSelectedPackage(pkg)}
                activeOpacity={0.8}
              >
                {isPopular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>BEST VALUE</Text>
                  </View>
                )}

                <View style={styles.packageHeader}>
                  <Text style={styles.packageTitle}>
                    {pkg.product.title}
                  </Text>
                  <Text style={styles.packagePrice}>
                    {pkg.product.priceString}
                  </Text>
                  <Text style={styles.packageDuration}>
                    {pkg.packageType === 'MONTHLY' && 'per month'}
                    {pkg.packageType === 'ANNUAL' && 'per year'}
                    {pkg.packageType === 'LIFETIME' && 'one-time payment'}
                  </Text>
                </View>

                {pkg.product.introPrice && (
                  <View style={styles.trialBadge}>
                    <Text style={styles.trialText}>
                      {pkg.product.introPrice.priceString} for {pkg.product.introPrice.period}
                    </Text>
                  </View>
                )}

                {isSelected && (
                  <View style={styles.checkmark}>
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Purchase Button */}
        <TouchableOpacity
          style={[
            styles.purchaseButton,
            !selectedPackage && styles.purchaseButtonDisabled,
          ]}
          onPress={() => selectedPackage && handlePurchase(selectedPackage)}
          disabled={!selectedPackage || purchasing}
          activeOpacity={0.85}
        >
          {purchasing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.purchaseButtonText}>
              {selectedPackage ? 'Continue' : 'Select a Plan'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Footer actions & legal */}
        <View style={styles.footerActions}>
          <TouchableOpacity
            style={styles.maybeLaterButton}
            onPress={() => {
              if (onDismiss) onDismiss();
              if (navigation) navigation.goBack();
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.maybeLaterText}>Maybe Later</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
            disabled={purchasing}
            activeOpacity={0.7}
          >
            <Text style={styles.restoreButtonText}>Restore Purchases</Text>
          </TouchableOpacity>
        </View>

        {/* Subscription Disclosure (App Store Required) */}
        <View style={styles.finePrint}>
          <Text style={styles.finePrintText}>
            One subscription covers both partners when linked.
          </Text>
          <Text style={styles.finePrintText}>
            Payment will be charged to your Apple ID account at confirmation of purchase.
            Subscription automatically renews unless auto-renew is turned off at least
            24 hours before the end of the current period. Your account will be charged
            for renewal within 24 hours prior to the end of the current period at the
            same price. You can manage your subscriptions and turn off auto-renewal in
            your Account Settings after purchase.
          </Text>
          {selectedPackage?.product?.introPrice && (
            <Text style={styles.finePrintText}>
              Any unused portion of a free trial period, if offered, will be forfeited
              when you purchase a subscription.
            </Text>
          )}
          <View style={styles.legalLinks}>
            <TouchableOpacity
              onPress={() => {
                if (navigation) navigation.navigate('Terms');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.legalLinkText}>Terms of Use</Text>
            </TouchableOpacity>
            <Text style={styles.legalSeparator}>·</Text>
            <TouchableOpacity
              onPress={() => {
                if (navigation) navigation.navigate('PrivacyPolicy');
              }}
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
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...TYPOGRAPHY.caption,
    color: colors.textMuted,
    marginTop: SPACING.md,
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
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.xl,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  title: {
    fontFamily: Platform.select({
      ios: 'PlayfairDisplay_700Bold',
      android: 'PlayfairDisplay_700Bold',
      default: 'serif',
    }),
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    color: colors.text,
    letterSpacing: -0.3,
  },
  titleAccent: {
    fontFamily: Platform.select({
      ios: 'PlayfairDisplay_700Bold',
      android: 'PlayfairDisplay_700Bold',
      default: 'serif',
    }),
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
    textAlign: 'center',
    color: colors.primary,
    letterSpacing: -0.3,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    color: colors.textSecondary,
  },
  featuresContainer: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xxl,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    backgroundColor: colors.primary + '15',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 3,
    color: colors.text,
  },
  featureDescription: {
    ...TYPOGRAPHY.bodySecondary,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  sectionLabel: {
    ...TYPOGRAPHY.label,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 2.5,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  packagesContainer: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  packageCard: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    position: 'relative',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  packageCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.primary + '08',
  },
  packageCardPopular: {
    borderColor: colors.primary + '40',
  },
  popularBadge: {
    position: 'absolute',
    top: -11,
    right: SPACING.lg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: colors.primary,
  },
  popularText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  packageHeader: {
    alignItems: 'center',
  },
  packageTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
    color: colors.text,
  },
  packagePrice: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 4,
    color: colors.text,
    letterSpacing: -0.3,
  },
  packageDuration: {
    ...TYPOGRAPHY.caption,
    fontSize: 14,
    color: colors.textMuted,
  },
  trialBadge: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    alignSelf: 'center',
    backgroundColor: colors.success + '18',
  },
  trialText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
  },
  checkmark: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
  },
  purchaseButton: {
    marginHorizontal: SPACING.xl,
    paddingVertical: 18,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
    backgroundColor: colors.primary,
  },
  purchaseButtonDisabled: {
    backgroundColor: colors.border,
  },
  purchaseButtonText: {
    ...TYPOGRAPHY.button,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  footerActions: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
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
  },
  restoreButtonText: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: colors.primary,
  },
  finePrint: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxl,
    alignItems: 'center',
  },
  finePrintText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    marginBottom: 6,
    lineHeight: 16,
    color: colors.textMuted,
    textAlign: 'center',
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  legalLinkText: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: colors.textMuted,
    marginHorizontal: SPACING.sm,
  },
});

export default PaywallScreen;

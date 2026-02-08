import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSubscription } from '../context/SubscriptionContext';
import { useTheme } from '../context/ThemeContext';

const PaywallScreen = ({ navigation, onDismiss }) => {
  const { offerings, purchasePackage, restorePurchases, isLoading } = useSubscription();
  const { colors } = useTheme();
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [purchasing, setPurchasing] = useState(false);

  const features = [
    {
      icon: 'infinite',
      title: 'Unlimited Prompts',
      description: 'Access all 582 conversation starters',
    },
    {
      icon: 'flame',
      title: 'All Heat Levels',
      description: 'From sweet to spicy - explore every level',
    },
    {
      icon: 'lock-closed',
      title: 'Private & Encrypted',
      description: 'Your journal entries are end-to-end encrypted',
    },
    {
      icon: 'people',
      title: 'Partner Sharing',
      description: 'One subscription covers both of you',
    },
    {
      icon: 'calendar',
      title: 'Date Night Ideas',
      description: 'Curated experiences for every mood',
    },
    {
      icon: 'heart',
      title: 'Relationship Insights',
      description: 'Track your connection over time',
    },
  ];

  const handlePurchase = async (pkg) => {
    try {
      setPurchasing(true);
      const result = await purchasePackage(pkg);

      if (result.success) {
        Alert.alert(
          '🎉 Welcome to Premium!',
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
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const packages = offerings.packages || [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              if (onDismiss) onDismiss();
              if (navigation) navigation.goBack();
            }}
          >
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>

          <Text style={[styles.title, { color: colors.text }]}>
            Unlock Premium
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Deepen your connection with full access
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name={feature.icon} size={24} color={colors.primary} />
              </View>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: colors.text }]}>
                  {feature.title}
                </Text>
                <Text style={[styles.featureDescription, { color: colors.textSecondary }]}>
                  {feature.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Pricing Packages */}
        <View style={styles.packagesContainer}>
          {packages.map((pkg, index) => {
            const isSelected = selectedPackage?.identifier === pkg.identifier;
            const isPopular = pkg.packageType === 'ANNUAL';

            return (
              <TouchableOpacity
                key={pkg.identifier}
                style={[
                  styles.packageCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => setSelectedPackage(pkg)}
              >
                {isPopular && (
                  <View style={[styles.popularBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.popularText}>BEST VALUE</Text>
                  </View>
                )}

                <View style={styles.packageHeader}>
                  <Text style={[styles.packageTitle, { color: colors.text }]}>
                    {pkg.product.title}
                  </Text>
                  <Text style={[styles.packagePrice, { color: colors.primary }]}>
                    {pkg.product.priceString}
                  </Text>
                  <Text style={[styles.packageDuration, { color: colors.textSecondary }]}>
                    {pkg.packageType === 'MONTHLY' && 'per month'}
                    {pkg.packageType === 'ANNUAL' && 'per year'}
                    {pkg.packageType === 'LIFETIME' && 'one-time payment'}
                  </Text>
                </View>

                {pkg.product.introPrice && (
                  <View style={[styles.trialBadge, { backgroundColor: colors.success + '20' }]}>
                    <Text style={[styles.trialText, { color: colors.success }]}>
                      {pkg.product.introPrice.priceString} for {pkg.product.introPrice.period}
                    </Text>
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
            {
              backgroundColor: selectedPackage ? colors.primary : colors.border,
            },
          ]}
          onPress={() => selectedPackage && handlePurchase(selectedPackage)}
          disabled={!selectedPackage || purchasing}
        >
          {purchasing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.purchaseButtonText}>
              {selectedPackage ? 'Continue' : 'Select a Plan'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Restore Button */}
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestore}
          disabled={purchasing}
        >
          <Text style={[styles.restoreButtonText, { color: colors.primary }]}>
            Restore Purchases
          </Text>
        </TouchableOpacity>

        {/* Fine Print */}
        <View style={styles.finePrint}>
          <Text style={[styles.finePrintText, { color: colors.textSecondary }]}>
            • One subscription covers both partners when linked
          </Text>
          <Text style={[styles.finePrintText, { color: colors.textSecondary }]}>
            • Cancel anytime from your device settings
          </Text>
          <Text style={[styles.finePrintText, { color: colors.textSecondary }]}>
            • Subscriptions auto-renew unless cancelled 24 hours before period ends
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  featuresContainer: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 14,
  },
  packagesContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  packageCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  packageHeader: {
    alignItems: 'center',
  },
  packageTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  packagePrice: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  packageDuration: {
    fontSize: 14,
  },
  trialBadge: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'center',
  },
  trialText: {
    fontSize: 14,
    fontWeight: '600',
  },
  purchaseButton: {
    marginHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  restoreButton: {
    marginHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  restoreButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  finePrint: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  finePrintText: {
    fontSize: 12,
    marginBottom: 4,
    lineHeight: 18,
  },
});

export default PaywallScreen;

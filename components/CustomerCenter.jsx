import React, { useEffect } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, Text } from 'react-native';
import { RevenueCatUI, CUSTOMER_CENTER_ACTION } from 'react-native-purchases-ui';
import { useSubscription } from '../context/SubscriptionContext';
import { useTheme } from '../context/ThemeContext';

/**
 * RevenueCat Customer Center Component
 * Provides subscription management UI for existing subscribers
 * Handles: View subscription, manage billing, cancel, restore, contact support
 */
const CustomerCenter = ({ onDismiss }) => {
  const { checkSubscriptionStatus } = useSubscription();
  const { colors } = useTheme();

  useEffect(() => {
    let removeListener = null;

    const presentAndListen = async () => {
      try {
        // Present RevenueCat's Customer Center
        await RevenueCatUI.presentCustomerCenter();

        // Set up event listener for customer center actions
        removeListener = RevenueCatUI.addCustomerCenterListener((event) => {
          console.log('Customer Center Event:', event);

          switch (event.action) {
            case CUSTOMER_CENTER_ACTION.CANCELLED:
              console.log('User cancelled subscription');
              Alert.alert(
                'Subscription Cancelled',
                'Your subscription has been cancelled. You\'ll continue to have access until the end of your billing period.',
                [{ text: 'OK' }]
              );
              checkSubscriptionStatus();
              break;

            case CUSTOMER_CENTER_ACTION.RESTORED:
              console.log('Purchases restored');
              Alert.alert(
                'Purchases Restored',
                'Your purchases have been restored successfully.',
                [{ text: 'OK' }]
              );
              checkSubscriptionStatus();
              break;

            case CUSTOMER_CENTER_ACTION.REFUND_REQUEST_STARTED:
              console.log('Refund request started');
              break;

            case CUSTOMER_CENTER_ACTION.REFUND_REQUEST_COMPLETED:
              console.log('Refund request completed');
              Alert.alert(
                'Refund Requested',
                'Your refund request has been submitted. You\'ll receive an email confirmation shortly.',
                [{ text: 'OK' }]
              );
              checkSubscriptionStatus();
              break;

            default:
              console.log('Unknown customer center action:', event.action);
          }
        });
      } catch (error) {
        console.error('Failed to present customer center:', error);
        Alert.alert(
          'Error',
          'Failed to load subscription management. Please try again.',
          [{ text: 'OK', onPress: () => { if (onDismiss) onDismiss(); } }]
        );
      }
    };

    presentAndListen();

    return () => {
      if (removeListener) removeListener();
    };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.loadingText, { color: colors.text }]}>
        Loading subscription management...
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
});

export default CustomerCenter;

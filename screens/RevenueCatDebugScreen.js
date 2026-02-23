import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import RevenueCatService from '../services/RevenueCatService';

/**
 * RevenueCat Debug Screen
 * Shows entitlement keys, customer info, and subscription status
 * Use this to find your correct ENTITLEMENT_ID
 */
export default function RevenueCatDebugScreen({ navigation }) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDebugInfo();
  }, []);

  const loadDebugInfo = async () => {
    try {
      setLoading(true);
      setError(null);

      // Initialize RevenueCat
      await RevenueCatService.init();

      // Get customer info
      const { customerInfo, isPremium } = await RevenueCatService.getCustomerInfo();

      // Extract entitlement keys
      const entitlementKeys = Object.keys(customerInfo?.entitlements?.active ?? {});
      
      // Get all entitlements (active and inactive)
      const allEntitlements = customerInfo?.entitlements?.all ?? {};
      const allEntitlementKeys = Object.keys(allEntitlements);

      // Get offerings
      let offerings = null;
      try {
        offerings = await RevenueCatService.getOfferings();
      } catch (e) {
        console.log('Could not load offerings:', e);
      }

      setData({
        isPremium,
        activeEntitlementKeys: entitlementKeys,
        allEntitlementKeys,
        customerInfo,
        offerings,
        currentEntitlementId: 'premium', // From your service
      });
    } catch (err) {
      console.error('Debug screen error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          Loading RevenueCat info...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>Error: {error}</Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.accent }]}
          onPress={loadDebugInfo}
        >
          <Text style={[styles.buttonText, { color: colors.text }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>RevenueCat Debug Info</Text>

        {/* Premium Status */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>Premium Status</Text>
          <Text style={[styles.value, { color: data.isPremium ? colors.success : colors.error }]}>
            {data.isPremium ? '✅ Premium Active' : '❌ Not Premium'}
          </Text>
        </View>

        {/* Current Entitlement ID in Code */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>
            Current ENTITLEMENT_ID in Code
          </Text>
          <Text style={[styles.code, { color: colors.mutedGold }]}>'{data.currentEntitlementId}'</Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            This is what your app is looking for
          </Text>
        </View>

        {/* Active Entitlement Keys */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>
            🔑 Active Entitlement Keys
          </Text>
          {data.activeEntitlementKeys && data.activeEntitlementKeys.length > 0 ? (
            <>
              {(data.activeEntitlementKeys || []).map((key, index) => (
                <Text key={index} style={[styles.code, { color: colors.success }]}> 
                  '{key}'
                </Text>
              ))}
              <Text style={[styles.hint, { color: colors.textSecondary, marginTop: 8 }]}> 
                ⚠️ Update ENTITLEMENT_ID in services/RevenueCatService.js to match one of these
              </Text>
            </>
          ) : (
            <Text style={[styles.value, { color: colors.textSecondary }]}>
              No active entitlements (no subscription purchased yet)
            </Text>
          )}
        </View>

        {/* All Entitlement Keys */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>
            All Entitlement Keys (from Dashboard)
          </Text>
          {data.allEntitlementKeys && data.allEntitlementKeys.length > 0 ? (
            <>
              {(data.allEntitlementKeys || []).map((key, index) => (
                <Text key={index} style={[styles.code, { color: colors.text }]}> 
                  '{key}'
                </Text>
              ))}
            </>
          ) : (
            <Text style={[styles.value, { color: colors.textSecondary }]}>
              No entitlements configured in RevenueCat dashboard
            </Text>
          )}
        </View>

        {/* Offerings */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>Offerings</Text>
          {data.offerings && data.offerings.packages && data.offerings.packages.length > 0 ? (
            <>
              <Text style={[styles.value, { color: colors.success }]}> 
                ✅ {(data.offerings?.packages || []).length} package(s) available
              </Text>
              {(data.offerings?.packages || []).map((pkg, index) => (
                <Text key={index} style={[styles.hint, { color: colors.textSecondary }]}> 
                  • {pkg.identifier}: {pkg.product?.priceString}
                </Text>
              ))}
            </>
          ) : (
            <Text style={[styles.value, { color: colors.error }]}>
              ❌ No offerings available
            </Text>
          )}
        </View>

        {/* Customer ID */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>Customer Info</Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            User ID: {data.customerInfo?.originalAppUserId || 'Anonymous'}
          </Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Active Subscriptions: {data.customerInfo?.activeSubscriptions?.length || 0}
          </Text>
        </View>

        {/* Instructions */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.accent, borderWidth: 2 }]}>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>📋 What to Do</Text>
          <Text style={[styles.instruction, { color: colors.text }]}>
            1. Check "Active Entitlement Keys" above
          </Text>
          <Text style={[styles.instruction, { color: colors.text }]}>
            2. If you see keys listed, copy one (e.g., 'pro')
          </Text>
          <Text style={[styles.instruction, { color: colors.text }]}>
            3. Update ENTITLEMENT_ID in services/RevenueCatService.js
          </Text>
          <Text style={[styles.instruction, { color: colors.text }]}>
            4. If no keys shown, you need to:
          </Text>
          <Text style={[styles.instruction, { color: colors.textSecondary, marginLeft: 16 }]}>
            • Make a test purchase, OR
          </Text>
          <Text style={[styles.instruction, { color: colors.textSecondary, marginLeft: 16 }]}>
            • Check RevenueCat dashboard for entitlement setup
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.accent }]}
          onPress={loadDebugInfo}
        >
          <Text style={[styles.buttonText, { color: colors.text }]}>🔄 Refresh</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.surface }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.buttonText, { color: colors.text }]}>← Back</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  value: {
    fontSize: 16,
    marginBottom: 4,
  },
  code: {
    fontSize: 16,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  hint: {
    fontSize: 14,
    marginBottom: 4,
  },
  instruction: {
    fontSize: 14,
    marginBottom: 8,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
});

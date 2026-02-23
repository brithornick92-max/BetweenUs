import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

/**
 * Terms of Service Screen
 * Displays full terms with accept/decline options for onboarding
 * Or read-only mode when accessed from settings
 */
const TermsScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const { onAccept, showActions = false } = route.params || {};
  const [isLoading, setIsLoading] = useState(false);

  const handleAccept = async () => {
    if (onAccept) {
      setIsLoading(true);
      await onAccept();
      setIsLoading(false);
    }
  };

  const handleDecline = () => {
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Terms of Service</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>Between Us - Terms of Service</Text>
          <Text style={[styles.date, { color: colors.textSecondary }]}>
            Last Updated: February 22, 2026
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>1. Acceptance of Terms</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            By accessing or using Between Us ("the App"), you agree to be bound by these Terms of Service. 
            If you do not agree to these terms, please do not use the App.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>2. Eligibility</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            You must be at least 18 years old to use this App. By using the App, you represent and warrant 
            that you are 18 years of age or older.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>3. Intended Use</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            Between Us is designed for couples who already have a loving foundation and want to deepen their intimacy and 
            connection. The App is NOT intended as a substitute for professional therapy, counseling, or 
            medical guidance. If your relationship needs professional support, please seek qualified help.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>4. User Accounts</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            You are responsible for maintaining the confidentiality of your account credentials. You agree to 
            notify us immediately of any unauthorized use of your account.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>5. Subscription & Payment</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            • Payment is charged to your Apple ID or Google Play account at confirmation of purchase{'\n'}
            • Subscriptions automatically renew unless auto-renew is turned off at least 24 hours before the end of the current period{'\n'}
            • Your account will be charged for renewal within 24 hours prior to the end of the current period{'\n'}
            • You can manage and cancel subscriptions in your device's Account Settings{'\n'}
            • Any unused portion of a free trial is forfeited when you purchase a subscription{'\n'}
            • One subscription covers both partners when accounts are linked{'\n'}
            • Prices: $7.99/month, $49.99/year, $69.99 lifetime{'\n'}
            • EU/UK users may have a 14-day right of withdrawal as provided by Apple/Google store policies
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>6. Privacy & Data</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            Your privacy is important to us. Please review our Privacy Policy to understand how we collect, 
            use, and protect your data. Journal entries are end-to-end encrypted.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>7. Content Guidelines</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            You agree not to use the App to:{'\n'}
            • Share illegal, harmful, or abusive content{'\n'}
            • Harass, threaten, or harm others{'\n'}
            • Violate any laws or regulations{'\n'}
            • Impersonate others or provide false information
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>8. Intellectual Property</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            All content, prompts, and features in the App are owned by Between Us and protected by copyright 
            and intellectual property laws. You may not copy, modify, or distribute our content without permission.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>9. Disclaimer of Warranties</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            The App is provided "as is" without warranties of any kind. We do not guarantee that the App will 
            be error-free, secure, or always available.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>10. Limitation of Liability</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            Between Us shall not be liable for any indirect, incidental, special, or consequential damages 
            arising from your use of the App.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>11. Termination</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            We reserve the right to suspend or terminate your account if you violate these Terms. You may 
            delete your account at any time from the Settings screen.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>12. Changes to Terms</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            We may update these Terms from time to time. Continued use of the App after changes constitutes 
            acceptance of the new Terms.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>13. Contact Us</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            If you have questions about these Terms, please contact us at:{'\n'}
            Email: brittanyapps@outlook.com{'\n'}
            Response time: 24-48 hours
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>14. Governing Law</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            These Terms are governed by the laws of the United States. Any disputes shall be resolved in 
            accordance with applicable law.
          </Text>

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Action Buttons (for onboarding) */}
      {showActions && (
        <View style={[styles.actionContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.declineButton, { borderColor: colors.border }]}
            onPress={handleDecline}
            disabled={isLoading}
          >
            <Text style={[styles.declineText, { color: colors.textSecondary }]}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.acceptButton, { backgroundColor: colors.primary }]}
            onPress={handleAccept}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={[styles.acceptText, { color: colors.text }]}>Accept & Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  date: {
    fontSize: 14,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
  actionContainer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    gap: 12,
  },
  declineButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  declineText: {
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TermsScreen;

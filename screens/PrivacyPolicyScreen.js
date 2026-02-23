import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

/**
 * Privacy Policy Screen
 * Displays full privacy policy
 * Accessible from settings and onboarding
 */
const PrivacyPolicyScreen = ({ navigation }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Privacy Policy</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>Between Us - Privacy Policy</Text>
          <Text style={[styles.date, { color: colors.textSecondary }]}>
            Last Updated: February 22, 2026
          </Text>

          <Text style={[styles.intro, { color: colors.textSecondary }]}>
            Your privacy is critically important to us. This Privacy Policy explains how we collect, use, 
            protect, and share your information when you use Between Us.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>1. Information We Collect</Text>
          
          <Text style={[styles.subTitle, { color: colors.text }]}>Account Information</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            • Email address{'\n'}
            • Partner names (customizable){'\n'}
            • Relationship preferences (heat level, etc.){'\n'}
            • Account creation date
          </Text>

          <Text style={[styles.subTitle, { color: colors.text }]}>Content You Create</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            • Journal entries (end-to-end encrypted){'\n'}
            • Prompt responses{'\n'}
            • Date night plans{'\n'}
            • Custom rituals{'\n'}
            • Shared content with your partner
          </Text>

          <Text style={[styles.subTitle, { color: colors.text }]}>Usage Information</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            • App usage patterns{'\n'}
            • Feature interactions{'\n'}
            • Crash reports{'\n'}
            • Performance data{'\n'}
            • Device information (type, OS version){'\n'}
            • Aggregated analytics events (screen views, feature usage) stored server-side{'\n'}
            • Session replays on error (screen interactions to help fix bugs)
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>2. How We Use Your Information</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            We use your information to:{'\n\n'}
            • Provide and improve the App{'\n'}
            • Personalize your experience{'\n'}
            • Enable partner linking and sharing{'\n'}
            • Process subscription payments{'\n'}
            • Send important updates and notifications{'\n'}
            • Provide customer support{'\n'}
            • Analyze app performance and usage{'\n'}
            • Ensure security and prevent fraud
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>3. End-to-End Encryption</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            Your journal entries are protected with end-to-end encryption. This means:{'\n\n'}
            • Only you and your partner can read your entries{'\n'}
            • We cannot access your encrypted content{'\n'}
            • Encryption keys are stored only on your device{'\n'}
            • Even if our servers are compromised, your entries remain private
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>4. Information Sharing</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            We do NOT sell your personal information. We may share information with:{'\n\n'}
            • Your partner (when you choose to share content){'\n'}
            • Service providers (RevenueCat) who help us operate the App{'\n'}
            • Law enforcement if required by law{'\n'}
            • In connection with a business transfer or acquisition
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>5. Third-Party Services</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            We use the following third-party services:{'\n\n'}
            • Supabase - Cloud data storage and authentication{'\n'}
            • RevenueCat - Subscription management{'\n'}
            • Sentry - Crash reporting, performance monitoring, and session replays (10% of sessions; 100% on error) to help fix bugs. Also powers optional user feedback.{'\n'}
            • Apple/Google - In-app purchases and payments{'\n\n'}
            These services have their own privacy policies and may collect data independently.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>6. Data Retention</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            • Account data: Retained while your account is active{'\n'}
            • Journal entries: Retained until you delete them{'\n'}
            • Usage data: Retained for up to 2 years{'\n'}
            • Deleted data: Permanently removed within 30 days
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>7. Your Rights</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            You have the right to:{'\n\n'}
            • Access your personal data{'\n'}
            • Correct inaccurate data{'\n'}
            • Delete your account and data{'\n'}
            • Export your data{'\n'}
            • Opt out of marketing communications{'\n'}
            • Withdraw consent at any time
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>8. GDPR Compliance (EU Users)</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            If you are in the European Union, you have additional rights under GDPR:{'\n\n'}
            • Right to data portability{'\n'}
            • Right to restriction of processing{'\n'}
            • Right to object to processing{'\n'}
            • Right to lodge a complaint with a supervisory authority
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>9. CCPA Compliance (California Users)</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            If you are a California resident, you have rights under CCPA:{'\n\n'}
            • Right to know what personal information is collected{'\n'}
            • Right to delete personal information{'\n'}
            • Right to opt-out of sale (we don't sell your data){'\n'}
            • Right to non-discrimination for exercising your rights
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>10. Children's Privacy</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            Between Us is not intended for users under 18. We do not knowingly collect information from 
            children. If we learn we have collected data from a child, we will delete it immediately.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>11. Security</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            We implement industry-standard security measures:{'\n\n'}
            • End-to-end encryption for journal entries{'\n'}
            • Secure data transmission (HTTPS/TLS){'\n'}
            • Regular security audits{'\n'}
            • Access controls and authentication{'\n'}
            • Encrypted data storage
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>12. International Data Transfers</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            Your data may be transferred to and processed in countries other than your own. We ensure 
            appropriate safeguards are in place to protect your data.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>13. Changes to This Policy</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            We may update this Privacy Policy from time to time. We will notify you of significant changes 
            via email or in-app notification. Continued use after changes constitutes acceptance.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>14. Contact Us</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            If you have questions about this Privacy Policy or want to exercise your rights:{'\n\n'}
            Email: brittanyapps@outlook.com{'\n'}
            Response time: 24-48 hours{'\n\n'}
            For data deletion requests, please use the "Delete Account" option in Settings.
          </Text>

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>
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
    marginBottom: 16,
  },
  intro: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
});

export default PrivacyPolicyScreen;

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
import { FALLBACK_PRICES } from '../utils/premiumFeatures';

/**
 * Terms of Service Screen
 * Displays full terms with accept/decline options for onboarding
 * Or read-only mode when accessed from settings
 */
const TermsScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors, false);
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
            Last Updated: March 21, 2026
          </Text>

          <Text style={[styles.intro, { color: colors.textSecondary }]}>
            Welcome to Between Us! These Terms of Service ("Terms") govern your use of the Between Us mobile 
            application and related services (collectively, the "Service"). By using Between Us, you agree to these Terms.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>1. Acceptance of Terms</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            By creating an account or using Between Us, you agree to be bound by these Terms and our Privacy Policy. 
            If you don't agree, please don't use the Service.{'\n\n'}
            Age Requirement: You must be at least 18 years old to use Between Us.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>2. Description of Service</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            Between Us is a couples app — where closeness deepens. It helps couples deepen their intimacy and connection through:{'\n\n'}
            • Daily conversation prompts across 5 heat levels{'\n'}
            • Journaling and prompt responses{'\n'}
            • Date night ideas and planning{'\n'}
            • Love notes with optional photo attachments{'\n'}
            • Night rituals and shared routines{'\n'}
            • Relationship memories and milestones{'\n'}
            • Vibe Signals and Moment Signals (real-time mood sharing){'\n'}
            • Inside Jokes vault (shared nicknames, jokes, and rituals){'\n'}
            • Reveal Together (simultaneous answer sharing){'\n'}
            • Energy Matcher and Relationship Climate (personalized content){'\n'}
            • Year Reflection narratives{'\n'}
            • Soft Boundaries (private content control){'\n'}
            • Calendar and event scheduling{'\n'}
            • Biometric app lock (Face ID / Touch ID){'\n\n'}
            Important: Between Us is designed for couples who already have a loving foundation and want to deepen their 
            intimacy and connection. It is not appropriate for couples navigating serious relationship concerns, trust 
            breakdowns, or considering separation. If your relationship needs professional support, please seek 
            qualified counseling or therapy.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>3. Account Registration</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            Account Creation:{'\n'}
            • You must provide accurate information when creating your account{'\n'}
            • You're responsible for maintaining the security of your account{'\n'}
            • You must notify us immediately of any unauthorized access{'\n'}
            • One account per person; accounts cannot be shared{'\n\n'}
            Partner Linking:{'\n'}
            • You can link your account with your partner's account{'\n'}
            • Both partners must consent to linking{'\n'}
            • Either partner can unlink at any time{'\n'}
            • Unlinking does not delete your individual data
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>4. User Content and Privacy</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            Your Content:{'\n'}
            • You retain ownership of all content you create (journal entries, responses, etc.){'\n'}
            • You grant us a limited license to store and display your content to you and your linked partner{'\n'}
            • We use end-to-end encryption to protect your sensitive content{'\n'}
            • We never sell your personal data or content to third parties{'\n\n'}
            Content Guidelines — you agree not to post content that:{'\n'}
            • Is illegal, harmful, or violates others' rights{'\n'}
            • Contains malware or harmful code{'\n'}
            • Harasses, threatens, or abuses others{'\n'}
            • Violates any applicable laws or regulations{'\n\n'}
            Partner Access:{'\n'}
            • Your linked partner can see content you choose to share{'\n'}
            • You control what you share and when{'\n'}
            • You can delete your content at any time{'\n'}
            • Deleting content removes it from both partners' views
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>5. Subscription & Payment</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            Free and Premium Features:{'\n'}
            • Free users may preview a limited selection of read-only prompts (Heat levels 1–3){'\n'}
            • All other features (responding, love notes, calendar, partner connection, cloud sync) require a paid subscription{'\n'}
            • Premium subscription is per couple (both partners get access when linked){'\n\n'}
            Current pricing:{'\n'}
            • Monthly: {FALLBACK_PRICES.monthly}/month{'\n'}
            • Yearly: {FALLBACK_PRICES.yearly}/year{'\n'}
            • Lifetime: {FALLBACK_PRICES.lifetime} one-time payment{'\n'}
            • Prices may change with 30 days notice{'\n\n'}
            Billing:{'\n'}
            • Payment is charged to your Apple ID account at confirmation of purchase{'\n'}
            • Subscriptions automatically renew unless auto-renew is turned off at least 24 hours before the end of the current period{'\n'}
            • Your account will be charged for renewal within 24 hours prior to the end of the current period{'\n'}
            • You can manage and cancel subscriptions in Settings › Apple ID › Subscriptions{'\n'}
            • Any unused portion of a free trial is forfeited when you purchase a subscription{'\n'}
            • Lifetime subscriptions are one-time payments with no renewal{'\n'}
            • EU/UK users may have a 14-day right of withdrawal as provided by Apple store policies{'\n\n'}
            Partner Access:{'\n'}
            • When you subscribe, your linked partner automatically gets premium access{'\n'}
            • If you unlink, your partner loses premium access unless they subscribe separately{'\n'}
            • You retain your premium subscription regardless of linking status{'\n\n'}
            Cancellation:{'\n'}
            • You can cancel monthly or yearly subscriptions anytime through your app store account settings{'\n'}
            • Access to premium features continues until the end of your billing period{'\n'}
            • Lifetime subscriptions cannot be cancelled (one-time payment){'\n'}
            • Your data remains accessible after cancellation{'\n'}
            • You can resubscribe at any time
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>6. Acceptable Use</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            You agree to use Between Us only for its intended purpose: strengthening your relationship with your partner.{'\n\n'}
            You may not:{'\n'}
            • Use the Service for any illegal purpose{'\n'}
            • Attempt to access other users' accounts or data{'\n'}
            • Reverse engineer or attempt to extract source code{'\n'}
            • Use automated systems to access the Service{'\n'}
            • Impersonate others or provide false information{'\n'}
            • Interfere with the Service's operation{'\n'}
            • Use the Service to harm, harass, or exploit others
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>7. Intellectual Property</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            Our Content:{'\n'}
            • All prompts, features, designs, and app content are owned by Between Us{'\n'}
            • You may not copy, modify, or distribute our content{'\n'}
            • Our trademarks and branding are protected{'\n\n'}
            Your Content:{'\n'}
            • You own your journal entries and responses{'\n'}
            • We don't claim ownership of your personal content{'\n'}
            • You can export or delete your content at any time
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>8. Privacy and Data Security</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            Data Protection:{'\n'}
            • We use industry-standard client-side encryption{'\n'}
            • Your sensitive content is encrypted end-to-end{'\n'}
            • We implement security measures to protect your data{'\n'}
            • See our Privacy Policy for complete details{'\n\n'}
            Important: Your encryption keys are stored on your device. If you lose access to your device without 
            having cloud sync enabled, content encrypted with your device-only key may be permanently unrecoverable. 
            We cannot recover encrypted data on your behalf.{'\n\n'}
            Data Retention:{'\n'}
            • We retain your data while your account is active{'\n'}
            • You can request data deletion at any time{'\n'}
            • Some data may be retained for legal compliance{'\n'}
            • Deleted data cannot be recovered
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>9. Disclaimers and Limitations</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            Service Availability:{'\n'}
            • We strive for high uptime but don't guarantee uninterrupted service{'\n'}
            • We may perform maintenance that temporarily affects availability{'\n'}
            • We're not liable for service interruptions{'\n\n'}
            Relationship Advice:{'\n'}
            • Between Us is not a substitute for professional counseling{'\n'}
            • We don't provide medical, therapeutic, or legal advice{'\n'}
            • Prompts are for entertainment and connection purposes{'\n'}
            • If your relationship needs professional support, please seek qualified counseling{'\n\n'}
            Limitation of Liability:{'\n'}
            TO THE MAXIMUM EXTENT PERMITTED BY LAW:{'\n'}
            • We're not liable for indirect, incidental, or consequential damages{'\n'}
            • Our total liability is limited to the amount you paid in the last 12 months{'\n'}
            • We're not responsible for your relationship outcomes{'\n'}
            • We're not liable for data loss due to your actions
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>10. Indemnification</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            You agree to indemnify and hold harmless Between Us and its developers from any claims, damages, 
            losses, or expenses (including legal fees) arising from your use of the App, your violation of 
            these Terms, or your violation of any third-party rights.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>11. Termination</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            By You:{'\n'}
            • You can delete your account at any time{'\n'}
            • Deletion is permanent and cannot be undone{'\n'}
            • Your partner's data remains separate{'\n\n'}
            By Us — we may suspend or terminate your account if you:{'\n'}
            • Violate these Terms{'\n'}
            • Engage in fraudulent activity{'\n'}
            • Abuse or harass others{'\n'}
            • Use the Service illegally{'\n\n'}
            Effect of Termination:{'\n'}
            • Your access to the Service ends immediately{'\n'}
            • Your data will be deleted according to our Privacy Policy{'\n'}
            • Paid subscriptions are non-refundable{'\n'}
            • These Terms survive termination where applicable
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>12. Changes to Terms</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            • We may update these Terms from time to time{'\n'}
            • We'll notify you of material changes via email or app notification{'\n'}
            • Continued use after changes means you accept the new Terms{'\n'}
            • If you don't agree, you should stop using the Service
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>13. Dispute Resolution</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            These Terms are governed by the laws of the United States, without regard to conflict of law principles.{'\n\n'}
            Disputes will be resolved through binding arbitration. You waive the right to a jury trial. Class action 
            lawsuits are not permitted. Arbitration is conducted under the rules of the American Arbitration Association.{'\n\n'}
            You may bring claims in small claims court if they qualify.{'\n\n'}
            If arbitration is not enforceable in your jurisdiction, disputes shall be resolved in the courts 
            of competent jurisdiction in the United States. Nothing in this section limits your statutory 
            rights under applicable consumer protection law.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>14. General Provisions</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            • These Terms and our Privacy Policy constitute the entire agreement between you and Between Us{'\n'}
            • If any provision is found invalid, the remaining provisions remain in effect{'\n'}
            • Our failure to enforce any right doesn't waive that right{'\n'}
            • You may not transfer your rights under these Terms; we may assign ours to a successor{'\n'}
            • We're not liable for delays or failures due to circumstances beyond our control
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>15. Contact Us</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            If you have questions about these Terms:{'\n\n'}
            Email: brittanyapps@outlook.com{'\n'}
            Response time: 24–48 hours
          </Text>

          <Text style={[styles.paragraph, { color: colors.textSecondary, marginTop: 20 }]}>
            By using Between Us, you acknowledge that you've read and understood these Terms, you agree to 
            be bound by them, you're at least 18 years old, and you'll use the Service responsibly and legally.{'\n\n'}
            Thank you for choosing Between Us to strengthen your relationship!
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

const createStyles = (colors, isDark) => StyleSheet.create({
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
    fontWeight: '600',
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
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TermsScreen;

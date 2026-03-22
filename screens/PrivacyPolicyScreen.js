import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
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
            Last Updated: March 21, 2026
          </Text>

          <Text style={[styles.intro, { color: colors.textSecondary }]}>
            Your privacy is critically important to us. This Privacy Policy explains how we collect, use, 
            protect, and share your information when you use Between Us.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>1. Information We Collect</Text>
          
          <Text style={[styles.subTitle, { color: colors.text }]}>Account Information</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            • Email address{'\n'}
            • Display name{'\n'}
            • Partner names (what you call each other){'\n'}
            • Relationship start date (optional){'\n'}
            • Heat level and energy level preferences
          </Text>

          <Text style={[styles.subTitle, { color: colors.text }]}>Content You Create</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            All user-created content is end-to-end encrypted before leaving your device:{'\n\n'}
            • Journal entries{'\n'}
            • Prompt responses{'\n'}
            • Love notes and photo attachments{'\n'}
            • Memories{'\n'}
            • Date night plans and calendar events{'\n'}
            • Rituals and check-ins{'\n'}
            • Vibe signals and moment signals{'\n'}
            • Inside jokes and nicknames{'\n'}
            • Relationship climate selections{'\n'}
            • Soft boundaries preferences{'\n'}
            • Relationship duration{'\n'}
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

          <Text style={[styles.subTitle, { color: colors.text }]}>Device Permissions</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            • Camera and Photo Library: Used for QR code scanning (partner linking) and photo attachments on love notes. Photos are encrypted before upload.{'\n'}
            • Push Notifications: Your device push token is sent to our server to deliver notifications such as partner activity and reminders. You can disable notifications in your device settings at any time.{'\n'}
            • Biometrics (Face ID / Touch ID): Used optionally to lock the app. Biometric data never leaves your device — we only receive a success/failure result from your device's secure enclave. We do not collect, store, or transmit biometric data.
          </Text>

          <Text style={[styles.subTitle, { color: colors.text }]}>On-Device Storage</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            The app stores data locally on your device for offline access:{'\n\n'}
            • An encrypted SQLite database containing your content{'\n'}
            • Preferences and settings in local storage{'\n'}
            • Encryption keys and credentials in your device's secure Keychain
          </Text>

          <Text style={[styles.subTitle, { color: colors.text }]}>Information We Don't Collect</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            We never collect:{'\n'}
            • Your sexual orientation{'\n'}
            • Precise location data{'\n'}
            • Contact lists{'\n'}
            • Photos or media (unless you explicitly attach them){'\n'}
            • Biometric data (authentication happens entirely within your device's secure hardware){'\n'}
            • Financial information (handled by Apple)
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
            All user-created content (journals, prompts, love notes, memories, rituals, check-ins, vibes, inside jokes, and more) is protected with end-to-end encryption using industry-standard cryptography (XSalsa20-Poly1305 with X25519 key exchange).{'\n\n'}
            • Private entries are encrypted with a key only you hold — not even your partner can read them{'\n'}
            • Shared entries are encrypted with a couple key derived between both partners' devices — only you and your partner can decrypt them{'\n'}
            • We cannot access your encrypted content{'\n'}
            • Encryption keys are stored in your device's secure hardware keychain{'\n'}
            • Even if our servers are compromised, your content remains private{'\n\n'}
            Important: If you lose access to your device without having cloud sync enabled, content encrypted with your device-only key may be permanently unrecoverable.{'\n\n'}
            Note: Some metadata (such as timestamps, event types, mood labels, and heat-level preferences) is stored without end-to-end encryption so we can provide features like filtering, sorting, and calendar scheduling. This metadata is still protected by TLS in transit and access controls at rest.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>4. Information Sharing</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            We do NOT sell your personal information. We may share information with:{'\n\n'}
            • Your partner (when you choose to share content){'\n'}
            • Service providers who help us operate the App (see Third-Party Services below){'\n'}
            • Law enforcement if required by law (we'll notify you unless legally prohibited){'\n'}
            • In connection with a business transfer or acquisition{'\n\n'}
            We never share your data with advertisers, data brokers, marketing companies, or social media platforms.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>5. Third-Party Services</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            We use the following third-party services:{'\n\n'}
            • Supabase - Cloud data storage and authentication{'\n'}
            • RevenueCat - Subscription management{'\n'}
            • Sentry - Crash reporting, performance monitoring, and session replays (10% of sessions; 100% on error) to help fix bugs. Also powers optional user feedback.{'\n'}
            • Expo - Push notification delivery and over-the-air updates{'\n'}
            • Apple - In-app purchases and payments{'\n\n'}
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

          <Text style={[styles.sectionTitle, { color: colors.text }]}>8. GDPR Compliance (EU/UK Users)</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            If you are in the European Union or UK, you have additional rights under GDPR:{'\n\n'}
            • Right to access your personal data{'\n'}
            • Right to rectification of inaccurate data{'\n'}
            • Right to erasure{'\n'}
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

          <Text style={[styles.sectionTitle, { color: colors.text }]}>10. Tracking & Advertising</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            Between Us does not track you across other apps or websites. We do not use advertising identifiers, and we do not serve ads. We do not participate in any ad networks or data brokers.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>11. Children's Privacy</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            Between Us is not for children. You must be 18+ to use the app. We do not knowingly collect 
            information from minors. If we discover underage use, we will delete the account immediately.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>12. Security</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            We implement industry-standard security measures:{'\n\n'}
            • End-to-end encryption for journal entries{'\n'}
            • Secure data transmission (HTTPS/TLS){'\n'}
            • Regular security audits{'\n'}
            • Access controls and authentication{'\n'}
            • Encrypted data storage
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>13. International Data Transfers</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            Our servers are located in the United States. Your data may be transferred internationally. 
            We use standard contractual clauses and ensure your data receives the same protection everywhere.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>14. Changes to This Policy</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            We may update this Privacy Policy from time to time. We will notify you of significant changes 
            via email or in-app notification. Continued use after changes constitutes acceptance.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>15. Your Choices</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            You control your privacy:{'\n\n'}
            Minimize data collection:{'\n'}
            • Skip optional fields (e.g., relationship start date){'\n'}
            • Disable notifications{'\n\n'}
            Protect your account:{'\n'}
            • Use a strong, unique password{'\n'}
            • Enable device security (passcode, biometrics){'\n'}
            • Don't share your login credentials{'\n\n'}
            Manage sharing:{'\n'}
            • Choose what to share with your partner{'\n'}
            • Keep entries private{'\n'}
            • Unlink when needed
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>16. Contact Us</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            If you have questions about this Privacy Policy or want to exercise your rights:{'\n\n'}
            Email: brittanyapps@outlook.com{'\n'}
            Response time: Within 30 days for data requests{'\n\n'}
            For data deletion requests, please use the "Delete Account" option in Settings.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>17. Transparency Report</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            We believe in transparency. We publish an annual report on government data requests, account terminations, security incidents, and privacy improvements.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>18. Privacy by Design</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            Our principles:{'\n\n'}
            1. Data Minimization — We only collect what's necessary{'\n'}
            2. Purpose Limitation — Data used only for stated purposes{'\n'}
            3. Storage Limitation — Data deleted when no longer needed{'\n'}
            4. Accuracy — You can correct your data anytime{'\n'}
            5. Integrity — Strong security measures protect your data{'\n'}
            6. Confidentiality — End-to-end encryption for intimate content{'\n'}
            7. Accountability — We're responsible for protecting your privacy
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Summary</Text>
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            What we do:{'\n'}
            ✅ Encrypt your intimate content{'\n'}
            ✅ Process data on your device{'\n'}
            ✅ Give you full control{'\n'}
            ✅ Never sell your data{'\n'}
            ✅ Respect your privacy{'\n\n'}
            What we don't do:{'\n'}
            ❌ Sell your data{'\n'}
            ❌ Share with advertisers{'\n'}
            ❌ Track you across apps{'\n'}
            ❌ Read your encrypted content{'\n'}
            ❌ Collect unnecessary information
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
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 42,
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

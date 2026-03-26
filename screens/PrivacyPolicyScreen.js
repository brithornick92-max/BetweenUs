import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Icon from '../components/Icon';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';
import { selection } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { SUPPORT_EMAIL, DATA_REQUEST_RESPONSE_TIME } from '../config/constants';

const { width: SCREEN_W } = Dimensions.get('window');
const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });

/**
 * Privacy Policy Screen
 * Velvet Glass & Apple Editorial High-End Updates Integrated.
 * Palette: Deep Crimson, Obsidian, Liquid Silver (Strictly No Gold).
 */
const PrivacyPolicyScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();

  // High-End Color Logic (No Gold)
  const theme = useMemo(() => ({
    crimson: '#D2121A',
    silver: isDark ? '#E5E5E7' : '#8E8E93',
    obsidian: '#0A0A0C',
    glass: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
    glassBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  }), [isDark]);

  const styles = useMemo(() => createStyles(colors, isDark, theme), [colors, isDark, theme]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={isDark ? [theme.obsidian, '#1A0205', theme.obsidian] : ['#FFFFFF', '#F9F4F4', '#FFFFFF']}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Crimson Ambient Glow */}
      <GlowOrb color={theme.crimson} size={400} top={-100} left={SCREEN_W - 250} opacity={0.08} />
      <GlowOrb color={theme.silver} size={300} top={800} left={-100} opacity={isDark ? 0.04 : 0.08} />
      <FilmGrain opacity={0.035} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Editorial Top Navigation */}
        <View style={styles.navHeader}>
          <TouchableOpacity
            onPress={() => {
              selection();
              navigation.goBack();
            }}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Icon name="chevron-back" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* Editorial Header Block */}
          <Animated.View entering={FadeIn.duration(800)} style={styles.introSection}>
            <Text style={[styles.headerEye, { color: theme.crimson }]}>SECURITY & TRUST</Text>
            <Text style={[styles.title, { color: colors.text }]}>Privacy Policy</Text>
            <Text style={[styles.date, { color: colors.textMuted || 'gray' }]}>
              Last Updated: March 26, 2026
            </Text>
            <Text style={[styles.intro, { color: colors.text }]}>
              Your privacy is critically important to us. This Privacy Policy explains how we collect, use, 
              protect, and share your information when you use Between Us.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(800)} style={styles.documentBody}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              <Text style={{ color: theme.crimson }}>1.</Text> Information We Collect
            </Text>
            
            <Text style={[styles.subTitle, { color: colors.text }]}>Account Information</Text>
            <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
              • Email address{'\n'}
              • Display name{'\n'}
              • Partner names (what you call each other){'\n'}
              • Relationship start date (optional){'\n'}
              • Heat level and energy level preferences
            </Text>

            <Text style={[styles.subTitle, { color: colors.text }]}>Content You Create</Text>
            <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
              We protect different categories of content in different ways:{'\n\n'}
              • Journal entries, prompt responses, love notes, and memories are encrypted before any premium cloud sync{'\n'}
              • Photo attachments are encrypted before upload{'\n'}
              • Some preferences and sensitive controls stay only on your device{'\n'}
              • Some metadata used for filtering, sorting, and scheduling is protected but not end-to-end encrypted{'\n'}
              • Shared content is only visible to your linked partner when you choose to share it
            </Text>

            <Text style={[styles.subTitle, { color: colors.text }]}>Usage Information</Text>
            <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
              • App usage patterns{'\n'}
              • Feature interactions{'\n'}
              • Crash reports{'\n'}
              • Performance data{'\n'}
              • Device information (type, OS version){'\n'}
              • Aggregated analytics events (screen views, feature usage) stored server-side{'\n'}
              • Session replays on a limited sample of sessions (10%) and on sessions where an error occurs to help fix bugs
            </Text>

            <Text style={[styles.subTitle, { color: colors.text }]}>Device Permissions</Text>
            <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
              • Camera and Photo Library: Used for QR code scanning (partner linking) and photo attachments on love notes. Photos are encrypted before upload.{'\n'}
              • Push Notifications: Your device push token is sent to our server to deliver notifications such as partner activity and reminders. You can disable notifications in your device settings at any time.{'\n'}
              • Biometrics (Face ID / Touch ID): Used optionally to lock the app. Biometric data never leaves your device — we only receive a success/failure result from your device's secure enclave. We do not collect, store, or transmit biometric data.
            </Text>

            <Text style={[styles.subTitle, { color: colors.text }]}>On-Device Storage</Text>
            <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
              The app stores data locally on your device for offline access:{'\n\n'}
              • An encrypted SQLite database containing your content{'\n'}
              • Preferences and settings in local storage{'\n'}
              • Encryption keys and credentials in your device's secure Keychain
            </Text>

            <Text style={[styles.subTitle, { color: colors.text }]}>Information We Don't Collect</Text>
            <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
              We never collect:{'\n'}
              • Your sexual orientation{'\n'}
              • Precise location data{'\n'}
              • Contact lists{'\n'}
              • Photos or media (unless you explicitly attach them){'\n'}
              • Biometric data (authentication happens entirely within your device's secure hardware){'\n'}
              • Financial information (handled by Apple)
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              <Text style={{ color: theme.crimson }}>2.</Text> How We Use Your Information
            </Text>
            <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
              We use your information to:{'\n\n'}
              • Provide and improve the App{'\n'}
              • Personalize your experience{'\n'}
              • Enable free partner linking and optional couple sharing{'\n'}
              • Process subscription payments{'\n'}
              • Send important updates and notifications{'\n'}
              • Provide customer support{'\n'}
              • Analyze app performance and usage{'\n'}
              • Ensure security and prevent fraud
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              <Text style={{ color: theme.crimson }}>3.</Text> End-to-End Encryption
            </Text>
            <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
              Between Us protects different kinds of content in different ways. Shared synced content uses client-side encryption with your couple key, while device-only content stays encrypted locally on your phone.{'\n\n'}
              • Private entries use a key only your device holds unless you explicitly share or sync them{'\n'}
              • Shared entries such as synced journals, prompt responses, memories, and love notes are encrypted with a couple key derived between both partners' devices{'\n'}
              • Device-only features such as soft boundaries, inside jokes, relationship climate, and year reflections stay local unless the feature explicitly says otherwise{'\n'}
              • We cannot read content protected by your device-only or couple encryption keys{'\n'}
              • Encryption keys are stored in your device's secure hardware keychain when available{'\n\n'}
              Important: If you lose access to your device without having cloud sync enabled, content encrypted with your device-only key may be permanently unrecoverable.{'\n\n'}
              Note: Some metadata (such as timestamps, event types, mood labels, and heat-level preferences) is stored without end-to-end encryption so we can provide features like filtering, sorting, scheduling, and delivery. This metadata is still protected by TLS in transit and access controls at rest.
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              <Text style={{ color: theme.crimson }}>4.</Text> Information Sharing
            </Text>
            <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
              We do NOT sell your personal information. We may share information with:{'\n\n'}
              • Your partner (when you choose to share content){'\n'}
              • Service providers who help us operate the App (see Third-Party Services below){'\n'}
              • Law enforcement if required by law (we'll notify you unless legally prohibited){'\n'}
              • In connection with a business transfer or acquisition{'\n\n'}
              We never share your data with advertisers, data brokers, marketing companies, or social media platforms.
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              <Text style={{ color: theme.crimson }}>5.</Text> Third-Party Services
            </Text>
            <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
              We use the following third-party services:{'\n\n'}
              • Supabase - Authentication, partner linking, and optional premium cloud sync{'\n'}
              • RevenueCat - Subscription management{'\n'}
              • Sentry - Crash reporting, performance monitoring, and session replays (10% of sessions; 100% on error) to help fix bugs. Also powers optional user feedback.{'\n'}
              • Expo - Push notification delivery and over-the-air updates{'\n'}
              • Apple - In-app purchases and payments{'\n\n'}
              These services have their own privacy policies and may collect data independently.
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              <Text style={{ color: theme.crimson }}>6.</Text> Data Retention
            </Text>
            <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
              • Account data: Retained while your account is active{'\n'}
              • Journal entries and linked-partner metadata: Retained until you delete them or remove access through unlinking or account deletion{'\n'}
              • Usage data: Retained for up to 2 years{'\n'}
              • Deleted data: Removed from active systems promptly; backup purge may take longer
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              <Text style={{ color: theme.crimson }}>7.</Text> Your Rights
            </Text>
            <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
              You have the right to:{'\n\n'}
              • Access your personal data{'\n'}
              • Correct inaccurate data{'\n'}
              • Delete your account and data{'\n'}
              • Export your data{'\n'}
              • Disable optional notifications{'\n'}
              • Withdraw consent at any time
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              <Text style={{ color: theme.crimson }}>8.</Text> GDPR Compliance (EU/UK)
            </Text>
            <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
              If you are in the European Union or UK, you have additional rights under GDPR:{'\n\n'}
              • Right to access your personal data{'\n'}
              • Right to rectification of inaccurate data{'\n'}
              • Right to erasure{'\n'}
              • Right to data portability{'\n'}
              • Right to restriction of processing{'\n'}
              • Right to object to processing{'\n'}
              • Right to lodge a complaint with a supervisory authority
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              <Text style={{ color: theme.crimson }}>9.</Text> CCPA Compliance (California)
            </Text>
            <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
              If you are a California resident, you have rights under CCPA:{'\n\n'}
              • Right to know what personal information is collected{'\n'}
              • Right to delete personal information{'\n'}
              • Right to opt-out of sale (we don't sell your data){'\n'}
              • Right to non-discrimination for exercising your rights
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              <Text style={{ color: theme.crimson }}>10.</Text> Tracking & Advertising
            </Text>
            <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
              Between Us does not track you across other apps or websites. We do not use advertising identifiers, and we do not serve ads. We do not participate in any ad networks or data brokers.
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              <Text style={{ color: theme.crimson }}>11.</Text> Children's Privacy
            </Text>
            <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
              Between Us is not for children. You must be 18+ to use the app. We do not knowingly collect 
              information from minors. If we discover underage use, we will delete the account immediately.
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              <Text style={{ color: theme.crimson }}>12.</Text> Security
            </Text>
            <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
              We implement industry-standard security measures:{'\n\n'}
              • End-to-end encryption for journal entries{'\n'}
              • Secure data transmission (HTTPS/TLS){'\n'}
              • Regular security audits{'\n'}
              • Access controls and authentication{'\n'}
              • Encrypted data storage
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              <Text style={{ color: theme.crimson }}>13.</Text> International Transfers
            </Text>
            <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
              Our servers are located in the United States. Your data may be transferred internationally. 
              We use standard contractual clauses and ensure your data receives the same protection everywhere.
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              <Text style={{ color: theme.crimson }}>14.</Text> Changes to This Policy
            </Text>
            <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
              We may update this Privacy Policy from time to time. We will notify you of significant changes 
              via email or in-app notification. Continued use after changes constitutes acceptance.
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              <Text style={{ color: theme.crimson }}>15.</Text> Your Choices
            </Text>
            <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
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

            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              <Text style={{ color: theme.crimson }}>16.</Text> Contact Us
            </Text>
            <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
              If you have questions about this Privacy Policy or want to exercise your rights:{'\n\n'}
              Email: {SUPPORT_EMAIL}{'\n'}
              Response time: {DATA_REQUEST_RESPONSE_TIME} for data requests{'\n\n'}
              For data deletion requests, please use the "Delete Account" option in Settings.
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              <Text style={{ color: theme.crimson }}>17.</Text> Transparency Report
            </Text>
            <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
              We believe in transparency. We publish an annual report on government data requests, account terminations, security incidents, and privacy improvements.
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              <Text style={{ color: theme.crimson }}>18.</Text> Privacy by Design
            </Text>
            <Text style={[styles.paragraph, { color: colors.textMuted || 'gray', marginBottom: 30 }]}>
              Our principles:{'\n\n'}
              1. Data Minimization — We only collect what's necessary{'\n'}
              2. Purpose Limitation — Data used only for stated purposes{'\n'}
              3. Storage Limitation — Data deleted when no longer needed{'\n'}
              4. Accuracy — You can correct your data anytime{'\n'}
              5. Integrity — Strong security measures protect your data{'\n'}
              6. Confidentiality — End-to-end encryption for intimate content{'\n'}
              7. Accountability — We're responsible for protecting your privacy
            </Text>
          </Animated.View>

          {/* Velvet Glass Summary Card */}
          <Animated.View entering={FadeInDown.delay(400).duration(800)}>
            <BlurView intensity={isDark ? 30 : 50} tint={isDark ? "dark" : "light"} style={[styles.summaryCard, { borderColor: theme.glassBorder }]}>
              <Text style={[styles.summaryTitle, { color: colors.text }]}>The Bottom Line</Text>
              
              <View style={styles.summaryGrid}>
                <View style={styles.summaryColumn}>
                  <Text style={[styles.summaryColTitle, { color: colors.text }]}>What we do</Text>
                  <View style={styles.summaryRow}><Icon name="checkmark-circle" size={16} color="#34C759" /><Text style={[styles.summaryItem, { color: colors.textMuted || 'gray' }]}>Encrypt intimate content</Text></View>
                  <View style={styles.summaryRow}><Icon name="checkmark-circle" size={16} color="#34C759" /><Text style={[styles.summaryItem, { color: colors.textMuted || 'gray' }]}>Process data on device</Text></View>
                  <View style={styles.summaryRow}><Icon name="checkmark-circle" size={16} color="#34C759" /><Text style={[styles.summaryItem, { color: colors.textMuted || 'gray' }]}>Give you full control</Text></View>
                </View>

                <View style={styles.summaryColumn}>
                  <Text style={[styles.summaryColTitle, { color: colors.text }]}>What we don't do</Text>
                  <View style={styles.summaryRow}><Icon name="close-circle" size={16} color={theme.crimson} /><Text style={[styles.summaryItem, { color: colors.textMuted || 'gray' }]}>Sell your data</Text></View>
                  <View style={styles.summaryRow}><Icon name="close-circle" size={16} color={theme.crimson} /><Text style={[styles.summaryItem, { color: colors.textMuted || 'gray' }]}>Share with advertisers</Text></View>
                  <View style={styles.summaryRow}><Icon name="close-circle" size={16} color={theme.crimson} /><Text style={[styles.summaryItem, { color: colors.textMuted || 'gray' }]}>Read encrypted content</Text></View>
                </View>
              </View>
            </BlurView>
          </Animated.View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const createStyles = (colors, isDark, theme) => StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  
  navHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  backButton: { 
    width: 44, 
    height: 44, 
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: theme.glass,
  },

  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16 },

  introSection: { marginBottom: 30 },
  headerEye: {
    fontFamily: Platform.select({ ios: 'Lato-Bold', android: 'Lato_700Bold' }),
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontFamily: SYSTEM_FONT,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1.5,
    marginBottom: 8,
  },
  date: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 24,
    textTransform: 'uppercase',
  },
  intro: {
    fontFamily: SYSTEM_FONT,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '500',
    opacity: 0.9,
  },

  documentBody: {
    paddingBottom: 20,
  },
  sectionTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 32,
    marginBottom: 12,
  },
  subTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '500',
    marginBottom: 16,
    opacity: 0.85,
  },

  summaryCard: {
    borderRadius: 28,
    borderWidth: 1.5,
    padding: 24,
    overflow: 'hidden',
    marginTop: 10,
  },
  summaryTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 20,
    textAlign: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  summaryColumn: {
    flex: 1,
    gap: 12,
  },
  summaryColTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  summaryItem: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    flex: 1,
    opacity: 0.9,
  },
});

export default PrivacyPolicyScreen;

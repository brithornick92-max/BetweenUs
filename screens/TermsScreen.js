/**
 * TermsScreen — Shared sanctuary guidelines
 * Velvet Glass & Apple Editorial High-End Updates Integrated.
 * Palette: Deep Crimson, Obsidian, Liquid Silver (Strictly No Gold).
 * ✅ Full original logic and legal content preserved.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
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
import { FALLBACK_PRICES } from '../utils/premiumFeatures';
import { SUPPORT_EMAIL, SUPPORT_RESPONSE_TIME } from '../config/constants';

const { width: SCREEN_W } = Dimensions.get('window');
const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });

const TermsScreen = ({ navigation, route }) => {
  const { colors, isDark } = useTheme();
  const { onAccept, showActions = false } = route.params || {};
  const [isLoading, setIsLoading] = useState(false);

  // High-End Color Logic (No Gold)
  const theme = useMemo(() => ({
    crimson: '#D2121A',
    silver: isDark ? '#E5E5E7' : '#8E8E93',
    obsidian: '#0A0A0C',
    glass: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
    glassBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  }), [isDark]);

  const styles = useMemo(() => createStyles(colors, isDark, theme), [colors, isDark, theme]);

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

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Editorial Header Block */}
          <Animated.View entering={FadeIn.duration(800)} style={styles.introSection}>
            <Text style={[styles.headerEye, { color: theme.crimson }]}>RULES OF ENGAGEMENT</Text>
            <Text style={[styles.title, { color: colors.text }]}>Terms of Service</Text>
            <Text style={[styles.date, { color: colors.textMuted || 'gray' }]}>
              EFFECTIVE: APRIL 6, 2026
            </Text>
            <Text style={[styles.intro, { color: colors.text }]}>
              Welcome to Between Us. These Terms of Service ("Terms") govern your use of the Between Us mobile
              application and related services (collectively, the "Service"). By using Between Us, you agree to these Terms.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(800)} style={styles.documentBody}>
            {/* 1. Acceptance of Terms */}
            <View style={[styles.section, { borderTopColor: theme.glassBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                <Text style={{ color: theme.crimson }}>1.</Text> Acceptance of Terms
              </Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
                By creating an account or using Between Us, you agree to be bound by these Terms and our Privacy Policy.
                If you don't agree, please don't use the Service.{'\n\n'}
                Age Requirement: You must be at least 18 years old to use Between Us.
              </Text>
            </View>

            {/* 2. Description of Service */}
            <View style={[styles.section, { borderTopColor: theme.glassBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                <Text style={{ color: theme.crimson }}>2.</Text> Description of Service
              </Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
                Between Us is a couples app — where closeness deepens. It helps couples deepen their intimacy and connection through:{'\n\n'}
                • Daily conversation prompts across 5 heat levels{'\n'}
                • Journaling and prompt responses{'\n'}
                • Date night ideas and planning{'\n'}
                • Love notes with optional photo attachments{'\n'}
                • Night rituals and shared routines{'\n'}
                • Relationship memories and milestones{'\n'}
                • Vibe Signals and Moment Signals (mood sharing when connected){'\n'}
                • Inside Jokes vault (private nicknames, jokes, and rituals){'\n'}
                • Reveal Together (simultaneous answer sharing){'\n'}
                • Energy Matcher and Relationship Climate (personalized content){'\n'}
                • Year Reflection narratives{'\n'}
                • Soft Boundaries (private content control){'\n'}
                • Calendar and event scheduling{'\n'}
                • Biometric app lock (Face ID / Touch ID)
              </Text>
              <View style={[styles.importantNote, { backgroundColor: theme.crimson + '10', borderColor: theme.crimson + '30' }]}>
                <Text style={[styles.paragraph, { color: colors.text, fontWeight: '700', marginBottom: 0 }]}>
                  Important: Between Us is designed for thriving couples only. It is not appropriate
                  for couples navigating serious concerns, trust breakdowns, or considering separation. If your relationship
                  needs professional support, please seek qualified counseling or therapy.
                </Text>
              </View>
            </View>

            {/* 3. Account Registration */}
            <View style={[styles.section, { borderTopColor: theme.glassBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                <Text style={{ color: theme.crimson }}>3.</Text> Account Registration
              </Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
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
            </View>

            {/* 4. User Content and Privacy */}
            <View style={[styles.section, { borderTopColor: theme.glassBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                <Text style={{ color: theme.crimson }}>4.</Text> User Content and Privacy
              </Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
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
            </View>

            {/* 5. Subscription & Payment */}
            <View style={[styles.section, { borderTopColor: theme.glassBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                <Text style={{ color: theme.crimson }}>5.</Text> Subscription & Payment
              </Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
                Free and Premium Features:{'\n'}
                • Free users can answer 1 guided prompt per day at Heat levels 1–3{'\n'}
                • Free users can link with a partner and fully plan 1 date per week{'\n'}
                • Premium adds unlimited date planning, love notes, calendar features, and secure cloud sync{'\n'}
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
                • Lifetime subscriptions are one-time payments with no renewal{'\n'}
                • Depending on your location, you may have additional cancellation or withdrawal rights under applicable law and App Store policies{'\n\n'}
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
            </View>

            {/* 6. Acceptable Use */}
            <View style={[styles.section, { borderTopColor: theme.glassBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                <Text style={{ color: theme.crimson }}>6.</Text> Acceptable Use
              </Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
                You agree to use Between Us only for its intended purpose: deepening your connection and bond with your partner.{'\n\n'}
                You may not:{'\n'}
                • Use the Service for any illegal purpose{'\n'}
                • Attempt to access other users' accounts or data{'\n'}
                • Reverse engineer or attempt to extract source code{'\n'}
                • Use automated systems to access the Service{'\n'}
                • Impersonate others or provide false information{'\n'}
                • Interfere with the Service's operation{'\n'}
                • Use the Service to harm, harass, or exploit others
              </Text>
            </View>

            {/* 7. Intellectual Property */}
            <View style={[styles.section, { borderTopColor: theme.glassBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                <Text style={{ color: theme.crimson }}>7.</Text> Intellectual Property
              </Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
                Our Content:{'\n'}
                • All prompts, features, designs, and app content are owned by Between Us{'\n'}
                • You may not copy, modify, or distribute our content{'\n'}
                • Our trademarks and branding are protected{'\n\n'}
                Your Content:{'\n'}
                • You own your journal entries and responses{'\n'}
                • We don't claim ownership of your personal content{'\n'}
                • You can export or delete your content at any time
              </Text>
            </View>

            {/* 8. Privacy and Data Security */}
            <View style={[styles.section, { borderTopColor: theme.glassBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                <Text style={{ color: theme.crimson }}>8.</Text> Privacy and Data Security
              </Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
                Data Protection:{'\n'}
                • We use industry-standard client-side encryption{'\n'}
                • Shared sensitive content is encrypted before sync, and some private content remains encrypted only on your device{'\n'}
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
            </View>

            {/* 9. Disclaimers and Limitations */}
            <View style={[styles.section, { borderTopColor: theme.glassBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                <Text style={{ color: theme.crimson }}>9.</Text> Disclaimers & Limitations
              </Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
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
            </View>

            {/* 10. User Responsibility */}
            <View style={[styles.section, { borderTopColor: theme.glassBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                <Text style={{ color: theme.crimson }}>10.</Text> User Responsibility
              </Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
                You are responsible for using the Service lawfully, respecting other people’s rights, and keeping
                your account credentials secure.
              </Text>
            </View>

            {/* 11. Termination */}
            <View style={[styles.section, { borderTopColor: theme.glassBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                <Text style={{ color: theme.crimson }}>11.</Text> Termination
              </Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
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
            </View>

            {/* 12. Changes to Terms */}
            <View style={[styles.section, { borderTopColor: theme.glassBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                <Text style={{ color: theme.crimson }}>12.</Text> Changes to Terms
              </Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
                • We may update these Terms from time to time{'\n'}
                • We'll notify you of material changes via email or app notification{'\n'}
                • Continued use after changes means you accept the new Terms{'\n'}
                • If you don't agree, you should stop using the Service
              </Text>
            </View>

            {/* 13. Dispute Resolution */}
            <View style={[styles.section, { borderTopColor: theme.glassBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                <Text style={{ color: theme.crimson }}>13.</Text> Dispute Resolution
              </Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
                If you have a dispute or concern about the Service, contact us first so we can try to resolve it informally.{'\n\n'}
                If we cannot resolve a dispute informally, it may be handled in a court or other forum with proper
                jurisdiction, subject to any mandatory rights you have under applicable consumer protection law.
              </Text>
            </View>

            {/* 14. General Provisions */}
            <View style={[styles.section, { borderTopColor: theme.glassBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                <Text style={{ color: theme.crimson }}>14.</Text> General Provisions
              </Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
                • These Terms and our Privacy Policy constitute the entire agreement between you and Between Us{'\n'}
                • If any provision is found invalid, the remaining provisions remain in effect{'\n'}
                • Our failure to enforce any right doesn't waive that right{'\n'}
                • You may not transfer your rights under these Terms; we may assign ours to a successor{'\n'}
                • We're not liable for delays or failures due to circumstances beyond our control
              </Text>
            </View>

            {/* 15. Contact Us */}
            <View style={[styles.section, { borderTopColor: theme.glassBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                <Text style={{ color: theme.crimson }}>15.</Text> Contact Us
              </Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
                If you have questions about these Terms:{'\n\n'}
                Email: {SUPPORT_EMAIL}{'\n'}
                Response time: {SUPPORT_RESPONSE_TIME}
              </Text>
            </View>

            <Text style={[styles.paragraph, { color: colors.textMuted || 'gray', marginTop: 40, fontStyle: 'italic', textAlign: 'center' }]}>
              By using Between Us, you acknowledge that you've read and understood these Terms, you agree to
              be bound by them, you're at least 18 years old, and you'll use the Service responsibly and legally.{'\n\n'}
              Thank you for choosing Between Us to deepen your connection.
            </Text>

            <View style={{ height: showActions ? 180 : 120 }} />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      {/* Action Buttons (for onboarding) */}
      {showActions && (
        <BlurView intensity={isDark ? 40 : 60} tint={isDark ? 'dark' : 'light'} style={[styles.actionContainer, { borderColor: theme.glassBorder }]}>
          <TouchableOpacity
            style={[styles.declineButton, { borderColor: theme.glassBorder, backgroundColor: theme.glass }]}
            onPress={handleDecline}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <Text style={[styles.declineText, { color: colors.text }]}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.acceptButton}
            onPress={handleAccept}
            disabled={isLoading}
            activeOpacity={0.9}
          >
            <LinearGradient colors={[theme.crimson, '#900C0F']} style={styles.acceptBtnGrad}>
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.acceptText}>Accept & Continue</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </BlurView>
      )}
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
  section: {
    borderTopWidth: 1,
    paddingTop: 32,
    marginTop: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  paragraph: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '500',
    marginBottom: 16,
    opacity: 0.85,
  },
  importantNote: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
  },

  actionContainer: {
    flexDirection: 'row',
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    gap: 12,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1.5,
  },
  declineButton: {
    flex: 1,
    height: 60,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '700',
  },
  acceptButton: {
    flex: 2,
    height: 60,
    borderRadius: 22,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: theme.crimson, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  acceptBtnGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: {
    color: '#FFFFFF',
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});

export default TermsScreen;

/**
 * EULAScreen — End User License Agreement
 * Displays Apple's Standard EULA with Between Us supplemental terms.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  StatusBar,
} from 'react-native';
import Icon from '../components/Icon';
import { useTheme } from '../context/ThemeContext';
import { withAlpha } from '../utils/theme';

const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });

const APPLE_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

const EULAScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();

  const t = useMemo(() => ({
    background: colors.background,
    surface: isDark ? '#131016' : '#FFFFFF',
    primary: colors.primary || '#D2121A',
    text: colors.text,
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="chevron-back" size={28} color={t.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.text }]}>Legal</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={[styles.title, { color: t.text }]}>
          End User License Agreement
        </Text>
        <Text style={[styles.date, { color: t.primary }]}>
          EFFECTIVE MARCH 21, 2026
        </Text>

        <Text style={[styles.paragraph, { color: t.subtext }]}>
          Between Us is licensed to you subject to the terms of the Licensed Application End User License
          Agreement ("Standard EULA") set forth by Apple Inc., as may be modified by the supplemental
          terms below. By downloading, installing, or using Between Us, you agree to be bound by the
          Standard EULA and these supplemental terms.
        </Text>

        {/* Apple Standard EULA */}
        <View style={[styles.section, { borderTopColor: t.border }]}>
          <Text style={[styles.sectionTitle, { color: t.text }]}>
            Apple's Standard Licensed Application End User License Agreement
          </Text>
          <Text style={[styles.paragraph, { color: t.subtext }]}>
            Between Us is subject to Apple's Standard Licensed Application End User License Agreement,
            which is available at:
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openURL(APPLE_EULA_URL)}
            activeOpacity={0.7}
          >
            <Text style={[styles.link, { color: t.primary }]}>
              {APPLE_EULA_URL}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.paragraph, { color: t.subtext, marginTop: 16 }]}>
            The Standard EULA governs your use of the app and is incorporated into this agreement
            by reference. In the event of a conflict between this document and the Standard EULA,
            the Standard EULA shall prevail.
          </Text>
        </View>

        {/* Supplemental Terms */}
        <View style={[styles.section, { borderTopColor: t.border }]}>
          <Text style={[styles.sectionTitle, { color: t.text }]}>
            Supplemental Terms
          </Text>

          <Text style={[styles.subTitle, { color: t.text }]}>1. License Scope</Text>
          <Text style={[styles.paragraph, { color: t.subtext }]}>
            Subject to your compliance with these terms and the Standard EULA, we grant you a limited,
            non-exclusive, non-transferable, revocable license to download, install, and use Between Us
            on any Apple-branded device that you own or control, as permitted by the App Store Terms of Service.
          </Text>

          <Text style={[styles.subTitle, { color: t.text }]}>2. Age Restriction</Text>
          <Text style={[styles.paragraph, { color: t.subtext }]}>
            You must be at least 18 years old to use Between Us. By using the app, you confirm that you
            meet this age requirement.
          </Text>

          <Text style={[styles.subTitle, { color: t.text }]}>3. Content & Intellectual Property</Text>
          <Text style={[styles.paragraph, { color: t.subtext }]}>
            All prompts, designs, features, and app content are the intellectual property of Between Us.
            You retain ownership of your personal content (journal entries, responses, love notes, etc.).
            You may not copy, modify, distribute, or reverse engineer any part of the app.
          </Text>

          <Text style={[styles.subTitle, { color: t.text }]}>4. Subscriptions</Text>
          <Text style={[styles.paragraph, { color: t.subtext }]}>
            Between Us offers optional in-app subscriptions (monthly, yearly, lifetime). Payment is
            charged to your Apple ID account. Subscriptions auto-renew unless turned off at least 24
            hours before the end of the current period. You can manage subscriptions in Settings {'>'} Apple
            ID {'>'} Subscriptions on your device.
          </Text>

          <Text style={[styles.subTitle, { color: t.text }]}>5. Privacy & Data</Text>
          <Text style={[styles.paragraph, { color: t.subtext }]}>
            Your use of Between Us is also governed by our Privacy Policy, available in the app
            under Settings {'>'} Safety & Support {'>'} Privacy Policy. We use end-to-end encryption for
            sensitive content and never sell your personal data.
          </Text>

          <Text style={[styles.subTitle, { color: t.text }]}>6. Disclaimer</Text>
          <Text style={[styles.paragraph, { color: t.subtext }]}>
            Between Us is designed for thriving couples only. It is not a substitute for professional
            therapy, counseling, or medical advice. It is not appropriate for couples navigating trust
            breakdowns, abuse, or considering separation. If your relationship needs professional
            support, please seek qualified help.
          </Text>

          <Text style={[styles.subTitle, { color: t.text }]}>7. Limitation of Liability</Text>
          <Text style={[styles.paragraph, { color: t.subtext }]}>
            To the maximum extent permitted by applicable law, Between Us and its developers shall not
            be liable for any indirect, incidental, special, consequential, or punitive damages, or any
            loss of profits or revenues, whether incurred directly or indirectly. Our total aggregate
            liability shall not exceed the amount you actually paid for the app in the twelve (12) months
            preceding the claim.
          </Text>

          <Text style={[styles.subTitle, { color: t.text }]}>8. Termination</Text>
          <Text style={[styles.paragraph, { color: t.subtext }]}>
            This license is effective until terminated. Your rights under this license will terminate
            automatically if you fail to comply with any of its terms. Upon termination, you must cease
            all use of the app and delete all copies from your devices.
          </Text>

          <Text style={[styles.subTitle, { color: t.text }]}>9. Governing Law</Text>
          <Text style={[styles.paragraph, { color: t.subtext }]}>
            This agreement is governed by the laws of the United States, without regard to conflict of
            law principles. Any disputes shall be resolved in accordance with the dispute resolution
            provisions in our Terms of Service.
          </Text>

          <Text style={[styles.subTitle, { color: t.text }]}>10. Contact</Text>
          <Text style={[styles.paragraph, { color: t.subtext }]}>
            If you have questions about this EULA:{'\n\n'}
            Email: brittanyapps@outlook.com{'\n'}
            Response time: 24–48 hours
          </Text>
        </View>

        {/* Related Documents */}
        <View style={[styles.relatedCard, { backgroundColor: withAlpha(t.surface, 0.6), borderColor: t.border }]}>
          <Text style={[styles.relatedTitle, { color: t.text }]}>Related Documents</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Terms')}>
            <Text style={[styles.relatedLink, { color: t.primary }]}>Terms of Service</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')}>
            <Text style={[styles.relatedLink, { color: t.primary }]}>Privacy Policy</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL(APPLE_EULA_URL)}>
            <Text style={[styles.relatedLink, { color: t.primary }]}>Apple Standard EULA (Full Text)</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
};

const createStyles = (t, isDark) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
  },
  backButton: { width: 44, height: 44, justifyContent: 'center' },
  headerTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 42,
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20 },
  title: {
    fontFamily: SYSTEM_FONT,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  date: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 24,
  },
  section: {
    borderTopWidth: 1,
    paddingTop: 24,
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 16,
  },
  subTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '500',
    marginBottom: 12,
  },
  link: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  relatedCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    marginTop: 32,
  },
  relatedTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  relatedLink: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 10,
  },
});

export default EULAScreen;

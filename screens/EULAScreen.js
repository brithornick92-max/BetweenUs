/**
 * EULAScreen — End User License Agreement
 * Velvet Glass & Apple Editorial High-End Updates Integrated.
 * Palette: Deep Crimson, Obsidian, Liquid Silver (Strictly No Gold).
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
import { SUPPORT_EMAIL, SUPPORT_RESPONSE_TIME } from '../config/constants';

const { width: SCREEN_W } = Dimensions.get('window');
const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });

const APPLE_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

const EULAScreen = ({ navigation }) => {
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

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Editorial Header Block */}
          <Animated.View entering={FadeIn.duration(800)} style={styles.introSection}>
            <Text style={[styles.headerEye, { color: theme.crimson }]}>LICENSE AGREEMENT</Text>
            <Text style={[styles.title, { color: colors.text }]}>EULA</Text>
            <Text style={[styles.date, { color: colors.textMuted || 'gray' }]}>
              Effective: March 21, 2026
            </Text>
            <Text style={[styles.intro, { color: colors.text }]}>
              Between Us is licensed to you subject to the terms of the Licensed Application End User License
              Agreement ("Standard EULA") set forth by Apple Inc., as modified by the supplemental
              terms below.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(800)} style={styles.documentBody}>
            {/* Apple Standard EULA */}
            <View style={[styles.section, { borderTopColor: theme.glassBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Apple's Standard EULA
              </Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
                Between Us is subject to Apple's Standard Licensed Application End User License Agreement,
                which is available at:
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL(APPLE_EULA_URL)}
                activeOpacity={0.7}
                style={{ marginBottom: 16 }}
              >
                <Text style={[styles.link, { color: theme.crimson }]}>
                  {APPLE_EULA_URL}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
                The Standard EULA governs your use of the app and is incorporated into this agreement
                by reference. In the event of a conflict between this document and the Standard EULA,
                the Standard EULA shall prevail.
              </Text>
            </View>

            {/* Supplemental Terms */}
            <View style={[styles.section, { borderTopColor: theme.glassBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Supplemental Terms
              </Text>

              <Text style={[styles.subTitle, { color: colors.text }]}>1. License Scope</Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
                Subject to your compliance with these terms and the Standard EULA, we grant you a limited,
                non-exclusive, non-transferable, revocable license to download, install, and use Between Us
                on any Apple-branded device that you own or control, as permitted by the App Store Terms of Service.
              </Text>

              <Text style={[styles.subTitle, { color: colors.text }]}>2. Age Restriction</Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
                You must be at least 18 years old to use Between Us. By using the app, you confirm that you
                meet this age requirement.
              </Text>

              <Text style={[styles.subTitle, { color: colors.text }]}>3. Content & Intellectual Property</Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
                All prompts, designs, features, and app content are the intellectual property of Between Us.
                You retain ownership of your personal content (journal entries, responses, love notes, etc.).
                You may not copy, modify, distribute, or reverse engineer any part of the app.
              </Text>

              <Text style={[styles.subTitle, { color: colors.text }]}>4. Subscriptions</Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
                Between Us offers optional in-app subscriptions (monthly, yearly, lifetime). Payment is
                charged to your Apple ID account. Subscriptions auto-renew unless turned off at least 24
                hours before the end of the current period. You can manage subscriptions in Settings {'>'} Apple
                ID {'>'} Subscriptions on your device.
              </Text>

              <Text style={[styles.subTitle, { color: colors.text }]}>5. Privacy & Data</Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
                Your use of Between Us is also governed by our Privacy Policy, available in the app
                under Settings {'>'} Safety & Support {'>'} Privacy Policy. We use end-to-end encryption for
                sensitive content and never sell your personal data.
              </Text>

              <Text style={[styles.subTitle, { color: colors.text }]}>6. Disclaimer</Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
                Between Us is designed for thriving couples only. It is not a substitute for professional
                therapy, counseling, or medical advice. It is not appropriate for couples navigating trust
                breakdowns, abuse, or considering separation. If your relationship needs professional
                support, please seek qualified help.
              </Text>

              <Text style={[styles.subTitle, { color: colors.text }]}>7. Limitation of Liability</Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
                To the maximum extent permitted by applicable law, Between Us and its developers shall not
                be liable for any indirect, incidental, special, consequential, or punitive damages, or any
                loss of profits or revenues, whether incurred directly or indirectly. Our total aggregate
                liability shall not exceed the amount you actually paid for the app in the twelve (12) months
                preceding the claim.
              </Text>

              <Text style={[styles.subTitle, { color: colors.text }]}>8. Termination</Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
                This license is effective until terminated. Your rights under this license will terminate
                automatically if you fail to comply with any of its terms. Upon termination, you must cease
                all use of the app and delete all copies from your devices.
              </Text>

              <Text style={[styles.subTitle, { color: colors.text }]}>9. Governing Law</Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray' }]}>
                This agreement is governed by the laws of the United States, without regard to conflict of
                law principles. Any disputes shall be resolved in accordance with the dispute resolution
                provisions in our Terms of Service.
              </Text>

              <Text style={[styles.subTitle, { color: colors.text }]}>10. Contact</Text>
              <Text style={[styles.paragraph, { color: colors.textMuted || 'gray', marginBottom: 20 }]}>
                If you have questions about this EULA:{'\n\n'}
                Email: {SUPPORT_EMAIL}{'\n'}
                Response time: {SUPPORT_RESPONSE_TIME}
              </Text>
            </View>
          </Animated.View>

          {/* Velvet Glass Related Documents Card */}
          <Animated.View entering={FadeInDown.delay(400).duration(800)}>
            <BlurView intensity={isDark ? 30 : 50} tint={isDark ? "dark" : "light"} style={[styles.relatedCard, { borderColor: theme.glassBorder }]}>
              <Text style={[styles.relatedTitle, { color: colors.text }]}>Related Documents</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Terms')} activeOpacity={0.7}>
                <View style={styles.relatedRow}>
                  <Text style={[styles.relatedLink, { color: colors.text }]}>Terms of Service</Text>
                  <Icon name="chevron-forward" size={18} color={colors.textMuted || 'gray'} />
                </View>
              </TouchableOpacity>
              <View style={[styles.relatedDivider, { backgroundColor: theme.glassBorder }]} />
              <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')} activeOpacity={0.7}>
                <View style={styles.relatedRow}>
                  <Text style={[styles.relatedLink, { color: colors.text }]}>Privacy Policy</Text>
                  <Icon name="chevron-forward" size={18} color={colors.textMuted || 'gray'} />
                </View>
              </TouchableOpacity>
              <View style={[styles.relatedDivider, { backgroundColor: theme.glassBorder }]} />
              <TouchableOpacity onPress={() => Linking.openURL(APPLE_EULA_URL)} activeOpacity={0.7}>
                <View style={styles.relatedRow}>
                  <Text style={[styles.relatedLink, { color: colors.text }]}>Apple Standard EULA</Text>
                  <Icon name="open-outline" size={18} color={colors.textMuted || 'gray'} />
                </View>
              </TouchableOpacity>
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
  link: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  relatedCard: {
    borderRadius: 28,
    borderWidth: 1.5,
    padding: 24,
    overflow: 'hidden',
    marginTop: 10,
  },
  relatedTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 20,
    opacity: 0.8,
  },
  relatedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  relatedLink: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '700',
  },
  relatedDivider: {
    height: 1,
    width: '100%',
    marginVertical: 4,
  },
});

export default EULAScreen;

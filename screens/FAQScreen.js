/**
 * FAQScreen — Knowledge & Support Hub
 * Velvet Glass & Apple Editorial High-End Updates Integrated.
 * Palette: Deep Crimson, Obsidian, Liquid Silver (Strictly No Gold).
 */

import React, { useState, useMemo } from 'react';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../components/Icon';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { SUPPORT_EMAIL } from '../config/constants';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';
import { FALLBACK_PRICES } from '../utils/premiumFeatures';

const { width: SCREEN_W } = Dimensions.get('window');
const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });

const FAQ_DATA = [
  {
    category: 'Getting Started',
    questions: [
      {
        q: 'What is Between Us?',
        a: 'Between Us is a private digital sanctuary built for couples to deepen their closeness. Through daily prompts, shared journaling, and intimate rituals, it provides a safe space to connect meaningfully beyond the noise of everyday life.',
      },
      {
        q: 'Who is Between Us for?',
        a: 'Between Us is for thriving couples only. If your relationship is already thriving and you want to make it even richer, this app was made for you.\n\nBetween Us is not a therapy app or relationship repair tool.',
      },
      {
        q: 'How much does it cost?',
        a: `Pro membership includes:\n• Monthly: ${FALLBACK_PRICES.monthly}\n• Yearly: ${FALLBACK_PRICES.yearly} (Best Value)\n• Lifetime: ${FALLBACK_PRICES.lifetime}\n\nFree users can still link with a partner, answer 1 prompt per day, and fully plan 1 date per week. One subscription covers both you and your linked partner. Access to data export is always free for all users.`,
      },
      {
        q: 'How do I get started?',
        a: '1. Create your account\n2. Customize your partner names\n3. Link with your partner (optional)\n4. Start exploring prompts!',
      },
    ],
  },
  {
    category: 'Account & Setup',
    questions: [
      {
        q: 'Do I need my partner to use the app?',
        a: 'No! You can use Between Us solo to journal, reflect, and prepare conversation topics. However, linking with your partner unlocks shared features and makes the experience more interactive.',
      },
      {
        q: 'How do I link with my partner?',
        a: '1. Both partners create accounts\n2. One partner generates an invite code or QR code\n3. The other partner scans the QR code or enters the code manually\n4. Both partners confirm the link\n5. You\'re connected!\n\nPartner linking is free. Premium adds encrypted sync and more shared features.',
      },
      {
        q: 'Can I unlink from my partner?',
        a: 'Yes, either partner can unlink at any time. Your individual data remains private, couple sharing stops, and you can relink later if desired.',
      },
    ],
  },
  {
    category: 'Privacy & Security',
    questions: [
      {
        q: 'Is my data private?',
        a: 'Absolutely. Shared content such as synced journal entries, prompt responses, memories, and love notes is encrypted before sync, and some private preferences stay only on your device. We also collect limited pseudonymous analytics, crash reports, and session replays to improve reliability. We do not sell your data, and we cannot read content protected by your device-only or couple encryption keys.',
      },
      {
        q: 'Can my partner see everything I write?',
        a: 'No! You control what you share. Private entries stay private, you choose what to share and when, and your partner can\'t access your private thoughts.',
      },
      {
        q: 'What happens if we break up?',
        a: 'You can unlink from your partner, your data remains yours, couple sharing stops, and you can delete your account if desired. Your ex-partner cannot access content you create after unlinking.',
      },
      {
        q: 'Can Between Us read my journal?',
        a: 'No. Encryption happens on your device before any data reaches our servers. Your intimacy is yours alone.',
      },
      {
        q: 'Can I lock the app with Face ID or a PIN?',
        a: 'Yes! Go to Settings > Privacy & Security to set up a PIN code and optionally enable Face ID or Touch ID. Your biometric data never leaves your device — we only check whether your device confirms your identity.',
      },
      {
        q: 'What happens if I lose my phone?',
        a: 'If you have cloud sync enabled, your encrypted data is backed up to the cloud and can be restored on a new device by signing in.\n\nIf you don\'t have cloud sync enabled, content encrypted with your device-only key may be permanently unrecoverable. We strongly recommend enabling cloud sync in Settings.',
      },
    ],
  },
  {
    category: 'Features & Usage',
    questions: [
      {
        q: 'What are Heat Levels?',
        a: 'Heat levels range from Level 1 (Pure Emotional Connection) to Level 5 (Intense Passion). You can adjust this setting anytime to match your current relationship vibe.',
      },
      {
        q: 'How do prompts work?',
        a: '1. Open the app to see your daily prompt\n2. Read and reflect on the question\n3. Write your response\n4. Share with your partner (optional)\n5. Read their response when ready\n6. Continue the conversation!',
      },
      {
        q: 'Can I skip prompts I don\'t like?',
        a: 'Yes! You can skip to the next prompt, refresh for a different one, mark prompts as favorites, or hide prompts you don\'t want to see again.',
      },
      {
        q: 'What if a prompt makes me uncomfortable?',
        a: 'Skip it immediately, adjust your heat level, provide feedback, or use content filtering in settings. You\'re always in control.',
      },
      {
        q: 'Does it work offline?',
        a: 'Yes. Between Us is built local-first. You can reflect and write anytime; your data will sync securely the next time you are online.',
      },
    ],
  },
  {
    category: 'Subscription & Billing',
    questions: [
      {
        q: 'What\'s included in Premium?',
        a: '• All heat levels (1-5)\n• Unlimited daily prompts\n• Unlimited prompt responses\n• Love notes with photo attachments\n• Unlimited date planning tools\n• Night rituals and custom routines\n• Calendar and scheduling\n• Encrypted cloud sync for linked couples\n• Vibe Signals (share your mood)\n• Moment Signals (thinking of you taps)\n• Energy Matcher (content for your energy level)\n• Inside Jokes vault\n• Year Reflection narratives\n• Surprise Tonight (spontaneous date ideas)\n• Reveal Together (simultaneous answer sharing)\n• Shared premium access for linked partners',
      },
      {
        q: 'How do I subscribe?',
        a: '1. Tap "Upgrade to Premium" in the app\n2. Choose your plan (Monthly, Yearly, or Lifetime)\n3. Confirm through the App Store\n4. Premium activates after purchase confirmation\n5. If you\'re linked, your partner can receive shared access too',
      },
      {
        q: 'Can I cancel anytime?',
        a: 'Yes! Cancel anytime:\n\nGo to Settings > Apple ID > Subscriptions on your device, then tap Between Us to cancel.\n\nYour premium access continues until the end of your billing period.',
      },
      {
        q: 'Can I share Premium with my partner?',
        a: 'Yes. Premium is priced per couple. When one partner subscribes, linked partners can share premium access. Linking itself is free, so one subscription supports the shared premium experience for the linked couple.',
      },
    ],
  },
  {
    category: 'Technical Support',
    questions: [
      {
        q: 'The app isn\'t working. What should I do?',
        a: '1. Force close and reopen the app\n2. Check for app updates\n3. Restart your device\n4. Check your internet connection\n5. Contact support if this continues',
      },
      {
        q: 'My partner and I aren\'t syncing. Help!',
        a: 'Check that:\n• Both partners are connected to internet\n• You\'re both logged in\n• Your accounts are properly linked\n• You\'ve both updated to the latest version\n• Try unlinking and relinking if needed',
      },
      {
        q: 'How do I delete my account?',
        a: '1. Go to Settings > Privacy & Security\n2. Tap "Delete Account"\n3. Confirm your decision\n4. Your data will be permanently deleted\n\nWarning: This cannot be undone!',
      },
      {
        q: 'I forgot my password. What can I do?',
        a: 'Use the Magic Link option from the Cloud Sync screen to sign in by email without entering your password. If you still need help accessing your account, contact support.',
      },
      {
        q: 'Can I use Between Us on multiple devices?',
        a: 'Yes. You can sign in on multiple devices with the same account. Synced cloud data can appear across devices after sign-in and sync, but device-only encrypted content may not be recoverable on a new device unless cloud sync is enabled.',
      },
    ],
  },
  {
    category: 'About Between Us & Your Relationship',
    questions: [
      {
        q: 'Is Between Us a substitute for therapy?',
        a: 'No. Between Us is a private space for thriving couples only — not therapy, counseling, or a relationship repair tool.\n\nIf your relationship needs professional support, please reach out to a licensed therapist.',
      },
      {
        q: 'When should we NOT use Between Us?',
        a: 'Between Us is specifically designed for thriving couples — not for couples navigating serious concerns. The app is not appropriate if you\'re:\n• Working through trust breakdowns or infidelity\n• Experiencing abuse of any kind\n• Considering separation or divorce\n• Feeling unsafe with your partner\n\nIf any of these apply, please seek support from a licensed therapist or counselor.',
      },
      {
        q: 'Is Between Us right for every couple?',
        a: 'Between Us is designed specifically for thriving couples — it deepens what\'s already beautiful. It is not a relationship repair tool and is not designed for couples working through serious concerns.\n\nIf your relationship is already thriving and you want to go deeper, Between Us was made for you.',
      },
      {
        q: 'Where can I find help if I\'m in an unsafe situation?',
        a: 'If you or someone you know is experiencing abuse or feels unsafe:\n\n• National Domestic Violence Hotline: 1-800-799-7233 (call or text)\n• Crisis Text Line: Text HOME to 741741\n• RAINN (sexual assault): 1-800-656-4673\n• International Association for Suicide Prevention: https://www.iasp.info/resources/Crisis_Centres/\n\nYou are not alone, and help is available 24/7.',
      },
    ],
  },
];

export default function FAQScreen({ navigation }) {
  const [expandedItems, setExpandedItems] = useState({});
  const { colors, isDark } = useTheme();

  // ── High-End Color Logic (No Gold) ──────────────────────────────────────────
  const theme = useMemo(() => ({
    crimson: '#D2121A',
    silver: isDark ? '#E5E5E7' : '#8E8E93',
    obsidian: '#0A0A0C',
    glass: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
    glassBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  }), [isDark]);

  const styles = useMemo(() => createStyles(colors, isDark, theme), [colors, isDark, theme]);

  const toggleItem = (categoryIndex, questionIndex) => {
    selection();
    const key = `${categoryIndex}-${questionIndex}`;
    setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleContactSupport = () => {
    impact(ImpactFeedbackStyle.Medium);
    Alert.alert('Concierge Support', `Email: ${SUPPORT_EMAIL}\nTypical response: 24-48 hours`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={isDark ? [theme.obsidian, '#1A0205', theme.obsidian] : ['#FFFFFF', '#F9F4F4', '#FFFFFF']}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Crimson Ambient Glow */}
      <GlowOrb color={theme.crimson} size={400} top={-100} left={SCREEN_W - 250} opacity={0.1} />
      <GlowOrb color={theme.silver} size={300} top={500} left={-100} opacity={isDark ? 0.05 : 0.08} />
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
            <Text style={[styles.headerEye, { color: theme.crimson }]}>KNOWLEDGE BASE</Text>
            <Text style={[styles.introTitle, { color: colors.text }]}>Assistance</Text>
            <Text style={[styles.introDate, { color: colors.textMuted }]}>Updated April 6, 2026</Text>
            <Text style={[styles.introText, { color: colors.textMuted }]}>
              Explore how to make the most of your shared sanctuary. If you need further guidance, our concierge team is available.
            </Text>
          </Animated.View>

          {/* FAQ Categories */}
          {FAQ_DATA.map((category, catIdx) => (
            <Animated.View
              key={catIdx}
              entering={FadeInDown.delay(catIdx * 100).duration(600)}
              style={styles.categoryContainer}
            >
              <Text style={[styles.categoryTitle, { color: theme.crimson }]}>{category.category}</Text>

              <View style={[styles.card, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}>
                {category.questions.map((item, qIdx) => {
                  const key = `${catIdx}-${qIdx}`;
                  const isExpanded = expandedItems[key];
                  const isLast = qIdx === category.questions.length - 1;

                  return (
                    <TouchableOpacity
                      key={qIdx}
                      style={[
                        styles.faqItem,
                        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.glassBorder },
                      ]}
                      onPress={() => toggleItem(catIdx, qIdx)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.questionRow}>
                        <Text style={[styles.questionText, { color: colors.text }]}>{item.q}</Text>
                        <View style={[styles.iconCircle, isExpanded && { backgroundColor: theme.crimson + '15' }]}>
                          <Icon
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={16}
                            color={isExpanded ? theme.crimson : colors.textMuted}
                          />
                        </View>
                      </View>

                      {isExpanded && (
                        <Animated.View entering={FadeInDown.duration(300)}>
                          <Text style={[styles.answerText, { color: colors.textMuted }]}>{item.a}</Text>
                        </Animated.View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          ))}

          {/* Concierge Support Velvet Card */}
          <Animated.View entering={FadeInDown.delay(600).duration(800)}>
            <BlurView intensity={isDark ? 20 : 40} tint={isDark ? "dark" : "light"} style={[styles.supportCard, { borderColor: theme.glassBorder }]}>
              <View style={[styles.supportIcon, { backgroundColor: theme.crimson + '15' }]}>
                <Icon name="mail" size={28} color={theme.crimson} />
              </View>
              <Text style={[styles.supportTitle, { color: colors.text }]}>Still have questions?</Text>
              <Text style={[styles.supportSub, { color: colors.textMuted }]}>Our concierge team usually responds within 24-48 hours.</Text>

              <TouchableOpacity
                style={styles.supportButton}
                onPress={handleContactSupport}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={[theme.crimson, '#900C0F']}
                  style={styles.supportButtonGrad}
                >
                  <Text style={styles.supportButtonText}>Contact Concierge</Text>
                </LinearGradient>
              </TouchableOpacity>

              <Text style={[styles.supportEmail, { color: colors.textMuted }]}>{SUPPORT_EMAIL}</Text>
            </BlurView>
          </Animated.View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

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
  
  introSection: { marginBottom: 40 },
  headerEye: {
    fontFamily: Platform.select({ ios: 'Lato-Bold', android: 'Lato_700Bold' }),
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  introTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1.5,
    marginBottom: 16,
  },
  introText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    opacity: 0.8,
  },
  introDate: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 10,
    textTransform: 'uppercase',
  },

  categoryContainer: { marginBottom: 36 },
  categoryTitle: {
    fontFamily: Platform.select({ ios: 'Lato-Bold', android: 'Lato_700Bold' }),
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 16,
    marginLeft: 4,
  },
  card: { 
    borderRadius: 28, 
    borderWidth: 1.5, 
    overflow: 'hidden' 
  },
  faqItem: { 
    padding: 22 
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  questionText: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.glass,
  },
  answerText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    lineHeight: 24,
    marginTop: 14,
    fontWeight: '500',
    opacity: 0.85,
  },

  supportCard: {
    padding: 32,
    borderRadius: 36,
    alignItems: 'center',
    borderWidth: 1.5,
    marginTop: 10,
    overflow: 'hidden',
  },
  supportIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  supportTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  supportSub: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    opacity: 0.8,
  },
  supportButton: {
    width: '100%',
    height: 60,
    borderRadius: 30,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: theme.crimson,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
      },
      android: { elevation: 8 },
    }),
  },
  supportButtonGrad: {
    flex: 1,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportButtonText: {
    color: '#FFFFFF',
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  supportEmail: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.6,
  },
});

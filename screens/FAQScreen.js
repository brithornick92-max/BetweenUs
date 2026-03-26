/**
 * FAQScreen — Knowledge & Support Hub
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 * High-end editorial typography with Velvet Glass surfaces.
 */

import React, { useState, useMemo } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Icon from '../components/Icon';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { SPACING, withAlpha } from '../utils/theme';
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
        a: 'Absolutely. Shared content such as synced journal entries, prompt responses, memories, and love notes is encrypted before sync, and some private preferences stay only on your device. We do not sell your data, and we cannot read content protected by your device-only or couple encryption keys.',
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

  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    background: colors.background,
    surface: isDark ? '#131016' : '#FFFFFF',
    surfaceSecondary: isDark ? '#1C1520' : '#F2F2F7',
    primary: colors.primary || '#D2121A',
    text: colors.text,
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  const toggleItem = (categoryIndex, questionIndex) => {
    selection();
    const key = `${categoryIndex}-${questionIndex}`;
    setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleContactSupport = () => {
    impact(ImpactFeedbackStyle.Medium);
    Alert.alert('Concierge Support', 'Email: brittanyapps@outlook.com\nTypical response: 24h');
  };

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle="light-content" />
      <GlowOrb color="#D2121A" size={300} top={-100} left={SCREEN_W - 200} opacity={isDark ? 0.15 : 0.1} />
      <GlowOrb color={isDark ? '#FFFFFF' : '#F2F2F7'} size={250} top={650} left={-80} delay={1500} opacity={isDark ? 0.1 : 0.06} />
      <FilmGrain opacity={0.03} />

      <SafeAreaView style={styles.safeArea}>
        {/* Editorial Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              selection();
              navigation.goBack();
            }}
            style={styles.backButton}
          >
            <Icon name="chevron-back" size={28} color={t.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: t.text }]}>Assistance</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Intro Text */}
          <View style={styles.introSection}>
            <Text style={[styles.introTitle, { color: t.text }]}>Frequently Asked Questions</Text>
            <Text style={[styles.introText, { color: t.subtext }]}>
              Explore how to make the most of your shared sanctuary. If you need further help, our support team is available.
            </Text>
          </View>

          {/* FAQ Categories */}
          {FAQ_DATA.map((category, catIdx) => (
            <Animated.View
              key={catIdx}
              entering={FadeInDown.delay(catIdx * 100).duration(600)}
              style={styles.categoryContainer}
            >
              <Text style={[styles.categoryTitle, { color: t.primary }]}>{category.category}</Text>

              <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
                {category.questions.map((item, qIdx) => {
                  const key = `${catIdx}-${qIdx}`;
                  const isExpanded = expandedItems[key];
                  const isLast = qIdx === category.questions.length - 1;

                  return (
                    <TouchableOpacity
                      key={qIdx}
                      style={[
                        styles.faqItem,
                        !isLast && { borderBottomWidth: 1, borderBottomColor: t.border },
                      ]}
                      onPress={() => toggleItem(catIdx, qIdx)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.questionRow}>
                        <Text style={[styles.questionText, { color: t.text }]}>{item.q}</Text>
                        <Icon
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={t.subtext}
                        />
                      </View>

                      {isExpanded && (
                        <Animated.View entering={FadeInDown.duration(300)}>
                          <Text style={[styles.answerText, { color: t.subtext }]}>{item.a}</Text>
                        </Animated.View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          ))}

          {/* Support Section */}
          <View style={[styles.supportCard, { backgroundColor: t.surfaceSecondary, borderColor: t.border }]}>
            <View style={[styles.supportIcon, { backgroundColor: withAlpha(t.primary, 0.1) }]}>
              <Icon name="mail-outline" size={24} color={t.primary} />
            </View>
            <Text style={[styles.supportTitle, { color: t.text }]}>Still have questions?</Text>
            <Text style={[styles.supportSub, { color: t.subtext }]}>We usually respond within 24 hours.</Text>

            <TouchableOpacity
              style={[styles.supportButton, { backgroundColor: t.primary }]}
              onPress={handleContactSupport}
              activeOpacity={0.9}
            >
              <Text style={styles.supportButtonText}>Contact Concierge</Text>
            </TouchableOpacity>

            <Text style={[styles.supportEmail, { color: t.subtext }]}>brittanyapps@outlook.com</Text>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (t, isDark) => StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
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
  introSection: { marginBottom: 40 },
  introTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: 12,
  },
  introText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  categoryContainer: { marginBottom: 32 },
  categoryTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 16,
    marginLeft: 4,
  },
  card: { borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  faqItem: { padding: 20 },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  questionText: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginRight: 16,
  },
  answerText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    fontWeight: '500',
  },
  supportCard: {
    padding: 32,
    borderRadius: 32,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 20,
  },
  supportIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  supportTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  supportSub: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 24,
  },
  supportButton: {
    height: 56,
    paddingHorizontal: 32,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#D2121A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  supportButtonText: {
    color: '#FFFFFF',
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: -0.2,
  },
  supportEmail: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '500',
  },
});

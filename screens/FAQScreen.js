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
import CloseScreenHeader, { CLOSE_HEADER_STYLES } from '../components/CloseScreenHeader';
import { FALLBACK_PRICES } from '../utils/premiumFeatures';

const { width: SCREEN_W } = Dimensions.get('window');
const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });

const FAQ_DATA = [
  {
    category: 'Getting Started',
    questions: [
      {
        q: 'What is Between Us?',
        a: 'Between Us is a private relationship space for couples who already love each other and want to keep choosing each other on purpose. Answer privately, reveal together, save favorite moments, upload photos or videos to Our Story Wall/Keepsake, and build a shared archive that feels like yours.',
      },
      {
        q: 'Who is Between Us for?',
        a: 'Between Us is for thriving couples only. If your relationship is already thriving and you want to make it even richer, this app was made for you.\n\nBetween Us is not a therapy app or relationship repair tool.',
      },
      {
        q: 'How much does it cost?',
        a: `The free version includes the core couple experience: prompts, notes, date ideas, shared calendar, Keepsake, app lock, and recaps.\n\nFree starts with 5 prompts, 5 date ideas, and 1 sex position, and adds 5 prompts, 5 date ideas, and 1 sex position each week. Free Keepsake shows the last 30 days of your shared story.\n\nPremium starts with 100 prompts, 100 date ideas, and 10 sex positions, then adds 15 prompts, 15 date ideas, and 3 sex positions each week, plus the full Keepsake archive. One subscription covers both linked partners after entitlement sync completes.\n\n• Monthly: ${FALLBACK_PRICES.monthly}\n• Yearly: ${FALLBACK_PRICES.yearly}`,
      },
      {
        q: 'How do I get started?',
        a: '1. Create your account\n2. Add your names and preferred tone\n3. Link with your partner\n4. Answer today\'s prompt privately\n5. Reveal together when both answers are in',
      },
    ],
  },
  {
    category: 'Account & Setup',
    questions: [
      {
        q: 'Do I need my partner to use the app?',
        a: 'You can start solo by saving answers and notes, but Between Us is strongest when both partners are linked. The shared reveal, date ideas, memories, signals, and archive are designed for the two of you.',
      },
      {
        q: 'How do I link with my partner?',
        a: '1. Both partners create accounts\n2. One partner generates an invite code\n3. The other partner enters the code manually\n4. Both accounts are linked into one couple space\n\nPartner linking is free. Premium only adds more prompts, more date ideas, more sex positions, and the full Keepsake archive.',
      },
      {
        q: 'Can I unlink from my partner?',
        a: 'Yes, either partner can unlink at any time. Unlinking dissolves the shared couple connection, stops future shared syncing, and leaves your separate account in place.',
      },
    ],
  },
  {
    category: 'Privacy & Security',
    questions: [
      {
        q: 'Is my data private?',
        a: 'Your relationship content such as synced journal entries, prompt responses, memories, check-ins, vibes, calendar events, date plans, sex position favorites/tried state, and media attachments is protected by account access controls, transport security, row-level security, and provider-side policies. We also collect limited pseudonymous analytics, crash reports, and diagnostic session replays to improve reliability. We do not sell your data.',
      },
      {
        q: 'Can my partner see everything I write?',
        a: 'Between Us is built around shared couple-space content. Your linked partner may be able to access content stored in that shared couple space according to the feature flow. Prompt answers are designed to show through the shared reveal experience.',
      },
      {
        q: 'What happens if we break up?',
        a: 'You can unlink from your partner. Unlinking dissolves the shared couple connection, stops future shared syncing, and leaves your separate account in place. Historical shared content may remain until deleted or until a cleanup process applies. You can also delete your account if desired.',
      },
      {
        q: 'Can Between Us read my journal?',
        a: 'Core synced journal entries are stored in Supabase and protected with authentication, row-level security, secure transport, and provider-side controls. We cannot accurately claim that our systems are technically unable to access core synced content.',
      },
      {
        q: 'Can I lock the app with Face ID or a PIN?',
        a: 'Yes. Go to Settings > Privacy & Security to enable device app lock. Biometric matching is handled by your device; we receive only a success/failure result and do not collect biometric templates.',
      },
      {
        q: 'What happens if I lose my phone?',
        a: 'If your account data has synced, it can appear on a new device after you sign in and sync completes.\n\nPending offline changes and cache-only preferences may not be recoverable from a lost device.',
      },
    ],
  },
  {
    category: 'Features & Usage',
    questions: [
      {
        q: 'What are Heat Levels?',
        a: 'Heat levels help you choose the intensity of prompts, from emotional connection (1) to explicit (5). All 5 Heat Levels are available on both free and premium. Premium mainly adds a larger content library and the full Keepsake archive.',
      },
      {
        q: 'How do prompts work?',
        a: '1. Open the app to see today\'s Between Us prompt\n2. Write your answer privately\n3. Your partner sees that something is waiting\n4. They add their answer\n5. Both answers reveal together\n6. The moment can be saved to your archive',
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
        q: 'What is Our Story Wall / Keepsake?',
        a: 'Our Story Wall and Keepsake let you save shared photos, videos, notes, prompt responses, date memories, and other meaningful moments in one couple archive. You can upload your own photos or videos where media attachments are available, and linked partners may see shared couple-space media according to the feature flow.',
      },
      {
        q: 'Does it work offline?',
        a: 'Partly. Between Us keeps a local cache for speed and temporary offline continuity, but Supabase is the source of truth. Some actions may work offline temporarily, and pending changes sync when you reconnect. Features that require account, partner, subscription, or realtime data need internet access.',
      },
    ],
  },
  {
    category: 'Subscription & Billing',
    questions: [
      {
        q: 'What\'s included in Premium?',
        a: 'Premium starts with 100 prompts, 100 date ideas, and 10 sex positions, keeps adding 15 prompts, 15 date ideas, and 3 sex positions each week, and unlocks the full Keepsake archive beyond the last 30 days. The rest of the core experience stays available on free. One subscription covers both linked partners after entitlement sync completes.',
      },
      {
        q: 'How do I subscribe?',
        a: '1. Open a premium experience in the app\n2. Choose your plan (Monthly or Yearly)\n3. Confirm through the App Store\n4. Premium activates after purchase confirmation\n5. If you\'re linked, your partner can receive shared access too',
      },
      {
        q: 'Can I cancel anytime?',
        a: 'Yes. Cancel anytime:\n\nGo to Settings > Apple ID > Subscriptions on your device, then tap Between Us to cancel.\n\nYour premium access generally continues until the end of your billing period unless the App Store indicates otherwise.',
      },
      {
        q: 'Can I share Premium with my partner?',
        a: 'Yes. Premium is intended to support the linked-couple premium experience. When one partner subscribes, the linked partner can receive shared premium access after account linking and entitlement sync complete. Linking itself is free.',
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
        a: '1. Go to Settings > Account\n2. Tap "Delete Account"\n3. Type DELETE when prompted\n4. Confirm your decision\n\nAccount deletion is permanent once completed. Active data is removed according to the deletion flow and Privacy Policy; backup copies may persist for a limited period before routine purge.',
      },
      {
        q: 'I forgot my password. What can I do?',
        a: 'Use the password recovery flow from the sign-in experience to request a 6-digit recovery code by email and set a new password. You can also use Magic Link sign-in if you prefer passwordless access. If you still need help accessing your account, contact support.',
      },
      {
        q: 'Can I use Between Us on multiple devices?',
        a: 'Yes. You can sign in on multiple devices with the same account. Synced data can appear across devices after sign-in and sync, but pending offline changes and cache-only preferences may not be recoverable on a new device.',
      },
      {
        q: 'What happens when I export my data?',
        a: 'Between Us prepares a plaintext JSON export for the system share sheet. After the export flow completes, the app removes its temporary export file from app storage. If you save or share the file elsewhere, that destination controls the copy you created.',
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
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
      <LinearGradient
        colors={isDark ? [theme.obsidian, '#1A0205', theme.obsidian] : ['#FFFFFF', '#F9F4F4', '#FFFFFF']}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Crimson Ambient Glow */}
      <GlowOrb color={theme.crimson} size={400} top={-100} left={SCREEN_W - 250} opacity={0.1} />
      <GlowOrb color={theme.silver} size={300} top={500} left={-100} opacity={isDark ? 0.05 : 0.08} />
      <FilmGrain opacity={0.035} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <CloseScreenHeader
          title="Assistance"
          subtitle="KNOWLEDGE BASE"
          titleColor={colors.text}
          subtitleColor={colors.textMuted}
          closeColor={colors.text}
          onClose={() => {
            selection();
            navigation.goBack();
          }}
        />

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Editorial Header Block */}
          <Animated.View entering={FadeIn.duration(800)} style={styles.introSection}>
            <Text style={[styles.introDate, { color: colors.textMuted }]}>Updated April 29, 2026</Text>
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
  
  navHeader: CLOSE_HEADER_STYLES.header,
  backButton: CLOSE_HEADER_STYLES.closeButton,

  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16 },
  
  introSection: { marginBottom: 40 },
  headerEye: {
    fontFamily: SYSTEM_FONT,
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
    fontFamily: SYSTEM_FONT,
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

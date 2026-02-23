// screens/HomeScreen.js — "Tonight's Moment" — Velvet Glass
// Deep plum · Glass cards · Single glowing accent · Luxury breathing room

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  TextInput,
  Alert,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useContent } from '../context/ContentContext';
import { DataLayer } from '../services/localfirst';
import { SPACING, BORDER_RADIUS, SERIF, SERIF_ACCENT, SANS, SANS_MEDIUM, SANS_BOLD, withAlpha } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import GlassCard from '../components/GlassCard';
import MomentSignal from '../components/MomentSignal';
import RelationshipClimate from '../components/RelationshipClimate';
import SurpriseTonight from '../components/SurpriseTonight';
import MilestoneCard from '../components/MilestoneCard';
import YearReflectionCard from '../components/YearReflectionCard.jsx';
import WelcomeBack from '../components/WelcomeBack';
import OfflineIndicator from '../components/OfflineIndicator';
import { RelationshipMilestones } from '../services/PolishEngine';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Floating Glow Orb ──────────────────────────────
const GlowOrb = ({ color, size = 200, top, left, delay = 0 }) => {
  const pulse = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.5, duration: 4000 + delay, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.25, duration: 4000 + delay, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', top, left,
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color, opacity: pulse,
      }}
    />
  );
};

function dayKeyLocal(date = new Date()) {
  const d = date instanceof Date ? date : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const FALLBACK_PROMPT = {
  id: 'fallback_prompt',
  text: "What's something about our relationship your past self wouldn't believe?",
  category: 'romance',
  heat: 1,
};

function normalizePrompt(p) {
  if (!p || typeof p !== 'object') return FALLBACK_PROMPT;
  const id = p.id ? String(p.id) : FALLBACK_PROMPT.id;
  const raw = typeof p.text === 'string' ? p.text : '';
  const text = raw.trim() ? raw : FALLBACK_PROMPT.text;
  return { ...p, id, text, heat: typeof p.heat === 'number' ? p.heat : 1, category: typeof p.category === 'string' ? p.category : 'romance' };
}

const ACTIONS = [
  { label: 'Love Note', icon: 'email-heart-outline', key: 'note', premium: true },
  { label: 'Ritual', icon: 'moon-waning-crescent', key: 'ritual' },
  { label: 'Jokes', icon: 'emoticon-wink-outline', key: 'jokes', premium: true },
];

export default function HomeScreen({ navigation }) {
  const { state } = useAppContext();
  const { user, userProfile } = useAuth();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const { todayPrompt, loadTodayPrompt } = useContent();
  const { colors, isDark } = useTheme();

  const todayKey = useMemo(() => dayKeyLocal(new Date()), []);
  const prompt = useMemo(() => normalizePrompt(todayPrompt), [todayPrompt]);
  const promptReady = !!todayPrompt?.id && typeof todayPrompt?.text === 'string' && !!todayPrompt.text.trim();

  const [myAnswer, setMyAnswer] = useState('');
  const [partnerAnswer, setPartnerAnswer] = useState('');
  const [showMoments, setShowMoments] = useState(false);
  const [inlineText, setInlineText] = useState('');
  const [isSavingInline, setIsSavingInline] = useState(false);
  const [throwback, setThrowback] = useState(null);
  const [unreadNotes, setUnreadNotes] = useState(0);

  // Entrance animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const actionsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    RelationshipMilestones.initFirstOpen().catch(() => {});
    Animated.stagger(80, [
      Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(cardAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(actionsAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (user && !todayPrompt && typeof loadTodayPrompt === 'function') {
      loadTodayPrompt(null).catch(() => {});
    }
  }, [user, todayPrompt, loadTodayPrompt]);

  useEffect(() => {
    (async () => {
      if (!promptReady) return;
      try {
        const row = await DataLayer.getPromptAnswerForToday(prompt.id);
        setMyAnswer(row?.answer || '');
        setPartnerAnswer(row?.partnerAnswer || '');
      } catch (e) { /* fallback to empty */ }
    })();
  }, [prompt.id, promptReady]);

  // Load a random past answer for Memory Lane
  useEffect(() => {
    (async () => {
      try {
        const past = await DataLayer.getPromptAnswers({ limit: 50 });
        const answered = (past || []).filter(r => r.answer && r.date_key !== dayKeyLocal());
        if (answered.length > 0) {
          const pick = answered[Math.floor(Math.random() * answered.length)];
          setThrowback(pick);
        }
      } catch (e) { /* fallback to no throwback */ }
    })();
  }, []);

  // Load unread love note count
  useEffect(() => {
    if (!isPremium) return;
    (async () => {
      try {
        const count = await DataLayer.getUnreadLoveNoteCount();
        setUnreadNotes(count || 0);
      } catch (e) { /* fallback to 0 */ }
    })();
  }, [isPremium]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    return 'Evening';
  }, []);

  const preferredName =
    userProfile?.partnerNames?.myName ||
    userProfile?.displayName ||
    user?.displayName ||
    null;
  const partnerLabel = state?.partnerLabel || userProfile?.partnerNames?.partnerName || 'Partner';
  const bothAnswered = !!myAnswer.trim() && !!partnerAnswer.trim();

  const handleInlineSave = useCallback(async () => {
    const finalText = inlineText.trim();
    if (!finalText || !prompt?.id) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSavingInline(true);
    try {
      await DataLayer.savePromptAnswer({ promptId: prompt.id, answer: finalText });
      setMyAnswer(finalText);
      setInlineText('');
    } catch {
      Alert.alert('Error', "We couldn't save your thoughts. Please try again.");
    } finally {
      setIsSavingInline(false);
    }
  }, [inlineText, prompt]);

  const handlePrimaryCTA = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isPremium) { showPaywall?.('promptResponses'); return; }
    if (!promptReady) { navigation.navigate('HeatLevel'); return; }
    if (!myAnswer && inlineText.trim()) { await handleInlineSave(); return; }
    if (!myAnswer) return;
    navigation.navigate('Reveal', {
      prompt: { id: prompt.id, text: prompt.text, dateKey: todayKey },
      userAnswer: { answer: myAnswer },
      partnerAnswer: partnerAnswer || null,
      bothAnswered,
    });
  }, [isPremium, promptReady, myAnswer, partnerAnswer, bothAnswered, prompt, todayKey, navigation, inlineText, handleInlineSave]);

  const primaryCTALabel = useMemo(() => {
    if (!promptReady) return 'Customize Content';
    if (!myAnswer && inlineText.trim()) return isSavingInline ? 'Saving…' : 'Share My Heart';
    if (!myAnswer) return 'Share Your Thoughts';
    if (bothAnswered) return 'Reveal Connection';
    return 'See Your Response';
  }, [promptReady, myAnswer, bothAnswered, inlineText, isSavingInline]);

  const statusText = useMemo(() => {
    if (!promptReady || !myAnswer) return null;
    return bothAnswered ? 'Both of you have shared' : `Waiting on ${partnerLabel}`;
  }, [promptReady, myAnswer, bothAnswered, partnerLabel]);

  const handleAction = useCallback(async (key) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (key === 'note') {
      if (!isPremium) { showPaywall?.('loveNotes'); return; }
      navigation.navigate('LoveNotesInbox');
    } else if (key === 'ritual') {
      navigation.navigate('NightRitual');
    } else if (key === 'jokes') {
      if (!isPremium) { showPaywall?.('insideJokes'); return; }
      navigation.navigate('InsideJokes');
    }
  }, [isPremium, showPaywall, navigation]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Deep velvet background gradient */}
      <LinearGradient
        colors={isDark
          ? [colors.background, '#0F0A1A', '#0D081A', colors.background]
          : [colors.background, colors.surface2 || '#F3EDE8', colors.background]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Floating glow orbs */}
      <GlowOrb color={colors.primaryGlow || withAlpha(colors.primary, 0.15)} size={240} top={-60} left={-40} />
      <GlowOrb color={colors.accentMuted || withAlpha(colors.accent, 0.08)} size={160} top={220} left={SCREEN_W - 100} delay={1500} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>

        {/* ── Header ── */}
        <Animated.View
          style={[styles.header, {
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
          }]}
        >
          <View style={styles.headerLeft}>
            <Text style={[styles.headerGreetingSub, { color: colors.textMuted }]}>
              {greeting}
            </Text>
            {preferredName ? (
              <Text style={[styles.headerName, { color: colors.text }]}>{preferredName}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.vibeButton, { borderColor: colors.borderGlass || colors.border }]}
            onPress={() => navigation.navigate('VibeSignal')}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="heart-pulse" size={32} color={colors.primary} />
          </TouchableOpacity>
        </Animated.View>

        <OfflineIndicator />

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <WelcomeBack />
          <MilestoneCard />

          {/* ── Hero Prompt Card (Glass) ── */}
          <Animated.View style={{
            opacity: cardAnim,
            transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
          }}>
            <GlassCard glow variant="elevated" style={styles.heroCardWrap}>
              <View style={styles.eyebrowRow}>
                <View style={[styles.eyebrowDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.eyebrow, { color: colors.textMuted }]}>TONIGHT'S MOMENT</Text>
              </View>

              <Text style={[styles.promptText, { color: colors.text }]}>
                {promptReady ? prompt.text : 'Gathering today\'s reflection…'}
              </Text>

              {myAnswer ? (
                <View style={[styles.answerBubble, { backgroundColor: withAlpha(colors.primary, 0.05), borderColor: withAlpha(colors.primary, 0.12) }]}>
                  <Text style={[styles.answerText, { color: colors.textSecondary || colors.text }]}>{myAnswer}</Text>
                </View>
              ) : isPremium ? (
                <TextInput
                  style={[styles.input, {
                    color: colors.text,
                    borderColor: colors.borderGlass || colors.border,
                    backgroundColor: isDark ? 'rgba(30,22,44,0.50)' : 'rgba(245,240,235,0.60)',
                  }]}
                  value={inlineText}
                  onChangeText={setInlineText}
                  placeholder="What comes to mind…"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  maxLength={1000}
                  textAlignVertical="top"
                />
              ) : (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => showPaywall?.('promptResponses')}
                  style={[styles.input, {
                    borderColor: colors.borderGlass || colors.border,
                    backgroundColor: isDark ? 'rgba(30,22,44,0.50)' : 'rgba(245,240,235,0.60)',
                    justifyContent: 'center',
                  }]}
                >
                  <Text style={[styles.inputPlaceholder, { color: colors.textMuted }]}>What comes to mind…</Text>
                </TouchableOpacity>
              )}

              {statusText && (
                <View style={styles.statusRow}>
                  <MaterialCommunityIcons
                    name={bothAnswered ? 'check-decagram-outline' : 'clock-outline'}
                    size={13}
                    color={colors.primary}
                  />
                  <Text style={[styles.statusText, { color: colors.textMuted }]}>{statusText}</Text>
                </View>
              )}

              <View style={[styles.cardDivider, { backgroundColor: colors.divider }]} />

              {/* Glowing CTA */}
              <LinearGradient
                colors={[colors.primary, colors.primaryMuted]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaGradient}
              >
                <TouchableOpacity
                  style={styles.cta}
                  activeOpacity={0.82}
                  onPress={handlePrimaryCTA}
                  onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                >
                  <Text style={styles.ctaLabel}>{primaryCTALabel}</Text>
                  <MaterialCommunityIcons name="arrow-right" size={16} color="#FFF" />
                </TouchableOpacity>
              </LinearGradient>
            </GlassCard>
          </Animated.View>

          <View style={{ height: SPACING.section }} />

          <RelationshipClimate compact />

          <View style={{ height: SPACING.lg }} />

          {/* ── Quick Actions (Glass cards) ── */}
          <Animated.View style={[styles.actionsRow, {
            opacity: actionsAnim,
            transform: [{ translateY: actionsAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
          }]}>
            {ACTIONS.map((action) => {
              const locked = action.premium && !isPremium;
              const badge = action.key === 'note' && unreadNotes > 0 ? unreadNotes : 0;
              return (
                <TouchableOpacity
                  key={action.key}
                  activeOpacity={0.75}
                  onPress={() => handleAction(action.key)}
                  style={[styles.actionCard, {
                    backgroundColor: isDark ? 'rgba(20,15,28,0.45)' : 'rgba(255,255,255,0.65)',
                    borderColor: colors.borderGlass || colors.border,
                  }]}
                >
                  {locked && (
                    <MaterialCommunityIcons name="lock" size={10} color={colors.textMuted} style={styles.lockBadge} />
                  )}
                  {badge > 0 && (
                    <View style={[styles.noteBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.noteBadgeText}>{badge > 9 ? '9+' : badge}</Text>
                    </View>
                  )}
                  <View style={[styles.actionIconWrap, { backgroundColor: withAlpha(colors.primary, 0.08) }]}>
                    <MaterialCommunityIcons name={action.icon} size={24} color={colors.primary} />
                  </View>
                  <Text style={[styles.actionLabel, { color: colors.text }]}>{action.label}</Text>
                </TouchableOpacity>
              );
            })}
          </Animated.View>

          <View style={{ height: SPACING.section }} />

          {/* ── Memory Lane Throwback ── */}
          {throwback && (
            <GlassCard style={styles.memoryLaneCard}>
              <View style={styles.memoryLaneHeader}>
                <MaterialCommunityIcons name="clock-outline" size={24} color={colors.primary} />
                <Text style={[styles.memoryLaneLabel, { color: colors.textMuted }]}>MEMORY LANE</Text>
              </View>
              <Text style={[styles.memoryLanePrompt, { color: colors.text }]}>
                {throwback.prompt_text || 'A past moment together'}
              </Text>
              <Text style={[styles.memoryLaneAnswer, { color: colors.textSecondary || colors.text }]}>
                "{throwback.answer}"
              </Text>
              <Text style={[styles.memoryLaneDate, { color: colors.textMuted }]}>
                {throwback.date_key ? new Date(throwback.date_key + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : ''}
              </Text>
            </GlassCard>
          )}

          <View style={{ height: SPACING.lg }} />

          <SurpriseTonight navigation={navigation} />
          {isPremium && (
            <YearReflectionCard onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate('YearReflection');
            }} />
          )}

          {/* ── Moment Signal ── */}
          <View style={[styles.momentSection, { borderTopColor: colors.divider }]}>
            <TouchableOpacity
              style={styles.momentToggle}
              onPress={() => {
                setShowMoments(!showMoments);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons name="shimmer" size={24} color={colors.primary} />
              <Text style={[styles.momentToggleText, { color: colors.textMuted }]}>
                Send a quick moment to {partnerLabel}
              </Text>
              <MaterialCommunityIcons
                name={showMoments ? 'chevron-up' : 'chevron-down'}
                size={24}
                color={colors.textMuted}
              />
            </TouchableOpacity>
            {showMoments && <MomentSignal partnerLabel={partnerLabel} />}
          </View>

          <View style={{ height: SPACING.xxxl + 20 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.screen,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  headerLeft: { flex: 1 },
  headerGreetingSub: {
    fontFamily: SANS_MEDIUM,
    fontSize: 14,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  headerName: {
    fontFamily: SERIF,
    fontSize: 34,
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  vibeButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  // ── Scroll ──
  scroll: {
    paddingHorizontal: SPACING.screen,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xxxl,
  },

  // ── Hero Card ──
  heroCardWrap: { marginBottom: 0 },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.lg,
  },
  eyebrowDot: { width: 6, height: 6, borderRadius: 3 },
  eyebrow: {
    fontFamily: SANS_BOLD,
    fontSize: 10,
    letterSpacing: 2.8,
    textTransform: 'uppercase',
  },
  promptText: {
    fontFamily: SERIF_ACCENT,
    fontSize: 26,
    fontWeight: '300',
    lineHeight: 36,
    letterSpacing: -0.3,
    marginBottom: SPACING.lg,
  },
  answerBubble: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  answerText: {
    fontFamily: SANS,
    fontSize: 15,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  input: {
    minHeight: 100,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: SPACING.lg,
    fontFamily: SANS,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: SPACING.md,
  },
  inputPlaceholder: { fontFamily: SANS, fontSize: 15 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.md,
  },
  statusText: {
    fontFamily: SANS,
    fontSize: 13,
    fontStyle: 'italic',
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: -SPACING.xl,
    marginVertical: SPACING.sm,
  },
  ctaGradient: {
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#C4567A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 16 },
      android: { elevation: 8 },
    }),
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  ctaLabel: {
    fontFamily: SANS_BOLD,
    fontSize: 13,
    letterSpacing: 1.2,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },

  // ── Quick Actions ──
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.gutter,
  },
  actionCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    gap: SPACING.sm,
    position: 'relative',
    ...Platform.select({
      ios: { shadowColor: '#060410', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.20, shadowRadius: 12 },
      android: { elevation: 4 },
    }),
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontFamily: SANS_MEDIUM,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  lockBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    opacity: 0.4,
  },
  noteBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    zIndex: 2,
  },
  noteBadgeText: {
    fontFamily: SANS_BOLD,
    fontSize: 10,
    color: '#FFFFFF',
    lineHeight: 14,
  },

  // ── Moment Signal ──
  momentSection: {
    marginTop: SPACING.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  momentToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.xs,
  },
  momentToggleText: {
    fontFamily: SANS,
    fontSize: 13,
    letterSpacing: 0.2,
  },

  // ── Memory Lane ──
  memoryLaneCard: {
    marginTop: SPACING.md,
  },
  memoryLaneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.md,
  },
  memoryLaneLabel: {
    fontFamily: SANS_BOLD,
    fontSize: 10,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  memoryLanePrompt: {
    fontFamily: SERIF_ACCENT,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '300',
    marginBottom: SPACING.sm,
  },
  memoryLaneAnswer: {
    fontFamily: SANS,
    fontSize: 14,
    lineHeight: 22,
    fontStyle: 'italic',
    marginBottom: SPACING.sm,
  },
  memoryLaneDate: {
    fontFamily: SANS,
    fontSize: 12,
    letterSpacing: 0.3,
  },
});

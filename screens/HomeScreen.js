// screens/HomeScreen.js — "Tonight's Moment" — Apple Editorial
// Deep plum gradient background · Crisp solid widgets · Native typography · High contrast

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
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useContent } from '../context/ContentContext';
import { DataLayer } from '../services/localfirst';
import { SPACING, BORDER_RADIUS, withAlpha } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import MomentSignal from '../components/MomentSignal';
import RelationshipClimate from '../components/RelationshipClimate';
import SurpriseTonight from '../components/SurpriseTonight';
import MilestoneCard from '../components/MilestoneCard';
import YearReflectionCard from '../components/YearReflectionCard.jsx';
import WelcomeBack from '../components/WelcomeBack';
import OfflineIndicator from '../components/OfflineIndicator';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';
import { RelationshipMilestones } from '../services/PolishEngine';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function dateKey(date) {
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

// Vibrant iOS System Colors for the 2-column action widgets
const ACTIONS = [
  { label: 'Love Note', icon: 'email-heart-outline', key: 'note', premium: true, color: '#FF2D55' },
  { label: 'Ritual', icon: 'candle', key: 'ritual', color: '#5856D6' },
  { label: 'Jokes', icon: 'emoticon-wink-outline', key: 'jokes', premium: true, color: '#FF9500' },
];

export default function HomeScreen({ navigation }) {
  const { state } = useAppContext();
  const { user, userProfile } = useAuth();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const { todayPrompt, loadTodayPrompt } = useContent();
  const { colors, isDark } = useTheme();

  // Apple Editorial Theme Map
  const t = useMemo(() => ({
    background: colors.background,
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    surfaceSecondary: isDark ? '#2C2C2E' : '#F2F2F7',
    accent: colors.accent || '#FF2D55',
    primary: colors.primary,
    text: colors.text,
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  const todayKey = useMemo(() => dateKey(new Date()), []);
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
  }, [headerAnim, cardAnim, actionsAnim]);

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

  useEffect(() => {
    (async () => {
      try {
        const past = await DataLayer.getPromptAnswers({ limit: 50 });
        const answered = (past || []).filter(r => r.answer && r.date_key !== dateKey());
        if (answered.length > 0) {
          const pick = answered[Math.floor(Math.random() * answered.length)];
          setThrowback(pick);
        }
      } catch (e) { /* fallback to no throwback */ }
    })();
  }, []);

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
  let partnerLabel = state?.partnerLabel || userProfile?.partnerNames?.partnerName || 'your partner';
  if (partnerLabel === 'A' || !partnerLabel.trim()) partnerLabel = 'your partner';
  const bothAnswered = !!myAnswer.trim() && !!partnerAnswer.trim();

  const handleInlineSave = useCallback(async () => {
    const finalText = inlineText.trim();
    if (!finalText || !prompt?.id) return;
    notification(NotificationFeedbackType.Success);
    setIsSavingInline(true);
    try {
      await DataLayer.savePromptAnswer({ promptId: prompt.id, answer: finalText });
      setMyAnswer(finalText);
      setInlineText('');
    } catch {
      Alert.alert('Something didn\u2019t work', "We couldn\u2019t save your thoughts \u2014 try again?");
    } finally {
      setIsSavingInline(false);
    }
  }, [inlineText, prompt]);

  const handlePrimaryCTA = useCallback(async () => {
    impact(ImpactFeedbackStyle.Medium);
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
    impact(ImpactFeedbackStyle.Light);
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
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />

      {/* Deep velvet background gradient */}
      <LinearGradient
        colors={isDark
          ? [t.background, '#0F0A1A', '#0D081A', t.background]
          : [t.background, t.surfaceSecondary, t.background]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Background ambience */}
      <GlowOrb color={t.primary} size={500} top={-200} left={-150} />
      <GlowOrb color={t.accent} size={300} top={SCREEN_H * 0.4} left={SCREEN_W - 100} delay={1500} />
      <FilmGrain />

      <SafeAreaView style={styles.safeArea} edges={['top']}>

        {/* ── Header ── */}
        <Animated.View
          style={[styles.header, {
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
          }]}
        >
          <View style={styles.headerLeft}>
            <Text style={styles.headerGreetingSub}>
              {greeting}
            </Text>
            {preferredName ? (
              <Text style={styles.headerName}>{preferredName}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => { selection(); navigation.navigate('VibeSignal'); }}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Send a vibe signal"
            style={styles.vibeButton}
          >
            <MaterialCommunityIcons name="heart-outline" size={24} color={t.primary} />
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

          {/* ── Hero Prompt Card (Crisp Apple Widget) ── */}
          <Animated.View style={{
            opacity: cardAnim,
            transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
          }}>
            <View style={styles.heroCardWrap}>
              <View style={styles.eyebrowRow}>
                <MaterialCommunityIcons name="star-four-points" size={12} color={t.accent} />
                <Text style={styles.eyebrow}>TONIGHT'S MOMENT</Text>
              </View>

              <Text style={styles.promptText}>
                {promptReady ? prompt.text : 'Gathering today\'s reflection…'}
              </Text>

              {myAnswer ? (
                <View style={styles.answerBubble}>
                  <Text style={styles.answerText}>{myAnswer}</Text>
                </View>
              ) : isPremium ? (
                <TextInput
                  style={styles.input}
                  placeholderTextColor={t.subtext}
                  value={inlineText}
                  onChangeText={setInlineText}
                  placeholder="What comes to mind…"
                  multiline
                  maxLength={1000}
                  textAlignVertical="top"
                />
              ) : (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => showPaywall?.('promptResponses')}
                  style={[styles.input, { justifyContent: 'center' }]}
                >
                  <Text style={styles.inputPlaceholder}>What comes to mind…</Text>
                </TouchableOpacity>
              )}

              {statusText && (
                <View style={styles.statusRow}>
                  <MaterialCommunityIcons
                    name={bothAnswered ? 'check-decagram-outline' : 'clock-outline'}
                    size={14}
                    color={t.primary}
                  />
                  <Text style={styles.statusText}>{statusText}</Text>
                </View>
              )}

              <View style={{ height: 16 }} />

              {/* Solid High-Contrast Editorial CTA */}
              <TouchableOpacity
                style={styles.cta}
                activeOpacity={0.85}
                onPress={handlePrimaryCTA}
                onPressIn={() => impact(ImpactFeedbackStyle.Light)}
                accessibilityRole="button"
                accessibilityLabel={primaryCTALabel}
              >
                <Text style={styles.ctaLabel}>{primaryCTALabel}</Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color={isDark ? "#000000" : "#FFFFFF"} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          <View style={{ height: SPACING.section }} />

          <RelationshipClimate compact />

          <View style={{ height: SPACING.lg }} />

          {/* ── Quick Actions (2-Column Apple Widget Layout) ── */}
          <Animated.View style={[styles.actionsRow, {
            opacity: actionsAnim,
            transform: [{ translateY: actionsAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
          }]}>
            {ACTIONS.map((action, index) => {
              const locked = action.premium && !isPremium;
              const badge = action.key === 'note' && unreadNotes > 0 ? unreadNotes : 0;
              // Stretch the final item across the bottom if there's an odd number
              const isFullWidth = ACTIONS.length % 2 !== 0 && index === ACTIONS.length - 1;

              return (
                <TouchableOpacity
                  key={action.key}
                  activeOpacity={0.75}
                  onPress={() => handleAction(action.key)}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  style={[
                    styles.actionCard,
                    isFullWidth && { width: '100%' },
                  ]}
                >
                  {locked && (
                    <View style={styles.lockBadge}>
                      <MaterialCommunityIcons name="lock" size={12} color={action.color} />
                    </View>
                  )}
                  {badge > 0 && (
                    <View style={[styles.noteBadge, { backgroundColor: action.color }]}>
                      <Text style={styles.noteBadgeText}>{badge > 9 ? '9+' : badge}</Text>
                    </View>
                  )}
                  <View style={[styles.actionIconWrap, { backgroundColor: action.color + '15' }]}>
                    <MaterialCommunityIcons name={action.icon} size={28} color={action.color} />
                  </View>
                  <Text style={styles.actionLabel}>{action.label}</Text>
                </TouchableOpacity>
              );
            })}
          </Animated.View>

          <View style={{ height: SPACING.section }} />

          {/* ── Memory Lane Throwback ── */}
          {throwback && (
            <View style={styles.memoryLaneCard}>
              <View style={styles.memoryLaneHeader}>
                <MaterialCommunityIcons name="clock-outline" size={18} color={t.primary} />
                <Text style={styles.memoryLaneLabel}>MEMORY LANE</Text>
              </View>
              <Text style={styles.memoryLanePrompt}>
                {throwback.prompt_text || 'A past moment together'}
              </Text>
              <Text style={styles.memoryLaneAnswer}>
                "{throwback.answer}"
              </Text>
              <Text style={styles.memoryLaneDate}>
                {throwback.date_key ? new Date(throwback.date_key + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : ''}
              </Text>
            </View>
          )}

          <View style={{ height: SPACING.lg }} />

          <SurpriseTonight navigation={navigation} />
          {isPremium && (
            <>
              <View style={{ height: SPACING.xl }} />
              <YearReflectionCard onPress={async () => {
                impact(ImpactFeedbackStyle.Light);
                navigation.navigate('YearReflection');
              }} />
            </>
          )}

          {/* ── Moment Signal ── */}
          <View style={styles.momentSection}>
            <TouchableOpacity
              style={styles.momentToggle}
              onPress={() => {
                setShowMoments(!showMoments);
                impact(ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Send a moment to ${partnerLabel}`}
            >
              <MaterialCommunityIcons name="shimmer" size={24} color={t.primary} />
              <Text style={styles.momentToggleText} numberOfLines={1} ellipsizeMode="tail">
                Send a moment to {partnerLabel}
              </Text>
              <MaterialCommunityIcons
                name={showMoments ? 'chevron-up' : 'chevron-down'}
                size={24}
                color={t.subtext}
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

// ------------------------------------------------------------------
// STYLES - Apple Editorial (Native Dashboard Look)
// ------------------------------------------------------------------
const createStyles = (t, isDark) => StyleSheet.create({
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
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: t.subtext,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  headerName: {
    fontFamily: Platform.select({ ios: "System", android: "Roboto" }),
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.3,
    lineHeight: 40,
    color: t.text,
  },
  vibeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: isDark ? '#000' : '#8A8A8E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.3 : 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },

  // ── Scroll ──
  scroll: {
    paddingHorizontal: SPACING.screen,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xxxl,
  },

  // ── Hero Card (Solid Widget) ──
  heroCardWrap: { 
    borderRadius: 24,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
    padding: SPACING.xl,
    marginBottom: 0,
    ...Platform.select({
      ios: { shadowColor: isDark ? '#000' : '#8A8A8E', shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDark ? 0.3 : 0.08, shadowRadius: 16 },
      android: { elevation: 4 },
    }),
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.md,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: t.accent,
  },
  promptText: {
    fontSize: 26,
    fontWeight: '700', // Editorial bold weight instead of thin serif
    lineHeight: 34,
    letterSpacing: -0.5,
    fontFamily: Platform.select({ ios: "System", android: "Roboto" }),
    color: t.text,
    marginBottom: SPACING.xl,
  },
  answerBubble: {
    borderRadius: 16,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: t.surfaceSecondary,
    borderColor: t.border,
  },
  answerText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    color: t.text,
  },
  input: {
    minHeight: 100,
    borderRadius: 16,
    borderWidth: 1,
    padding: SPACING.lg,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: SPACING.xl,
    color: t.text,
    borderColor: t.border,
    backgroundColor: t.surfaceSecondary,
  },
  inputPlaceholder: { 
    fontSize: 16, 
    color: t.subtext 
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.lg,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: t.subtext,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 28,
    backgroundColor: t.text, // High contrast
    gap: 8,
  },
  ctaLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: isDark ? '#000000' : '#FFFFFF',
  },

  // ── Quick Actions (2-Column Apple Widget Layout) ──
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionCard: {
    width: '48%', // Enables the 2-column layout natively
    alignItems: 'flex-start', // Left aligned content for Apple Widget feel
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
    gap: 12,
    position: 'relative',
    ...Platform.select({
      ios: { shadowColor: isDark ? '#000' : '#8A8A8E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: isDark ? 0.2 : 0.06, shadowRadius: 12 },
      android: { elevation: 3 },
    }),
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: t.text,
  },
  lockBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.surfaceSecondary,
  },
  noteBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    zIndex: 2,
  },
  noteBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF', 
  },

  // ── Moment Signal ──
  momentSection: {
    marginTop: SPACING.xl,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
    ...Platform.select({
      ios: { shadowColor: isDark ? '#000' : '#8A8A8E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.2 : 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  momentToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  momentToggleText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: t.text,
  },

  // ── Memory Lane ──
  memoryLaneCard: {
    marginTop: SPACING.md,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
    padding: SPACING.xl,
    ...Platform.select({
      ios: { shadowColor: isDark ? '#000' : '#8A8A8E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: isDark ? 0.2 : 0.06, shadowRadius: 12 },
      android: { elevation: 3 },
    }),
  },
  memoryLaneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  memoryLaneLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: t.primary,
  },
  memoryLanePrompt: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: "System", android: "Roboto" }),
    color: t.text,
    marginBottom: SPACING.sm,
  },
  memoryLaneAnswer: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '400',
    color: t.subtext,
    marginBottom: SPACING.sm,
  },
  memoryLaneDate: {
    fontSize: 12,
    fontWeight: '700',
    color: t.subtext,
    letterSpacing: 0.3,
  },
});

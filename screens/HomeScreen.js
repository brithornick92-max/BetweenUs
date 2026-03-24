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
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useContent } from '../context/ContentContext';
import { DataLayer } from '../services/localfirst';
import PremiumGatekeeper from '../services/PremiumGatekeeper';
import { PremiumFeature } from '../utils/featureFlags';
import { SPACING } from '../utils/theme';
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
import { NicknameEngine, RelationshipMilestones } from '../services/PolishEngine';
import { getMyDisplayName, getPartnerDisplayName } from '../utils/profileNames';

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

function getMomentLabel() {
  const hour = new Date().getHours(); // uses device locale time automatically
  if (hour >= 5 && hour < 17) return "TODAY'S MOMENT";
  return "TONIGHT'S MOMENT";
}

const TONE_HOME_COPY = {
  warm: {
    subheadline: (partner) => `A softer place for you and ${partner}.`,
    ctaDraft: 'Share My Heart',
    ctaEmpty: 'Share Your Thoughts',
    ctaDone: 'Reveal Connection',
    waiting: (partner) => `Waiting gently on ${partner}`,
  },
  playful: {
    subheadline: (partner) => `A little spark for you and ${partner}.`,
    ctaDraft: 'Send the Spark',
    ctaEmpty: 'Start the Spark',
    ctaDone: 'See the Spark',
    waiting: (partner) => `${partner} is up next`,
  },
  intimate: {
    subheadline: (partner) => `A closer space for you and ${partner}.`,
    ctaDraft: 'Open My Heart',
    ctaEmpty: 'Open Up',
    ctaDone: 'Reveal Closeness',
    waiting: (partner) => `Holding for ${partner}`,
  },
  minimal: {
    subheadline: () => 'A quieter space for what matters.',
    ctaDraft: 'Save Reflection',
    ctaEmpty: 'Write Reflection',
    ctaDone: 'Open Reflection',
    waiting: (partner) => `Waiting on ${partner}`,
  },
};

function normalizePrompt(p) {
  if (!p || typeof p !== 'object') return FALLBACK_PROMPT;
  const id = p.id ? String(p.id) : FALLBACK_PROMPT.id;
  const raw = typeof p.text === 'string' ? p.text : '';
  const text = raw.trim() ? raw : FALLBACK_PROMPT.text;
  return { ...p, id, text, heat: typeof p.heat === 'number' ? p.heat : 1, category: typeof p.category === 'string' ? p.category : 'romance' };
}

// Romantic palette colors for action widgets — rose-wine, velvet plum, champagne gold
const ACTIONS = [
  { label: 'Love Note', icon: 'mail-outline', key: 'note', premium: true, color: '#D2121A' }, // Sexy red
  { label: 'Ritual', icon: 'flame-outline', key: 'ritual', color: '#7E4FA3' }, // Velvet plum
  { label: 'Jokes', icon: 'happy-outline', key: 'jokes', premium: true, color: '#D4AA7E' }, // Champagne gold
];

export default function HomeScreen({ navigation }) {
  const { state } = useAppContext();
  const { user, userProfile } = useAuth();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const { todayPrompt, loadTodayPrompt, usageStatus, loadUsageStatus } = useContent();
  const { colors, isDark } = useTheme();

  // Apple Editorial & Velvet Glass Theme Map
  const t = useMemo(() => ({
    background: colors.background,
    surface: colors.surface,
    surfaceSecondary: colors.surface2,
    accent: colors.accent || '#D4AA7E',
    primary: colors.primary || '#D2121A',
    text: colors.text,
    subtext: colors.textMuted,
    border: colors.border,
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
  const [selectedTone, setSelectedTone] = useState('warm');
  const remainingFreePrompts = usageStatus?.remaining?.prompts ?? 1;
  const canWritePrompt = isPremium || !!myAnswer.trim() || remainingFreePrompts > 0;

  // Entrance animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const actionsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    RelationshipMilestones.initFirstOpen().catch(() => {});
    Animated.stagger(80, [
      Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(cardAnim, { toValue: 1, friction: 9, tension: 60, useNativeDriver: true }),
      Animated.spring(actionsAnim, { toValue: 1, friction: 9, tension: 60, useNativeDriver: true }),
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

  useFocusEffect(
    useCallback(() => {
      let active = true;

      NicknameEngine.getConfig()
        .then((config) => {
          if (active) setSelectedTone(config?.tone || 'warm');
        })
        .catch(() => {
          if (active) setSelectedTone('warm');
        });

      return () => {
        active = false;
      };
    }, [])
  );

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    return 'Evening';
  }, []);

  const preferredName = getMyDisplayName(userProfile, state?.userProfile, user?.displayName || null);
  const partnerLabel = getPartnerDisplayName(userProfile, state?.userProfile, 'your partner');
  const bothAnswered = !!myAnswer.trim() && !!partnerAnswer.trim();
  const toneCopy = TONE_HOME_COPY[selectedTone] || TONE_HOME_COPY.warm;

  const handleInlineSave = useCallback(async () => {
    const finalText = inlineText.trim();
    if (!finalText || !prompt?.id || !user?.uid) return;
    setIsSavingInline(true);
    try {
      if (!isPremium && !myAnswer) {
        const accessCheck = await PremiumGatekeeper.canAccessPrompt(user.uid, prompt.heat || 1, false);
        if (!accessCheck.canAccess) {
          showPaywall?.(PremiumFeature.UNLIMITED_PROMPTS);
          return;
        }
      }

      await DataLayer.savePromptAnswer({ promptId: prompt.id, answer: finalText });
      if (!isPremium && !myAnswer) {
        await PremiumGatekeeper.trackPromptUsage(user.uid, prompt.id, false, prompt.heat || 1);
        await loadUsageStatus?.();
      }
      notification(NotificationFeedbackType.Success);
      setMyAnswer(finalText);
      setInlineText('');
    } catch {
      Alert.alert('Something didn\u2019t work', "We couldn\u2019t save your thoughts \u2014 try again?");
    } finally {
      setIsSavingInline(false);
    }
  }, [inlineText, prompt, user, isPremium, myAnswer, showPaywall, loadUsageStatus]);

  const handlePrimaryCTA = useCallback(async () => {
    impact(ImpactFeedbackStyle.Medium);
    if (!promptReady) { navigation.navigate('HeatLevel'); return; }
    if (!myAnswer && inlineText.trim()) { await handleInlineSave(); return; }
    if (!myAnswer && !isPremium && remainingFreePrompts <= 0) {
      showPaywall?.(PremiumFeature.UNLIMITED_PROMPTS);
      return;
    }
    if (!myAnswer) {
      navigation.navigate('PromptAnswer', {
        prompt: { id: prompt.id, text: prompt.text, dateKey: todayKey, heat: prompt.heat, category: prompt.category },
      });
      return;
    }
    navigation.navigate('Reveal', {
      prompt: { id: prompt.id, text: prompt.text, dateKey: todayKey },
      userAnswer: { answer: myAnswer },
      partnerAnswer: partnerAnswer || null,
      bothAnswered,
    });
  }, [
    isPremium,
    promptReady,
    myAnswer,
    partnerAnswer,
    bothAnswered,
    prompt,
    todayKey,
    navigation,
    inlineText,
    handleInlineSave,
    remainingFreePrompts,
    showPaywall,
  ]);

  const primaryCTALabel = useMemo(() => {
    if (!promptReady) return 'Customize Content';
    if (!myAnswer && inlineText.trim()) return isSavingInline ? 'Saving…' : toneCopy.ctaDraft;
    if (!myAnswer) return toneCopy.ctaEmpty;
    if (bothAnswered) return toneCopy.ctaDone;
    return 'See Your Response';
  }, [promptReady, myAnswer, bothAnswered, inlineText, isSavingInline, toneCopy]);

  const statusText = useMemo(() => {
    if (!promptReady || !myAnswer) return null;
    return bothAnswered ? 'Both of you have shared' : toneCopy.waiting(partnerLabel);
  }, [promptReady, myAnswer, bothAnswered, partnerLabel, toneCopy]);

  const handleAction = useCallback(async (key) => {
    impact(ImpactFeedbackStyle.Light);
    if (key === 'note') {
      if (!isPremium) { showPaywall?.(PremiumFeature.LOVE_NOTES); return; }
      navigation.navigate('LoveNotesInbox');
    } else if (key === 'ritual') {
      navigation.navigate('NightRitual');
    } else if (key === 'jokes') {
      if (!isPremium) { showPaywall?.(PremiumFeature.INSIDE_JOKES); return; }
      navigation.navigate('InsideJokes');
    }
  }, [isPremium, showPaywall, navigation]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />

      {/* Deep velvet background gradient */}
      <LinearGradient
        colors={isDark
          ? [t.background, '#120206', '#0A0003', t.background]
          : [t.background, t.surfaceSecondary, t.background]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Background ambience */}
      <GlowOrb color={t.primary} size={500} top={-200} left={SCREEN_W - 200} opacity={isDark ? 0.2 : 0.08} />
      <GlowOrb color={isDark ? '#FFFFFF' : '#F2F2F7'} size={300} top={SCREEN_H * 0.7} left={-100} delay={1500} opacity={isDark ? 0.1 : 0.05} />
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
            <Text style={styles.headerToneLine}>{toneCopy.subheadline(partnerLabel)}</Text>
          </View>
          <TouchableOpacity
            onPress={() => { selection(); navigation.navigate('VibeSignal'); }}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Send a vibe signal"
            style={styles.vibeButton}
          >
            <Icon name="heart-outline" size={30} color={t.primary} />
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
                <Icon name="star-outline" size={14} color={t.accent} />
                <Text style={styles.eyebrow}>{getMomentLabel()}</Text>
              </View>

              <Text style={styles.promptText}>
                {promptReady ? prompt.text : 'Gathering today\'s reflection…'}
              </Text>

              {myAnswer ? (
                <View style={styles.answerBubble}>
                  <Text style={styles.answerText}>{myAnswer}</Text>
                </View>
              ) : canWritePrompt ? (
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
                  onPress={() => showPaywall?.(PremiumFeature.UNLIMITED_PROMPTS)}
                  style={[styles.input, { justifyContent: 'center' }]}
                >
                  <Text style={styles.inputPlaceholder}>You used today's free reflection. Unlock more.</Text>
                </TouchableOpacity>
              )}

              {statusText && (
                <View style={styles.statusRow}>
                  <Icon
                    name={bothAnswered ? 'checkmark-outline' : 'time-outline'}
                    size={16}
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
                <Icon name="arrow-forward-outline" size={20} color={isDark ? "#000000" : "#FFFFFF"} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          <View style={{ height: SPACING.section }} />

          <RelationshipClimate compact />

          <View style={{ height: SPACING.lg }} />

          {/* ── Quick Actions (3-Column Apple Widget Layout) ── */}
          <Animated.View style={[styles.actionsRow, {
            opacity: actionsAnim,
            transform: [{ translateY: actionsAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
          }]}>
            {ACTIONS.map((action, index) => {
              const locked = action.premium && !isPremium;
              const badge = action.key === 'note' && unreadNotes > 0 ? unreadNotes : 0;

              return (
                <TouchableOpacity
                  key={action.key}
                  activeOpacity={0.75}
                  onPress={() => handleAction(action.key)}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  style={styles.actionCard}
                >
                  {locked && (
                    <View style={styles.lockBadge}>
                      <Icon name="lock-closed-outline" size={12} color={action.color} />
                    </View>
                  )}
                  {badge > 0 && (
                    <View style={[styles.noteBadge, { backgroundColor: action.color }]}>
                      <Text style={styles.noteBadgeText}>{badge > 9 ? '9+' : badge}</Text>
                    </View>
                  )}
                  <Icon name={action.icon} size={20} color={action.color} />
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
                <Icon name="time-outline" size={16} color={t.primary} />
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
              <Icon name="color-wand-outline" size={24} color={t.primary} />
              <Text style={styles.momentToggleText} numberOfLines={1} ellipsizeMode="tail">
                Send a moment to {partnerLabel}
              </Text>
              <Icon
                name={showMoments ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={t.subtext}
              />
            </TouchableOpacity>
            {showMoments && <MomentSignal partnerLabel={partnerLabel} />}
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const systemFont = Platform.select({ ios: "System", android: "Roboto" });

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
    fontFamily: systemFont,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: t.subtext,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  headerName: {
    fontFamily: systemFont,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 40,
    color: t.text,
  },
  headerToneLine: {
    fontFamily: systemFont,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: t.subtext,
    marginTop: 4,
  },
  vibeButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.3 : 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },

  // ── Scroll ──
  scroll: {
    paddingHorizontal: SPACING.screen,
    paddingTop: SPACING.sm,
    paddingBottom: 160, // Clear the bottom tab bar securely
  },

  // ── Hero Card ──
  heroCardWrap: { 
    borderRadius: 24, // Deep Apple squircle
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
    padding: SPACING.xl,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDark ? 0.4 : 0.08, shadowRadius: 24 },
      android: { elevation: 6 },
    }),
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  eyebrow: {
    fontFamily: systemFont,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: t.accent,
  },
  promptText: {
    fontFamily: systemFont,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 30,
    letterSpacing: -0.5,
    color: t.text,
    marginBottom: SPACING.xl,
  },
  answerBubble: {
    borderRadius: 20,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: t.surfaceSecondary,
    borderColor: t.border,
  },
  answerText: {
    fontFamily: systemFont,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '400',
    color: t.text,
  },
  input: {
    minHeight: 120,
    borderRadius: 20,
    borderWidth: 1,
    padding: SPACING.lg,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: systemFont,
    marginBottom: SPACING.xl,
    color: t.text,
    borderColor: t.border,
    backgroundColor: t.surfaceSecondary,
  },
  inputPlaceholder: { 
    fontFamily: systemFont,
    fontSize: 17, 
    color: t.subtext 
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.lg,
  },
  statusText: {
    fontFamily: systemFont,
    fontSize: 14,
    fontWeight: '600',
    color: t.subtext,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56, // Tall Apple Action Button
    borderRadius: 28,
    backgroundColor: t.text,
    gap: 8,
  },
  ctaLabel: {
    fontFamily: systemFont,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: isDark ? '#000000' : '#FFFFFF',
  },

  // ── Quick Actions ──
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    flexDirection: 'column', // Stack icon and label vertically
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
    gap: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.3 : 0.05, shadowRadius: 12 },
      android: { elevation: 2 },
    }),
  },
  actionLabel: {
    fontFamily: systemFont,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: t.text,
  },
  lockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.surfaceSecondary,
  },
  noteBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  noteBadgeText: {
    fontFamily: systemFont,
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
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.3 : 0.06, shadowRadius: 16 },
      android: { elevation: 2 },
    }),
  },
  momentToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    gap: 12,
  },
  momentToggleText: {
    fontFamily: systemFont,
    fontSize: 16,
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
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: isDark ? 0.3 : 0.06, shadowRadius: 16 },
      android: { elevation: 3 },
    }),
  },
  memoryLaneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.md,
  },
  memoryLaneLabel: {
    fontFamily: systemFont,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: t.primary,
  },
  memoryLanePrompt: {
    fontFamily: systemFont,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: t.text,
    marginBottom: SPACING.sm,
  },
  memoryLaneAnswer: {
    fontFamily: systemFont,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '400',
    color: t.subtext,
    marginBottom: SPACING.md,
  },
  memoryLaneDate: {
    fontFamily: systemFont,
    fontSize: 13,
    fontWeight: '600',
    color: t.subtext,
    letterSpacing: 0.3,
  },
});

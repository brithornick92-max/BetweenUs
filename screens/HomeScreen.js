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
import { useData } from '../context/DataContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useContent } from '../context/ContentContext';
import { DataLayer } from '../services/localfirst';
import PremiumGatekeeper from '../services/PremiumGatekeeper';
import { PremiumFeature } from '../utils/featureFlags';
import { promptStorage, storage, STORAGE_KEYS } from '../utils/storage';
import { SPACING } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { Share } from 'react-native';
import MomentSignal from '../components/MomentSignal';
import RelationshipClimate from '../components/RelationshipClimate';
import SurpriseTonight from '../components/SurpriseTonight';
import MilestoneCard from '../components/MilestoneCard';
import YearReflectionCard from '../components/YearReflectionCard.jsx';
import WelcomeBack from '../components/WelcomeBack';
import OfflineIndicator from '../components/OfflineIndicator';
import GentleCelebration from '../components/GentleCelebration';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';
import { NicknameEngine, RelationshipMilestones } from '../services/PolishEngine';
import { getMyDisplayName, getPartnerDisplayName } from '../utils/profileNames';
import { FALLBACK_PROMPT } from '../utils/contentLoader';
import StreakBanner from '../components/StreakBanner';
import { PromptCardSkeleton } from '../components/SkeletonLoader';
import ConnectionMemory from '../utils/connectionMemory';
import achievementEngine from '../utils/achievementEngine';
import PreferenceEngine from '../services/PreferenceEngine';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PROMPTED_PARTNER_SHARE_KEY = '@betweenus:promptedPartnerShare';

function dateKey(date) {
  const d = date instanceof Date ? date : new Date(date ?? undefined);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  { label: 'Ritual', icon: 'flame-outline', key: 'ritual', premium: true, color: '#7E4FA3' }, // Velvet plum
  { label: 'Jokes', icon: 'happy-outline', key: 'jokes', premium: true, color: '#D4AA7E' }, // Champagne gold
  { label: 'Intimacy', icon: 'flame', key: 'intimacy', premium: true, color: '#C14953' }, // Deep rose
];

export default function HomeScreen({ navigation }) {
  const { state } = useAppContext();
  const { user, userProfile } = useAuth();
  const { data: dataLayer } = useData();
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
  const [homeLayout, setHomeLayout] = useState({
    type: 'comfortable',
    spacing: { padding: SPACING.screen, gap: SPACING.section },
    fontSize: { title: 34, base: 13 },
  });
  const [showReward, setShowReward] = useState(false);
  const [rewardData, setRewardData] = useState(null);
  const [smartGreeting, setSmartGreeting] = useState('Welcome Back');
  const [smartSubGreeting, setSmartSubGreeting] = useState('Your evening awaits.');
  const [answeredCount, setAnsweredCount] = useState(0);
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
    let active = true;

    const loadHomePersonalization = async () => {
      try {
        const avgSession = await ConnectionMemory.getAverageSessionLength();
        const isCompact = avgSession != null && avgSession < 120;
        if (active) {
          setHomeLayout({
            type: isCompact ? 'compact' : 'comfortable',
            spacing: isCompact
              ? { padding: SPACING.lg, gap: SPACING.lg }
              : { padding: SPACING.screen, gap: SPACING.section },
            fontSize: isCompact
              ? { title: 28, base: 12 }
              : { title: 34, base: 13 },
          });
        }

        const profile = await PreferenceEngine.getContentProfile({});
        const greeting = await PreferenceEngine.getSmartGreeting(profile);
        const seasonGreetings = {
          busy: 'A quick moment',
          cozy: 'Welcome Back',
          growth: 'Growing together',
          adventure: 'Something new awaits',
          rest: 'Take it slow tonight',
        };
        const seasonId = profile?.season?.id || 'cozy';
        if (active) {
          setSmartGreeting(seasonGreetings[seasonId] || 'Welcome Back');
          setSmartSubGreeting(greeting || 'A softer place for what matters tonight.');
        }
      } catch (e) {
        if (__DEV__) console.warn('[Home] personalization load:', e?.message);
      }
    };

    loadHomePersonalization();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const checkForNewAchievements = async () => {
      if (!user?.uid) return;
      try {
        const milestoneData = await achievementEngine.checkAchievements(user.uid, dataLayer);
        const newMilestone = milestoneData?.newlyUnlocked?.[0];
        if (active && newMilestone) {
          setRewardData({
            type: 'milestone',
            title: 'A quiet milestone',
            message: newMilestone.name,
            icon: newMilestone.icon || 'sparkles-outline',
          });
          setShowReward(true);
        }
      } catch (e) {
        if (__DEV__) console.warn('[Home] achievement check:', e?.message);
      }
    };

    checkForNewAchievements();

    return () => {
      active = false;
    };
  }, [user, dataLayer]);

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
        if (row?.answer) {
          setMyAnswer(row.answer);
          setPartnerAnswer(row?.partnerAnswer || '');
          return;
        }

        const saved = await promptStorage.getAnswer(todayKey, prompt.id);
        setMyAnswer(saved?.content || saved?.answer || '');
        setPartnerAnswer(row?.partnerAnswer || '');
      } catch (e) { if (__DEV__) console.warn('[Home] prompt answer fetch:', e?.message); }
    })();
  }, [prompt.id, promptReady, todayKey]);

  useEffect(() => {
    (async () => {
      try {
        const past = await DataLayer.getPromptAnswers({ limit: 50 });
        const answered = (past || []).filter(r => r.answer && r.date_key !== dateKey());
        setAnsweredCount(answered.length);
        if (answered.length > 0) {
          const pick = answered[Math.floor(Math.random() * answered.length)];
          setThrowback(pick);
        }
      } catch (e) { if (__DEV__) console.warn('[Home] throwback fetch:', e?.message); }
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isPremium) return;
      let active = true;
      (async () => {
        try {
          const count = await DataLayer.getUnreadLoveNoteCount();
          if (active) setUnreadNotes(count || 0);
        } catch (e) { if (__DEV__) console.warn('[Home] unread notes fetch:', e?.message); }
      })();
      return () => { active = false; };
    }, [isPremium])
  );

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

      // Schedule engagement notifications (streak-break alert + weekly recap)
      import('../services/WinBackNudges').then(({ default: WinBackNudges }) => {
        if (!active) return;
        // Streak-break loss-aversion alert
        import('../services/localfirst').then(({ DataLayer: DL }) => {
          Promise.all([
            DL.getCheckIns?.({ limit: 90 }).catch(() => []),
            DL.getPromptAnswers?.({ limit: 90 }).catch(() => []),
          ]).then(([checkIns, answers]) => {
            if (!active) return;
            const daySet = new Set();
            for (const ci of (checkIns || [])) {
              const d = new Date(ci.created_at || ci.date_key);
              daySet.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
            }
            for (const a of (answers || [])) { if (a.date_key) daySet.add(a.date_key); }
            const sorted = [...daySet].sort().reverse();
            let streak = 0;
            const today = new Date();
            for (let i = 0; i < sorted.length; i++) {
              const exp = new Date(today); exp.setDate(exp.getDate() - i);
              const k = `${exp.getFullYear()}-${String(exp.getMonth()+1).padStart(2,'0')}-${String(exp.getDate()).padStart(2,'0')}`;
              if (daySet.has(k)) streak++; else break;
            }
            if (streak >= 3) {
              WinBackNudges.scheduleStreakBreakAlert(streak, partnerLabel).catch(() => {});
            }
            // Weekly recap
            const weekAnswers = (answers || []).filter(a => {
              if (!a.date_key) return false;
              const d = new Date(a.date_key + 'T00:00:00');
              const diff = (today - d) / (1000 * 60 * 60 * 24);
              return diff <= 7;
            });
            WinBackNudges.scheduleWeeklyRecap({
              prompts: weekAnswers.length,
              streak,
              partnerName: partnerLabel,
            }).catch(() => {});
          }).catch(() => {});
        }).catch(() => {});
      }).catch(() => {});

      return () => {
        active = false;
      };
    }, [partnerLabel])
  );

  // ── Real-time: refresh partnerAnswer when partner submits a prompt answer ──
  useFocusEffect(
    useCallback(() => {
      if (!promptReady || !state?.coupleId) return;

      let channelRef = null;
      let cancelled = false;

      const setup = async () => {
        try {
          const mod = require('../config/supabase');
          const sb = mod.supabase;
          if (!sb || cancelled) return;

          const channel = sb
            .channel(`partner_prompt_${state.coupleId}`)
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'couple_data',
                filter: `couple_id=eq.${state.coupleId}`,
              },
              (payload) => {
                const row = payload.new;
                if (row?.data_type !== 'prompt_answer') return;
                if (row?.created_by === user?.uid) return; // skip own saves
                // Refresh partner answer from DataLayer
                DataLayer.getPromptAnswerForToday(prompt.id)
                  .then((row) => { if (!cancelled && row?.partnerAnswer) setPartnerAnswer(row.partnerAnswer); })
                  .catch(() => {});
              }
            )
            .subscribe();

          if (cancelled) { sb.removeChannel(channel); return; }
          channelRef = channel;
        } catch { /* non-critical */ }
      };

      setup();

      return () => {
        cancelled = true;
        if (channelRef) {
          try {
            const mod = require('../config/supabase');
            mod.supabase?.removeChannel(channelRef);
          } catch {}
          channelRef = null;
        }
      };
    }, [state?.coupleId, prompt?.id, promptReady, user?.uid])
  );

  const preferredName = getMyDisplayName(userProfile, state?.userProfile, user?.displayName || null);
  const partnerLabel = getPartnerDisplayName(userProfile, state?.userProfile, 'your partner');
  const bothAnswered = !!myAnswer.trim() && !!partnerAnswer.trim();
  const toneCopy = TONE_HOME_COPY[selectedTone] || TONE_HOME_COPY.warm;

  const handleInlineSave = useCallback(async () => {
    const finalText = inlineText.trim();
    if (!finalText || !prompt?.id || !user?.uid || isSavingInline) return;
    setIsSavingInline(true);
    try {
      if (!isPremium && !myAnswer) {
        const accessCheck = await PremiumGatekeeper.canAccessPrompt(user.uid, prompt.heat || 1, isPremium);
        if (!accessCheck.canAccess) {
          showPaywall?.(PremiumFeature.UNLIMITED_PROMPTS);
          return;
        }
      }

      await promptStorage.setAnswer(todayKey, prompt.id, {
        answer: finalText,
        timestamp: Date.now(),
      });

      let savedOffline = false;
      try {
        await DataLayer.savePromptAnswer({ promptId: prompt.id, answer: finalText, heatLevel: prompt.heat || 1 });
      } catch (dataLayerError) {
        savedOffline = true;
        if (__DEV__) console.warn('[Home] DataLayer prompt save failed:', dataLayerError?.message);
      }

      if (!isPremium && !myAnswer) {
        await PremiumGatekeeper.trackPromptUsage(user.uid, prompt.id, isPremium, prompt.heat || 1);
        await loadUsageStatus?.();
      }
      notification(NotificationFeedbackType.Success);
      setMyAnswer(finalText);
      setInlineText('');

      if (savedOffline) {
        Alert.alert('Saved locally', "Your answer will sync with your partner when you're back online.");
      }

      // Notify partner that we answered the prompt
      import('../services/PartnerNotifications').then(({ default: PN }) =>
        PN.promptAnswered(getMyDisplayName(userProfile, state?.userProfile, null))
      ).catch(() => {});

      // Viral loop: prompt free users to invite partner after first answer
      if (!isPremium) {
        const hasPromptedShare = await storage.get(PROMPTED_PARTNER_SHARE_KEY, false);
        const coupleId = await storage.get(STORAGE_KEYS.COUPLE_ID, null);
        if (!hasPromptedShare && !coupleId) {
          await storage.set(PROMPTED_PARTNER_SHARE_KEY, true);
          setTimeout(() => {
            Alert.alert(
              'Share with your partner?',
              'Invite them to Between Us so they can answer too \u2014 and you can reveal each other\u2019s responses.',
              [
                { text: 'Not Now', style: 'cancel' },
                {
                  text: 'Invite Partner',
                  onPress: () => {
                    Share.share({
                      message: 'I just answered a relationship prompt on Between Us \u2014 download it so we can share our answers together! https://apps.apple.com/app/between-us',
                    }).catch(() => {});
                  },
                },
              ]
            );
          }, 800);
        }
      }
    } catch {
      Alert.alert('Something didn\u2019t work', "We couldn\u2019t save your thoughts \u2014 try again?");
    } finally {
      setIsSavingInline(false);
    }
  }, [inlineText, prompt, user, isPremium, myAnswer, showPaywall, loadUsageStatus, isSavingInline]);

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
      if (!isPremium) {
        Alert.alert(
          `${partnerLabel} can send you love notes`,
          `Unlock premium so ${partnerLabel} can send you private messages — and you can write them back.`,
          [
            { text: 'Not Now', style: 'cancel' },
            { text: 'Unlock Premium', onPress: () => showPaywall?.(PremiumFeature.LOVE_NOTES) },
          ]
        );
        return;
      }
      navigation.navigate('LoveNotesInbox');
    } else if (key === 'ritual') {
      if (!isPremium) {
        Alert.alert(
          `Tonight's ritual with ${partnerLabel}`,
          `Premium unlocks guided nightly rituals you and ${partnerLabel} can do together — check-ins, gratitude, and more.`,
          [
            { text: 'Not Now', style: 'cancel' },
            { text: 'Unlock Premium', onPress: () => showPaywall?.(PremiumFeature.NIGHT_RITUAL_MODE) },
          ]
        );
        return;
      }
      navigation.navigate('NightRitual');
    } else if (key === 'jokes') {
      if (!isPremium) { showPaywall?.(PremiumFeature.INSIDE_JOKES); return; }
      navigation.navigate('InsideJokes');
    } else if (key === 'intimacy') {
      if (!isPremium) {
        Alert.alert(
          `Explore intimacy with ${partnerLabel}`,
          `Premium unlocks illustrated intimacy positions with weekly new releases for you and ${partnerLabel}.`,
          [
            { text: 'Not Now', style: 'cancel' },
            { text: 'Unlock Premium', onPress: () => showPaywall?.(PremiumFeature.HEAT_LEVELS_4_5) },
          ]
        );
        return;
      }
      navigation.navigate('IntimacyPositions');
    }
  }, [isPremium, showPaywall, navigation, partnerLabel]);

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
            paddingHorizontal: homeLayout.spacing.padding,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
          }]}
        >
          <View style={styles.headerLeft}>
            <Text style={[styles.headerGreetingSub, { fontSize: homeLayout.fontSize.base, color: t.primary }]}>
              {smartGreeting},
            </Text>
            <Text style={[styles.headerName, { fontSize: homeLayout.fontSize.title }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{preferredName || 'You'}</Text>
            <Text style={styles.headerToneLine}>{smartSubGreeting || toneCopy.subheadline(partnerLabel)}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => { selection(); navigation.navigate('SavedMoments'); }}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Open saved moments and prompts"
              testID="open-saved-moments-button"
              style={styles.archiveButton}
            >
              <Icon name="archive-outline" size={24} color={t.text} />
              <Text style={styles.archiveButtonText}>Saved</Text>
            </TouchableOpacity>
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
          </View>
        </Animated.View>

        <OfflineIndicator />

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: homeLayout.spacing.padding, paddingTop: homeLayout.type === 'compact' ? SPACING.xs : SPACING.sm }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <WelcomeBack />
          <MilestoneCard />

          {/* ── Partner Answered Banner (highest priority pull-back) ── */}
          {partnerAnswer && myAnswer && !bothAnswered && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handlePrimaryCTA}
              style={[styles.partnerAnsweredBanner, { backgroundColor: t.primary }]}
            >
              <Icon name="chatbubble-ellipses-outline" size={18} color="#FFF" />
              <Text style={styles.partnerAnsweredText}>
                {partnerLabel} just answered — tap to see both responses
              </Text>
              <Icon name="arrow-forward-outline" size={16} color="#FFF" />
            </TouchableOpacity>
          )}
          {partnerAnswer && !myAnswer && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handlePrimaryCTA}
              style={[styles.partnerAnsweredBanner, { backgroundColor: isDark ? '#1C1C1E' : '#FFF', borderWidth: 1.5, borderColor: t.primary }]}
            >
              <Icon name="time-outline" size={18} color={t.primary} />
              <Text style={[styles.partnerAnsweredText, { color: t.primary }]}>
                {partnerLabel} answered — your turn to share
              </Text>
              <Icon name="arrow-forward-outline" size={16} color={t.primary} />
            </TouchableOpacity>
          )}

          {/* ── Streak Counter ── */}
          <View style={{ paddingHorizontal: SPACING.screen, marginBottom: SPACING.md }}>
            <StreakBanner onPress={() => navigation.navigate('Achievements')} />
          </View>

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
                {promptReady ? prompt.text : ''}
              </Text>

              {!promptReady && <PromptCardSkeleton />}

              {myAnswer ? (
                <View style={styles.answerBubble}>
                  <Text style={styles.answerText}>{myAnswer}</Text>
                  <View style={styles.partnerVisibilityRow}>
                    <Icon name="eye-outline" size={13} color={t.primary} />
                    <Text style={styles.partnerVisibilityText}>{partnerLabel} can see this</Text>
                  </View>
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
                  <Text style={styles.inputPlaceholder}>
                    {`You’ve used today’s free reflection. ${isPremium ? '' : 'Premium unlocks all prompts across 5 heat levels.'}`}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    <Icon name="lock-open-outline" size={14} color={t.primary} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: t.primary }}>Unlock more</Text>
                  </View>
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

          <View style={{ height: homeLayout.spacing.gap }} />

          <RelationshipClimate compact />

          <View style={{ height: homeLayout.type === 'compact' ? SPACING.md : SPACING.lg }} />

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

          <View style={{ height: homeLayout.spacing.gap }} />

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

          <View style={{ height: homeLayout.type === 'compact' ? SPACING.md : SPACING.lg }} />

          <SurpriseTonight navigation={navigation} />

          {/* ── Soft Upgrade Nudge (free users with 3+ shared moments) ── */}
          {!isPremium && answeredCount >= 3 && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => showPaywall?.(PremiumFeature.UNLIMITED_PROMPTS)}
              style={[styles.softNudgeCard, { backgroundColor: t.surface, borderColor: t.border }]}
            >
              <View style={styles.softNudgeInner}>
                <Icon name="heart-circle-outline" size={28} color={t.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.softNudgeTitle, { color: t.text }]}>
                    You've shared {answeredCount} moments together
                  </Text>
                  <Text style={[styles.softNudgeBody, { color: t.subtext }]}>
                    A year from now, you'll have a vault of every answer, every memory, every spark. Premium keeps your story safe — and growing.
                  </Text>
                </View>
              </View>
              <View style={styles.softNudgeCTA}>
                <Text style={[styles.softNudgeCTAText, { color: t.primary }]}>Protect your story</Text>
                <Icon name="arrow-forward-outline" size={14} color={t.primary} />
              </View>
            </TouchableOpacity>
          )}

          {/* ── Year Reflection (all users — free users hit paywall) ── */}
          <View style={{ height: SPACING.xl }} />
          <YearReflectionCard onPress={() => {
            impact(ImpactFeedbackStyle.Light);
            if (!isPremium) {
              showPaywall?.(PremiumFeature.YEAR_REFLECTION);
              return;
            }
            navigation.navigate('YearReflection');
          }} />

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
            <MomentSignal
              partnerLabel={partnerLabel}
              visible={showMoments}
              onReceive={() => setShowMoments(true)}
            />
          </View>

        </ScrollView>
      </SafeAreaView>

      {rewardData && (
        <GentleCelebration
          visible={showReward}
          title={rewardData.title}
          message={rewardData.message}
          icon={rewardData.icon}
          onComplete={() => setShowReward(false)}
        />
      )}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
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
  archiveButton: {
    minWidth: 82,
    height: 56,
    paddingHorizontal: 14,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.3 : 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  archiveButtonText: {
    fontFamily: systemFont,
    fontSize: 13,
    fontWeight: '700',
    color: t.text,
  },

  // ── Scroll ──
  scroll: {
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
  partnerVisibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
  },
  partnerVisibilityText: {
    fontFamily: systemFont,
    fontSize: 12,
    fontWeight: '600',
    color: t.primary,
    opacity: 0.75,
  },
  partnerAnsweredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: SPACING.screen,
    marginBottom: SPACING.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  partnerAnsweredText: {
    flex: 1,
    fontFamily: systemFont,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
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
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionCard: {
    width: '48%',
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
    marginHorizontal: -4,
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

  // ── Soft Upgrade Nudge ──
  softNudgeCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.25 : 0.05, shadowRadius: 12 },
      android: { elevation: 2 },
    }),
  },
  softNudgeInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: SPACING.md,
  },
  softNudgeTitle: {
    fontFamily: systemFont,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  softNudgeBody: {
    fontFamily: systemFont,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  softNudgeCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  softNudgeCTAText: {
    fontFamily: systemFont,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});

// screens/HomeScreen.js — "Today's Moment" — Apple Editorial
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
  Share,
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
import { PremiumFeature } from '../utils/featureFlags';
import { promptStorage, storage, STORAGE_KEYS } from '../utils/storage';
import { SPACING } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import MilestoneCard from '../components/MilestoneCard';
import WelcomeBack from '../components/WelcomeBack';
import OfflineIndicator from '../components/OfflineIndicator';
import GentleCelebration from '../components/GentleCelebration';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';
import { RelationshipMilestones } from '../services/PolishEngine';
import {
  markAnniversaryPopupSeen,
  shouldShowAnniversaryPopup,
} from '../services/AnniversaryMomentService';
import { getMyDisplayName, getPartnerDisplayName } from '../utils/profileNames';
import { FALLBACK_PROMPT, getPromptById, isTodayBetweenUsPrompt } from '../utils/contentLoader';
import {
  canShowPartnerPromptQuote,
  chooseDailyPartnerPromptQuote,
  getPartnerPromptQuoteCandidateCount,
} from '../utils/partnerPromptQuote';

import { PromptCardSkeleton } from '../components/SkeletonLoader';
import ConnectionMemory from '../utils/connectionMemory';
import { checkAchievements } from '../utils/achievementEngine';
import * as PreferenceEngine from '../services/PreferenceEngine';
import useProgressiveDisclosure from '../hooks/useProgressiveDisclosure';
import { CONTENT_TYPES } from '../services/WeeklyContentSetService';
import {
  canSaveFreePromptAnswer,
  resolvePromptUsageUserId,
  trackFreePromptAnswerUsage,
} from '../utils/freePromptAnswerQuota';
import { isItemInStableFreeWeeklyDeck } from '../utils/freeWeeklyDeckAccess';
import { getDailyContentDateKey } from '../utils/dailyContentDate';
import { resolveVisibleDailyPromptState } from '../utils/dailyPromptState';
import { getSparkAccessGate } from '../utils/sparkAccessGate';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PROMPTED_PARTNER_SHARE_KEY = '@betweenus:cache:promptedPartnerShare';

const loadAllBundledPrompts = () => {
  const bundled = require('../content/prompts.json');
  if (Array.isArray(bundled)) return bundled;
  if (Array.isArray(bundled?.items)) return bundled.items;
  if (Array.isArray(bundled?.prompts)) return bundled.prompts;
  if (Array.isArray(bundled?.default)) return bundled.default;
  if (Array.isArray(bundled?.default?.items)) return bundled.default.items;
  if (Array.isArray(bundled?.default?.prompts)) return bundled.default.prompts;
  return [];
};

function deriveRitualState({ isLinked, myAnswer, partnerHasAnswered, isRevealed }) {
  if (isRevealed) return 'revealed';
  if (myAnswer && partnerHasAnswered) return 'both_answered_ready';
  if (myAnswer) return isLinked ? 'answered_waiting' : 'solo_answered';
  if (isLinked && partnerHasAnswered) return 'partner_answered';
  if (isLinked) return 'linked_unanswered';
  return 'solo_unanswered';
}

function normalizePrompt(p) {
  if (!p || typeof p !== 'object') return FALLBACK_PROMPT;
  const id = p.id ? String(p.id) : FALLBACK_PROMPT.id;
  const raw = typeof p.text === 'string' ? p.text : '';
  const text = raw.trim() ? raw : FALLBACK_PROMPT.text;
  return {
    ...p,
    id,
    text,
    heat: typeof p.heat === 'number' ? p.heat : 1,
    category: typeof p.category === 'string' ? p.category : 'romance',
  };
}

// Romantic palette colors for action widgets — rose-wine, velvet plum, champagne gold
const ACTIONS = [
  { label: 'Notes', icon: 'document-text-outline', key: 'journal', premium: false, color: '#8E8E93' },
  { label: 'Play', icon: 'chatbubbles-outline', key: 'quiz', premium: false, color: '#8E8E93' },
  { label: 'Keepsake', icon: 'images-outline', key: 'memories', premium: false, color: '#8E8E93' },
  { label: 'Spark', icon: 'flame', key: 'intimacy', premium: false, color: '#8E8E93' },
];

export default function HomeScreen({ navigation }) {
  const { state } = useAppContext();
  const { user, userProfile } = useAuth();
  const { data: dataLayer } = useData();
  const {
    isPremiumEffective: isPremium,
    isLoading: entitlementsLoading,
    showPaywall,
  } = useEntitlements();
  const { todayPrompt, loadTodayPrompt, loadUsageStatus } = useContent();
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
  }), [colors]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  const currentDailyKey = getDailyContentDateKey();
  const dailyPromptState = useMemo(
    () => resolveVisibleDailyPromptState(todayPrompt, currentDailyKey),
    [todayPrompt, currentDailyKey]
  );
  const prompt = useMemo(() => normalizePrompt(dailyPromptState.prompt), [dailyPromptState.prompt]);
  const todayKey = dailyPromptState.dateKey;
  const promptReady = dailyPromptState.promptReady;

  const [myAnswer, setMyAnswer] = useState('');
  const [partnerAnswer, setPartnerAnswer] = useState('');
  const [partnerHasAnswered, setPartnerHasAnswered] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [includePromptInKeepsake, setIncludePromptInKeepsake] = useState(false);
  const [inlineText, setInlineText] = useState('');
  const [isSavingInline, setIsSavingInline] = useState(false);
  const [throwback, setThrowback] = useState(null);
  const [homeLayout, setHomeLayout] = useState({
    type: 'comfortable',
    spacing: { padding: SPACING.screen, gap: SPACING.section },
    fontSize: { title: 34, base: 13 },
  });
  const [showReward, setShowReward] = useState(false);
  const [rewardData, setRewardData] = useState(null);
  const [smartGreeting, setSmartGreeting] = useState('Welcome Back');
  const [answeredCount, setAnsweredCount] = useState(0);
  const canWritePrompt = true;
  const disclosure = useProgressiveDisclosure(answeredCount);
  const preferredName = getMyDisplayName(userProfile, state?.userProfile, user?.displayName || null);
  const partnerLabel = getPartnerDisplayName(userProfile, state?.userProfile, 'your partner');
  const coupleId = state?.coupleId || userProfile?.coupleId || null;
  const isLinked = !!coupleId;
  const activePromptUserId = user?.id || user?.uid || state?.userId || null;

  // Entrance animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const actionsAnim = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);
  const savingInlineRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

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
        const seasonGreetings = {
          busy: 'A quick moment',
          cozy: 'Just us',
          growth: 'Choosing each other',
          adventure: 'A new spark',
          rest: 'Take it slow',
        };
        const seasonId = profile?.season?.id || 'cozy';

        if (active) {
          setSmartGreeting(seasonGreetings[seasonId] || 'Welcome Back');
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
        const milestoneData = await checkAchievements(user.uid, dataLayer);
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

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const checkAnniversaryMoment = async () => {
        const relationshipStartDate = userProfile?.relationshipStartDate || state?.userProfile?.relationshipStartDate;
        if (!relationshipStartDate) return;

        try {
          const anniversaryMoment = await shouldShowAnniversaryPopup(relationshipStartDate);
          if (!active || !anniversaryMoment) return;

          await markAnniversaryPopupSeen(anniversaryMoment.key);
          if (!active) return;

          setRewardData({
            type: 'anniversary',
            title: anniversaryMoment.title,
            message: anniversaryMoment.message,
            icon: anniversaryMoment.icon,
          });
          setShowReward(true);
        } catch (e) {
          if (__DEV__) console.warn('[Home] anniversary moment check:', e?.message);
        }
      };

      checkAnniversaryMoment();

      return () => {
        active = false;
      };
    }, [state?.userProfile?.relationshipStartDate, userProfile?.relationshipStartDate])
  );

  useEffect(() => {
    if (user && !todayPrompt && typeof loadTodayPrompt === 'function') {
      loadTodayPrompt(null).catch(() => {});
    }
  }, [user, todayPrompt, loadTodayPrompt]);

  useEffect(() => {
    if (user && dailyPromptState.isStale && typeof loadTodayPrompt === 'function') {
      loadTodayPrompt(null).catch(() => {});
    }
  }, [user, dailyPromptState.isStale, loadTodayPrompt]);

  useFocusEffect(
    useCallback(() => {
      if (!user || typeof loadTodayPrompt !== 'function') return undefined;
      loadTodayPrompt(null).catch(() => {});
      return undefined;
    }, [user, loadTodayPrompt])
  );

  useEffect(() => {
    setMyAnswer('');
    setPartnerAnswer('');
    setPartnerHasAnswered(false);
    setIsRevealed(false);
    setIncludePromptInKeepsake(false);
    setInlineText('');
  }, [activePromptUserId, prompt.id, todayKey]);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!promptReady) return;

      try {
        const row = await DataLayer.getPromptAnswerForToday(prompt.id, todayKey);
        if (!active) return;

        if (row?.answer) {
          setMyAnswer(row.answer);
          setPartnerAnswer(row?.partnerAnswer || '');
          setPartnerHasAnswered(!!(row?.partnerHasAnswered || row?.partnerAnswer));
          setIsRevealed(!!(row?.isRevealed || row?.is_revealed));
          setIncludePromptInKeepsake(!!row?.includeInKeepsake);
          return;
        }

        const saved = activePromptUserId
          ? await promptStorage.getAnswerForUser(todayKey, prompt.id, activePromptUserId)
          : await promptStorage.getAnswer(todayKey, prompt.id);
        if (!active) return;

        setMyAnswer(saved?.content || saved?.answer || '');
        setPartnerAnswer(row?.partnerAnswer || '');
        setPartnerHasAnswered(!!(row?.partnerHasAnswered || row?.partnerAnswer));
        setIsRevealed(!!saved?.isRevealed);
        setIncludePromptInKeepsake(!!saved?.includeInKeepsake);
      } catch (e) {
        if (__DEV__) console.warn('[Home] prompt answer fetch:', e?.message);
      }
    })();

    return () => {
      active = false;
    };
  }, [activePromptUserId, prompt.id, promptReady, todayKey]);

  useFocusEffect(
    useCallback(() => {
      if (!promptReady) return undefined;

      let active = true;

      (async () => {
        try {
          const row = await DataLayer.getPromptAnswerForToday(prompt.id, todayKey);
          if (!active) return;

          if (row?.answer) {
            setMyAnswer(row.answer);
            setPartnerAnswer(row?.partnerAnswer || '');
            setPartnerHasAnswered(!!(row?.partnerHasAnswered || row?.partnerAnswer));
            setIsRevealed(!!(row?.isRevealed || row?.is_revealed));
            setIncludePromptInKeepsake(!!row?.includeInKeepsake);
            return;
          }

          const saved = activePromptUserId
            ? await promptStorage.getAnswerForUser(todayKey, prompt.id, activePromptUserId)
            : await promptStorage.getAnswer(todayKey, prompt.id);
          if (!active) return;

          setMyAnswer(saved?.content || saved?.answer || '');
          setPartnerAnswer(row?.partnerAnswer || '');
          setPartnerHasAnswered(!!(row?.partnerHasAnswered || row?.partnerAnswer));
          setIsRevealed(!!saved?.isRevealed);
          setIncludePromptInKeepsake(!!saved?.includeInKeepsake);
        } catch (e) {
          if (__DEV__) console.warn('[Home] prompt answer focus refresh:', e?.message);
        }
      })();

      return () => {
        active = false;
      };
    }, [activePromptUserId, prompt.id, promptReady, todayKey])
  );

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const [past, shared] = await Promise.all([
          DataLayer.getPromptAnswers({ limit: 200 }),
          DataLayer.getSharedPromptAnswers?.({ limit: 500 }) || Promise.resolve([]),
        ]);
        if (!active) return;

        const answered = (past || []).filter((r) =>
          r.answer
          && r.date_key !== todayKey
          && !String(r.prompt_id || '').startsWith('quiz:')
        );
        setAnsweredCount(answered.length);

        const partnerQuoteCount = getPartnerPromptQuoteCandidateCount(shared || []);
        const canShowQuote = canShowPartnerPromptQuote({
          answeredCount: partnerQuoteCount,
          minAnswers: 1,
        });

        if (!canShowQuote) {
          setThrowback(null);
          return;
        }

        const quote = await chooseDailyPartnerPromptQuote(shared || [], {
          relationshipStartDate: userProfile?.relationshipStartDate || state?.userProfile?.relationshipStartDate || null,
        });

        if (!quote) {
          setThrowback(null);
          return;
        }

        const quotePrompt = getPromptById(quote.prompt_id);

        setThrowback({
          ...quote,
          promptText: quotePrompt?.text || 'A past moment together',
        });
      } catch (e) {
        if (__DEV__) console.warn('[Home] throwback fetch:', e?.message);
      }
    })();

    return () => {
      active = false;
    };
  }, [state?.userProfile?.relationshipStartDate, todayKey, userProfile?.relationshipStartDate]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      // Schedule soft return invitations and the weekly recap.
      import('../services/WinBackNudges').then(({ default: WinBackNudges }) => {
        if (!active) return;

        import('../services/localfirst').then(({ DataLayer: DL }) => {
          Promise.all([
            DL.getCheckIns?.({ limit: 90 }).catch(() => []),
            DL.getPromptAnswers?.({ limit: 90 }).catch(() => []),
          ]).then(([checkIns, answers]) => {
            if (!active) return;

            const daySet = new Set();

            for (const ci of (checkIns || [])) {
              const d = new Date(ci.created_at || ci.date_key);
              daySet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
            }

            for (const a of (answers || [])) {
              if (String(a.prompt_id || '').startsWith('quiz:')) continue;
              if (a.date_key) daySet.add(a.date_key);
            }

            const sorted = [...daySet].sort().reverse();
            let streak = 0;
            const today = new Date();

            for (let i = 0; i < sorted.length; i += 1) {
              const exp = new Date(today);
              exp.setDate(exp.getDate() - i);
              const k = `${exp.getFullYear()}-${String(exp.getMonth() + 1).padStart(2, '0')}-${String(exp.getDate()).padStart(2, '0')}`;

              if (daySet.has(k)) streak += 1;
              else break;
            }

            if (streak >= 3) {
              WinBackNudges.scheduleStreakBreakAlert(streak, partnerLabel, isPremium).catch(() => {});
            }

            const weekAnswers = (answers || []).filter((a) => {
              if (String(a.prompt_id || '').startsWith('quiz:')) return false;
              if (!a.date_key) return false;
              const d = new Date(`${a.date_key}T00:00:00`);
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
    }, [partnerLabel, isPremium])
  );

  // ── Real-time: refresh partner status when partner submits or reveals ──
  useFocusEffect(
    useCallback(() => {
      if (!promptReady || !coupleId) return undefined;

      let channelRef = null;
      let cancelled = false;

      const setup = async () => {
        try {
          const mod = require('../config/supabase');
          const sb = mod.supabase;
          if (!sb || cancelled) return;

          const channel = sb
            .channel(`partner_prompt_${coupleId}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'couple_data',
                filter: `couple_id=eq.${coupleId}`,
              },
              (payload) => {
                const row = payload.new || payload.old;
                const currentUserId = user?.uid || user?.id;

                if (!['prompt_answer', 'prompt_answer_status'].includes(row?.data_type)) return;
                if (currentUserId && row?.created_by === currentUserId) return;
                if (row?.value?.promptId !== prompt.id || row?.value?.dateKey !== todayKey) return;

                DataLayer.getPromptAnswerForToday(prompt.id, todayKey)
                  .then((row) => {
                    if (cancelled) return;
                    setPartnerAnswer(row?.partnerAnswer || '');
                    setPartnerHasAnswered(!!(row?.partnerHasAnswered || row?.partnerAnswer));
                    setIsRevealed(!!(row?.isRevealed || row?.is_revealed));
                    setIncludePromptInKeepsake(!!row?.includeInKeepsake);
                  })
                  .catch(() => {});
              }
            )
            .subscribe();

          if (cancelled) {
            sb.removeChannel(channel);
            return;
          }

          channelRef = channel;
        } catch {
          // non-critical
        }
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
    }, [coupleId, prompt?.id, promptReady, todayKey, user?.id, user?.uid])
  );

  const bothAnswered = !!myAnswer.trim() && partnerHasAnswered;
  const ritualState = useMemo(() => deriveRitualState({
    isLinked,
    myAnswer: myAnswer.trim(),
    partnerHasAnswered,
    isRevealed,
  }), [isLinked, myAnswer, partnerHasAnswered, isRevealed]);

  const ritualCopy = useMemo(() => ({
    solo_unanswered: {
      eyebrow: 'TODAY BETWEEN US',
      title: promptReady ? prompt.text : 'A small moment for today',
      body: null,
      primaryLabel: "Answer today's question",
      secondaryLabel: 'Invite your partner',
    },
    linked_unanswered: {
      eyebrow: 'TODAY BETWEEN US',
      title: promptReady ? prompt.text : `A small moment for you and ${partnerLabel}`,
      body: null,
      primaryLabel: "Answer today's question",
      secondaryLabel: null,
    },
    partner_answered: {
      eyebrow: 'PARTNER SAVED',
      title: promptReady ? prompt.text : `A small moment for you and ${partnerLabel}`,
      body: `${partnerLabel} saved their answer. Lock in yours to reveal.`,
      primaryLabel: "Answer today's question",
      secondaryLabel: null,
    },
    answered_waiting: {
      eyebrow: 'SAVED FOR REVEAL',
      title: promptReady ? prompt.text : `A small moment for you and ${partnerLabel}`,
      body: `Your answer is saved and locked in. Waiting for ${partnerLabel}.`,
      primaryLabel: 'Answer saved',
      secondaryLabel: null,
    },
    solo_answered: {
      eyebrow: 'SAVED',
      title: promptReady ? prompt.text : 'Your answer is saved',
      body: 'Your answer is saved. Add it to Keepsake or invite your partner whenever you are ready.',
      primaryLabel: includePromptInKeepsake ? 'In Keepsake' : 'Add to Keepsake',
      secondaryLabel: 'Invite your partner',
    },
    both_answered_ready: {
      eyebrow: 'PRIVATE REVEAL',
      title: 'Your private reveal is ready',
      body: null,
      primaryLabel: 'Both answers saved - reveal',
      secondaryLabel: null,
    },
    revealed: {
      eyebrow: 'REVEALED',
      title: 'You showed up for each other today',
      body: null,
      primaryLabel: includePromptInKeepsake ? 'In Keepsake' : 'Add to Keepsake',
      secondaryLabel: 'Plan something from this',
    },
  }[ritualState]), [includePromptInKeepsake, partnerLabel, prompt.text, promptReady, ritualState]);

  const handleInlineSave = useCallback(async () => {
    const finalText = inlineText.trim();
    const activeUserId = activePromptUserId;
    if (!finalText || !prompt?.id || !activeUserId || savingInlineRef.current) return;

    savingInlineRef.current = true;
    setIsSavingInline(true);

    try {
      const usageUserId = resolvePromptUsageUserId(user, userProfile);

      if (!isPremium && !myAnswer) {
        const isDailyBetweenUsPrompt = isTodayBetweenUsPrompt(prompt);
        const profile = await PreferenceEngine.getContentProfile(userProfile || {});

        if (!isDailyBetweenUsPrompt) {
          const weeklyEligiblePrompts = loadAllBundledPrompts().filter((item) =>
            PreferenceEngine.getPromptVisibilityState(item, profile).visible
          );
          const isWeeklyPrompt = await isItemInStableFreeWeeklyDeck(prompt.id, weeklyEligiblePrompts, {
            contentType: CONTENT_TYPES.PROMPTS,
            user,
            userProfile,
            userSettings: profile || userProfile || {},
          });

          if (!isWeeklyPrompt) {
            showPaywall?.(PremiumFeature.UNLIMITED_PROMPTS);
            return;
          }
        }

        const accessCheck = await canSaveFreePromptAnswer({
          userId: usageUserId,
          user,
          userProfile,
          isPremium,
          promptId: prompt.id,
        });

        if (!accessCheck.canSave) {
          showPaywall?.(PremiumFeature.UNLIMITED_PROMPTS);
          return;
        }
      }

      let nextPartnerAnswer = partnerAnswer;
      let nextPartnerHasAnswered = partnerHasAnswered;
      let nextRevealed = false;

      try {
        await DataLayer.savePromptAnswer({
          promptId: prompt.id,
          answer: finalText,
          heatLevel: prompt.heat || 1,
          dateKey: todayKey,
          includeInKeepsake: false,
        });

        const refreshedRow = await DataLayer.getPromptAnswerForToday(prompt.id, todayKey);
        nextPartnerAnswer = refreshedRow?.partnerAnswer || '';
        nextPartnerHasAnswered = !!(refreshedRow?.partnerHasAnswered || refreshedRow?.partnerAnswer);
        nextRevealed = !!(refreshedRow?.isRevealed || refreshedRow?.is_revealed);
      } catch (dataLayerError) {
        if (__DEV__) console.warn('[Home] DataLayer prompt save failed:', dataLayerError?.message);
      }

      await promptStorage.setAnswer(todayKey, prompt.id, {
        answer: finalText,
        userId: activePromptUserId || undefined,
        timestamp: Date.now(),
        isRevealed: nextRevealed,
        includeInKeepsake: false,
      });

      if (!isPremium && !myAnswer) {
        await trackFreePromptAnswerUsage({
          userId: usageUserId,
          user,
          userProfile,
          isPremium,
          promptId: prompt.id,
        });
      }

      if (!isPremium && !myAnswer) {
        try {
          await loadUsageStatus?.();
        } catch (usageError) {
          if (__DEV__) console.warn('[Home] Usage status refresh failed:', usageError?.message);
        }
      }

      notification(NotificationFeedbackType.Success);
      setMyAnswer(finalText);
      setPartnerAnswer(nextPartnerAnswer);
      setPartnerHasAnswered(nextPartnerHasAnswered);
      setIsRevealed(nextRevealed);
      setInlineText('');

      if (!isPremium) {
        const hasPromptedShare = await storage.get(PROMPTED_PARTNER_SHARE_KEY, false);
        const coupleId = await storage.get(STORAGE_KEYS.COUPLE_ID, null);

        if (!hasPromptedShare && !coupleId) {
          await storage.set(PROMPTED_PARTNER_SHARE_KEY, true);

          setTimeout(() => {
            if (!mountedRef.current) return;

            Alert.alert(
              'Share with your partner?',
              'Invite them into your private space so you can answer and reveal together.',
              [
                { text: 'Not Now', style: 'cancel' },
                {
                  text: 'Invite',
                  onPress: () => {
                    Share.share({
                      message: 'I left something for us on Between Us. Join our private space so we can reveal our answers together: https://apps.apple.com/app/between-us',
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
      savingInlineRef.current = false;
      setIsSavingInline(false);
    }
  }, [
    inlineText,
    activePromptUserId,
    prompt,
    user,
    userProfile,
    isPremium,
    myAnswer,
    partnerAnswer,
    partnerHasAnswered,
    showPaywall,
    loadUsageStatus,
    todayKey,
  ]);

  const handlePrimaryCTA = useCallback(async () => {
    impact(ImpactFeedbackStyle.Medium);

    if (!promptReady) {
      navigation.navigate('HeatLevel');
      return;
    }

    if (ritualState === 'answered_waiting') {
      return;
    }

    if (ritualState === 'revealed' || ritualState === 'solo_answered') {
      const nextValue = !includePromptInKeepsake;
      const row = await DataLayer.getPromptAnswerForToday(prompt.id, todayKey).catch(() => null);
      const answerText = row?.answer || myAnswer;

      if (answerText) {
        await DataLayer.savePromptAnswer({
          promptId: prompt.id,
          answer: answerText,
          heatLevel: prompt.heat || 1,
          dateKey: todayKey,
          includeInKeepsake: nextValue,
        }).catch(() => {});

        const existing = activePromptUserId
          ? await promptStorage.getAnswerForUser(todayKey, prompt.id, activePromptUserId)
          : await promptStorage.getAnswer(todayKey, prompt.id);
        await promptStorage.setAnswer(todayKey, prompt.id, {
          ...(existing || {}),
          answer: answerText,
          userId: activePromptUserId || undefined,
          includeInKeepsake: nextValue,
        });
        setIncludePromptInKeepsake(nextValue);
        notification(NotificationFeedbackType.Success);
      }
      return;
    }

    if (!myAnswer && inlineText.trim()) {
      await handleInlineSave();
      return;
    }

    if (!myAnswer) {
      navigation.navigate('PromptAnswer', {
        prompt: {
          id: prompt.id,
          text: prompt.text,
          dateKey: todayKey,
          heat: prompt.heat,
          category: prompt.category,
        },
      });
      return;
    }

    navigation.navigate('Reveal', {
      prompt: { id: prompt.id, text: prompt.text, dateKey: todayKey },
      userAnswer: { answer: myAnswer, isRevealed, includeInKeepsake: includePromptInKeepsake },
      partnerAnswer: partnerAnswer || null,
      partnerHasAnswered,
      bothAnswered,
    });
  }, [
    promptReady,
    myAnswer,
    partnerAnswer,
    partnerHasAnswered,
    bothAnswered,
    isRevealed,
    prompt,
    includePromptInKeepsake,
    activePromptUserId,
    todayKey,
    navigation,
    inlineText,
    handleInlineSave,
    ritualState,
  ]);

  const primaryCTALabel = useMemo(() => {
    if (!promptReady) return 'Customize Content';

    if (
      (ritualState === 'solo_unanswered'
        || ritualState === 'linked_unanswered'
        || ritualState === 'partner_answered')
      && inlineText.trim()
    ) {
      return isSavingInline ? 'Locking in...' : 'Lock in my answer';
    }

    return ritualCopy?.primaryLabel || "Answer today's question";
  }, [promptReady, ritualCopy, ritualState, inlineText, isSavingInline]);

  const statusText = useMemo(() => {
    if (!promptReady) return null;
    return ritualCopy?.body || null;
  }, [promptReady, ritualCopy]);

  const handleSecondaryCTA = useCallback(() => {
    if (!promptReady) return;

    if (ritualState === 'solo_unanswered' || ritualState === 'solo_answered') {
      navigation.navigate('ConnectPartner');
      return;
    }

    if (ritualState === 'answered_waiting') {
      navigation.navigate('PromptAnswer', {
        mode: 'edit',
        prompt: {
          id: prompt.id,
          text: prompt.text,
          dateKey: todayKey,
          heat: prompt.heat,
          category: prompt.category,
        },
      });
      return;
    }

    if (ritualState === 'revealed') {
      navigation.navigate('DatePlans', {
        source: 'prompt_reveal',
        promptText: prompt.text,
      });
    }
  }, [navigation, prompt, promptReady, ritualState, todayKey]);

  const handleSparkAction = useCallback(() => {
    try {
      const gate = getSparkAccessGate();
      Alert.alert(gate.title, gate.message, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => navigation.navigate('IntimacyPositions', { allowSexPositionContent: true }),
        },
      ]);
    } catch (error) {
      if (__DEV__) console.warn('[Home] Spark gate failed:', error?.message);
      navigation.navigate('IntimacyPositions', { allowSexPositionContent: true });
    }
  }, [navigation]);

  const handleAction = useCallback(async (key) => {
    impact(ImpactFeedbackStyle.Light);

    if (key === 'journal') {
      navigation.navigate('JournalHome', { initialFilter: 'shared' });
    } else if (key === 'quiz') {
      navigation.navigate('CouplesQuiz');
    } else if (key === 'memories') {
      navigation.navigate('OurStory');
    } else if (key === 'intimacy') {
      await handleSparkAction();
    }
  }, [handleSparkAction, navigation]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

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
          <Text style={[styles.headerGreetingSub, { color: t.primary }]}>
            {smartGreeting}
          </Text>

          <View style={styles.headerRow}>
            <Text style={styles.headerName} numberOfLines={2} ellipsizeMode="tail">
              {preferredName || 'You'}
            </Text>

            <TouchableOpacity
              onPress={() => {
                selection();
                if (entitlementsLoading) {
                  return;
                }
                if (!isPremium) {
                  showPaywall?.(PremiumFeature.VIBE_SIGNAL);
                  return;
                }
                navigation.navigate('VibeSignal');
              }}
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
          contentContainerStyle={[styles.scroll, {
            paddingHorizontal: homeLayout.spacing.padding,
            paddingTop: homeLayout.type === 'compact' ? SPACING.xs : SPACING.sm,
          }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <WelcomeBack />

          {/* ── Hero Prompt Card (Crisp Apple Widget) ── */}
          <Animated.View style={{
            opacity: cardAnim,
            transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
          }}
          >
            <View style={styles.heroCardWrap}>
              <View style={styles.eyebrowRow}>
                <Icon name="star-outline" size={14} color={t.primary} />
                <Text style={styles.eyebrow}>{ritualCopy?.eyebrow || 'TODAY'}</Text>
              </View>

              <Text style={styles.promptText}>
                {promptReady ? ritualCopy?.title || prompt.text : ''}
              </Text>

              {!promptReady && <PromptCardSkeleton />}

              {promptReady && myAnswer ? (
                <View style={styles.answerBubble}>
                  <Text style={styles.answerText}>{myAnswer}</Text>
                </View>
              ) : !promptReady ? null : canWritePrompt ? (
                <TextInput
                  style={styles.input}
                  placeholderTextColor={t.subtext}
                  value={inlineText}
                  onChangeText={setInlineText}
                  placeholder="Leave them one small piece of your heart..."
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
                    Today's free moment is used.
                  </Text>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    <Icon name="lock-open-outline" size={14} color={t.primary} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: t.primary }}>Discover more</Text>
                  </View>
                </TouchableOpacity>
              )}

              {statusText && (
                <View style={styles.statusRow}>
                  <View style={styles.statusLine1}>
                    <Icon
                      name={
                        (ritualState === 'both_answered_ready'
                          || ritualState === 'revealed'
                          || ritualState === 'solo_answered'
                          || ritualState === 'partner_answered')
                          ? 'checkmark-outline'
                          : ritualState === 'answered_waiting'
                            ? 'time-outline'
                            : 'chatbubble-outline'
                      }
                      size={14}
                      color={t.primary}
                    />

                    <Text style={styles.statusTextLine1}>
                      {statusText.split('.')[0]}.
                    </Text>
                  </View>

                  <Text style={styles.statusTextLine2}>
                    {statusText.split('.').slice(1).join('.').trim()}
                  </Text>
                </View>
              )}

              <View style={{ height: 16 }} />

              {/* Solid High-Contrast Editorial CTA */}
              <TouchableOpacity
                style={[
                  styles.cta,
                  ritualState === 'answered_waiting' && styles.ctaMuted,
                ]}
                activeOpacity={0.85}
                onPress={handlePrimaryCTA}
                onPressIn={() => impact(ImpactFeedbackStyle.Light)}
                disabled={ritualState === 'answered_waiting'}
                accessibilityRole="button"
                accessibilityLabel={primaryCTALabel}
                accessibilityState={{ disabled: ritualState === 'answered_waiting' }}
              >
                <Text style={styles.ctaLabel}>{primaryCTALabel}</Text>
              </TouchableOpacity>

              {ritualCopy?.secondaryLabel ? (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={handleSecondaryCTA}
                  style={styles.secondaryCTA}
                  accessibilityRole="button"
                  accessibilityLabel={ritualCopy.secondaryLabel}
                >
                  <Text style={styles.secondaryCTALabel}>{ritualCopy.secondaryLabel}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </Animated.View>

          <View style={{ height: homeLayout.spacing.gap }} />

          {/* ── Shared moments + milestones (below the fold) ── */}
          <MilestoneCard />

          <View style={{ height: homeLayout.type === 'compact' ? SPACING.md : SPACING.lg }} />

          {/* ── Quick Actions (3-Column Apple Widget Layout) ── */}
          {disclosure.quickActions && (
            <Animated.View style={[styles.actionsRow, {
              opacity: actionsAnim,
              transform: [{ translateY: actionsAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
            }]}
            >
              {ACTIONS.filter((action) => {
                if (action.premium && !isPremium && answeredCount < 3) return false;
                return true;
              }).map((action) => {
                const locked = action.premium && !isPremium;
                const badge = 0;
                const actionColor = isDark ? '#FFFFFF' : action.color;
                const badgeColor = action.color;

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
                        <Icon name="lock-closed-outline" size={12} color={actionColor} />
                      </View>
                    )}

                    {badge > 0 && (
                      <View style={[styles.noteBadge, { backgroundColor: badgeColor }]}>
                        <Text style={styles.noteBadgeText}>{badge > 9 ? '9+' : badge}</Text>
                      </View>
                    )}

                    <Icon name={action.icon} size={28} color={actionColor} />
                    <Text style={styles.actionLabel}>{action.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </Animated.View>
          )}

          <View style={{ height: homeLayout.spacing.gap }} />

          {/* ── Partner Quote ── */}
          {throwback && (
            <View style={styles.memoryLaneCard}>
              <View style={styles.memoryLaneHeader}>
                <Icon name="time-outline" size={16} color={t.primary} />
                <Text style={[
                  styles.memoryLaneLabel,
                  !throwback.isOnThisDay && styles.memoryLaneLabelName,
                ]}>
                  {throwback.isOnThisDay ? 'ON THIS DAY' : (partnerLabel === 'your partner' ? 'What your partner said' : `What ${partnerLabel} said`)}
                </Text>
              </View>

              <Text style={styles.memoryLaneAnswer}>
                "{throwback.answer}"
              </Text>

              <Text style={styles.memoryLaneDate}>
                {throwback.date_key
                  ? new Date(`${throwback.date_key}T00:00:00`).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                  : ''}
              </Text>
            </View>
          )}

          <View style={{ height: homeLayout.type === 'compact' ? SPACING.md : SPACING.lg }} />

          {/* ── Soft Upgrade Nudge (free users with 3+ shared moments) ── */}
          {disclosure.softNudge && !isPremium && answeredCount >= 3 && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => showPaywall?.(PremiumFeature.UNLIMITED_PROMPTS)}
              style={[styles.softNudgeCard, { backgroundColor: t.surface, borderColor: t.border }]}
            >
              <View style={styles.softNudgeInner}>
                <Icon name="heart-circle-outline" size={28} color={t.primary} />

                <View style={{ flex: 1 }}>
                  <Text style={[styles.softNudgeTitle, { color: t.text }]}>
                    You've created {answeredCount} shared moments
                  </Text>

                </View>
              </View>

              <View style={styles.softNudgeCTA}>
                <Text style={[styles.softNudgeCTAText, { color: t.primary }]}>Keep building this</Text>
                <Icon name="arrow-forward-outline" size={14} color={t.primary} />
              </View>
            </TouchableOpacity>
          )}
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

const systemFont = Platform.select({ ios: 'System', android: 'Roboto' });
const DARK_TODAY_BETWEEN_US_CARD = '#131016';
const SETTINGS_PROFILE_CARD_DARK = '#1C1C1E';
const SETTINGS_PROFILE_CARD_LIGHT = '#FFFFFF';
const SETTINGS_PROFILE_BORDER_DARK = 'rgba(255,255,255,0.04)';
const SETTINGS_PROFILE_BORDER_LIGHT = 'rgba(0,0,0,0.03)';

const createStyles = (t, isDark) => StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },

  // ── Header ──
  header: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerGreetingSub: {
    fontFamily: systemFont,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    color: t.subtext,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },
  headerName: {
    fontFamily: systemFont,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 42,
    color: t.text,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingRight: SPACING.md,
  },
  vibeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
      },
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
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
      },
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
    paddingBottom: 160,
  },

  // ── Hero Card ──
  heroCardWrap: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: isDark ? DARK_TODAY_BETWEEN_US_CARD : t.surface,
    padding: SPACING.xl,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: isDark ? 0.4 : 0.08,
        shadowRadius: 24,
      },
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
    color: t.primary,
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
    color: t.subtext,
  },
  statusRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -SPACING.md,
    marginBottom: SPACING.sm,
  },
  statusLine1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statusTextLine1: {
    fontFamily: systemFont,
    fontSize: 11,
    fontWeight: '600',
    color: t.subtext,
    textAlign: 'center',
  },
  statusTextLine2: {
    fontFamily: systemFont,
    fontSize: 11,
    fontWeight: '600',
    color: t.subtext,
    textAlign: 'center',
    marginTop: 2,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 28,
    backgroundColor: t.text,
    gap: 8,
  },
  ctaMuted: {
    opacity: 0.72,
  },
  ctaLabel: {
    fontFamily: systemFont,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: isDark ? '#000000' : '#FFFFFF',
  },
  secondaryCTA: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  secondaryCTALabel: {
    fontFamily: systemFont,
    fontSize: 15,
    fontWeight: '700',
    color: t.primary,
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
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.12)' : t.border,
    backgroundColor: isDark ? DARK_TODAY_BETWEEN_US_CARD : t.surface,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.3 : 0.05,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  actionLabel: {
    fontFamily: systemFont,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: isDark ? '#FFFFFF' : t.text,
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
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 16,
      },
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
    borderColor: isDark ? SETTINGS_PROFILE_BORDER_DARK : SETTINGS_PROFILE_BORDER_LIGHT,
    backgroundColor: isDark ? SETTINGS_PROFILE_CARD_DARK : SETTINGS_PROFILE_CARD_LIGHT,
    padding: SPACING.xl,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 16,
      },
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
  memoryLaneLabelName: {
    letterSpacing: 0,
    textTransform: 'none',
  },
  memoryLaneAnswer: {
    fontFamily: systemFont,
    fontSize: 19,
    lineHeight: 28,
    fontWeight: '400',
    color: t.text,
    marginBottom: SPACING.lg,
    textAlign: 'center',
    alignSelf: 'stretch',
    flexShrink: 1,
  },
  memoryLaneDate: {
    fontFamily: systemFont,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    color: t.subtext,
    letterSpacing: 0.2,
    textAlign: 'right',
    alignSelf: 'stretch',
    opacity: 0.78,
  },

  // ── Soft Upgrade Nudge ──
  softNudgeCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.25 : 0.05,
        shadowRadius: 12,
      },
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

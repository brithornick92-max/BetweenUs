// screens/DateNightDetailScreen.js — High-End Editorial Implementation
// Sexy Red Intimacy & Apple Editorial Updates Integrated.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Platform,
  Dimensions,
  StatusBar
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Icon from '../components/Icon';
import CloseScreenHeader, { CLOSE_HEADER_STYLES } from '../components/CloseScreenHeader';
import { useTheme } from "../context/ThemeContext";
import { useAppContext } from "../context/AppContext";
import { useEntitlements } from "../context/EntitlementsContext";
import { impact, selection, ImpactFeedbackStyle } from "../utils/haptics";
import { withAlpha } from "../utils/theme";
import { getAllDates, getDateById } from "../utils/contentLoader";
import { getPartnerDisplayName, personalizePartnerText } from "../utils/profileNames";
import { PremiumFeature } from "../utils/featureFlags";
import Button from "../components/Button";
import ReAnimated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import GlowOrb from "../components/GlowOrb";
import { useAuth } from '../context/AuthContext';
import { useContent } from '../context/ContentContext';
import * as PreferenceEngine from '../services/PreferenceEngine';
import PremiumGatekeeper from '../services/PremiumGatekeeper';
import { CONTENT_TYPES } from '../services/WeeklyContentSetService';
import { getDateCardPalette } from '../components/dateCardPalette';
import {
  getDateHistory,
  rateDateHistoryEntry,
  removeDateHistoryEntry,
  removeDateSavedKeepsake,
  saveDateHistoryEntry,
} from '../utils/dateHistory';
import {
  addDateToShortlist,
  getDateShortlist,
  removeDateFromShortlist,
} from '../services/supabase/dateShortlistService';
import {
  canOpenFreeDateDetail,
  trackFreeDateDetailUsage,
} from '../utils/freePromptAnswerQuota';
import { isItemInFreeWeeklyDeck } from '../utils/freeWeeklyDeckAccess';

const AUTO_LOG_THRESHOLD_SECONDS = 300; // 5 minutes

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

export default function DateNightDetailScreen({ route, navigation }) {
  const { date: routeDate, dateId } = route.params || {};
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const { user, userProfile } = useAuth();
  const { state } = useAppContext();
  const userId = userProfile?.id || userProfile?.user_id || userProfile?.uid || user?.uid || user?.id || null;
  const { loadUsageStatus } = useContent();
  const [date, setDate] = useState(routeDate || null);
  const [freeDateFlowRemaining, setFreeDateFlowRemaining] = useState(null);
  const [dateHistoryEntry, setDateHistoryEntry] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [triedBusy, setTriedBusy] = useState(false);
  const [ratingBusy, setRatingBusy] = useState(false);

  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    background: colors.background, 
    surface: isDark ? '#131016' : '#FFFFFF',
    surfaceSecondary: isDark ? '#1C1520' : '#F2F2F7',
    primary: colors.primary || '#D2121A', // Sexy Red
    text: colors.text,
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  useEffect(() => {
    let active = true;

    if (!user?.uid) return undefined;

    PremiumGatekeeper.getUserUsageStatus(user.uid, isPremium)
      .then((status) => {
        if (active) {
          setFreeDateFlowRemaining(status?.remaining?.dateFlowsPerWeek ?? null);
        }
      })
      .catch(() => {
        if (active) setFreeDateFlowRemaining(null);
      });

    return () => {
      active = false;
    };
  }, [user?.uid, isPremium, date?.id]);

  useEffect(() => {
    let active = true;

    (async () => {
      const resolvedDate = routeDate || (dateId ? getDateById(dateId) : null);
      if (!active) return;

      if (!resolvedDate) {
        Alert.alert('Date unavailable', 'This date idea is no longer available.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      }

      const profile = await PreferenceEngine.getContentProfile(userProfile || {});
      if (!active) return;

      const visibility = PreferenceEngine.getDateVisibilityState(resolvedDate, profile);
      if (!visibility.visible) {
        Alert.alert(visibility.title, visibility.message, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      }

      if (!isPremium) {
        const weeklyEligibleDates = getAllDates().filter((item) =>
          PreferenceEngine.getDateVisibilityState(item, profile).visible
        );
        const accessCheck = await canOpenFreeDateDetail({
          userId,
          user,
          userProfile,
          isPremium,
          dateId: resolvedDate.id,
        });
        if (!active) return;

        const isWeeklyDate = isItemInFreeWeeklyDeck(resolvedDate.id, weeklyEligibleDates, {
          contentType: CONTENT_TYPES.DATES,
          userId,
          user,
          userProfile,
          userSettings: profile || userProfile || {},
        });

        if ((!isWeeklyDate && !accessCheck.alreadyUsed) || !accessCheck.canUse) {
          showPaywall?.(PremiumFeature.UNLIMITED_DATE_IDEAS);
          navigation.goBack();
          return;
        }

        const trackResult = await trackFreeDateDetailUsage({
          userId,
          user,
          userProfile,
          isPremium,
          dateId: resolvedDate.id,
        });
        if (!active) return;

        if (trackResult?.canUse === false) {
          showPaywall?.(PremiumFeature.UNLIMITED_DATE_IDEAS);
          navigation.goBack();
          return;
        }

        await loadUsageStatus?.();
      }

      setDate(resolvedDate);
    })().catch(() => {
      if (active) {
        Alert.alert('Date unavailable', 'This date idea is no longer available.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    });

    return () => {
      active = false;
    };
  }, [routeDate, dateId, navigation, userProfile, isPremium, showPaywall, user, userId, loadUsageStatus]);

  const partnerName = useMemo(
    () => getPartnerDisplayName(userProfile, state?.userProfile, 'your partner'),
    [state?.userProfile, userProfile]
  );

  const personalizeCopy = React.useCallback(
    (text) => personalizePartnerText(text, partnerName),
    [partnerName]
  );

  const steps = useMemo(() => {
    const rawSteps = Array.isArray(date?.guidedSteps) && date.guidedSteps.length > 0
      ? date.guidedSteps
      : (Array.isArray(date?.steps) ? date.steps : []);

    return rawSteps.map(personalizeCopy);
  }, [date?.guidedSteps, date?.steps, personalizeCopy]);

  const supplies = useMemo(
    () => (Array.isArray(date?.supplies) ? date.supplies.map(personalizeCopy) : []),
    [date?.supplies, personalizeCopy]
  );

  const conversationPrompts = useMemo(
    () => (Array.isArray(date?.conversationPrompts) ? date.conversationPrompts.map(personalizeCopy) : []),
    [date?.conversationPrompts, personalizeCopy]
  );

  const dateVibe = useMemo(() => personalizeCopy(date?.vibe), [date?.vibe, personalizeCopy]);
  const dateSetup = useMemo(() => personalizeCopy(date?.setup), [date?.setup, personalizeCopy]);
  const dateConnectionTwist = useMemo(
    () => personalizeCopy(date?.connectionTwist),
    [date?.connectionTwist, personalizeCopy]
  );
  const dateEnding = useMemo(() => personalizeCopy(date?.ending), [date?.ending, personalizeCopy]);

  const dateTone = useMemo(() => getDateCardPalette(date?.heat || 1), [date?.heat]);

  const [currentStep, setCurrentStep] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const timerRef = useRef(null);
  const autoLoggedRef = useRef(false);
  const saveBusyRef = useRef(false);
  const triedBusyRef = useRef(false);
  const ratingBusyRef = useRef(false);

  const logDateComplete = React.useCallback(async () => {
    if (!date?.id) return;
    autoLoggedRef.current = true;
    const result = await saveDateHistoryEntry(date);
    setDateHistoryEntry(result.entry);
  }, [date]);

  const loadDateHistoryEntry = React.useCallback(async () => {
    if (!date?.id) {
      setDateHistoryEntry(null);
      return;
    }

    const history = await getDateHistory();
    setDateHistoryEntry(history.find((entry) => entry.id === date.id) || null);
  }, [date?.id]);

  useEffect(() => {
    loadDateHistoryEntry().catch(() => {});
  }, [loadDateHistoryEntry]);

  useEffect(() => {
    let active = true;

    if (!date?.id || !userId) {
      setIsSaved(false);
      return undefined;
    }

    getDateShortlist(userId)
      .then((rows) => {
        if (!active) return;
        setIsSaved((rows || []).some((row) => row.date_id === date.id));
      })
      .catch(() => {
        if (active) setIsSaved(false);
      });

    return () => {
      active = false;
    };
  }, [date?.id, userId]);

  useEffect(() => {
    autoLoggedRef.current = false;
  }, [date?.id]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Drive the interval from a dedicated effect so it's never started
  // inside a setState updater (which can run multiple times in React 18).
  useEffect(() => {
    if (!timerActive) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    timerRef.current = setInterval(() => setTimeElapsed((s) => s + 1), 1000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [timerActive]);

  // Auto-log to history once the timer passes 5 minutes
  useEffect(() => {
    if (autoLoggedRef.current) return;
    if (timeElapsed < AUTO_LOG_THRESHOLD_SECONDS) return;
    if (!date?.id) return;
    logDateComplete()
      .catch(() => {});
  }, [timeElapsed, date?.id, logDateComplete]);

  const toggleTimer = () => {
    impact(ImpactFeedbackStyle.Medium);
    setTimerActive((prev) => !prev);
  };

  const handleToggleSaved = async () => {
    if (!date?.id || saveBusyRef.current) return;
    selection();
    saveBusyRef.current = true;
    setSaveBusy(true);

    const wasSaved = isSaved;
    setIsSaved(!wasSaved);

    try {
      if (userId) {
        if (wasSaved) {
          await removeDateFromShortlist(userId, date.id);
        } else {
          await addDateToShortlist(userId, date.id);
        }
      }

      if (wasSaved) {
        await removeDateSavedKeepsake(date.id);
      }
    } catch (error) {
      setIsSaved(wasSaved);
      if (__DEV__) console.warn('[DateNightDetail] Failed to toggle saved date:', error?.message);
    } finally {
      saveBusyRef.current = false;
      setSaveBusy(false);
    }
  };

  const handleToggleTried = async () => {
    if (!date?.id || triedBusyRef.current) return;
    selection();
    triedBusyRef.current = true;
    setTriedBusy(true);

    const previousEntry = dateHistoryEntry;
    setDateHistoryEntry(previousEntry ? null : { id: date.id, title: date.title, rating: null });

    try {
      if (previousEntry) {
        await removeDateHistoryEntry(date.id);
        autoLoggedRef.current = true;
        return;
      }

      const result = await saveDateHistoryEntry(date);
      setDateHistoryEntry(result.entry);
    } catch (error) {
      setDateHistoryEntry(previousEntry);
      if (__DEV__) console.warn('[DateNightDetail] Failed to toggle tried date:', error?.message);
    } finally {
      triedBusyRef.current = false;
      setTriedBusy(false);
    }
  };

  const handleRateDate = async (rating) => {
    if (!date?.id || ratingBusyRef.current) return;
    selection();
    ratingBusyRef.current = true;
    setRatingBusy(true);

    const previousEntry = dateHistoryEntry;
    const nextRating = previousEntry?.rating === rating ? null : rating;
    setDateHistoryEntry({
      ...(previousEntry || { id: date.id, title: date.title }),
      rating: nextRating,
    });

    try {
      const result = await rateDateHistoryEntry(date, rating);
      setDateHistoryEntry(result.entry);
      autoLoggedRef.current = true;
    } catch (error) {
      setDateHistoryEntry(previousEntry);
      if (__DEV__) console.warn('[DateNightDetail] Failed to rate date:', error?.message);
    } finally {
      ratingBusyRef.current = false;
      setRatingBusy(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSchedule = async () => {
    if (!date) return;

    if (!isPremium && user?.uid) {
      const accessCheck = await PremiumGatekeeper.canAccessDateFlow(user.uid, date.id, isPremium);
      if (!accessCheck.canAccess) {
        showPaywall(PremiumFeature.UNLIMITED_DATE_IDEAS);
        return;
      }

      await PremiumGatekeeper.trackDateFlowUsage(user.uid, date.id, isPremium);
      await loadUsageStatus?.();
      const refreshed = await PremiumGatekeeper.getUserUsageStatus(user.uid, isPremium);
      setFreeDateFlowRemaining(refreshed?.remaining?.dateFlowsPerWeek ?? null);
    }

    selection();
    const stepsText = steps.length ? `• ${steps.join("\n• ")}` : "";
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 30, 0, 0);

    const prefill = {
      title: `Date: ${date.title || "Date Night"}`,
      prefillDate: tomorrow.getTime(),
      location: date?.location === "home" ? "Our Home" : "Out & About",
      notes: stepsText,
      isDateNight: true,
    };

    // Calendar tab is only mounted after day 2. Guard to avoid navigating to an
    // unmounted route for brand-new users.
    const joinedAt = userProfile?.createdAt ? new Date(userProfile.createdAt).getTime() : null;
    const daysSinceJoin = joinedAt ? Math.floor((Date.now() - joinedAt) / 86400000) : Infinity;
    if (daysSinceJoin < 2) {
      Alert.alert(
        'Calendar Unlocks Soon',
        'The shared calendar unlocks after your first day together in the app. Check back tomorrow!',
        [{ text: 'Got it' }]
      );
      return;
    }
    navigation.navigate("MainTabs", { screen: "Calendar", params: { prefill } });
  };

  if (!date) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <GlowOrb color={t.primary} size={450} top={-100} left={SCREEN_WIDTH - 250} opacity={0.14} />
      <GlowOrb color={isDark ? 'rgba(255,255,255,0.6)' : t.background} size={350} top={650} left={-100} opacity={0.08} />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Editorial Hero Header */}
        <LinearGradient 
          colors={[withAlpha(t.primary, 0.15), "transparent"]} 
          style={styles.heroHeader}
        >
          <CloseScreenHeader
            title={date.title}
            subtitle="THE PLAN"
            titleColor={t.text}
            subtitleColor={t.primary}
            closeColor={t.text}
            closeIcon="close-outline"
            onClose={() => navigation.goBack()}
            titleStyle={{ fontSize: 24, lineHeight: 30, letterSpacing: -0.5 }}
            titleProps={{ adjustsFontSizeToFit: true, numberOfLines: 2 }}
          />

          <ReAnimated.View entering={FadeInUp.duration(800)} style={styles.heroBody}>
            <View style={styles.quickInfoRow}>
              <View style={[styles.infoPill, { backgroundColor: withAlpha(dateTone.base, 0.92), borderColor: withAlpha(dateTone.chrome, 0.22) }]}> 
                <Icon name="time-outline" size={15} color={dateTone.highlight} />
                <Text style={[styles.infoPillText, { color: dateTone.text }]}>{date.minutes}m</Text>
              </View>
              <View style={[styles.infoPill, { backgroundColor: withAlpha(dateTone.base, 0.92), borderColor: withAlpha(dateTone.chrome, 0.22) }]}> 
                <Icon 
                  name={date.location === "home" ? "home-outline" : "map-outline"} 
                  size={15} color={dateTone.highlight} 
                />
                <Text style={[styles.infoPillText, { color: dateTone.text }]}> 
                  {date.location === "home" ? "At Home" : date.location === "out" ? "Out & About" : "Anywhere"}
                </Text>
              </View>
            </View>
          </ReAnimated.View>
        </LinearGradient>

        {/* Primary Editorial Action */}
        <ReAnimated.View entering={FadeInDown.delay(200)} style={styles.centerAction}>
          {!isPremium && freeDateFlowRemaining !== null ? (
            <Text style={[styles.freeAccessNote, { color: t.subtext }]}>
              {freeDateFlowRemaining > 0 ? '1 free date plan available this week.' : 'Your free weekly date plan is used. More can open anytime.'}
            </Text>
          ) : null}
          <TouchableOpacity onPress={handleSchedule} activeOpacity={0.9}>
            <LinearGradient colors={[t.primary, t.primaryMuted || '#8E0D2C']} style={styles.scheduleBtn}>
              <Icon name="calendar-outline" size={22} color="#FFF" />
              <Text style={styles.scheduleBtnText}>Schedule Moment</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ReAnimated.View>

        <View style={styles.triedPanelWrap}>
          <BlurView intensity={isDark ? 30 : 50} tint={isDark ? "dark" : "light"} style={[styles.triedPanel, { borderColor: t.border }]}>
            <TouchableOpacity
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSaved, disabled: saveBusy }}
              accessibilityLabel={isSaved ? 'Date saved' : 'Save date'}
              activeOpacity={0.8}
              disabled={saveBusy}
              onPress={handleToggleSaved}
              style={[
                styles.triedToggle,
                { backgroundColor: isSaved ? t.primary : t.surfaceSecondary, borderColor: isSaved ? t.primary : t.border },
                saveBusy && styles.disabledControl,
              ]}
            >
              <Icon name={isSaved ? 'bookmark' : 'bookmark-outline'} size={20} color={isSaved ? '#FFFFFF' : t.text} />
              <Text style={[styles.triedToggleText, { color: isSaved ? '#FFFFFF' : t.text }]}>
                {isSaved ? 'Saved' : 'Save'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!dateHistoryEntry, disabled: triedBusy }}
              accessibilityLabel={dateHistoryEntry ? 'Date marked as tried' : 'Mark date as tried'}
              activeOpacity={0.8}
              disabled={triedBusy}
              onPress={handleToggleTried}
              style={[
                styles.triedToggle,
                { backgroundColor: dateHistoryEntry ? t.primary : t.surfaceSecondary, borderColor: dateHistoryEntry ? t.primary : t.border },
                triedBusy && styles.disabledControl,
              ]}
            >
              <Icon name={dateHistoryEntry ? 'checkmark-circle-outline' : 'ellipse-outline'} size={20} color={dateHistoryEntry ? '#FFFFFF' : t.text} />
              <Text style={[styles.triedToggleText, { color: dateHistoryEntry ? '#FFFFFF' : t.text }]}>
                {dateHistoryEntry ? 'Tried' : 'Mark Tried'}
              </Text>
            </TouchableOpacity>
            <View style={styles.dateRatingRow}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: dateHistoryEntry?.rating === 'up', disabled: ratingBusy }}
                accessibilityLabel={dateHistoryEntry?.rating === 'up' ? 'Remove thumbs up for this date' : 'Thumbs up for this date'}
                activeOpacity={0.75}
                disabled={ratingBusy}
                onPress={() => handleRateDate('up')}
                style={[
                  styles.dateRatingButton,
                  { borderColor: dateHistoryEntry?.rating === 'up' ? '#22C55E60' : t.border, backgroundColor: dateHistoryEntry?.rating === 'up' ? '#22C55E20' : t.surfaceSecondary },
                  ratingBusy && styles.disabledControl,
                ]}
              >
                <Icon name="thumbs-up-outline" size={22} color={dateHistoryEntry?.rating === 'up' ? '#22C55E' : t.text} />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: dateHistoryEntry?.rating === 'down', disabled: ratingBusy }}
                accessibilityLabel={dateHistoryEntry?.rating === 'down' ? 'Remove thumbs down for this date' : 'Thumbs down for this date'}
                activeOpacity={0.75}
                disabled={ratingBusy}
                onPress={() => handleRateDate('down')}
                style={[
                  styles.dateRatingButton,
                  { borderColor: dateHistoryEntry?.rating === 'down' ? '#EF444460' : t.border, backgroundColor: dateHistoryEntry?.rating === 'down' ? '#EF444420' : t.surfaceSecondary },
                  ratingBusy && styles.disabledControl,
                ]}
              >
                <Icon name="thumbs-down-outline" size={22} color={dateHistoryEntry?.rating === 'down' ? '#EF4444' : t.text} />
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>

        {/* Presence Module (Velvet Glass) */}
        <View style={styles.modulePadding}>
          <BlurView intensity={isDark ? 30 : 50} tint={isDark ? "dark" : "light"} style={[styles.timerModule, { borderColor: t.border }]}>
            <Text style={[styles.moduleLabel, { color: t.subtext }]}>PRESENCE TIMER</Text>
            <Text style={[styles.timerValue, { color: t.text }]}>{formatTime(timeElapsed)}</Text>
            <TouchableOpacity onPress={toggleTimer} style={[styles.timerToggle, { backgroundColor: timerActive ? t.surfaceSecondary : t.primary }]}>
              <Icon name={timerActive ? "pause-outline" : "play-outline"} size={32} color={timerActive ? dateTone.highlight : "#FFF"} />
            </TouchableOpacity>
          </BlurView>
        </View>
          {/* Guided Date Details */}
          {!!dateVibe && (
            <View style={styles.experienceSection}>
              <Text style={[styles.sectionTitle, { color: t.text }]}>Vibe</Text>
              <View style={[styles.stepRow, { backgroundColor: t.surface, borderColor: t.border }]}>
                <View style={[styles.stepIndicator, { backgroundColor: t.surfaceSecondary }]}>
                  <Icon name="sparkles-outline" size={18} color={t.primary} />
                </View>
                <Text style={[styles.stepText, { color: t.text }]}>{dateVibe}</Text>
              </View>
            </View>
          )}

          {!!dateSetup && (
            <View style={styles.experienceSection}>
              <Text style={[styles.sectionTitle, { color: t.text }]}>Before You Start</Text>
              <View style={[styles.stepRow, { backgroundColor: t.surface, borderColor: t.border }]}>
                <View style={[styles.stepIndicator, { backgroundColor: t.surfaceSecondary }]}>
                  <Icon name="heart-outline" size={18} color={t.primary} />
                </View>
                <Text style={[styles.stepText, { color: t.text }]}>{dateSetup}</Text>
              </View>
            </View>
          )}

          {supplies.length > 0 && (
            <View style={styles.experienceSection}>
              <Text style={[styles.sectionTitle, { color: t.text }]}>What You’ll Need</Text>
              {supplies.map((item, index) => (
                <View
                  key={`supply-${index}`}
                  style={[styles.stepRow, { backgroundColor: t.surface, borderColor: t.border }]}
                >
                  <View style={[styles.stepIndicator, { backgroundColor: t.surfaceSecondary }]}>
                    <Text style={[styles.stepNumber, { color: t.primary }]}>•</Text>
                  </View>
                  <Text style={[styles.stepText, { color: t.text }]}>{item}</Text>
                </View>
              ))}
            </View>
          )}


        {/* Experience Timeline */}
        <View style={styles.experienceSection}>
          <Text style={[styles.sectionTitle, { color: t.text }]}>Your Date Guide</Text>
          
          {steps.map((step, index) => {
            const isCompleted = currentStep > index;
            const isActive = currentStep === index;

            return (
              <TouchableOpacity
                key={index}
                onPress={() => { selection(); setCurrentStep(index); }}
                activeOpacity={0.8}
                style={[
                  styles.stepRow,
                  { backgroundColor: isActive ? t.surfaceSecondary : t.surface, borderColor: isActive ? t.primary : t.border },
                  isActive && { borderWidth: StyleSheet.hairlineWidth }
                ]}
              >
                <View style={[styles.stepIndicator, { backgroundColor: isCompleted ? "#34C759" : t.surfaceSecondary }]}>
                  {isCompleted ? (
                    <Icon name="checkmark-outline" size={18} color="#FFF" />
                  ) : (
                    <Text style={[styles.stepNumber, { color: isActive ? t.primary : t.subtext }]}>{index + 1}</Text>
                  )}
                </View>
                <Text style={[
                  styles.stepText, 
                  { color: t.text },
                  isCompleted && styles.stepTextCompleted,
                  isActive && styles.stepTextActive
                ]}>
                  {step}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
          {conversationPrompts.length > 0 && (
            <View style={styles.experienceSection}>
              <Text style={[styles.sectionTitle, { color: t.text }]}>Talk About This</Text>
              {conversationPrompts.map((prompt, index) => (
                <View
                  key={`prompt-${index}`}
                  style={[styles.stepRow, { backgroundColor: t.surface, borderColor: t.border }]}
                >
                  <View style={[styles.stepIndicator, { backgroundColor: t.surfaceSecondary }]}>
                    <Icon name="chatbubble-ellipses-outline" size={18} color={t.primary} />
                  </View>
                  <Text style={[styles.stepText, { color: t.text }]}>{prompt}</Text>
                </View>
              ))}
            </View>
          )}

          {!!dateConnectionTwist && (
            <View style={styles.experienceSection}>
              <Text style={[styles.sectionTitle, { color: t.text }]}>Make It Yours</Text>
              <View style={[styles.stepRow, { backgroundColor: t.surface, borderColor: t.border }]}>
                <View style={[styles.stepIndicator, { backgroundColor: t.surfaceSecondary }]}>
                  <Icon name="ribbon-outline" size={18} color={t.primary} />
                </View>
                <Text style={[styles.stepText, { color: t.text }]}>{dateConnectionTwist}</Text>
              </View>
            </View>
          )}

          {!!dateEnding && (
            <View style={styles.experienceSection}>
              <Text style={[styles.sectionTitle, { color: t.text }]}>How To End</Text>
              <View style={[styles.stepRow, { backgroundColor: t.surface, borderColor: t.border }]}>
                <View style={[styles.stepIndicator, { backgroundColor: t.surfaceSecondary }]}>
                  <Icon name="moon-outline" size={18} color={t.primary} />
                </View>
                <Text style={[styles.stepText, { color: t.text }]}>{dateEnding}</Text>
              </View>
            </View>
          )}


        <View style={styles.footer}>
          <Button
            title={currentStep === steps.length - 1 ? "Finish Experience" : "Next Step"}
            onPress={() => {
              if (currentStep === steps.length - 1) {
                impact(ImpactFeedbackStyle.Success);
                logDateComplete()
                  .catch(() => {})
                  .finally(() => {
                    Alert.alert("Date Complete!", "A new memory has been shared.");
                    navigation.goBack();
                  });
              } else {
                impact(ImpactFeedbackStyle.Light);
                setCurrentStep((s) => s + 1);
              }
            }}
            fullWidth
          />
        </View>
        
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // Hero Section
  heroHeader: {
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
  },
  heroBody: {
    paddingHorizontal: 24,
    paddingBottom: 56,
  },
  backBtn: CLOSE_HEADER_STYLES.closeButton,
  editorialTitle: CLOSE_HEADER_STYLES.title,
  quickInfoRow: { 
    flexDirection: 'row', 
    gap: 12, 
    marginTop: 24, 
    justifyContent: 'center' 
  },
  infoPill: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderRadius: 16, 
    paddingHorizontal: 16, 
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  infoPillText: { fontSize: 14, fontWeight: '700', marginLeft: 8 },

  // Module Actions
  centerAction: { 
    marginTop: -30, 
    alignSelf: 'center', 
    zIndex: 10 
  },
  freeAccessNote: {
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '600',
  },
  scheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    height: 60,
    borderRadius: 30,
    ...Platform.select({
      ios: { shadowColor: '#D2121A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 20 },
      android: { elevation: 8 }
    })
  },
  scheduleBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16, marginLeft: 12, textTransform: 'uppercase', letterSpacing: 0.5 },

  triedPanelWrap: {
    paddingHorizontal: 24,
    marginTop: 28,
  },
  triedPanel: {
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    overflow: 'hidden',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  triedToggle: {
    height: 48,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 112,
    justifyContent: 'center',
  },
  triedToggleText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateRatingButton: {
    width: 48,
    height: 48,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledControl: {
    opacity: 0.55,
  },

  modulePadding: { paddingHorizontal: 24, marginTop: 28 },
  timerModule: {
    padding: 36,
    borderRadius: 40,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  moduleLabel: { fontWeight: '800', fontSize: 12, letterSpacing: 2.5, marginBottom: 8 },
  timerValue: { 
    fontSize: 72, 
    fontWeight: '200', 
    fontVariant: ['tabular-nums'], 
    marginVertical: 12,
    letterSpacing: -2,
  },
  timerToggle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },

  // Experience Section
  experienceSection: { paddingHorizontal: 24, marginTop: 48 },
  sectionTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8, marginBottom: 28 },
  stepRow: {
    flexDirection: 'row',
    padding: 24,
    borderRadius: 28,
    marginBottom: 16,
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  stepIndicator: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 18,
  },
  stepNumber: { fontWeight: '800', fontSize: 15 },
  stepText: { flex: 1, fontWeight: '500', fontSize: 17, lineHeight: 26, letterSpacing: -0.4, marginTop: 5 },
  stepTextCompleted: { opacity: 0.35, textDecorationLine: 'line-through' },
  stepTextActive: { fontWeight: '600' },

  footer: { paddingHorizontal: 24, marginTop: 40 },
});

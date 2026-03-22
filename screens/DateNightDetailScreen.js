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
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Icon from '../components/Icon';
import { useTheme } from "../context/ThemeContext";
import { useEntitlements } from "../context/EntitlementsContext";
import { impact, selection, ImpactFeedbackStyle } from "../utils/haptics";
import { SPACING, withAlpha } from "../utils/theme";
import { getDimensionMeta } from "../utils/contentLoader";
import Button from "../components/Button";
import ReAnimated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import GlowOrb from "../components/GlowOrb";

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

export default function DateNightDetailScreen({ route, navigation }) {
  const { date } = route.params || {};
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();

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
    if (!isPremium && date?.isPremium) {
      showPaywall("DATE_NIGHT_DETAILS");
    }
  }, [isPremium, date?.isPremium]);

  const steps = useMemo(() => (Array.isArray(date?.steps) ? date.steps : []), [date?.steps]);
  
  const dimensionBadges = useMemo(() => {
    const dims = getDimensionMeta();
    const badges = [];
    if (typeof date?.heat === 'number') {
      const h = dims.heat.find(x => x.level === date.heat);
      if (h) badges.push({ label: h.label, icon: h.icon, color: h.color });
    }
    if (typeof date?.load === 'number') {
      const l = dims.load.find(x => x.level === date.load);
      if (l) badges.push({ label: l.label, icon: l.icon, color: l.color });
    }
    if (date?.style) {
      const s = dims.style.find(x => x.id === date.style);
      if (s) badges.push({ label: s.label, icon: s.icon, color: s.color });
    }
    if (date?._matchLabel) {
      badges.unshift({ label: date._matchLabel, icon: '✨', color: t.primary });
    }
    return badges;
  }, [date, t]);

  const [currentStep, setCurrentStep] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const toggleTimer = () => {
    impact(ImpactFeedbackStyle.Medium);
    setTimerActive((prev) => {
      const next = !prev;
      if (next) {
        timerRef.current = setInterval(() => { setTimeElapsed((s) => s + 1); }, 1000);
      } else {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return next;
    });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSchedule = () => {
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
    navigation.navigate("MainTabs", { screen: "Calendar", params: { prefill } });
  };

  if (!date) return null;

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle="light-content" />
      <GlowOrb color={t.primary} size={400} top={-100} left={-150} opacity={0.12} />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Editorial Hero Header */}
        <LinearGradient 
          colors={[withAlpha(t.primary, 0.15), "transparent"]} 
          style={styles.heroHeader}
        >
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="chevron-back-outline" size={32} color={t.text} />
          </TouchableOpacity>

          <ReAnimated.View entering={FadeInUp.duration(800)}>
            <Text style={[styles.editorialTitle, { color: t.text }]}>{date.title}</Text>
            
            <View style={styles.metaBadgeRow}>
              {dimensionBadges.map((b, i) => (
                <View key={i} style={[styles.glassBadge, { backgroundColor: withAlpha(b.color, 0.1), borderColor: withAlpha(b.color, 0.15) }]}>
                  {b.icon ? <Text style={{ fontSize: 10 }}>{b.icon}</Text> : null}
                  <Text style={[styles.badgeText, { color: b.color }]}>{b.label.toUpperCase()}</Text>
                </View>
              ))}
            </View>

            <View style={styles.quickInfoRow}>
              <View style={[styles.infoPill, { backgroundColor: t.surfaceSecondary }]}>
                <Icon name="time-outline" size={14} color={t.primary} />
                <Text style={[styles.infoPillText, { color: t.text }]}>{date.minutes}m</Text>
              </View>
              <View style={[styles.infoPill, { backgroundColor: t.surfaceSecondary }]}>
                <Icon 
                  name={date.location === "home" ? "home-outline" : "map-outline"} 
                  size={14} color={t.primary} 
                />
                <Text style={[styles.infoPillText, { color: t.text }]}>
                  {date.location === "home" ? "At Home" : "Outdoors"}
                </Text>
              </View>
            </View>
          </ReAnimated.View>
        </LinearGradient>

        {/* Primary Editorial Action */}
        <ReAnimated.View entering={FadeInDown.delay(200)} style={styles.centerAction}>
          <TouchableOpacity onPress={handleSchedule} activeOpacity={0.9}>
            <LinearGradient colors={[t.primary, "#8E0D2C"]} style={styles.scheduleBtn}>
              <Icon name="calendar-outline" size={20} color="#FFF" />
              <Text style={styles.scheduleBtnText}>Schedule Moment</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ReAnimated.View>

        {/* Presence Module (Velvet Glass) */}
        <View style={styles.modulePadding}>
          <BlurView intensity={isDark ? 25 : 40} tint={isDark ? "dark" : "light"} style={[styles.timerModule, { borderColor: t.border }]}>
            <Text style={[styles.moduleLabel, { color: t.subtext }]}>PRESENCE TIMER</Text>
            <Text style={[styles.timerValue, { color: t.text }]}>{formatTime(timeElapsed)}</Text>
            <TouchableOpacity onPress={toggleTimer} style={[styles.timerToggle, { backgroundColor: timerActive ? t.surfaceSecondary : t.primary }]}>
              <Icon name={timerActive ? "pause" : "play"} size={32} color={timerActive ? t.text : "#FFF"} />
            </TouchableOpacity>
          </BlurView>
        </View>

        {/* Experience Timeline */}
        <View style={styles.experienceSection}>
          <Text style={[styles.sectionTitle, { color: t.text }]}>The Experience</Text>
          
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
                  { backgroundColor: t.surface, borderColor: isActive ? t.primary : t.border },
                  isActive && { borderWidth: 1.5 }
                ]}
              >
                <View style={[styles.stepIndicator, { backgroundColor: isCompleted ? "#34C759" : t.surfaceSecondary }]}>
                  {isCompleted ? (
                    <Icon name="checkmark" size={16} color="#FFF" />
                  ) : (
                    <Text style={[styles.stepNumber, { color: isActive ? t.primary : t.subtext }]}>{index + 1}</Text>
                  )}
                </View>
                <Text style={[
                  styles.stepText, 
                  { color: t.text },
                  isCompleted && styles.stepTextCompleted
                ]}>
                  {step}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.footer}>
          <Button
            title={currentStep === steps.length - 1 ? "Finish Experience" : "Next Step"}
            onPress={() => {
              if (currentStep === steps.length - 1) {
                impact(ImpactFeedbackStyle.Success);
                Alert.alert("Date Complete!", "A new memory has been shared.");
                navigation.goBack();
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // Hero Section
  heroHeader: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 64 : 40,
    paddingBottom: 48,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', marginBottom: 20 },
  editorialTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: -0.8,
  },
  metaBadgeRow: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    gap: 8, 
    marginTop: 20, 
    justifyContent: "center" 
  },
  glassBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  badgeText: { fontFamily: SYSTEM_FONT, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginLeft: 4 },
  
  quickInfoRow: { 
    flexDirection: 'row', 
    gap: 12, 
    marginTop: 24, 
    justifyContent: 'center' 
  },
  infoPill: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderRadius: 12, 
    paddingHorizontal: 14, 
    paddingVertical: 8,
  },
  infoPillText: { fontSize: 13, fontWeight: '700', marginLeft: 6 },

  // Module Actions
  centerAction: { 
    marginTop: -28, 
    alignSelf: 'center', 
    zIndex: 10 
  },
  scheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    height: 56,
    borderRadius: 28,
    ...Platform.select({
      ios: { shadowColor: '#D2121A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15 },
      android: { elevation: 6 }
    })
  },
  scheduleBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15, marginLeft: 10, textTransform: 'uppercase' },

  modulePadding: { paddingHorizontal: 24, marginTop: 40 },
  timerModule: {
    padding: 32,
    borderRadius: 32,
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  moduleLabel: { fontWeight: '800', fontSize: 11, letterSpacing: 2, marginBottom: 8 },
  timerValue: { 
    fontSize: 56, 
    fontWeight: '400', 
    fontVariant: ['tabular-nums'], 
    marginVertical: 12 
  },
  timerToggle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },

  // Experience Section
  experienceSection: { paddingHorizontal: 24, marginTop: 40 },
  sectionTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginBottom: 24 },
  stepRow: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 24,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  stepIndicator: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumber: { fontWeight: '800', fontSize: 14 },
  stepText: { flex: 1, fontWeight: '500', fontSize: 16, lineHeight: 24, letterSpacing: -0.1 },
  stepTextCompleted: { opacity: 0.3, textDecorationLine: 'line-through' },

  footer: { paddingHorizontal: 24, marginTop: 32 },
});

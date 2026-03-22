// screens/DateNightDetailScreen.js — High-End Editorial Implementation
// Velvet Glass · Atmospheric Header · Physics-based Interaction

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  TouchableOpacity,
  Platform,
  Dimensions,
  StatusBar
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useEntitlements } from "../context/EntitlementsContext";
import { impact, selection, ImpactFeedbackStyle } from "../utils/haptics";
import { TYPOGRAPHY, SPACING, BORDER_RADIUS, withAlpha } from "../utils/theme";
import { getDimensionMeta } from "../utils/contentLoader";
import Button from "../components/Button";
import ReAnimated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import GlowOrb from "../components/GlowOrb";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DateNightDetailScreen({ route, navigation }) {
  const { date } = route.params || {};
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();

  // Integrated logic from existing structure
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
      badges.unshift({ label: date._matchLabel, icon: '✨', color: colors.primary });
    }
    return badges;
  }, [date, colors]);

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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <GlowOrb color={colors.primary} size={400} top={-100} left={-150} opacity={0.15} />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Editorial Hero Header */}
        <LinearGradient 
          colors={[withAlpha(colors.primary, 0.25), "transparent"]} 
          style={styles.heroHeader}
        >
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="chevron-left" size={32} color={colors.text} />
          </TouchableOpacity>

          <ReAnimated.View entering={FadeInUp.duration(800)}>
            <Text style={[styles.editorialTitle, { color: colors.text }]}>{date.title}</Text>
            
            <View style={styles.metaBadgeRow}>
              {dimensionBadges.map((b, i) => (
                <View key={i} style={[styles.glassBadge, { backgroundColor: withAlpha(b.color, 0.12), borderColor: withAlpha(b.color, 0.2) }]}>
                  {b.icon ? <Text style={{ fontSize: 12 }}>{b.icon}</Text> : null}
                  <Text style={[styles.badgeText, { color: b.color }]}>{b.label.toUpperCase()}</Text>
                </View>
              ))}
            </View>

            <View style={styles.quickInfoRow}>
              <View style={[styles.infoPill, { backgroundColor: colors.surface2 }]}>
                <MaterialCommunityIcons name="clock-outline" size={14} color={colors.primary} />
                <Text style={[styles.infoPillText, { color: colors.text }]}>{date.minutes}m</Text>
              </View>
              <View style={[styles.infoPill, { backgroundColor: colors.surface2 }]}>
                <MaterialCommunityIcons 
                  name={date.location === "home" ? "home-variant-outline" : "map-marker-outline"} 
                  size={14} color={colors.primary} 
                />
                <Text style={[styles.infoPillText, { color: colors.text }]}>
                  {date.location === "home" ? "At Home" : "Outdoors"}
                </Text>
              </View>
            </View>
          </ReAnimated.View>
        </LinearGradient>

        {/* Primary Editorial Action */}
        <ReAnimated.View entering={FadeInDown.delay(200)} style={styles.centerAction}>
          <TouchableOpacity onPress={handleSchedule} activeOpacity={0.85}>
            <LinearGradient colors={[colors.primary, colors.primaryMuted || colors.primary]} style={styles.scheduleBtn}>
              <MaterialCommunityIcons name="calendar-heart" size={20} color="#FFF" />
              <Text style={styles.scheduleBtnText}>Schedule Moment</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ReAnimated.View>

        {/* Presence Module */}
        <View style={styles.modulePadding}>
          <BlurView intensity={isDark ? 30 : 50} tint={isDark ? "dark" : "light"} style={[styles.timerModule, { borderColor: colors.borderGlass }]}>
            <Text style={[styles.moduleLabel, { color: colors.textMuted }]}>PRESENCE TIMER</Text>
            <Text style={[styles.timerValue, { color: colors.text }]}>{formatTime(timeElapsed)}</Text>
            <TouchableOpacity onPress={toggleTimer} style={[styles.timerToggle, { backgroundColor: timerActive ? colors.surface : colors.primary }]}>
              <MaterialCommunityIcons name={timerActive ? "pause" : "play"} size={32} color={timerActive ? colors.text : "#FFF"} />
            </TouchableOpacity>
          </BlurView>
        </View>

        {/* Experience Timeline */}
        <View style={styles.experienceSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>The Experience</Text>
          
          {steps.map((step, index) => {
            const isCompleted = currentStep > index;
            const isActive = currentStep === index;

            return (
              <TouchableOpacity
                key={index}
                onPress={() => { selection(); setCurrentStep(index); }}
                activeOpacity={0.7}
                style={[
                  styles.stepRow,
                  isActive && { backgroundColor: withAlpha(colors.primary, 0.05), borderColor: withAlpha(colors.primary, 0.2), borderWidth: 1 }
                ]}
              >
                <View style={[styles.stepIndicator, { backgroundColor: isCompleted ? colors.success : colors.surface2 }]}>
                  {isCompleted ? (
                    <MaterialCommunityIcons name="check" size={16} color="#FFF" />
                  ) : (
                    <Text style={[styles.stepNumber, { color: isActive ? colors.primary : colors.textMuted }]}>{index + 1}</Text>
                  )}
                </View>
                <Text style={[
                  styles.stepText, 
                  { color: colors.text },
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
                Alert.alert("Date Complete! 🎉", "A new memory has been created.");
                navigation.goBack();
              } else {
                impact(ImpactFeedbackStyle.Light);
                setCurrentStep((s) => s + 1);
              }
            }}
            fullWidth
          />
        </View>
        
        <View style={{ height: 60 }} />
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
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', marginBottom: 20 },
  editorialTitle: {
    fontFamily: 'DMSerifDisplay-Regular',
    fontSize: 40,
    textAlign: 'center',
    lineHeight: 48,
    letterSpacing: -0.5,
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
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: { fontFamily: 'Lato_700Bold', fontSize: 10, letterSpacing: 1, marginLeft: 4 },
  
  quickInfoRow: { 
    flexDirection: 'row', 
    gap: 12, 
    marginTop: 20, 
    justifyContent: 'center' 
  },
  infoPill: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderRadius: 20, 
    paddingHorizontal: 14, 
    paddingVertical: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 2 }
    })
  },
  infoPillText: { fontSize: 13, fontFamily: 'Lato_700Bold', marginLeft: 6 },

  // Module Actions
  centerAction: { 
    marginTop: -30, 
    alignSelf: 'center', 
    zIndex: 10 
  },
  scheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 30,
    ...Platform.select({
      ios: { shadowColor: '#7A1E4E', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20 },
      android: { elevation: 6 }
    })
  },
  scheduleBtnText: { color: '#FFF', fontFamily: 'Lato_700Bold', fontSize: 15, marginLeft: 10 },

  modulePadding: { paddingHorizontal: 24, marginTop: 30 },
  timerModule: {
    padding: 28,
    borderRadius: 32,
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  moduleLabel: { fontFamily: 'Lato_700Bold', fontSize: 11, letterSpacing: 2, marginBottom: 8 },
  timerValue: { 
    fontSize: 54, 
    fontFamily: 'Lato_400Regular', 
    fontVariant: ['tabular-nums'], 
    marginVertical: 10 
  },
  timerToggle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
  },

  // Experience Section
  experienceSection: { paddingHorizontal: 24, marginTop: 40 },
  sectionTitle: { fontFamily: 'DMSerifDisplay-Regular', fontSize: 28, marginBottom: 24 },
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
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumber: { fontFamily: 'Lato_700Bold', fontSize: 14 },
  stepText: { flex: 1, fontFamily: 'Lato_400Regular', fontSize: 16, lineHeight: 24 },
  stepTextCompleted: { opacity: 0.3, textDecorationLine: 'line-through' },

  footer: { paddingHorizontal: 24, marginTop: 30 },
});

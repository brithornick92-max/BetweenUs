// screens/DateNightDetailScreen.js
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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useEntitlements } from "../context/EntitlementsContext";
import { TYPOGRAPHY } from "../utils/theme";
import { getDimensionMeta } from "../utils/contentLoader";
import Button from "../components/Button";

export default function DateNightDetailScreen({ route, navigation }) {
  const { date } = route.params || {};
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();

  const t = useMemo(
    () => ({
      background: colors.background,
      surface: colors.surface,
      surfaceSecondary: colors.surface2,
      text: colors.text,
      textSecondary: colors.textMuted,
      border: colors.border,
      blushRose: colors.accent || colors.primary,
      mutedGold: colors.accent || colors.primary,
      deepPlum: colors.primaryMuted || colors.primary,
      success: colors.success,
    }),
    [colors]
  );

  // Gate: date night details require premium if date is premium
  useEffect(() => {
    if (!isPremium && date?.isPremium) {
      showPaywall("DATE_NIGHT_DETAILS");
    }
  }, [isPremium, date?.isPremium, showPaywall]);

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
      badges.unshift({ label: date._matchLabel, icon: '', color: '#C9A84C' });
    }
    return badges;
  }, [date?.heat, date?.load, date?.style, date?._matchLabel]);
  const [currentStep, setCurrentStep] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const toggleTimer = () => {
    setTimerActive((prev) => {
      const next = !prev;

      if (next) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setTimeElapsed((s) => s + 1);
        }, 1000);
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
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
    const stepsText = steps.length ? `• ${steps.join("\n• ")}` : "";

    // Default to tomorrow at 7:30 PM so the user has a sensible starting point
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 30, 0, 0);

    const prefill = {
      __token: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      title: `Date: ${date.title || "Date Night"}`,
      prefillDate: tomorrow.getTime(),      // timestamp — pickers understand this
      location: date?.location === "home" ? "Our Home" : "Out & About",
      notes: stepsText,
      isDateNight: true,
      minutes: date?.minutes || null,
    };
    navigation.navigate("MainTabs", { screen: "Calendar", params: { prefill } });
  };

  if (!date) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: t.textMuted, fontSize: 16, marginBottom: 16 }}>This date isn't available.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, backgroundColor: t.primary }}>
          <Text style={{ color: t.background, fontWeight: '700' }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <LinearGradient colors={[`${t.blushRose}40`, t.background]} style={styles.heroHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={t.text} />
          </TouchableOpacity>

          <Text style={[TYPOGRAPHY.display, { color: t.text, fontSize: 32 }]}>{date.title}</Text>






          {/* Duration and Place badges restored */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 15, alignSelf: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.surfaceSecondary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 }}>
              <MaterialCommunityIcons name="clock-outline" size={16} color={t.blushRose} />
              <Text style={{ fontSize: 12, fontWeight: '700', marginLeft: 6, color: t.text }}>{date.minutes}m</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.surfaceSecondary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}>
              <MaterialCommunityIcons
                name={date.location === "home" ? "home-variant" : "map-marker"}
                size={16}
                color={t.mutedGold}
              />
              <Text style={{ fontSize: 12, fontWeight: '700', marginLeft: 6, color: t.text }}>
                {date.location === "home" ? "Home" : "Out"}
              </Text>
            </View>
          </View>

        </LinearGradient>

        {/* Schedule Button above Presence Timer */}
        <TouchableOpacity style={[styles.scheduleFloat, { marginTop: 0, alignSelf: 'center' }]} onPress={handleSchedule}>
          <LinearGradient colors={[t.blushRose, t.deepPlum]} style={styles.scheduleInner}>
            <MaterialCommunityIcons name="calendar-plus" size={20} color="#FFF" />
            <Text style={[styles.scheduleText, { color: '#FFF' }]}>Schedule</Text>
          </LinearGradient>
        </TouchableOpacity>


        <View style={styles.timerSection}>
          <BlurView
            intensity={20}
            tint={isDark ? "dark" : "light"}
            style={[styles.timerCard, { borderColor: t.border }]}
          >
            <Text style={[TYPOGRAPHY.caption, { letterSpacing: 2, color: t.textSecondary }]}>
              PRESENCE TIMER
            </Text>

            <Text style={[styles.timerDisplay, { color: t.text }]}>{formatTime(timeElapsed)}</Text>

            <TouchableOpacity
              onPress={toggleTimer}
              style={[
                styles.playBtn,
                {
                  backgroundColor: timerActive ? t.surface : t.blushRose,
                  borderColor: t.border,
                },
              ]}
            >
              <MaterialCommunityIcons name={timerActive ? "pause" : "play"} size={28} color="#FFF" />
            </TouchableOpacity>
          </BlurView>
        </View>

        <View style={styles.stepsContainer}>
          <Text style={[TYPOGRAPHY.h2, { marginBottom: 20, marginLeft: 5, color: t.text }]}>
            The Experience
          </Text>

          {steps.length === 0 ? (
            <View
              style={[
                styles.stepCard,
                { backgroundColor: t.surface, borderColor: t.border, borderWidth: 1 },
              ]}
            >
              <Text style={[TYPOGRAPHY.body, { color: t.textSecondary }]}>
                No steps for this date yet.
              </Text>
            </View>
          ) : (
            steps.map((step, index) => {
              const isCompleted = currentStep > index;
              const isActive = currentStep === index;

              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => setCurrentStep(index)}
                  style={[
                    styles.stepCard,
                    { backgroundColor: t.surface },
                    isActive && { borderColor: t.blushRose, borderWidth: 1 },
                    !isActive && { borderWidth: 0 },
                  ]}
                >
                  <View
                    style={[
                      styles.stepIndicator,
                      {
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.06)"
                          : "rgba(0,0,0,0.05)",
                      },
                      isCompleted && { backgroundColor: t.success },
                    ]}
                  >
                    {isCompleted ? (
                      <MaterialCommunityIcons name="check" size={16} color={t.text} />
                    ) : (
                      <Text
                        style={[
                          styles.stepNumber,
                          { color: isActive ? t.blushRose : t.textSecondary },
                        ]}
                      >
                        {index + 1}
                      </Text>
                    )}
                  </View>

                  <Text
                    style={[
                      TYPOGRAPHY.body,
                      styles.stepText,
                      { color: t.text },
                      isCompleted && styles.completedText,
                    ]}
                  >
                    {step}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={styles.footer}>
          <Button
            title={steps.length > 0 && currentStep === steps.length - 1 ? "Complete Date" : "Next Step"}
            onPress={() => {
              if (steps.length === 0) {
                Alert.alert("No steps", "This date doesn’t have steps yet.");
                return;
              }

              if (currentStep === steps.length - 1) {
                Alert.alert("Date Complete! 🎉", "Memories saved to your heart (and hopefully your journal).");
                navigation.goBack();
              } else {
                setCurrentStep((s) => s + 1);
              }
            }}
            fullWidth
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 60 },

  heroHeader: {
    padding: 30,
    paddingTop: 20,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  backBtn: { marginBottom: 20 },

  metaBadgeRow: { flexDirection: "row", gap: 10, marginTop: 15 },
  moodBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
  },
  glassBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  moodBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  badgeText: { fontSize: 12, fontWeight: "700", marginLeft: 6 },
  moodBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },

  scheduleFloat: { marginTop: 25, alignSelf: "flex-start" },
  scheduleInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
  },
  scheduleText: { fontWeight: "800", marginLeft: 8, fontSize: 14 },

    timerSection: { paddingHorizontal: 30, marginTop: 20 },
  timerCard: {
    padding: 25,
    borderRadius: 30,
    alignItems: "center",
    borderWidth: 1,
    overflow: "hidden",
  },
  timerDisplay: {
    fontSize: 42,
    fontWeight: "800",
    marginVertical: 10,
    fontVariant: ["tabular-nums"],
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    borderWidth: 1,
  },

  stepsContainer: { padding: 30 },
  stepCard: {
    flexDirection: "row",
    padding: 20,
    borderRadius: 20,
    marginBottom: 15,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  stepIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  stepNumber: { fontSize: 14, fontWeight: "800" },
  stepText: { flex: 1, lineHeight: 22 },
  completedText: { opacity: 0.4, textDecorationLine: "line-through" },

  footer: { paddingHorizontal: 30, marginTop: 10 },
});

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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import { useEntitlements } from "../context/EntitlementsContext";
import { TYPOGRAPHY, SPACING, BORDER_RADIUS, COLORS } from "../utils/theme";
import Button from "../components/Button";

const { width } = Dimensions.get("window");

const toISODate = (d) => {
  const date = new Date(d);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};

export default function DateNightDetailScreen({ route, navigation }) {
  const { date } = route.params || {};
  const { state } = useAppContext();
  const { theme: activeTheme, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();

  // Gate: date night details require premium after the first free one
  useEffect(() => {
    if (!isPremium && date?.isPremium) {
      showPaywall('DATE_NIGHT_DETAILS');
    }
  }, [isPremium, date?.isPremium, showPaywall]);

  // ✅ Theme normalization (works with either {colors} or flat theme objects)
  const t = useMemo(() => {
    const base = activeTheme?.colors ? activeTheme.colors : activeTheme;

    return {
      background: base?.background ?? (isDark ? COLORS.warmCharcoal : COLORS.softCream),
      surface: base?.surface ?? (isDark ? COLORS.deepPlum : COLORS.pureWhite),
      surfaceSecondary:
        base?.surfaceSecondary ?? (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)"),
      text: base?.text ?? (isDark ? COLORS.softCream : COLORS.charcoal),
      textSecondary:
        base?.textSecondary ??
        (isDark ? "rgba(246,242,238,0.70)" : "rgba(51,51,51,0.68)"),
      border: base?.border ?? (isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"),
      blushRose: base?.blushRose ?? base?.accent ?? COLORS.blushRose,
      mutedGold: base?.mutedGold ?? COLORS.mutedGold,
      deepPlum: base?.deepPlum ?? COLORS.deepPlum,
      success: base?.success ?? COLORS.success,
    };
  }, [activeTheme, isDark]);

  const steps = useMemo(() => (Array.isArray(date?.steps) ? date.steps : []), [date?.steps]);

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
        // start
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setTimeElapsed((s) => s + 1);
        }, 1000);
      } else {
        // stop
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
    const prefill = {
      __token: `${Date.now()}_${Math.random().toString(16).slice(2)}`, // ✅ prevents duplicate prefill reuse
      title: `Date: ${date.title || "Date Night"}`,
      dateStr: new Date().toLocaleDateString('en-US', { 
        month: '2-digit', 
        day: '2-digit', 
        year: 'numeric' 
      }),
      timeStr: "7:30 PM",
      location: date?.location === "home" ? "Our Home" : "Out & About",
      notes: stepsText,
      isDateNight: true,
    };
    navigation.navigate("Calendar", { prefill });
  };

  if (!date) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Immersive Header */}
        <LinearGradient
          colors={[`${t.blushRose}40`, t.background]}
          style={styles.heroHeader}
        >
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={t.text} />
          </TouchableOpacity>

          <Text style={[TYPOGRAPHY.display, { color: t.text, fontSize: 32 }]}>
            {date.title}
          </Text>

          <View style={styles.metaBadgeRow}>
            <View style={[styles.glassBadge, { backgroundColor: t.surfaceSecondary }]}>
              <MaterialCommunityIcons name="clock-outline" size={16} color={t.blushRose} />
              <Text style={[styles.badgeText, { color: t.text }]}>{date.minutes}m</Text>
            </View>

            <View style={[styles.glassBadge, { backgroundColor: t.surfaceSecondary }]}>
              <MaterialCommunityIcons
                name={date.location === "home" ? "home-variant" : "map-marker"}
                size={16}
                color={t.mutedGold}
              />
              <Text style={[styles.badgeText, { color: t.text }]}>
                {date.location === "home" ? "Home" : "Out"}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.scheduleFloat} onPress={handleSchedule}>
            <LinearGradient colors={[t.blushRose, t.deepPlum]} style={styles.scheduleInner}>
              <MaterialCommunityIcons name="calendar-plus" size={20} color={COLORS.pureWhite} />
              <Text style={styles.scheduleText}>Schedule</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>

        {/* The Connection Timer */}
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
                { backgroundColor: timerActive ? t.surface : t.blushRose, borderColor: t.border },
              ]}
            >
              <MaterialCommunityIcons
                name={timerActive ? "pause" : "play"}
                size={28}
                color={timerActive ? t.text : "#FFF"}
              />
            </TouchableOpacity>
          </BlurView>
        </View>

        {/* Step-by-Step Guide */}
        <View style={styles.stepsContainer}>
          <Text style={[TYPOGRAPHY.h2, { marginBottom: 20, marginLeft: 5, color: t.text }]}>
            The Experience
          </Text>

          {steps.length === 0 ? (
            <View style={[styles.stepCard, { backgroundColor: t.surface, borderColor: t.border, borderWidth: 1 }]}>
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
                      { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" },
                      isCompleted && { backgroundColor: t.success },
                    ]}
                  >
                    {isCompleted ? (
                      <MaterialCommunityIcons name="check" size={16} color="#FFF" />
                    ) : (
                      <Text style={[styles.stepNumber, { color: isActive ? t.blushRose : t.textSecondary }]}>
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

        {/* Completion Action */}
        <View style={styles.footer}>
          <Button
            title={
              steps.length > 0 && currentStep === steps.length - 1 ? "Complete Date" : "Next Step"
            }
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
  glassBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: { fontSize: 12, fontWeight: "700", marginLeft: 6 },

  scheduleFloat: { marginTop: 25, alignSelf: "flex-start" },
  scheduleInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
  },
  scheduleText: { color: "#FFF", fontWeight: "800", marginLeft: 8, fontSize: 14 },

  timerSection: { paddingHorizontal: 30, marginTop: -40 },
  timerCard: {
    padding: 25,
    borderRadius: 30,
    alignItems: "center",
    borderWidth: 1,
    overflow: "hidden",
  },
  timerDisplay: { fontSize: 42, fontWeight: "800", marginVertical: 10, fontVariant: ["tabular-nums"] },
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
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  Alert,
  RefreshControl,
  Animated,
  Platform,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from 'expo-haptics';
import { calendarStorage, myDatesStorage } from "../utils/storage";
import {
  ensureNotificationPermissions,
  scheduleEventNotification,
} from "../utils/notifications";
import { useTheme } from "../context/ThemeContext";
import { TYPOGRAPHY, SPACING, BORDER_RADIUS, GRADIENTS, COLORS, SHADOWS, getGlassStyle } from "../utils/theme";
import Button from "../components/Button";

const { width } = Dimensions.get("window");

const toISODate = (d) => {
  const date = new Date(d);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};

const toTimeString = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });

const combineDateTime = (dateStr, timeStr) => {
  // Handle MM/DD/YYYY format
  const [mm, dd, yyyy] = String(dateStr || "").split("/").map(Number);
  const [hh, min] = String(timeStr || "").split(":").map(Number);
  return new Date(yyyy || new Date().getFullYear(), (mm || 1) - 1, dd || 1, hh || 0, min || 0).getTime();
};

// Premium Calendar Component
function PremiumCalendar({ selectedDate, onDateSelect, events, theme, isDark }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const getEventsForDate = (date) => {
    if (!date) return [];
    const dateStr = toISODate(date);
    return events.filter(event => {
      const eventDate = toISODate(new Date(event.whenTs));
      return eventDate === dateStr;
    });
  };

  const isToday = (date) => {
    if (!date) return false;
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date) => {
    if (!date || !selectedDate) return false;
    return date.toDateString() === selectedDate.toDateString();
  };

  const navigateMonth = (direction) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() + direction);
    setCurrentMonth(newMonth);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderDay = (date, index) => {
    if (!date) {
      return <View key={`empty-${index}`} style={styles.dayCell} />;
    }

    const dayEvents = getEventsForDate(date);
    const hasEvents = dayEvents.length > 0;
    const hasDateNight = dayEvents.some(e => e.isDateNight);
    const today = isToday(date);
    const selected = isSelected(date);

    return (
      <TouchableOpacity
        key={date.toISOString()}
        style={[
          styles.dayCell,
          today && styles.todayCell,
          selected && styles.selectedCell,
        ]}
        onPress={() => {
          Haptics.selectionAsync();
          onDateSelect(date);
        }}
        activeOpacity={0.8}
      >
        {selected && (
          <BlurView intensity={20} style={styles.selectedBackground}>
            <LinearGradient
              colors={[theme.blushRose + "40", theme.blushRose + "20"]}
              style={StyleSheet.absoluteFill}
            />
          </BlurView>
        )}
        
        <Text style={[
          styles.dayText,
          { color: theme.text },
          today && { color: theme.blushRose, fontWeight: '800' },
          selected && { color: '#FFF', fontWeight: '700' },
        ]}>
          {date.getDate()}
        </Text>
        
        {hasEvents && (
          <View style={styles.eventIndicators}>
            {hasDateNight && (
              <View style={[styles.eventDot, { backgroundColor: theme.blushRose }]} />
            )}
            {dayEvents.length > (hasDateNight ? 1 : 0) && (
              <View style={[styles.eventDot, { backgroundColor: theme.mutedGold }]} />
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });

  return (
    <Animated.View style={[styles.calendarContainer, { opacity: fadeAnim }]}>
      <BlurView
        intensity={isDark ? 40 : 70}
        tint={isDark ? "dark" : "light"}
        style={styles.calendarCard}
      >
        <LinearGradient
          colors={
            isDark
              ? ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.02)"]
              : ["rgba(255,255,255,0.9)", "rgba(255,255,255,0.6)"]
          }
          style={StyleSheet.absoluteFill}
        />

        {/* Calendar Header */}
        <View style={styles.calendarHeader}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateMonth(-1)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="chevron-left" size={24} color={theme.text} />
          </TouchableOpacity>
          
          <Text style={[styles.monthTitle, { color: theme.text }]}>
            {monthName}
          </Text>
          
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateMonth(1)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="chevron-right" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Day Labels */}
        <View style={styles.dayLabelsRow}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <View key={day} style={styles.dayLabelCell}>
              <Text style={[styles.dayLabel, { color: theme.textSecondary }]}>
                {day}
              </Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarGrid}>
          {Array.from({ length: Math.ceil(days.length / 7) }, (_, weekIndex) => (
            <View key={weekIndex} style={styles.weekRow}>
              {days.slice(weekIndex * 7, (weekIndex + 1) * 7).map((date, dayIndex) =>
                renderDay(date, weekIndex * 7 + dayIndex)
              )}
            </View>
          ))}
        </View>
      </BlurView>
    </Animated.View>
  );
}

// Animated Event Card
function AnimatedEventCard({ item, index, onLongPress, theme, isDark }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const dateObj = new Date(item.whenTs);

  return (
    <Animated.View
      style={[
        styles.eventWrapper,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={async () => {
          await Haptics.selectionAsync();
          onLongPress();
        }}
      >
        <BlurView
          intensity={isDark ? 35 : 60}
          tint={isDark ? "dark" : "light"}
          style={styles.eventCard}
        >
          <LinearGradient
            colors={
              isDark
                ? ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.01)"]
                : ["rgba(255,255,255,0.85)", "rgba(255,255,255,0.6)"]
            }
            style={StyleSheet.absoluteFill}
          />

          {item.isDateNight && (
            <View style={[styles.dateNightBadge, { backgroundColor: theme.blushRose + "20" }]}>
              <MaterialCommunityIcons name="heart-multiple" size={12} color={theme.blushRose} />
              <Text style={[styles.badgeText, { color: theme.blushRose }]}>DATE NIGHT</Text>
            </View>
          )}

          <View style={styles.eventContent}>
            <View style={styles.eventMain}>
              <Text style={[styles.eventTitle, { color: theme.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={styles.eventMeta}>
                <MaterialCommunityIcons name="clock-outline" size={12} color={theme.textSecondary} />
                <Text style={[styles.eventMetaText, { color: theme.textSecondary }]}>
                  {dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}
                </Text>
                {item.location && (
                  <>
                    <View style={[styles.metaDot, { backgroundColor: theme.textSecondary }]} />
                    <MaterialCommunityIcons name="map-marker-outline" size={12} color={theme.textSecondary} />
                    <Text style={[styles.eventMetaText, { color: theme.textSecondary }]} numberOfLines={1}>
                      {item.location}
                    </Text>
                  </>
                )}
              </View>
            </View>

            <MaterialCommunityIcons
              name={item.isDateNight ? "heart-multiple" : "calendar-check"}
              size={20}
              color={item.isDateNight ? theme.blushRose : theme.mutedGold}
            />
          </View>
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function CalendarScreen({ navigation, route }) {
  const { theme: activeTheme, isDark } = useTheme();

  const t = useMemo(() => {
    const base = activeTheme?.colors ? activeTheme.colors : activeTheme;

    const primaryGradient =
      activeTheme?.gradients?.primary ||
      base?.gradients?.primary ||
      GRADIENTS.primary;

    return {
      background: base?.background ?? (isDark ? COLORS.warmCharcoal : COLORS.softCream),
      surface: base?.surface ?? (isDark ? COLORS.deepPlum : COLORS.pureWhite),
      text: base?.text ?? (isDark ? COLORS.softCream : COLORS.charcoal),
      textSecondary:
        base?.textSecondary ??
        (isDark ? "rgba(246,242,238,0.70)" : "rgba(51,51,51,0.68)"),
      border: base?.border ?? (isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"),
      blushRose: base?.accent ?? COLORS.blushRose,
      mutedGold: base?.mutedGold ?? COLORS.mutedGold,
      gradients: { primary: primaryGradient },
    };
  }, [activeTheme, isDark]);

  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState({
    title: "",
    dateStr: toISODate(new Date()),
    timeStr: toTimeString(new Date()),
    location: "",
    notes: "",
    isDateNight: false,
    notify: false,
    notifyMins: "60",
  });

  const scrollY = useRef(new Animated.Value(0)).current;

  const loadEvents = async () => {
    const list = await calendarStorage.getEvents();
    const safe = Array.isArray(list) ? list : [];
    setEvents(safe.sort((a, b) => (a.whenTs || 0) - (b.whenTs || 0)));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadEvents();
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadEvents();

      const prefill = route?.params?.prefill;
      if (prefill) {
        setForm((prev) => ({
          ...prev,
          title: prefill.title || "",
          dateStr: prefill.dateStr || toISODate(new Date()),
          timeStr: prefill.timeStr || toTimeString(new Date()),
          location: prefill.location || "",
          notes: prefill.notes || "",
          isDateNight: !!prefill.isDateNight,
        }));

        setModalOpen(true);
        navigation.setParams({ prefill: null });
      }
    }, [route?.params?.prefill])
  );

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setForm(prev => ({
      ...prev,
      dateStr: toISODate(date)
    }));
  };

  const getSelectedDateEvents = () => {
    const selectedDateStr = toISODate(selectedDate);
    return events.filter(event => {
      const eventDate = toISODate(new Date(event.whenTs));
      return eventDate === selectedDateStr;
    });
  };

  const handleSave = async () => {
    if (!form.title.trim()) return Alert.alert("Required", "Please name your event.");

    const whenTs = combineDateTime(form.dateStr, form.timeStr);
    let notificationId = null;

    if (form.notify) {
      const mins = parseInt(form.notifyMins, 10);
      const offsetMs = (Number.isFinite(mins) ? mins : 60) * 60000;

      const { ok } = await ensureNotificationPermissions();
      if (ok) {
        notificationId = await scheduleEventNotification({
          title: "Between Us",
          body: `${form.title} is coming up! 💜`,
          when: whenTs - offsetMs,
        });
      }
    }

    const eventData = { ...form, whenTs, notificationId };
    const savedEvent = await calendarStorage.addEvent(eventData);

    if (form.isDateNight) {
      await myDatesStorage.addMyDate({
        title: form.title,
        locationType: form.location ? "out" : "home",
        moods: ["romantic"],
        steps: form.notes ? [form.notes] : ["Plan the vibe.", "Enjoy the moment."],
        sourceEventId: savedEvent?.id,
      });
    }

    setModalOpen(false);
    await loadEvents();

    setForm((prev) => ({
      ...prev,
      title: "",
      location: "",
      notes: "",
      isDateNight: false,
      notify: false,
      notifyMins: "60",
    }));
  };

  const selectedDateEvents = getSelectedDateEvents();

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      {/* Atmospheric Background */}
      <LinearGradient
        colors={
          isDark
            ? [COLORS.warmCharcoal, COLORS.deepPlum + "30", COLORS.warmCharcoal]
            : [COLORS.softCream, COLORS.blushRose + "10", COLORS.mutedGold + "05", COLORS.softCream]
        }
        style={StyleSheet.absoluteFill}
        locations={isDark ? [0, 0.5, 1] : [0, 0.35, 0.7, 1]}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.headerEyebrow, { color: t.mutedGold }]}>
              YOUR TIMELINE
            </Text>
            <Text style={[styles.headerTitle, { color: t.text }]}>Calendar</Text>
          </View>

          <TouchableOpacity 
            style={styles.fab} 
            onPress={() => {
              Haptics.selectionAsync();
              setModalOpen(true);
            }} 
            activeOpacity={0.9}
          >
            <LinearGradient colors={t.gradients.primary} style={styles.fabGradient}>
              <MaterialCommunityIcons name="plus" size={24} color={COLORS.pureWhite} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.blushRose} />
          }
        >
          {/* Premium Calendar */}
          <PremiumCalendar
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            events={events}
            theme={t}
            isDark={isDark}
          />

          {/* Selected Date Events */}
          <View style={styles.eventsSection}>
            <Text style={[styles.sectionTitle, { color: t.text }]}>
              {selectedDate.toLocaleDateString('en-US', { 
                weekday: 'long',
                month: 'long', 
                day: 'numeric' 
              })}
            </Text>

            {selectedDateEvents.length > 0 ? (
              selectedDateEvents.map((event, index) => (
                <AnimatedEventCard
                  key={event.id}
                  item={event}
                  index={index}
                  onLongPress={() => {
                    Alert.alert("Delete Event", "Remove this from your timeline?", [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: async () => {
                          await calendarStorage.deleteEvent(event.id);
                          loadEvents();
                        },
                      },
                    ]);
                  }}
                  theme={t}
                  isDark={isDark}
                />
              ))
            ) : (
              <View style={styles.emptyDay}>
                <MaterialCommunityIcons name="calendar-plus" size={48} color={t.border} />
                <Text style={[styles.emptyDayText, { color: t.textSecondary }]}>
                  No events planned
                </Text>
                <TouchableOpacity
                  style={styles.addEventButton}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setModalOpen(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.addEventText, { color: t.blushRose }]}>
                    Add Event
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Add Event Modal */}
      <Modal visible={modalOpen} animationType="slide" transparent>
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: t.surface }]}>
              <LinearGradient
                colors={
                  isDark
                    ? ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.02)"]
                    : ["rgba(255,255,255,0.95)", "rgba(255,255,255,0.8)"]
                }
                style={StyleSheet.absoluteFill}
              />

              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: t.text }]}>New Event</Text>
                <TouchableOpacity onPress={() => setModalOpen(false)}>
                  <MaterialCommunityIcons name="close" size={24} color={t.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.modalForm} 
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 20 }}
              >
              <TextInput
                style={[styles.input, { color: t.text, borderColor: t.border }]}
                placeholder="What are we doing?"
                placeholderTextColor={t.textSecondary}
                value={form.title}
                onChangeText={(v) => setForm((prev) => ({ ...prev, title: v }))}
              />

              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { flex: 1, color: t.text, borderColor: t.border }]}
                  value={form.dateStr}
                  onChangeText={(v) => setForm((prev) => ({ ...prev, dateStr: v }))}
                  placeholderTextColor={t.textSecondary}
                />
                <TextInput
                  style={[styles.input, { flex: 1, marginLeft: 12, color: t.text, borderColor: t.border }]}
                  value={form.timeStr}
                  onChangeText={(v) => setForm((prev) => ({ ...prev, timeStr: v }))}
                  placeholderTextColor={t.textSecondary}
                />
              </View>

              <TextInput
                style={[styles.input, { color: t.text, borderColor: t.border }]}
                placeholder="Location (optional)"
                placeholderTextColor={t.textSecondary}
                value={form.location}
                onChangeText={(v) => setForm((prev) => ({ ...prev, location: v }))}
              />

              <TextInput
                style={[styles.textArea, { color: t.text, borderColor: t.border }]}
                placeholder="Notes (optional)"
                placeholderTextColor={t.textSecondary}
                value={form.notes}
                onChangeText={(v) => setForm((prev) => ({ ...prev, notes: v }))}
                multiline
                numberOfLines={3}
              />

              <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                  <MaterialCommunityIcons name="heart-multiple" size={20} color={t.blushRose} />
                  <Text style={[styles.switchText, { color: t.text }]}>Date Night</Text>
                </View>
                <Switch
                  value={form.isDateNight}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, isDateNight: v }))}
                  trackColor={{ false: t.border, true: t.blushRose + "40" }}
                  thumbColor={form.isDateNight ? t.blushRose : t.textSecondary}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                  <MaterialCommunityIcons name="bell-outline" size={20} color={t.mutedGold} />
                  <Text style={[styles.switchText, { color: t.text }]}>Remind Me</Text>
                </View>
                <Switch
                  value={form.notify}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, notify: v }))}
                  trackColor={{ false: t.border, true: t.mutedGold + "40" }}
                  thumbColor={form.notify ? t.mutedGold : t.textSecondary}
                />
              </View>

              {form.notify && (
                <View style={styles.reminderOptions}>
                  <Text style={[styles.reminderLabel, { color: t.textSecondary }]}>
                    Remind me:
                  </Text>
                  <View style={styles.reminderGrid}>
                    {[
                      { value: "15", label: "15 min before" },
                      { value: "30", label: "30 min before" },
                      { value: "60", label: "1 hour before" },
                      { value: "120", label: "2 hours before" },
                      { value: "1440", label: "1 day before" },
                      { value: "2880", label: "2 days before" },
                    ].map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.reminderOption,
                          {
                            backgroundColor: form.notifyMins === option.value 
                              ? t.mutedGold + "20" 
                              : t.surface,
                            borderColor: form.notifyMins === option.value 
                              ? t.mutedGold 
                              : t.border,
                          },
                        ]}
                        onPress={() => setForm((prev) => ({ ...prev, notifyMins: option.value }))}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.reminderOptionText,
                            {
                              color: form.notifyMins === option.value 
                                ? t.mutedGold 
                                : t.text,
                            },
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: t.border }]}
                  onPress={() => setModalOpen(false)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.cancelButtonText, { color: t.textSecondary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSave}
                  activeOpacity={0.9}
                >
                  <LinearGradient colors={t.gradients.primary} style={styles.saveButtonGradient}>
                    <Text style={styles.saveButtonText}>Save Event</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </BlurView>
      </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  headerEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginBottom: SPACING.sm,
    opacity: 0.8,
  },

  headerTitle: {
    fontFamily: Platform.select({
      ios: "PlayfairDisplay-Bold",
      android: "PlayfairDisplay_700Bold",
    }),
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.5,
  },

  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },

  fabGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Calendar
  calendarContainer: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
  },

  calendarCard: {
    borderRadius: BORDER_RADIUS.xxl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    padding: SPACING.xl,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },

  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.xl,
  },

  navButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },

  monthTitle: {
    fontFamily: Platform.select({
      ios: "PlayfairDisplay-Bold",
      android: "PlayfairDisplay_700Bold",
    }),
    fontSize: 20,
    fontWeight: "700",
  },

  dayLabelsRow: {
    flexDirection: "row",
    marginBottom: 10,
  },

  dayLabelCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },

  dayLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  calendarGrid: {
    gap: 2,
  },

  weekRow: {
    flexDirection: "row",
    gap: 2,
  },

  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    position: "relative",
  },

  selectedCell: {
    overflow: "hidden",
  },

  selectedBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
  },

  todayCell: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },

  dayText: {
    fontSize: 16,
    fontWeight: "600",
  },

  eventIndicators: {
    position: "absolute",
    bottom: 2,
    flexDirection: "row",
    gap: 2,
  },

  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  // Events Section
  eventsSection: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 100,
  },

  sectionTitle: {
    fontFamily: Platform.select({
      ios: "PlayfairDisplay-Bold",
      android: "PlayfairDisplay_700Bold",
    }),
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 20,
  },

  eventWrapper: {
    marginBottom: 16,
  },

  eventCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: "hidden",
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },

  dateNightBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: 12,
    gap: 4,
  },

  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  eventContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  eventMain: {
    flex: 1,
  },

  eventTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
  },

  eventMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  eventMetaText: {
    fontSize: 12,
  },

  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },

  // Empty State
  emptyDay: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },

  emptyDayText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 20,
  },

  addEventButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },

  addEventText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },

  modalContent: {
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    maxHeight: "80%",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    paddingBottom: 16,
  },

  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
  },

  modalForm: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },

  input: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },

  textArea: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: "top",
  },

  row: {
    flexDirection: "row",
    gap: 12,
  },

  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    marginBottom: 8,
  },

  switchLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  switchText: {
    fontSize: 16,
    fontWeight: "600",
  },

  // Reminder Options
  reminderOptions: {
    marginTop: 16,
    marginBottom: 8,
  },

  reminderLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },

  reminderGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  reminderOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    minWidth: "30%",
    alignItems: "center",
  },

  reminderOptionText: {
    fontSize: 12,
    fontWeight: "600",
  },

  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },

  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 16,
    alignItems: "center",
  },

  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },

  saveButton: {
    flex: 2,
    borderRadius: BORDER_RADIUS.lg,
    overflow: "hidden",
  },

  saveButtonGradient: {
    paddingVertical: 16,
    alignItems: "center",
  },

  saveButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
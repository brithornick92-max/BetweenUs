// screens/CalendarScreen.js
/**
 * CalendarScreen — Shared Timeline & Planning
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 * Velvet Glass · Physics-based Modals · High-End Typography
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Switch,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Icon from '../components/Icon';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useAppContext } from '../context/AppContext';
import { calendarStorage, myDatesStorage } from '../utils/storage';
import { ensureNotificationPermissions, scheduleEventNotification, cancelNotification } from '../utils/notifications';
import { supabase, TABLES } from '../config/supabase';
import { SPACING, withAlpha } from '../utils/theme';
import ReAnimated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';

const { width: SCREEN_W } = Dimensions.get('window');
const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });
const SERIF_FONT  = Platform.select({ ios: 'Georgia', android: 'serif' });

// Event type visual config — Apple System Colors & Sexy Red
const EVENT_TYPES = {
  dateNight:   { label: 'Date Plans', icon: 'heart-outline',    color: '#D2121A' },
  ritual:      { label: 'Ritual',     icon: 'moon-outline',     color: '#AF52DE' },
  loveNote:    { label: 'Love Note',  icon: 'mail-outline',     color: '#D2121A' },
  anniversary: { label: 'Special',    icon: 'sparkles-outline', color: '#FF9F0A' },
  general:     { label: 'Event',      icon: 'calendar-outline', color: '#007AFF' },
};

const REMINDER_OPTIONS = [
  { label: '5m before',  mins: 5    },
  { label: '30m before', mins: 30   },
  { label: '1h before',  mins: 60   },
  { label: '1d before',  mins: 1440 },
];

const toDisplayDate = (d) => {
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  return (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();
};

// ─── PremiumCalendar ──────────────────────────────────────────────────────────

function PremiumCalendar({ selectedDate, onDateSelect, events, styles, colors, isDark }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let day = 1; day <= lastDay.getDate(); day++) days.push(new Date(year, month, day));
    while (days.length % 7 !== 0) days.push(null);
    return days;
  };

  const getEventsForDate = (date) => {
    if (!date) return [];
    const dateStr = toDisplayDate(date);
    return events.filter(event => toDisplayDate(new Date(event.whenTs)) === dateStr);
  };

  const isToday    = (date) => date && date.toDateString() === new Date().toDateString();
  const isSelected = (date) => date && selectedDate && date.toDateString() === selectedDate.toDateString();

  const navigateMonth = (direction) => {
    const next = new Date(currentMonth);
    next.setMonth(currentMonth.getMonth() + direction);
    setCurrentMonth(next);
    impact(ImpactFeedbackStyle.Light);
  };

  const days      = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long' });

  return (
    <ReAnimated.View
      entering={FadeInUp.duration(600)}
      style={[styles.calendarCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.calendarHeader}>
        <View>
          <Text style={[styles.monthTitle, { color: colors.text }]}>{monthName}</Text>
          <Text style={[styles.yearTitle,  { color: colors.subtext }]}>{currentMonth.getFullYear()}</Text>
        </View>
        <View style={styles.navButtons}>
          <TouchableOpacity
            onPress={() => navigateMonth(-1)}
            style={[styles.navButton, { backgroundColor: colors.surfaceSecondary }]}
            activeOpacity={0.7}
          >
            <Icon name="chevron-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigateMonth(1)}
            style={[styles.navButton, { backgroundColor: colors.surfaceSecondary }]}
            activeOpacity={0.7}
          >
            <Icon name="chevron-right" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.dayLabelsRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <Text key={i} style={[styles.dayLabel, { color: colors.subtext }]}>{day}</Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {Array.from({ length: Math.ceil(days.length / 7) }).map((_, weekIndex) => (
          <View key={weekIndex} style={styles.weekRow}>
            {days.slice(weekIndex * 7, (weekIndex + 1) * 7).map((date, dayIndex) => {
              if (!date) return <View key={dayIndex} style={styles.dayCellWrapper} />;
              const selected  = isSelected(date);
              const today     = isToday(date);
              const dayEvents = getEventsForDate(date);

              return (
                <View key={dayIndex} style={styles.dayCellWrapper}>
                  <TouchableOpacity
                    style={[styles.dayCell, selected && { backgroundColor: colors.primary }]}
                    onPress={() => { selection(); onDateSelect(date); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.dayText,
                      { color: selected ? '#FFF' : (today ? colors.primary : colors.text) },
                      selected && { fontWeight: '800' },
                    ]}>
                      {date.getDate()}
                    </Text>
                    {dayEvents.length > 0 && !selected && (
                      <View style={styles.eventDotsRow}>
                        {dayEvents.slice(0, 3).map((evt, ei) => (
                          <View
                            key={ei}
                            style={[styles.eventDot, { backgroundColor: EVENT_TYPES[evt.eventType]?.color || colors.primary }]}
                          />
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </ReAnimated.View>
  );
}

// ─── TimelineEvent ────────────────────────────────────────────────────────────

function TimelineEvent({ item, onLongPress, styles, colors }) {
  const dateObj   = new Date(item.whenTs);
  const time      = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const eventType = EVENT_TYPES[item.eventType] || (item.isDateNight ? EVENT_TYPES.dateNight : EVENT_TYPES.general);

  return (
    <TouchableOpacity
      style={[styles.timelineCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onLongPress={onLongPress}
      activeOpacity={0.9}
    >
      <View style={[styles.timelineCardColorBar, { backgroundColor: eventType.color }]} />
      <View style={styles.timelineCardContent}>
        <View style={styles.timelineCardHeader}>
          <Text style={[styles.eventTitleText, { color: colors.text }]}>{item.title}</Text>
          <Text style={[styles.eventTimeText,  { color: colors.subtext }]}>{time}</Text>
        </View>
        <View style={styles.eventTypeRow}>
          <Icon name={eventType.icon} size={12} color={eventType.color} />
          <Text style={[styles.eventTypeLabel, { color: eventType.color }]}>{eventType.label}</Text>
        </View>
        {item.location ? (
          <View style={styles.locationRow}>
            <Icon name="location-outline" size={12} color={colors.subtext} />
            <Text style={[styles.locationText, { color: colors.subtext }]}>{item.location}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── CalendarScreen ───────────────────────────────────────────────────────────

export default function CalendarScreen({ navigation, route }) {
  const { colors, isDark }                            = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const { state: appState }                           = useAppContext();
  const { coupleId, userId }                          = appState;

  const [events,       setEvents]       = useState([]);
  const [myDates,      setMyDates]      = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [refreshing,   setRefreshing]   = useState(false);
  const [modalOpen,    setModalOpen]    = useState(false);

  // Date/time picker state
  const [pickerDate, setPickerDate] = useState(new Date());
  const [pickerTime, setPickerTime] = useState(new Date());

  const [form, setForm] = useState({
    title:       '',
    location:    '',
    notes:       '',
    eventType:   'general',
    isDateNight: false,
    notify:      false,
    notifyMins:  60,
  });

  // ─── THEME MAP ───
  const t = useMemo(() => ({
    background:       colors.background,
    surface:          isDark ? '#131016' : '#FFFFFF',
    surfaceSecondary: isDark ? '#1C1520' : '#F2F2F7',
    primary:          colors.primary || '#D2121A',
    text:             colors.text,
    subtext:          isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60,60,67,0.6)',
    border:           isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  const loadEvents = async () => {
    const [localList, dates] = await Promise.all([
      calendarStorage.getEvents(),
      myDatesStorage.getMyDates(),
    ]);
    let safe = Array.isArray(localList) ? localList : [];

    if (supabase && coupleId) {
      try {
        const { data: remoteEvents, error } = await supabase
          .from(TABLES.CALENDAR_EVENTS)
          .select('*')
          .eq('couple_id', coupleId)
          .order('event_date', { ascending: true });

        if (!error && Array.isArray(remoteEvents)) {
          const mapped = remoteEvents.map(r => ({
            id: r.id,
            title: r.title,
            location: r.location || '',
            notes: r.description || '',
            eventType: r.event_type || 'general',
            isDateNight: r.event_type === 'dateNight' || r.event_type === 'date_night',
            whenTs: new Date(r.event_date).getTime(),
            createdBy: r.created_by,
            isRemote: true,
            metadata: r.metadata || {},
          }));
          const remoteIds = new Set(mapped.map(e => e.id));
          const localOnly = safe.filter(e => !remoteIds.has(e.id) && !e.supabaseId);
          safe = [...mapped, ...localOnly];
        }
      } catch (err) {}
    }

    setEvents(safe.sort((a, b) => (a.whenTs || 0) - (b.whenTs || 0)));
    setMyDates(Array.isArray(dates) ? dates : []);
  };

  useFocusEffect(
    useCallback(() => {
      loadEvents();
      const prefill = route?.params?.prefill;
      if (prefill) {
        let prefillDateObj = new Date();
        if (prefill.prefillDate) prefillDateObj = new Date(prefill.prefillDate);
        else if (prefill.dateStr) {
          const [mm, dd, yyyy] = prefill.dateStr.split('/').map(Number);
          prefillDateObj = new Date(yyyy || new Date().getFullYear(), (mm || 1) - 1, dd || 1);
        }

        let prefillTimeObj = new Date(prefillDateObj);
        if (!prefill.prefillDate && prefill.timeStr) {
          const timeMatch = String(prefill.timeStr).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
          if (timeMatch) {
            let hh = parseInt(timeMatch[1], 10);
            const mm = parseInt(timeMatch[2], 10);
            const ampm = (timeMatch[3] || '').toUpperCase();
            if (ampm === 'PM' && hh < 12) hh += 12;
            if (ampm === 'AM' && hh === 12) hh = 0;
            prefillTimeObj = new Date(prefillDateObj);
            prefillTimeObj.setHours(hh, mm, 0, 0);
          }
        }

        setPickerDate(prefillDateObj);
        setPickerTime(prefillTimeObj);
        setSelectedDate(prefillDateObj); 

        setForm(prev => ({
          ...prev,
          title: prefill.title || '',
          location: prefill.location || '',
          notes: prefill.notes || '',
          isDateNight: !!prefill.isDateNight,
          eventType: prefill.isDateNight ? 'dateNight' : 'general',
        }));
        setModalOpen(true);
        navigation.setParams({ prefill: null });
      }
    }, [route?.params?.prefill])
  );

  useEffect(() => {
    if (!supabase || !coupleId) return;
    const channel = supabase
      .channel(`calendar_${coupleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLES.CALENDAR_EVENTS, filter: `couple_id=eq.${coupleId}` },
        () => loadEvents()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [coupleId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return Alert.alert('Required', 'Please name your event.');

    try {
      const combined = new Date(pickerDate);
      combined.setHours(pickerTime.getHours(), pickerTime.getMinutes(), 0, 0);
      const whenTs = combined.getTime();

      let notificationId = null;

      if (form.notify) {
        try {
          const mins = form.notifyMins || 60;
          const triggerTs = whenTs - (mins * 60000);
          if (triggerTs > Date.now()) {
            const { ok } = await ensureNotificationPermissions();
            if (ok) {
              notificationId = await scheduleEventNotification({
                title: 'Between Us',
                body: `${form.title} is coming up`,
                when: triggerTs,
              });
            } else {
              Alert.alert('Notifications', 'Please enable notifications in Settings to receive reminders.');
            }
          }
        } catch (notifErr) {}
      }

      const eventData = { ...form, whenTs, notificationId, eventType: form.eventType };
      let supabaseId = null;

      if (supabase && coupleId && userId) {
        try {
          const { data: inserted, error } = await supabase
            .from(TABLES.CALENDAR_EVENTS)
            .insert({
              couple_id: coupleId,
              title: form.title.trim(),
              description: form.notes || null,
              event_date: new Date(whenTs).toISOString(),
              event_type: form.eventType || 'general',
              location: form.location || null,
              metadata: { isDateNight: form.isDateNight, notify: form.notify, notifyMins: form.notifyMins, notificationId },
              created_by: userId,
            })
            .select('id')
            .single();

          if (!error && inserted) supabaseId = inserted.id;
        } catch (syncErr) {}
      }

      const savedEvent = await calendarStorage.addEvent({
        ...eventData,
        ...(supabaseId ? { id: supabaseId, supabaseId } : {}),
      });

      if (form.isDateNight || form.eventType === 'dateNight') {
        await myDatesStorage.addMyDate({
          title: form.title,
          locationType: form.location ? 'out' : 'home',
          heat: 2,
          load: 2,
          style: 'mixed',
          steps: form.notes ? [form.notes] : ['Plan the vibe.', 'Enjoy the moment.'],
          sourceEventId: savedEvent?.id,
        });
      }

      notification(NotificationFeedbackType.Success);
      setModalOpen(false);
      const savedDate = new Date(combined);
      savedDate.setHours(0, 0, 0, 0);
      setSelectedDate(savedDate);
      await loadEvents();
      const now = new Date();
      setPickerDate(now);
      setPickerTime(now);
      setForm({ title: '', location: '', notes: '', eventType: 'general', isDateNight: false, notify: false, notifyMins: 60 });
    } catch (err) {
      Alert.alert('Error', 'Something went wrong saving your event. Please try again.');
    }
  };

  const selectedDateEvents = events.filter(e => toDisplayDate(new Date(e.whenTs)) === toDisplayDate(selectedDate));

  // ─── Paywall gate ──────────────────────────────────────────────
  if (!isPremium) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.background }]}>
        <View style={styles.paywallCenter}>
          <Icon name="calendar-outline" size={64} color={t.primary} style={{ marginBottom: 24 }} />
          <Text style={[styles.paywallTitle, { color: t.text }]}>The Shared Timeline</Text>
          <Text style={[styles.paywallDesc,  { color: t.subtext }]}>
            Plan date nights, protect anniversaries, and build a beautiful archive of your time together.
          </Text>
          <TouchableOpacity
            onPress={() => showPaywall?.('calendar')}
            style={[styles.paywallButton, { backgroundColor: t.primary }]}
            activeOpacity={0.85}
          >
            <Text style={styles.paywallButtonText}>UNLOCK PRO CALENDAR</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Main render ───────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Velvet background gradient */}
      <LinearGradient
        colors={isDark
          ? [t.background, '#120206', t.background]
          : [t.background, '#F9F6F4', t.background]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <GlowOrb color={withAlpha(t.primary, 0.12)} size={300} top={-50} left={-50} />
      <FilmGrain opacity={0.03} />

      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />
          }
        >
          {/* Header */}
          <View style={styles.mainPadding}>
            <Text style={[styles.editorialTitle, { color: t.text }]}>Timeline</Text>
            <Text style={[styles.subGreeting,    { color: t.subtext }]}>Your shared future, organized.</Text>
          </View>

          {/* Calendar widget */}
          <PremiumCalendar
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            events={events}
            styles={styles}
            colors={t}
            isDark={isDark}
          />

          {/* Timeline section */}
          <View style={styles.timelineSection}>
            <View style={styles.timelineHeaderRow}>
              <Text style={[styles.timelineDate, { color: t.text }]}>
                {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              </Text>
              <Text style={[styles.eventCountText, { color: t.primary }]}>
                {selectedDateEvents.length} {selectedDateEvents.length === 1 ? 'PLAN' : 'PLANS'}
              </Text>
            </View>

            {selectedDateEvents.length > 0 ? (
              <View style={styles.eventsList}>
                {selectedDateEvents.map((event, i) => (
                  <ReAnimated.View key={event.id} entering={FadeInDown.duration(300).delay(i * 50)}>
                    <TimelineEvent
                      item={event}
                      styles={styles}
                      colors={t}
                      onLongPress={() => {
                        Alert.alert('Remove Event', 'Are you sure you want to delete this?', [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: async () => {
                              if (event.notificationId) await cancelNotification(event.notificationId);
                              if (supabase && (event.isRemote || event.supabaseId)) {
                                try {
                                  await supabase
                                    .from(TABLES.CALENDAR_EVENTS)
                                    .delete()
                                    .eq('id', event.supabaseId || event.id);
                                } catch (err) {}
                              }
                              await calendarStorage.deleteEvent(event.id);
                              loadEvents();
                            },
                          },
                        ]);
                      }}
                    />
                  </ReAnimated.View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Icon name="calendar-outline" size={32} color={t.subtext} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyText, { color: t.subtext }]}>No shared plans for this day.</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* FAB */}
        <TouchableOpacity
          onPress={() => { setModalOpen(true); selection(); }}
          style={[styles.fab, { backgroundColor: t.primary }]}
          activeOpacity={0.9}
        >
          <Icon name="plus" size={32} color="#FFF" />
        </TouchableOpacity>

        {/* ── Create Event Modal ─────────────────────────────── */}
        <Modal visible={modalOpen} animationType="slide" transparent>
          <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalContent}
            >
              <View style={[styles.modalInner, { backgroundColor: t.surface, borderColor: t.border }]}>
                {/* Modal header */}
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: t.text }]}>New Event</Text>
                  <TouchableOpacity onPress={() => setModalOpen(false)} style={styles.closeButton}>
                    <Icon name="close" size={24} color={t.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalForm}>

                  {/* Title */}
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: t.primary }]}>TITLE</Text>
                    <TextInput
                      style={[styles.input, { color: t.text, backgroundColor: t.surfaceSecondary, borderColor: t.border }]}
                      placeholder="What are you planning?"
                      placeholderTextColor={t.subtext}
                      value={form.title}
                      onChangeText={v => setForm(p => ({ ...p, title: v }))}
                    />
                  </View>

                  {/* Date & Time pickers */}
                  <View style={styles.pickerRow}>
                    <View style={styles.pickerSection}>
                      <Text style={[styles.inputLabel, { color: t.primary }]}>DATE</Text>
                      <View style={[styles.pickerWrap, { backgroundColor: t.surfaceSecondary }]}>
                        <DateTimePicker
                          value={pickerDate}
                          mode="date"
                          display="compact"
                          onChange={(e, d) => d && setPickerDate(d)}
                          themeVariant={isDark ? 'dark' : 'light'}
                        />
                      </View>
                    </View>
                    <View style={styles.pickerSection}>
                      <Text style={[styles.inputLabel, { color: t.primary }]}>TIME</Text>
                      <View style={[styles.pickerWrap, { backgroundColor: t.surfaceSecondary }]}>
                        <DateTimePicker
                          value={pickerTime}
                          mode="time"
                          display="compact"
                          onChange={(e, time) => time && setPickerTime(time)}
                          themeVariant={isDark ? 'dark' : 'light'}
                        />
                      </View>
                    </View>
                  </View>

                  {/* Location */}
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: t.primary }]}>LOCATION</Text>
                    <TextInput
                      style={[styles.input, { color: t.text, backgroundColor: t.surfaceSecondary, borderColor: t.border }]}
                      placeholder="Add location (optional)"
                      placeholderTextColor={t.subtext}
                      value={form.location}
                      onChangeText={v => setForm(p => ({ ...p, location: v }))}
                    />
                  </View>

                  {/* Reminder / Alert */}
                  <View style={styles.reminderSection}>
                    <View style={styles.reminderToggleRow}>
                      <Text style={[styles.inputLabel, { color: t.primary }]}>ALERT</Text>
                      <Switch
                        value={form.notify}
                        onValueChange={v => setForm(p => ({ ...p, notify: v }))}
                        trackColor={{ false: t.border, true: t.primary }}
                      />
                    </View>
                    {form.notify && (
                      <View style={styles.reminderOptions}>
                        {REMINDER_OPTIONS.map(opt => {
                          const isActive = form.notifyMins === opt.mins;
                          return (
                            <TouchableOpacity
                              key={opt.mins}
                              style={[
                                styles.reminderChip,
                                { borderColor: t.border },
                                isActive && { backgroundColor: t.primary, borderColor: t.primary },
                              ]}
                              onPress={() => setForm(p => ({ ...p, notifyMins: opt.mins }))}
                            >
                              <Text style={[styles.reminderChipText, { color: isActive ? '#FFF' : t.text }]}>
                                {opt.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  {/* Save */}
                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: t.primary }]}
                    onPress={handleSave}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryBtnText}>SAVE TO TIMELINE</Text>
                  </TouchableOpacity>

                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </BlurView>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const createStyles = (t, isDark) => StyleSheet.create({
  container:     { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { flexGrow: 1, paddingBottom: 160 },
  mainPadding:   { paddingHorizontal: 32, paddingTop: 20, paddingBottom: SPACING.md },

  editorialTitle: {
    fontFamily:    SYSTEM_FONT,
    fontSize:      36,
    fontWeight:    '900',
    letterSpacing: -1,
    lineHeight:    42,
  },
  subGreeting: {
    fontFamily: SYSTEM_FONT,
    fontSize:   16,
    fontWeight: '500',
    marginTop:  4,
  },

  // ── Calendar ──────────────────────────────────────────────────
  calendarCard: {
    marginHorizontal: 24,
    borderRadius:     32,
    padding:          24,
    borderWidth:      1,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 16 },
      android: { elevation: 4 },
    }),
  },
  calendarHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   24,
  },
  monthTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  yearTitle:  { fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 },
  navButtons: { flexDirection: 'row', gap: 10 },
  navButton:  { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  dayLabelsRow:   { flexDirection: 'row', marginBottom: 16 },
  dayLabel:       { fontSize: 11, fontWeight: '800', width: '14.28%', textAlign: 'center', opacity: 0.6 },
  calendarGrid:   { gap: 12 },
  weekRow:        { flexDirection: 'row' },
  dayCellWrapper: { width: '14.28%', alignItems: 'center', justifyContent: 'center' },
  dayCell:        { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dayText:        { fontSize: 15, fontWeight: '600', textAlign: 'center', fontVariant: ['tabular-nums'] },
  eventDotsRow:   { position: 'absolute', bottom: 4, flexDirection: 'row', gap: 2, alignItems: 'center' },
  eventDot:       { width: 4, height: 4, borderRadius: 2 },

  // ── Timeline ──────────────────────────────────────────────────
  timelineSection: { marginTop: 40, paddingHorizontal: 32 },
  timelineHeaderRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   24,
  },
  timelineDate:   { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  eventCountText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  eventsList:     { gap: SPACING.md },

  timelineCard: {
    flexDirection: 'row',
    borderRadius:  24,
    borderWidth:   1,
    overflow:      'hidden',
    marginBottom:  4,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  timelineCardColorBar: { width: 5 },
  timelineCardContent:  { flex: 1, padding: 20, gap: 6 },
  timelineCardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eventTitleText: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2, flex: 1, marginRight: 8 },
  eventTimeText:  { fontSize: 13, fontWeight: '700' },
  eventTypeRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  eventTypeLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  locationRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  locationText:   { fontSize: 13, fontWeight: '500' },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText:      { fontSize: 15, fontWeight: '600', fontStyle: 'italic' },

  // ── FAB ───────────────────────────────────────────────────────
  fab: {
    position:       'absolute',
    bottom:         110,
    right:          SPACING.xl,
    width:          64,
    height:         64,
    borderRadius:   32,
    alignItems:     'center',
    justifyContent: 'center',
    shadowColor:    '#D2121A',
    shadowOffset:   { width: 0, height: 8 },
    shadowOpacity:  0.3,
    shadowRadius:   12,
    ...Platform.select({ android: { elevation: 8 } }),
  },

  // ── Modal ─────────────────────────────────────────────────────
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { height: '88%' },
  modalInner: {
    flex:                 1,
    borderTopLeftRadius:  40,
    borderTopRightRadius: 40,
    borderTopWidth:       1,
    padding:              32,
  },
  modalHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   32,
  },
  modalTitle:  { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  modalForm:   { gap: 24, paddingBottom: 40 },

  inputGroup: { gap: 10 },
  inputLabel: { fontFamily: SYSTEM_FONT, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  input: {
    height:            56,
    borderRadius:      16,
    borderWidth:       1,
    paddingHorizontal: 16,
    fontSize:          16,
    fontWeight:        '600',
  },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 16,
    height:            40,
    borderRadius:      20,
    borderWidth:       1,
    justifyContent:    'center',
  },
  typeChipText: { fontSize: 13, fontWeight: '700' },

  pickerRow:     { flexDirection: 'row', gap: 20 },
  pickerSection: { flex: 1, gap: 10 },
  pickerWrap:    { borderRadius: 16, padding: 8, alignItems: 'flex-start' },

  reminderSection:   { gap: 12 },
  reminderToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reminderOptions:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reminderChip:      { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  reminderChipText:  { fontSize: 13, fontWeight: '700' },

  primaryBtn:     { height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 1 },

  // ── Paywall ───────────────────────────────────────────────────
  paywallCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  paywallTitle:  { fontFamily: SYSTEM_FONT, fontSize: 32, fontWeight: '900', textAlign: 'center', letterSpacing: -1, marginBottom: 12 },
  paywallDesc:   { fontFamily: SYSTEM_FONT, fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  paywallButton: { height: 56, paddingHorizontal: 32, borderRadius: 28, justifyContent: 'center', alignItems: 'center', width: '100%' },
  paywallButtonText: { color: '#FFF', fontFamily: SYSTEM_FONT, fontSize: 14, fontWeight: '900', letterSpacing: 1 },
});

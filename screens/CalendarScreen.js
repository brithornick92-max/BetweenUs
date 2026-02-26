import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
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
  Animated,
  RefreshControl,
  Platform,
  KeyboardAvoidingView,
  Switch,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useAppContext } from '../context/AppContext';
import { calendarStorage, myDatesStorage } from '../utils/storage';
import { ensureNotificationPermissions, scheduleEventNotification, cancelNotification } from '../utils/notifications';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../utils/theme';
import { supabase, TABLES } from '../config/supabase';

// Event type visual config — color-coded topics
const EVENT_TYPES = {
  dateNight: { label: 'Date Plans', icon: 'heart', color: '#9A2E5E' },
  ritual: { label: 'Ritual', icon: 'star-four-points-outline', color: '#C9A84C' },
  loveNote: { label: 'Love Note', icon: 'email-heart-outline', color: '#D4839A' },
  anniversary: { label: 'Anniversary', icon: 'party-popper', color: '#E8726A' },
  general: { label: 'General', icon: 'calendar-outline', color: '#7A6B73' },
};

const REMINDER_OPTIONS = [
  { label: '5 min before', mins: 5 },
  { label: '15 min before', mins: 15 },
  { label: '30 min before', mins: 30 },
  { label: '1 hour before', mins: 60 },
  { label: '1 day before', mins: 1440 },
];

const toDisplayDate = (d) => {
  // Always use a proper Date object and local date components to avoid timezone shifts
  const date = d instanceof Date ? d : new Date(typeof d === 'number' ? d : d);
  if (isNaN(date.getTime())) return '';
  return (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();
};

const toTimeString = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

const combineDateTime = (dateStr, timeStr) => {
  const [mm, dd, yyyy] = String(dateStr || '').split('/').map(Number);
  const time = String(timeStr || '').trim();
  const isPM = /pm/i.test(time);
  const isAM = /am/i.test(time);
  const cleanTime = time.replace(/\s*(am|pm)/i, '');
  const [rawHH, rawMin] = cleanTime.split(':').map(Number);
  let hh = rawHH || 0;
  if (isPM && hh < 12) hh += 12;
  if (isAM && hh === 12) hh = 0;
  return new Date(yyyy || new Date().getFullYear(), (mm || 1) - 1, dd || 1, hh, rawMin || 0).getTime();
};

function CountdownBanner({ nextEvent, styles, colors }) {
  if (!nextEvent) return null;
  
  const diff = Math.ceil((nextEvent.whenTs - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0 || diff > 14) return null; // Only show for next 2 weeks

  return (
    <View style={[styles.countdownBanner, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
      <View>
        <Text style={[styles.countdownLabel, { color: colors.primary }]}>UPCOMING</Text>
        <Text style={[styles.countdownTitle, { color: colors.text }]}>{nextEvent.title}</Text>
      </View>
      <View style={styles.daysBadge}>
        <Text style={[styles.daysNumber, { color: colors.primary }]}>{diff === 0 ? 'Today' : diff}</Text>
        {diff > 0 && <Text style={[styles.daysLabel, { color: colors.primary }]}>days</Text>}
      </View>
    </View>
  );
}

function PremiumCalendar({ selectedDate, onDateSelect, events, styles }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { colors } = useTheme();

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
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
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  };

  const getEventsForDate = (date) => {
    if (!date) return [];
    const dateStr = toDisplayDate(date);
    return events.filter(event => toDisplayDate(new Date(event.whenTs)) === dateStr);
  };

  const getEventTypeColor = (event) => {
    if (event.eventType && EVENT_TYPES[event.eventType]) return EVENT_TYPES[event.eventType].color;
    if (event.isDateNight) return EVENT_TYPES.dateNight.color;
    return EVENT_TYPES.general.color;
  };

  const isToday = (date) => date && date.toDateString() === new Date().toDateString();
  const isSelected = (date) => date && selectedDate && date.toDateString() === selectedDate.toDateString();

  const navigateMonth = (direction) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() + direction);
    setCurrentMonth(newMonth);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long' });
  const yearName = currentMonth.getFullYear();

  return (
    <Animated.View style={[styles.calendarContainer, { opacity: fadeAnim }]}>
      <View style={styles.calendarHeader}>
        <View>
          <Text style={[styles.monthTitle, { color: colors.text }]}>{monthName}</Text>
          <Text style={[styles.yearTitle, { color: colors.textMuted }]}>{yearName}</Text>
        </View>
        <View style={styles.navButtons}>
          <TouchableOpacity onPress={() => navigateMonth(-1)} style={styles.navButton}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateMonth(1)} style={styles.navButton}>
            <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.dayLabelsRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <Text key={i} style={[styles.dayLabel, { color: colors.textMuted }]}>{day}</Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {Array.from({ length: Math.ceil(days.length / 7) }).map((_, weekIndex) => (
          <View key={weekIndex} style={styles.weekRow}>
            {days.slice(weekIndex * 7, (weekIndex + 1) * 7).map((date, dayIndex) => {
              if (!date) return <View key={dayIndex} style={styles.dayCell} />;
              
              const selected = isSelected(date);
              const today = isToday(date);
              const dayEvents = getEventsForDate(date);
              const hasEvents = dayEvents.length > 0;

              return (
                <TouchableOpacity
                  key={dayIndex}
                  style={styles.dayCell}
                  onPress={() => {
                    Haptics.selectionAsync();
                    onDateSelect(date);
                  }}
                  activeOpacity={0.7}
                >
                  {selected && (
                    <View style={[styles.signatureGlow, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]} />
                  )}
                  <Text style={[
                    styles.dayText, 
                    { color: selected ? colors.text : (today ? colors.primary : colors.text) },
                    selected && { fontWeight: '600' }
                  ]}>
                    {date.getDate()}
                  </Text>
                  {hasEvents && !selected && (
                    <View style={styles.eventDotsRow}>
                      {dayEvents.slice(0, 3).map((evt, ei) => (
                        <View key={ei} style={[styles.eventDot, { backgroundColor: getEventTypeColor(evt) }]} />
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

function TimelineEvent({ item, index, onLongPress, styles }) {
  const { colors } = useTheme();
  const dateObj = new Date(item.whenTs);
  const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const eventType = item.eventType && EVENT_TYPES[item.eventType] 
    ? EVENT_TYPES[item.eventType] 
    : (item.isDateNight ? EVENT_TYPES.dateNight : EVENT_TYPES.general);

  return (
    <TouchableOpacity 
      style={styles.timelineItem} 
      onLongPress={onLongPress}
      activeOpacity={0.8}
    >
      <View style={styles.whisperLineContainer}>
        <View style={[styles.whisperLine, { backgroundColor: colors.border }]} />
        <View style={[styles.whisperDot, { backgroundColor: eventType.color }]} />
      </View>

      <View style={styles.eventCardStationery}>
        <View style={styles.eventTypeRow}>
          <MaterialCommunityIcons name={eventType.icon} size={12} color={eventType.color} />
          <Text style={[styles.eventTypeLabel, { color: eventType.color }]}>{eventType.label}</Text>
        </View>
        <Text style={[styles.eventTimeText, { color: colors.textMuted }]}>{time}</Text>
        <Text style={[styles.eventTitleText, { color: colors.text }]}>{item.title}</Text>
        {item.location && (
          <View style={styles.locationRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={12} color={colors.textMuted} />
            <Text style={[styles.locationText, { color: colors.textMuted }]}>{item.location}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function CalendarScreen({ navigation, route }) {
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const { state: appState } = useAppContext();
  const coupleId = appState.coupleId;
  const userId = appState.userId;
  const [events, setEvents] = useState([]);
  const [myDates, setMyDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const styles = useMemo(() => createStyles(colors), [colors]);

  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Date/time picker state
  const [pickerDate, setPickerDate] = useState(new Date());
  const [pickerTime, setPickerTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios');
  const [showTimePicker, setShowTimePicker] = useState(Platform.OS === 'ios');

  const [form, setForm] = useState({
    title: '',
    location: '',
    notes: '',
    eventType: 'general',
    isDateNight: false,
    notify: false,
    notifyMins: 60,
  });

  const loadEvents = async () => {
    const [localList, dates] = await Promise.all([
      calendarStorage.getEvents(),
      myDatesStorage.getMyDates(),
    ]);
    let safe = Array.isArray(localList) ? localList : [];

    // ── Merge with Supabase calendar_events (shared with partner) ──
    if (supabase && coupleId) {
      try {
        const { data: remoteEvents, error } = await supabase
          .from(TABLES.CALENDAR_EVENTS)
          .select('*')
          .eq('couple_id', coupleId)
          .order('event_date', { ascending: true });

        if (!error && Array.isArray(remoteEvents)) {
          // Convert Supabase rows → local event shape
          const mapped = remoteEvents.map(r => ({
            id: r.id,
            title: r.title,
            location: r.location || '',
            notes: r.description || '',
            eventType: r.event_type || 'general',
            isDateNight: r.event_type === 'dateNight' || r.event_type === 'date_night',
            whenTs: new Date(r.event_date).getTime(),
            createdBy: r.created_by,
            isRemote: true, // flag so we know it came from Supabase
            metadata: r.metadata || {},
          }));
          // Merge: remote events take precedence for same id
          const remoteIds = new Set(mapped.map(e => e.id));
          const localOnly = safe.filter(e => !remoteIds.has(e.id) && !e.supabaseId);
          safe = [...mapped, ...localOnly];
        }
      } catch (err) {
        console.warn('[Calendar] Failed to fetch remote events:', err.message);
        // Fall back to local-only — offline-safe
      }
    }

    setEvents(safe.sort((a, b) => (a.whenTs || 0) - (b.whenTs || 0)));
    setMyDates(Array.isArray(dates) ? dates : []);
  };

  useFocusEffect(
    useCallback(() => {
      loadEvents();
      const prefill = route?.params?.prefill;
      if (prefill) {
        // ── Prefill date & time pickers from a timestamp or string ──
        let prefillDateObj = new Date();

        if (prefill.prefillDate) {
          // Preferred: numeric timestamp
          prefillDateObj = new Date(prefill.prefillDate);
        } else if (prefill.dateStr) {
          // Legacy: "MM/DD/YYYY" string
          const [mm, dd, yyyy] = prefill.dateStr.split('/').map(Number);
          prefillDateObj = new Date(yyyy || new Date().getFullYear(), (mm || 1) - 1, dd || 1);
        }

        // Parse time from the same timestamp, or from a timeStr fallback
        let prefillTimeObj = new Date(prefillDateObj);
        if (!prefill.prefillDate && prefill.timeStr) {
          // Try to parse "7:30 PM" style strings
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
        setSelectedDate(prefillDateObj);  // highlight the day on the calendar

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

  // ── Realtime: auto-refresh when partner adds/removes calendar events ──
  useEffect(() => {
    if (!supabase || !coupleId) return;

    const channel = supabase
      .channel(`calendar_${coupleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLES.CALENDAR_EVENTS,
          filter: `couple_id=eq.${coupleId}`,
        },
        () => {
          // Partner created/updated/deleted an event — reload
          loadEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [coupleId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return Alert.alert('Required', 'Please name your event.');

    try {
      // Combine picker date and time into a single timestamp
      const combined = new Date(pickerDate);
      combined.setHours(pickerTime.getHours(), pickerTime.getMinutes(), 0, 0);
      const whenTs = combined.getTime();

      let notificationId = null;

      // Schedule notification separately — don't let failures block the save
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
        } catch (notifErr) {
          console.warn('Notification scheduling failed:', notifErr);
        }
      }

      const eventData = { ...form, whenTs, notificationId, eventType: form.eventType };

      // ── Sync to Supabase so partner sees it ──
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
              metadata: {
                isDateNight: form.isDateNight,
                notify: form.notify,
                notifyMins: form.notifyMins,
                notificationId,
              },
              created_by: userId,
            })
            .select('id')
            .single();

          if (!error && inserted) {
            supabaseId = inserted.id;
          } else if (error) {
            console.warn('[Calendar] Supabase insert failed:', error.message);
          }
        } catch (syncErr) {
          console.warn('[Calendar] Supabase sync error:', syncErr.message);
          // Continue — event still saves locally
        }
      }

      // Save locally (with Supabase id reference for dedup)
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

      setModalOpen(false);
      // Navigate the calendar to the date of the newly saved event
      const savedDate = new Date(combined);
      savedDate.setHours(0, 0, 0, 0);
      setSelectedDate(savedDate);
      await loadEvents();
      const now = new Date();
      setPickerDate(now);
      setPickerTime(now);
      setForm({
        title: '',
        location: '',
        notes: '',
        eventType: 'general',
        isDateNight: false,
        notify: false,
        notifyMins: 60,
      });
    } catch (err) {
      console.error('Calendar save error:', err);
      Alert.alert('Error', 'Something went wrong saving your event. Please try again.');
    }
  };

  const selectedDateEvents = events.filter(e => toDisplayDate(new Date(e.whenTs)) === toDisplayDate(selectedDate));

  // Free users: calendar is locked
  if (!isPremium) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.mainPadding}>
          <View style={styles.topHeader}>
            <Text style={[styles.editorialTitle, { color: colors.text }]}>Your Shared Time</Text>
          </View>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
          <MaterialCommunityIcons name="calendar-lock-outline" size={64} color={colors.primary} style={{ marginBottom: 16 }} />
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '600', marginBottom: 8, textAlign: 'center' }}>
            Calendar is Premium
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
            Plan date nights, track anniversaries, set reminders, and build a shared timeline of your relationship.
          </Text>
          <TouchableOpacity
            onPress={() => showPaywall?.('calendar')}
            style={{ backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 }}
            activeOpacity={0.85}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Upgrade to Premium</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.mainPadding}>
          <View style={styles.topHeader}>
            <Text style={[styles.editorialTitle, { color: colors.text }]}>Your Shared Time</Text>
          </View>

          <PremiumCalendar selectedDate={selectedDate} onDateSelect={setSelectedDate} events={events} styles={styles} />

          {/* Color-coded topic legend */}
          <View style={styles.legendContainer}>
            {Object.entries(EVENT_TYPES).map(([key, config]) => (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: config.color }]} />
                <Text style={[styles.legendLabel, { color: colors.textMuted }]}>{config.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.timelineSection}>
            <Text style={[styles.timelineDate, { color: colors.textMuted }]}>
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()}
            </Text>

            {selectedDateEvents.length > 0 ? (
              selectedDateEvents.map((event, i) => (
                <TimelineEvent 
                  key={event.id} 
                  item={event} 
                  index={i} 
                  styles={styles}
                  onLongPress={() => {
                    Alert.alert('Remove Event', 'Are you sure you want to delete this?', [
                      { text: 'Keep' },
                      { text: 'Delete', style: 'destructive', onPress: async () => {
                        if (event.notificationId) {
                          await cancelNotification(event.notificationId);
                        }
                        // Delete from Supabase if it came from there
                        if (supabase && (event.isRemote || event.supabaseId)) {
                          try {
                            const remoteId = event.supabaseId || event.id;
                            await supabase
                              .from(TABLES.CALENDAR_EVENTS)
                              .delete()
                              .eq('id', remoteId);
                          } catch (err) {
                            console.warn('[Calendar] Supabase delete failed:', err.message);
                          }
                        }
                        await calendarStorage.deleteEvent(event.id);
                        loadEvents();
                      }}
                    ]);
                  }}
                />
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <View style={styles.whisperLineContainer}>
                  <View style={[styles.whisperLine, { backgroundColor: colors.border, height: 40 }]} />
                </View>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No plans recorded yet.</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <TouchableOpacity onPress={() => setModalOpen(true)} style={[styles.fab, { backgroundColor: colors.primary }]} activeOpacity={0.85}>
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modalOpen} animationType="fade" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>New Entry</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalForm} showsVerticalScrollIndicator={false}>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Event Title"
                placeholderTextColor={colors.textMuted}
                value={form.title}
                onChangeText={v => setForm(p => ({ ...p, title: v }))}
              />

              {/* Date Picker */}
              <View style={styles.pickerSection}>
                <Text style={[styles.pickerLabel, { color: colors.textMuted }]}>Date</Text>
                {Platform.OS === 'android' && (
                  <TouchableOpacity
                    style={[styles.pickerTrigger, { borderColor: colors.border }]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <MaterialCommunityIcons name="calendar" size={18} color={colors.primary} />
                    <Text style={[styles.pickerTriggerText, { color: colors.text }]}>
                      {pickerDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                )}
                {showDatePicker && (
                  <DateTimePicker
                    value={pickerDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'spinner'}
                    onChange={(event, date) => {
                      if (Platform.OS === 'android') setShowDatePicker(false);
                      if (date) setPickerDate(date);
                    }}
                    themeVariant={isDark ? 'dark' : 'light'}
                    style={styles.picker}
                  />
                )}
              </View>

              {/* Time Picker */}
              <View style={styles.pickerSection}>
                <Text style={[styles.pickerLabel, { color: colors.textMuted }]}>Time</Text>
                {Platform.OS === 'android' && (
                  <TouchableOpacity
                    style={[styles.pickerTrigger, { borderColor: colors.border }]}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <MaterialCommunityIcons name="clock-outline" size={18} color={colors.primary} />
                    <Text style={[styles.pickerTriggerText, { color: colors.text }]}>
                      {pickerTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </Text>
                  </TouchableOpacity>
                )}
                {showTimePicker && (
                  <DateTimePicker
                    value={pickerTime}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'spinner'}
                    onChange={(event, time) => {
                      if (Platform.OS === 'android') setShowTimePicker(false);
                      if (time) setPickerTime(time);
                    }}
                    themeVariant={isDark ? 'dark' : 'light'}
                    style={styles.picker}
                  />
                )}
              </View>

              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Location"
                placeholderTextColor={colors.textMuted}
                value={form.location}
                onChangeText={v => setForm(p => ({ ...p, location: v }))}
              />
              
              {/* Event type (color-coded topics) */}
              <View style={styles.eventTypeSelector}>
                <Text style={[styles.eventTypeSelectorLabel, { color: colors.textMuted }]}>Topic</Text>
                <View style={styles.eventTypeChips}>
                  {Object.entries(EVENT_TYPES).map(([key, config]) => (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.eventTypeChip,
                        { borderColor: form.eventType === key ? config.color : colors.border },
                        form.eventType === key && { backgroundColor: config.color + '20' },
                      ]}
                      onPress={() => setForm(p => ({ ...p, eventType: key, isDateNight: key === 'dateNight' }))}
                    >
                      <MaterialCommunityIcons name={config.icon} size={14} color={form.eventType === key ? config.color : colors.textMuted} />
                      <Text style={[styles.eventTypeChipText, { color: form.eventType === key ? config.color : colors.textMuted }]}>
                        {config.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Reminder / Notification */}
              <View style={styles.reminderSection}>
                <View style={styles.reminderToggleRow}>
                  <View style={styles.reminderToggleLabel}>
                    <MaterialCommunityIcons name="bell-outline" size={18} color={form.notify ? colors.primary : colors.textMuted} />
                    <Text style={[styles.reminderText, { color: colors.text }]}>Reminder</Text>
                  </View>
                  <Switch
                    value={form.notify}
                    onValueChange={v => setForm(p => ({ ...p, notify: v }))}
                    trackColor={{ false: colors.border, true: colors.primary + '60' }}
                    thumbColor={form.notify ? colors.primary : colors.textMuted}
                  />
                </View>
                {form.notify && (
                  <View style={styles.reminderOptions}>
                    {REMINDER_OPTIONS.map(opt => (
                      <TouchableOpacity
                        key={opt.mins}
                        style={[
                          styles.reminderChip,
                          { borderColor: form.notifyMins === opt.mins ? colors.primary : colors.border },
                          form.notifyMins === opt.mins && { backgroundColor: colors.primary + '15' },
                        ]}
                        onPress={() => setForm(p => ({ ...p, notifyMins: opt.mins }))}
                      >
                        <Text style={[
                          styles.reminderChipText,
                          { color: form.notifyMins === opt.mins ? colors.primary : colors.textMuted },
                        ]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
                <Text style={styles.primaryBtnText}>Save</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  mainPadding: { paddingHorizontal: SPACING.screen, paddingTop: 20 },
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  editorialTitle: { fontFamily: TYPOGRAPHY.h1.fontFamily, fontSize: 34, fontWeight: '400', letterSpacing: -0.3 },
  fab: { position: 'absolute', bottom: 100, alignSelf: 'center', left: '50%', marginLeft: -28, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', ...Platform.select({ ios: { shadowColor: '#C4567A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12 }, android: { elevation: 8 } }) },
  calendarContainer: { marginBottom: 40 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 },
  monthTitle: { fontFamily: TYPOGRAPHY.h1.fontFamily, fontSize: 26, fontWeight: '400' },
  yearTitle: { fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', marginTop: 4 },
  navButtons: { flexDirection: 'row', gap: 8 },
  navButton: { padding: 8 },
  dayLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: 10 },
  dayLabel: { fontSize: 10, fontWeight: '600', width: 30, textAlign: 'center', letterSpacing: 0.5 },
  calendarGrid: { gap: 12 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCell: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  dayText: { fontSize: 14, fontFamily: TYPOGRAPHY.body.fontFamily },
  signatureGlow: { position: 'absolute', width: 32, height: 32, borderRadius: 16, borderWidth: 1 },
  eventDot: { width: 3, height: 3, borderRadius: 1.5, marginHorizontal: 1 },
  eventDotsRow: { position: 'absolute', bottom: 2, flexDirection: 'row', gap: 2, alignItems: 'center' },
  timelineSection: { marginTop: 24, paddingBottom: 100 },
  timelineDate: { fontSize: 10, letterSpacing: 2, fontWeight: '600', marginBottom: 24 },
  timelineItem: { flexDirection: 'row', marginBottom: 0, minHeight: 80 },
  whisperLineContainer: { width: 20, alignItems: 'center' },
  whisperLine: { width: 1, flex: 1, opacity: 0.3 },
  whisperDot: { width: 6, height: 6, borderRadius: 3, position: 'absolute', top: 6 },
  eventCardStationery: { flex: 1, paddingLeft: 20, paddingBottom: 30 },
  eventTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  eventTypeLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' },
  eventTimeText: { fontSize: 12, fontFamily: TYPOGRAPHY.body.fontFamily, marginBottom: 4 },
  eventTitleText: { fontSize: 18, fontFamily: TYPOGRAPHY.h1.fontFamily, fontWeight: '400', marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 12 },
  emptyContainer: { flexDirection: 'row', height: 60 },
  emptyText: { paddingLeft: 20, fontSize: 14, fontStyle: 'italic', marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: BORDER_RADIUS.xxl, borderTopRightRadius: BORDER_RADIUS.xxl, padding: 32, maxHeight: '80%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderGlass || colors.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  modalTitle: { fontSize: 24, fontFamily: TYPOGRAPHY.h1.fontFamily, fontWeight: '400' },
  modalForm: { gap: 20 },
  input: { borderBottomWidth: 1, paddingVertical: 12, fontSize: 16, fontFamily: TYPOGRAPHY.body.fontFamily },
  row: { flexDirection: 'row', gap: 16 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  primaryBtn: { backgroundColor: colors.primary, paddingVertical: 18, borderRadius: BORDER_RADIUS.full, alignItems: 'center', marginTop: 20, ...Platform.select({ ios: { shadowColor: '#C4567A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 }, android: { elevation: 6 } }) },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' },
  eventTypeSelector: { marginVertical: 8 },
  eventTypeSelectorLabel: { fontSize: 13, fontWeight: '600', marginBottom: 10, fontFamily: TYPOGRAPHY.body.fontFamily },
  eventTypeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  eventTypeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  eventTypeChipText: { fontSize: 12, fontWeight: '500' },
  // Legend
  legendContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28, paddingHorizontal: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, fontWeight: '500', letterSpacing: 0.3 },
  // Picker
  pickerSection: { marginBottom: 4 },
  pickerLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8, fontFamily: TYPOGRAPHY.body.fontFamily },
  pickerTrigger: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1 },
  pickerTriggerText: { fontSize: 16, fontFamily: TYPOGRAPHY.body.fontFamily },
  picker: { height: 120 },
  // Reminder
  reminderSection: { marginVertical: 4 },
  reminderToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reminderToggleLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reminderText: { fontSize: 16, fontFamily: TYPOGRAPHY.body.fontFamily },
  reminderOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  reminderChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  reminderChipText: { fontSize: 12, fontWeight: '500' },

  // Countdown Banner
  countdownBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    marginVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: colors.primaryGlow || 'rgba(154, 46, 94, 0.3)',
    backgroundColor: colors.primary + '0A',
  },
  countdownLabel: {
    fontFamily: Platform.select({ ios: 'Inter-SemiBold', default: 'sans-serif' }),
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 4,
    fontWeight: '700',
  },
  countdownTitle: {
    fontFamily: TYPOGRAPHY.h1.fontFamily,
    fontSize: 20,
    fontWeight: '400',
  },
  daysBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
  },
  daysNumber: {
    fontSize: 24,
    fontWeight: '700',
  },
  daysLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  
  // Memories
  addMemoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    borderTopWidth: 1,
    paddingTop: 8,
    alignSelf: 'flex-start',
  },
  addMemoryText: {
    fontSize: 12,
  },
});

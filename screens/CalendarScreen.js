// screens/CalendarScreen.js
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
  KeyboardAvoidingView,
  Switch,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useAppContext } from '../context/AppContext';
import { calendarStorage, myDatesStorage } from '../utils/storage';
import { ensureNotificationPermissions, scheduleEventNotification, cancelNotification } from '../utils/notifications';
import { supabase, TABLES } from '../config/supabase';
import { SPACING, BORDER_RADIUS, withAlpha } from '../utils/theme';
import ReAnimated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';

const { width: SCREEN_W } = Dimensions.get('window');

// Event type visual config — Apple System Colors
const EVENT_TYPES = {
  dateNight: { label: 'Date Plans', icon: 'heart', color: '#FF2D55' }, // Apple Red/Pink
  ritual: { label: 'Ritual', icon: 'star-four-points-outline', color: '#5856D6' }, // Apple Purple
  loveNote: { label: 'Love Note', icon: 'email-heart-outline', color: '#FF2D55' },
  anniversary: { label: 'Anniversary', icon: 'party-popper', color: '#FF9500' }, // Apple Orange
  general: { label: 'General', icon: 'calendar-outline', color: '#007AFF' }, // Apple Blue
};

const REMINDER_OPTIONS = [
  { label: '5 min before', mins: 5 },
  { label: '15 min before', mins: 15 },
  { label: '30 min before', mins: 30 },
  { label: '1 hour before', mins: 60 },
  { label: '1 day before', mins: 1440 },
];

const toDisplayDate = (d) => {
  const date = d instanceof Date ? d : new Date(typeof d === 'number' ? d : d);
  if (isNaN(date.getTime())) return '';
  return (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();
};

const toTimeString = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

function PremiumCalendar({ selectedDate, onDateSelect, events, styles, colors }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
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
    while (days.length % 7 !== 0) {
      days.push(null);
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
    impact(ImpactFeedbackStyle.Light);
  };

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long' });
  const yearName = currentMonth.getFullYear();

  return (
    <Animated.View style={[styles.calendarCard, { opacity: fadeAnim }]}>
      <View style={styles.calendarHeader}>
        <View>
          <Text style={styles.monthTitle}>{monthName}</Text>
          <Text style={styles.yearTitle}>{yearName}</Text>
        </View>
        <View style={styles.navButtons}>
          <TouchableOpacity onPress={() => navigateMonth(-1)} style={styles.navButton} activeOpacity={0.7}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateMonth(1)} style={styles.navButton} activeOpacity={0.7}>
            <MaterialCommunityIcons name="chevron-right" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.dayLabelsRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <Text key={i} style={styles.dayLabel}>{day}</Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {Array.from({ length: Math.ceil(days.length / 7) }).map((_, weekIndex) => (
          <View key={weekIndex} style={styles.weekRow}>
            {days.slice(weekIndex * 7, (weekIndex + 1) * 7).map((date, dayIndex) => {
              if (!date) return <View key={dayIndex} style={styles.dayCellWrapper} />;
              
              const selected = isSelected(date);
              const today = isToday(date);
              const dayEvents = getEventsForDate(date);
              const hasEvents = dayEvents.length > 0;

              return (
                <View key={dayIndex} style={styles.dayCellWrapper}>
                  <TouchableOpacity
                    style={[
                      styles.dayCell,
                      selected && { backgroundColor: colors.text } // High contrast selection
                    ]}
                    onPress={() => {
                      selection();
                      onDateSelect(date);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.dayText, 
                      { color: selected ? colors.background : (today ? colors.primary : colors.text) },
                      selected && { fontWeight: '700' }
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
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

function TimelineEvent({ item, onLongPress, styles, isDark }) {
  const dateObj = new Date(item.whenTs);
  const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const eventType = item.eventType && EVENT_TYPES[item.eventType] 
    ? EVENT_TYPES[item.eventType] 
    : (item.isDateNight ? EVENT_TYPES.dateNight : EVENT_TYPES.general);

  return (
    <TouchableOpacity 
      style={[
        styles.timelineCard, 
        { 
          backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
        }
      ]} 
      onLongPress={onLongPress}
      activeOpacity={0.8}
    >
      <View style={[styles.timelineCardColorBar, { backgroundColor: eventType.color }]} />
      
      <View style={styles.timelineCardContent}>
        <View style={styles.timelineCardHeader}>
          <Text style={styles.eventTitleText}>{item.title}</Text>
          <Text style={styles.eventTimeText}>{time}</Text>
        </View>

        <View style={styles.eventTypeRow}>
          <MaterialCommunityIcons name={eventType.icon} size={14} color={eventType.color} />
          <Text style={[styles.eventTypeLabel, { color: eventType.color }]}>{eventType.label}</Text>
        </View>

        {item.location && (
          <View style={styles.locationRow}>
            <MaterialCommunityIcons name="map-marker" size={14} color={styles.subtextColor} />
            <Text style={styles.locationText}>{item.location}</Text>
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

  const t = useMemo(() => ({
    background: colors.background,
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    surfaceSecondary: isDark ? '#2C2C2E' : '#F2F2F7',
    accent: colors.accent || '#FF2D55',
    primary: colors.primary,
    text: colors.text,
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Date/time picker state
  const [pickerDate, setPickerDate] = useState(new Date());
  const [pickerTime, setPickerTime] = useState(new Date());

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

  if (!isPremium) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.background }]}>
        <View style={styles.mainPadding}>
          <Text style={styles.editorialTitle}>Your Shared Time</Text>
        </View>
        <View style={styles.paywallCenter}>
          <MaterialCommunityIcons name="calendar-lock" size={64} color={t.primary} style={{ marginBottom: 16 }} />
          <Text style={styles.paywallTitle}>Calendar is Premium</Text>
          <Text style={styles.paywallDesc}>
            Plan date nights, track anniversaries, set reminders, and build a shared timeline of your relationship.
          </Text>
          <TouchableOpacity
            onPress={() => showPaywall?.('calendar')}
            style={styles.paywallButton}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="star" size={18} color="#FFFFFF" />
            <Text style={styles.paywallButtonText}>Discover Premium</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      {/* Velvet background gradient */}
      <LinearGradient
        colors={isDark 
          ? [t.background, '#0F0A1A', '#0D081A', t.background] 
          : [t.background, '#F2F2F7', t.background]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <GlowOrb color={withAlpha(t.primary, 0.15)} size={250} top={-50} left={-50} />
      <FilmGrain />

      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
        >
          <View style={styles.mainPadding}>
            <Text style={styles.editorialTitle}>Timeline</Text>
          </View>

          <PremiumCalendar 
            selectedDate={selectedDate} 
            onDateSelect={setSelectedDate} 
            events={events} 
            styles={styles} 
            colors={t} 
          />

          <View style={styles.timelineSection}>
            <View style={styles.timelineHeaderRow}>
              <Text style={styles.timelineDate}>
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
              <Text style={styles.eventCountText}>
                {selectedDateEvents.length} {selectedDateEvents.length === 1 ? 'Event' : 'Events'}
              </Text>
            </View>

            {selectedDateEvents.length > 0 ? (
              <View style={styles.eventsList}>
                {selectedDateEvents.map((event, i) => (
                  <ReAnimated.View key={event.id} entering={FadeInDown.duration(300).delay(i * 50)}>
                    <TimelineEvent 
                      item={event} 
                      styles={styles}
                      isDark={isDark}
                      onLongPress={() => {
                        Alert.alert('Remove Event', 'Are you sure you want to delete this?', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: async () => {
                            if (event.notificationId) await cancelNotification(event.notificationId);
                            if (supabase && (event.isRemote || event.supabaseId)) {
                              try {
                                await supabase.from(TABLES.CALENDAR_EVENTS).delete().eq('id', event.supabaseId || event.id);
                              } catch (err) {}
                            }
                            await calendarStorage.deleteEvent(event.id);
                            loadEvents();
                          }}
                        ]);
                      }}
                    />
                  </ReAnimated.View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="calendar-blank" size={32} color={t.subtext} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyText}>No plans recorded for this day.</Text>
              </View>
            )}
          </View>
        </ScrollView>

        <TouchableOpacity onPress={() => setModalOpen(true)} style={styles.fab} activeOpacity={0.9}>
          <MaterialCommunityIcons name="plus" size={32} color={isDark ? "#000" : "#FFF"} />
        </TouchableOpacity>

        {/* Create Event Modal */}
        <Modal visible={modalOpen} animationType="slide" transparent>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Event</Text>
                <TouchableOpacity onPress={() => setModalOpen(false)} style={styles.closeButton}>
                  <MaterialCommunityIcons name="close" size={24} color={t.text} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.modalForm} showsVerticalScrollIndicator={false}>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Title</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Dinner at Mario's"
                    placeholderTextColor={t.subtext}
                    value={form.title}
                    onChangeText={v => setForm(p => ({ ...p, title: v }))}
                  />
                </View>

                {/* Event Type Grid */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Type</Text>
                  <View style={styles.typeGrid}>
                    {Object.entries(EVENT_TYPES).map(([key, type]) => {
                      const isActive = form.eventType === key;
                      return (
                        <TouchableOpacity
                          key={key}
                          style={[
                            styles.typeChip,
                            isActive && { backgroundColor: type.color, borderColor: type.color }
                          ]}
                          onPress={() => setForm(p => ({ ...p, eventType: key, isDateNight: key === 'dateNight' }))}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.typeChipText, { color: isActive ? '#FFFFFF' : t.text }]}>
                            {type.label}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </View>

                <View style={styles.pickerRow}>
                  <View style={styles.pickerSection}>
                    <Text style={styles.inputLabel}>Date</Text>
                    <View style={styles.pickerWrap}>
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
                    <Text style={styles.inputLabel}>Time</Text>
                    <View style={styles.pickerWrap}>
                      <DateTimePicker
                        value={pickerTime}
                        mode="time"
                        display="compact"
                        onChange={(e, t) => t && setPickerTime(t)}
                        themeVariant={isDark ? 'dark' : 'light'}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Location (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Add location"
                    placeholderTextColor={t.subtext}
                    value={form.location}
                    onChangeText={v => setForm(p => ({ ...p, location: v }))}
                  />
                </View>

                <View style={styles.reminderSection}>
                  <View style={styles.reminderToggleRow}>
                    <Text style={styles.inputLabel}>Alert</Text>
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
                              isActive && { backgroundColor: t.text, borderColor: t.text },
                            ]}
                            onPress={() => setForm(p => ({ ...p, notifyMins: opt.mins }))}
                          >
                            <Text style={[
                              styles.reminderChipText,
                              { color: isActive ? t.background : t.text },
                            ]}>
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                  )}
                </View>

                <TouchableOpacity style={styles.primaryBtn} onPress={handleSave} activeOpacity={0.8}>
                  <Text style={styles.primaryBtnText}>Add Event</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

// ------------------------------------------------------------------
// STYLES - Apple Editorial
// ------------------------------------------------------------------
const createStyles = (t, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { flexGrow: 1, paddingBottom: 160 }, // Extra padding to clear tab bar and FAB
  mainPadding: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.md },
  
  editorialTitle: { 
    fontFamily: Platform.select({ ios: "System", android: "Roboto" }),
    fontSize: 34, 
    fontWeight: '800', 
    letterSpacing: 0.3,
    color: t.text,
  },

  // ── Premium Calendar Widget ──
  calendarCard: {
    backgroundColor: t.surface,
    marginHorizontal: SPACING.xl,
    borderRadius: 28,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: t.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 16 },
      android: { elevation: 4 },
    }),
  },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.lg, paddingHorizontal: 4 },
  monthTitle: { fontSize: 24, fontWeight: '700', color: t.text, letterSpacing: -0.5 },
  yearTitle: { fontSize: 14, fontWeight: '600', color: t.subtext, marginTop: 2 },
  navButtons: { flexDirection: 'row', gap: 12 },
  navButton: { padding: 4, backgroundColor: t.surfaceSecondary, borderRadius: 16 },
  
  dayLabelsRow: { flexDirection: 'row', marginBottom: 12 },
  dayLabel: { fontSize: 11, fontWeight: '700', color: t.subtext, width: '14.28%', textAlign: 'center' },
  calendarGrid: { gap: 8 },
  weekRow: { flexDirection: 'row' },
  dayCellWrapper: { width: '14.28%', alignItems: 'center', justifyContent: 'center' },
  dayCell: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 15, fontWeight: '500', textAlign: 'center', fontVariant: ['tabular-nums'] },
  eventDotsRow: { position: 'absolute', bottom: 4, flexDirection: 'row', gap: 2, alignItems: 'center' },
  eventDot: { width: 4, height: 4, borderRadius: 2 },

  // ── Timeline Section ──
  timelineSection: { marginTop: SPACING.xl, paddingHorizontal: SPACING.xl },
  timelineHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: SPACING.lg },
  timelineDate: { fontSize: 20, fontWeight: '700', color: t.text, letterSpacing: -0.3 },
  eventCountText: { fontSize: 14, fontWeight: '500', color: t.subtext },
  eventsList: { gap: SPACING.md },
  
  timelineCard: {
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  timelineCardColorBar: { width: 6 },
  timelineCardContent: { flex: 1, padding: SPACING.lg, gap: 8 },
  timelineCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eventTitleText: { fontSize: 17, fontWeight: '700', color: t.text, flex: 1, marginRight: 8 },
  eventTimeText: { fontSize: 13, fontWeight: '600', color: t.subtext },
  eventTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventTypeLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  locationText: { fontSize: 13, fontWeight: '500', color: t.subtext },
  subtextColor: t.subtext, // passed for the icon

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, backgroundColor: t.surface, borderRadius: 20, borderWidth: 1, borderColor: t.border },
  emptyText: { fontSize: 15, fontWeight: '500', color: t.subtext },

  // ── FAB ──
  fab: { 
    position: 'absolute', 
    bottom: 110, // Lifted above the bottom tab bar
    right: SPACING.xl, 
    width: 64, 
    height: 64, 
    borderRadius: 32, 
    backgroundColor: t.text, 
    alignItems: 'center', 
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },

  // ── Modal / Form ──
  modalOverlay: { flex: 1, backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { 
    backgroundColor: t.surface, 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    padding: SPACING.xl, 
    maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xl },
  modalTitle: { fontSize: 24, fontWeight: '800', color: t.text, letterSpacing: -0.5 },
  closeButton: { padding: 4, backgroundColor: t.surfaceSecondary, borderRadius: 16 },
  modalForm: { gap: 24, paddingBottom: 40 },
  
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: t.text, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { 
    backgroundColor: t.surfaceSecondary,
    borderRadius: 16,
    padding: SPACING.md,
    fontSize: 16,
    color: t.text,
    fontWeight: '500',
  },
  
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { 
    paddingHorizontal: 16, paddingVertical: 10, 
    borderRadius: 20, 
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surfaceSecondary,
  },
  typeChipText: { fontSize: 13, fontWeight: '600' },

  pickerRow: { flexDirection: 'row', gap: 16 },
  pickerSection: { flex: 1, gap: 8 },
  pickerWrap: { backgroundColor: t.surfaceSecondary, borderRadius: 16, padding: 8, alignItems: 'flex-start' },

  reminderSection: { gap: 12, marginTop: 8 },
  reminderToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reminderOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reminderChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: t.border },
  reminderChipText: { fontSize: 13, fontWeight: '600' },

  primaryBtn: { 
    backgroundColor: t.primary, 
    paddingVertical: 18, 
    borderRadius: 28, 
    alignItems: 'center', 
    marginTop: 16,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },

  // Paywall
  paywallCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.xxl },
  paywallTitle: { fontSize: 28, fontWeight: '800', color: t.text, marginBottom: SPACING.md, letterSpacing: -0.5 },
  paywallDesc: { fontSize: 15, color: t.subtext, textAlign: 'center', lineHeight: 22, marginBottom: SPACING.xxl },
  paywallButton: { backgroundColor: t.text, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 28, width: '100%', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  paywallButtonText: { color: t.background, fontSize: 16, fontWeight: '700' },
});

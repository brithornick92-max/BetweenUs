import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useRitualContext } from '../context/RitualContext';
import { storage, STORAGE_KEYS } from '../utils/storage';
import { cancelNotification } from '../utils/notifications';
import { TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../utils/theme';

export default function RitualRemindersScreen({ navigation }) {
  const { theme } = useTheme();
  const { actions } = useRitualContext();
  const [reminders, setReminders] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState('Ritual Reminder');
  const [body, setBody] = useState('Time for your connection ritual.');
  const [when, setWhen] = useState(new Date(Date.now() + 60 * 60 * 1000));

  const sortedReminders = useMemo(() => {
    return [...reminders].sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));
  }, [reminders]);

  const loadReminders = async () => {
    const data = (await storage.get(STORAGE_KEYS.RITUAL_REMINDERS)) || [];
    setReminders(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    loadReminders();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setTitle('Ritual Reminder');
    setBody('Time for your connection ritual.');
    setWhen(new Date(Date.now() + 60 * 60 * 1000));
  };

  const handleAddOrUpdate = async () => {
    try {
      const payload = {
        id: editing?.id,
        title: title.trim() || 'Ritual Reminder',
        body: body.trim() || 'Time for your connection ritual.',
        when,
      };

      if (editing?.notificationId) {
        await cancelNotification(editing.notificationId);
      }

      await actions.scheduleRitualReminder(payload);
      await loadReminders();
      resetForm();
    } catch (error) {
      Alert.alert('Reminder failed', error?.message || 'Please try again.');
    }
  };

  const handleEdit = (reminder) => {
    setEditing(reminder);
    setTitle(reminder.title || 'Ritual Reminder');
    setBody(reminder.body || 'Time for your connection ritual.');
    setWhen(reminder.scheduledFor ? new Date(reminder.scheduledFor) : new Date());
  };

  const handleDelete = (reminder) => {
    Alert.alert('Delete reminder?', 'This will cancel the scheduled notification.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (reminder?.notificationId) {
            await cancelNotification(reminder.notificationId);
          }
          const remaining = reminders.filter((r) => r.id !== reminder.id);
          await storage.set(STORAGE_KEYS.RITUAL_REMINDERS, remaining);
          await loadReminders();
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <LinearGradient colors={theme.gradients.secondary} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Ritual Reminders</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {editing ? 'Edit reminder' : 'Add reminder'}
            </Text>

            <TextInput
              style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Title"
              placeholderTextColor={theme.colors.textSecondary}
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Message"
              placeholderTextColor={theme.colors.textSecondary}
              value={body}
              onChangeText={setBody}
            />

            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => setShowPicker(true)}
              activeOpacity={0.9}
            >
              <MaterialCommunityIcons name="clock-outline" size={18} color={theme.colors.text} />
              <Text style={[styles.timeText, { color: theme.colors.text }]}>
                {when.toLocaleString()}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryButton} onPress={handleAddOrUpdate}>
              <Text style={styles.primaryButtonText}>
                {editing ? 'Save reminder' : 'Schedule reminder'}
              </Text>
            </TouchableOpacity>

            {editing && (
              <TouchableOpacity style={styles.secondaryButton} onPress={resetForm}>
                <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>
                  Cancel edit
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Scheduled</Text>
            {sortedReminders.length === 0 && (
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                No reminders yet.
              </Text>
            )}

            {sortedReminders.map((reminder) => (
              <View key={reminder.id} style={styles.reminderRow}>
                <View style={styles.reminderInfo}>
                  <Text style={[styles.reminderTitle, { color: theme.colors.text }]}>
                    {reminder.title || 'Ritual Reminder'}
                  </Text>
                  <Text style={[styles.reminderTime, { color: theme.colors.textSecondary }]}>
                    {reminder.scheduledFor
                      ? new Date(reminder.scheduledFor).toLocaleString()
                      : 'Unknown time'}
                  </Text>
                </View>
                <View style={styles.reminderActions}>
                  <TouchableOpacity onPress={() => handleEdit(reminder)} style={styles.iconButton}>
                    <MaterialCommunityIcons name="pencil" size={18} color={theme.colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(reminder)} style={styles.iconButton}>
                    <MaterialCommunityIcons name="trash-can" size={18} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>

      {showPicker && (
        <DateTimePicker
          value={when}
          mode="datetime"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, date) => {
            setShowPicker(false);
            if (date) setWhen(date);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scroll: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  card: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    marginBottom: SPACING.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: SPACING.md,
  },
  timeText: {
    ...TYPOGRAPHY.body,
  },
  primaryButton: {
    backgroundColor: '#D4AF37',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0B0B0B',
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  secondaryButtonText: {
    ...TYPOGRAPHY.caption,
  },
  emptyText: {
    ...TYPOGRAPHY.caption,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  reminderInfo: {
    flex: 1,
  },
  reminderTitle: {
    ...TYPOGRAPHY.body,
  },
  reminderTime: {
    ...TYPOGRAPHY.caption,
  },
  reminderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 6,
  },
});

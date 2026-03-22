/**
 * ExportDataScreen — Privacy-first data portability
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 * Allows users to export all journal entries and shared data in a premium UI.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Switch,
  Platform,
  StatusBar,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useMemoryContext } from '../context/MemoryContext';
import DataLayer from '../services/data/DataLayer';
import Constants from 'expo-constants';
import Icon from '../components/Icon';
import { SPACING, withAlpha, SYSTEM_FONT } from '../utils/theme';

// ─── Sub-component ───────────────────────────────────────────────────────────

const FeatureRow = ({ icon, text, color, textColor }) => (
  <View style={featureRowStyle.row}>
    <Icon name={icon} size={18} color={color} />
    <Text style={[featureRowStyle.text, { color: textColor }]}>{text}</Text>
  </View>
);

const featureRowStyle = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { fontFamily: SYSTEM_FONT, fontSize: 15, fontWeight: '600', flex: 1 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

const ExportDataScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const { user, userProfile } = useAuth();
  const { state: memoryState } = useMemoryContext();
  const memories = memoryState?.memories;

  // ─── Sexy Red x Apple Editorial Theme Map ───
  const t = useMemo(() => ({
    background: colors.background,
    surface: isDark ? '#131016' : '#FFFFFF',
    surfaceSecondary: isDark ? '#1C1520' : '#F2F2F7',
    primary: colors.primary || '#C3113D',
    text: colors.text,
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    warning: '#FF9F0A',
    success: '#34C759',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  const [isExporting, setIsExporting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [includeSharedEntries, setIncludeSharedEntries] = useState(false);
  const [includeAccountDetails, setIncludeAccountDetails] = useState(false);

  /**
   * Gather all user data from the local-first DataLayer (SQLite + E2EE decrypt).
   * Returns decrypted plaintext so the export is human-readable.
   */
  const gatherAllData = async ({ includeShared }) => {
    const filterPrivate = (rows) => {
      if (includeShared) return rows || [];
      return (rows || []).filter(r =>
        !(r?.shared === true || r?.isShared === true || r?.partnerShared === true || r?.is_private === false)
      );
    };

    // Fetch from each data type via DataLayer (handles decryption)
    const [journalEntries, promptAnswers, memoryRows, rituals, checkIns, vibes, loveNotes] =
      await Promise.all([
        DataLayer.getJournalEntries({ limit: 10000 }).catch(() => []),
        DataLayer.getPromptAnswers({ limit: 10000 }).catch(() => []),
        DataLayer.getMemories({ limit: 10000 }).catch(() => []),
        DataLayer.getRituals({ limit: 10000 }).catch(() => []),
        DataLayer.getCheckIns({ limit: 10000 }).catch(() => []),
        DataLayer.getVibes({ limit: 10000 }).catch(() => []),
        DataLayer.getLoveNotes({ limit: 10000 }).catch(() => []),
      ]);

    // Strip cipher columns and internal sync metadata from output
    const sanitize = (rows) => (rows || []).map(r => {
      if (!r) return r;
      const clean = { ...r };
      // Remove cipher columns (user already has the plaintext fields)
      for (const key of Object.keys(clean)) {
        if (key.endsWith('_cipher') || ['sync_status', 'sync_version', 'sync_source'].includes(key)) {
          delete clean[key];
        }
      }
      delete clean.locked;
      return clean;
    });

    return {
      journalEntries: sanitize(filterPrivate(journalEntries)),
      promptAnswers: sanitize(filterPrivate(promptAnswers)),
      memories: sanitize(filterPrivate(memoryRows)),
      rituals: sanitize(rituals),
      checkIns: sanitize(checkIns),
      vibes: sanitize(vibes),
      loveNotes: sanitize(filterPrivate(loveNotes)),
    };
  };

  const exportData = async (options = {}) => {
    try {
      setIsExporting(true);

      const includeShared = !!options.includeSharedEntries;
      const includeAccount = !!options.includeAccountDetails;

      // Gather all data from DataLayer (decrypted)
      const allData = await gatherAllData({ includeShared });

      const exportPayload = {
        exportDate: new Date().toISOString(),
        appVersion: Constants.expoConfig?.version || Constants.manifest?.version || '1.0.0',
        user: includeAccount
          ? {
              email: user?.email,
              displayName: userProfile?.displayName,
              relationshipStartDate: userProfile?.relationshipStartDate,
              createdAt: userProfile?.createdAt,
            }
          : null,
        ...allData,
        totals: {
          journalEntries: allData.journalEntries.length,
          promptAnswers: allData.promptAnswers.length,
          memories: allData.memories.length,
          rituals: allData.rituals.length,
          checkIns: allData.checkIns.length,
          vibes: allData.vibes.length,
          loveNotes: allData.loveNotes.length,
        },
      };

      // Convert to JSON
      const jsonData = JSON.stringify(exportPayload, null, 2);

      // Create filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `between-us-export-${timestamp}.json`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      // Write file
      await FileSystem.writeAsStringAsync(fileUri, jsonData);

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();

      if (isAvailable) {
        // Share the file
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export Your Data',
          UTI: 'public.json',
        });

        // Clean up exported file after sharing to avoid plaintext data lingering on disk
        try {
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
        } catch (e) { /* cleanup non-critical */ }

        Alert.alert(
          'Export Successful',
          'Your digital history has been securely exported. The temporary file has been removed from this device.',
          [{ text: 'OK' }]
        );
      } else {
        // Sharing not available — clean up the plaintext file immediately
        try {
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
        } catch (e) { /* cleanup non-critical */ }

        Alert.alert(
          'Export Unavailable',
          'Sharing is not available on this device. The export file has been removed for your privacy.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Export error:', error?.message ?? error);
      Alert.alert(
        'Export Failed',
        'Failed to export your data. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="chevron-back" size={28} color={t.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.text }]}>Data Portability</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Icon Hero */}
        <View style={[styles.iconHero, { backgroundColor: withAlpha(t.primary, 0.1) }]}>
          <Icon name="download-outline" size={42} color={t.primary} />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: t.text }]}>Export Your Story</Text>
        <Text style={[styles.subtitle, { color: t.subtext }]}>
          Download a complete archive of your shared moments and personal reflections.
        </Text>

        {/* Archive Contents */}
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.cardTitle, { color: t.text }]}>Archive Contents</Text>
          <View style={styles.list}>
            <FeatureRow icon="book-outline" text="All Journal Entries" color={t.primary} textColor={t.text} />
            <FeatureRow icon="chatbubbles-outline" text="Reflection & Prompt Answers" color={t.primary} textColor={t.text} />
            <FeatureRow icon="heart-outline" text="Love Notes & Rituals" color={t.primary} textColor={t.text} />
            <FeatureRow icon="calendar-outline" text="Check-ins, Vibes & Date Night Plans" color={t.primary} textColor={t.text} />
            <FeatureRow icon="person-outline" text="Account & Relationship Preferences" color={t.primary} textColor={t.text} />
          </View>
        </View>

        {/* Export Format */}
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.cardTitle, { color: t.text }]}>Export Format</Text>
          <Text style={[styles.cardText, { color: t.subtext }]}>
            Your archive is exported as a JSON file — human-readable and openable in any text editor.
            Each section is clearly labeled and includes all entries in full.
          </Text>
        </View>

        {/* Privacy Notice */}
        <View style={[styles.warningCard, { borderColor: withAlpha(t.warning, 0.3) }]}>
          <View style={styles.warningHeader}>
            <Icon name="shield-checkmark-outline" size={20} color={t.warning} />
            <Text style={[styles.warningTitle, { color: t.warning }]}>Privacy Notice</Text>
          </View>
          <Text style={[styles.warningText, { color: t.subtext }]}>
            This file will contain sensitive plaintext information. Share it only with those you trust
            and store it in a secure, encrypted location.
          </Text>
        </View>

        {/* Stats */}
        <View style={[styles.statsCard, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.statNumber, { color: t.primary }]}>{memories?.length || 0}</Text>
          <Text style={[styles.statLabel, { color: t.subtext }]}>Captured Memories</Text>
        </View>
        <Text style={[styles.cardText, { color: t.subtext, textAlign: 'center', marginBottom: 32, paddingHorizontal: 16 }]}>
          Journal entries, prompt responses, rituals, check-ins, vibes, and love notes will also be included.
        </Text>

        {/* Export Button */}
        <TouchableOpacity
          style={[styles.exportButton, { backgroundColor: t.primary }]}
          onPress={() => setShowConfirm(true)}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.exportButtonText}>Generate Archive</Text>
              <Icon name="arrow-forward" size={18} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>

        {/* GDPR/CCPA Info */}
        <Text style={[styles.legalText, { color: t.subtext }]}>
          Archive generated in compliance with GDPR and CCPA data portability standards.
          You have the right to receive your personal data in a structured, commonly used format.
        </Text>
      </ScrollView>

      {/* Confirm Modal */}
      <Modal visible={showConfirm} transparent animationType="fade">
        <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.cardTitle, { color: t.text, textAlign: 'center' }]}>Configure Export</Text>
            <Text style={[styles.modalSub, { color: t.subtext }]}>
              Your export may include personal and shared entries. Shared entries may contain your
              partner's words. Choose what to include before continuing.
            </Text>

            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: t.text }]}>Include shared partner data</Text>
              <Switch
                value={includeSharedEntries}
                onValueChange={setIncludeSharedEntries}
                trackColor={{ true: t.primary }}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: t.text }]}>Include account metadata</Text>
              <Switch
                value={includeAccountDetails}
                onValueChange={setIncludeAccountDetails}
                trackColor={{ true: t.primary }}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowConfirm(false)} style={styles.cancelBtn}>
                <Text style={[styles.cancelText, { color: t.subtext }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowConfirm(false);
                  exportData({ includeSharedEntries, includeAccountDetails });
                }}
                style={[styles.confirmBtn, { backgroundColor: t.primary }]}
              >
                <Text style={styles.confirmText}>Export</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>
    </View>
  );
};

const createStyles = (t, isDark) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
  },
  backButton: { width: 44, height: 44, justifyContent: 'center' },
  headerTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 42,
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 60 },
  iconHero: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontFamily: SYSTEM_FONT,
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  card: {
    padding: 24,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  cardText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  list: { gap: 12 },
  warningCard: {
    padding: 20,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    backgroundColor: withAlpha('#FF9F0A', 0.05),
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  warningTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  warningText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  statsCard: {
    padding: 32,
    borderRadius: 24,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  statNumber: {
    fontFamily: SYSTEM_FONT,
    fontSize: 48,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -1,
  },
  statLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 28,
    gap: 10,
    marginBottom: 24,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: -0.2,
  },
  legalText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '500',
    paddingHorizontal: 20,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
  },
  modalSub: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '500',
    lineHeight: 20,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  switchLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    paddingRight: 12,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  cancelBtn: { flex: 1, height: 56, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: SYSTEM_FONT, fontSize: 16, fontWeight: '700' },
  confirmBtn: { flex: 2, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  confirmText: { color: '#FFFFFF', fontFamily: SYSTEM_FONT, fontSize: 16, fontWeight: '800' },
});

export default ExportDataScreen;

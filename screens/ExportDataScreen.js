/**
 * ExportDataScreen — Privacy-first data portability
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 * Allows users to export supported account and relationship data.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Switch
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useMemoryContext } from '../context/MemoryContext';
import { DataLayer } from '../services/localfirst';
import Constants from 'expo-constants';
import Icon from '../components/Icon';
import { withAlpha, SYSTEM_FONT } from '../utils/theme';
import EditorialScreenScaffold from '../components/EditorialScreenScaffold';
import {
  buildExportPayload,
  gatherExportData,
  isShareCancellation,
} from '../utils/exportDataArchive';


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
  const exportUserId = user?.uid || user?.id || userProfile?.uid || userProfile?.id || userProfile?.user_id || null;

  // ─── Sexy Red x Apple Editorial Theme Map ───
  const t = useMemo(() => ({
    background: colors.background,
    surface: isDark ? '#131016' : '#FFFFFF',
    surfaceSecondary: isDark ? '#1C1520' : '#F2F2F7',
    primary: colors.primary || '#D2121A',
    text: colors.text,
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    warning: '#FF9F0A',
    success: '#34C759',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  const [isExporting, setIsExporting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [includeAccountDetails, setIncludeAccountDetails] = useState(false);

  const exportData = async (options = {}) => {
    let fileUri = null;
    try {
      setIsExporting(true);

      const includeAccount = !!options.includeAccountDetails;

      const allData = await gatherExportData(DataLayer, {
        userId: exportUserId,
        onPartialError: (loadErrors) => {
          Alert.alert(
            'Partial Export',
            `Some data could not be loaded: ${loadErrors.join(', ')}. The export will continue without those sections.`,
          );
        },
      });

      const exportPayload = buildExportPayload({
        allData,
        includeAccountDetails: includeAccount,
        user,
        userProfile,
        appVersion: Constants.expoConfig?.version || Constants.manifest?.version || '1.0.0',
      });

      // Convert to JSON
      const jsonData = JSON.stringify(exportPayload, null, 2);

      // Create filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `between-us-export-${timestamp}.json`;
      const exportDir = FileSystem.cacheDirectory;
      if (!exportDir) throw new Error('Export cache directory unavailable');
      fileUri = `${exportDir}${filename}`;

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

        Alert.alert(
          'Export Created',
          'Your export was created. The temporary file has been removed from this device after the share sheet closed.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Export Unavailable',
          'Sharing is not available on this device. The export file has been removed for your privacy.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      if (isShareCancellation(error)) {
        return;
      }

      if (__DEV__) console.error('Export error:', error?.message ?? error);
      Alert.alert(
        'Export Failed',
        'Failed to export your data. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      if (fileUri) {
        try {
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
        } catch (_) { /* cleanup non-critical */ }
      }
      setIsExporting(false);
    }
  };

  return (
    <EditorialScreenScaffold
      navigation={navigation}
      headerTitle="Data Portability"
      headerSubtitle="DATA EXPORT"
    >
        {/* Archive Contents */}
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.cardTitle, { color: t.text }]}>Archive Contents</Text>
          <View style={styles.list}>
            <FeatureRow icon="book-outline" text="Supported Journal Entries" color={t.primary} textColor={t.text} />
            <FeatureRow icon="chatbubbles-outline" text="Supported Reflections, Prompt Answers & Love Notes" color={t.primary} textColor={t.text} />
            <FeatureRow icon="calendar-outline" text="Check-ins, Vibes, Calendar, Date Plans & Saved Dates" color={t.primary} textColor={t.text} />
            <FeatureRow icon="person-outline" text="Optional Account Metadata" color={t.primary} textColor={t.text} />
          </View>
        </View>

        {/* Export Format */}
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.cardTitle, { color: t.text }]}>Export Format</Text>
          <Text style={[styles.cardText, { color: t.subtext }]}>
            Your archive is exported as a JSON file — human-readable and openable in any text editor.
            Each supported section is clearly labeled in a structured format.
          </Text>
        </View>

        {/* Privacy Notice */}
        <View style={[styles.warningCard, { borderColor: withAlpha(t.warning, 0.3) }]}>
          <View style={styles.warningHeader}>
            <Icon name="shield-checkmark-outline" size={20} color={t.warning} />
            <Text style={[styles.warningTitle, { color: t.warning }]}>Privacy Notice</Text>
          </View>
          <Text style={[styles.warningText, { color: t.subtext }]}>
            This file will contain sensitive plaintext information. Share it only with those you trust.
          </Text>
        </View>

        {/* Stats */}
        <View style={[styles.statsCard, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.statNumber, { color: t.primary }]}>{memories?.length || 0}</Text>
          <Text style={[styles.statLabel, { color: t.subtext }]}>Captured Memories</Text>
        </View>
        <Text style={[styles.cardText, { color: t.subtext, textAlign: 'center', marginBottom: 32, paddingHorizontal: 16 }]}>
          Journal entries, prompt responses, memories, love notes, check-ins, vibes, calendar events, date plans, and saved date IDs will also be included.
        </Text>

        {/* Export Button */}
        <TouchableOpacity
          style={[styles.exportButton, { backgroundColor: t.primary }]}
          onPress={() => setShowConfirm(true)}
          disabled={isExporting}
          accessibilityRole="button"
          accessibilityLabel="Generate data archive"
          accessibilityState={{ disabled: isExporting, busy: isExporting }}
        >
          {isExporting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.exportButtonText}>Generate Archive</Text>
              <Icon name="arrow-forward-outline" size={18} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>

        {/* GDPR/CCPA Info */}
        <Text style={[styles.legalText, { color: t.subtext }]}>
          Archive designed to support data portability requests by providing supported app data in a structured format.
        </Text>
      

      {/* Confirm Modal */}
      <Modal visible={showConfirm} transparent animationType="fade">
        <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.cardTitle, { color: t.text, textAlign: 'center' }]}>Configure Export</Text>
            <Text style={[styles.modalSub, { color: t.subtext }]}>
              Your export includes your relationship data, which may contain your partner's words.
              Choose whether to include account metadata before continuing.
            </Text>

            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: t.text }]}>Include account metadata</Text>
              <Switch
                value={includeAccountDetails}
                onValueChange={setIncludeAccountDetails}
                trackColor={{ true: t.primary }}
                accessibilityLabel="Include account metadata"
                accessibilityState={{ checked: includeAccountDetails }}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowConfirm(false)}
                style={styles.cancelBtn}
                accessibilityRole="button"
                accessibilityLabel="Cancel export"
              >
                <Text style={[styles.cancelText, { color: t.subtext }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowConfirm(false);
                  exportData({ includeAccountDetails });
                }}
                style={[styles.confirmBtn, { backgroundColor: t.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Export data archive"
              >
                <Text style={styles.confirmText}>Export</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>
    </EditorialScreenScaffold>
  );
};

const createStyles = (t, isDark) => StyleSheet.create({
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

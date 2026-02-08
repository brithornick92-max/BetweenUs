import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useMemoryContext } from '../context/MemoryContext';

/**
 * Export Data Screen
 * Allows users to export all their journal entries and data
 * GDPR/CCPA compliance feature
 */
const ExportDataScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { user, userProfile } = useAuth();
  const { state: memoryState } = useMemoryContext();
  const memories = memoryState?.memories;
  const [isExporting, setIsExporting] = useState(false);

  const exportData = async () => {
    try {
      setIsExporting(true);

      // Prepare data for export
      const exportData = {
        exportDate: new Date().toISOString(),
        user: {
          email: user?.email,
          displayName: userProfile?.displayName,
          relationshipStartDate: userProfile?.relationshipStartDate,
          createdAt: userProfile?.createdAt,
        },
        journalEntries: memories || [],
        totalEntries: memories?.length || 0,
      };

      // Convert to JSON
      const jsonData = JSON.stringify(exportData, null, 2);

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

        Alert.alert(
          'Export Successful',
          'Your data has been exported. You can now save it to your device or share it.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Export Complete',
          `Your data has been saved to:\n${fileUri}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert(
        'Export Failed',
        'Failed to export your data. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = () => {
    Alert.alert(
      'Export Your Data',
      'This will create a file containing all your journal entries and account information. The file will be in JSON format.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          onPress: exportData,
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Export My Data</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="download" size={48} color={colors.primary} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>Export Your Data</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Download all your journal entries and account information
          </Text>

          {/* What's Included */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>What's Included</Text>
            
            <View style={styles.listItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={[styles.listText, { color: colors.textSecondary }]}>
                All journal entries
              </Text>
            </View>

            <View style={styles.listItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={[styles.listText, { color: colors.textSecondary }]}>
                Prompt responses
              </Text>
            </View>

            <View style={styles.listItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={[styles.listText, { color: colors.textSecondary }]}>
                Account information
              </Text>
            </View>

            <View style={styles.listItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={[styles.listText, { color: colors.textSecondary }]}>
                Relationship preferences
              </Text>
            </View>

            <View style={styles.listItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={[styles.listText, { color: colors.textSecondary }]}>
                Date night plans
              </Text>
            </View>
          </View>

          {/* Format Info */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Export Format</Text>
            <Text style={[styles.cardText, { color: colors.textSecondary }]}>
              Your data will be exported as a JSON file that you can save to your device or share. 
              The file is human-readable and can be opened with any text editor.
            </Text>
          </View>

          {/* Privacy Note */}
          <View style={[styles.card, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
            <View style={styles.warningHeader}>
              <Ionicons name="shield-checkmark" size={24} color={colors.warning} />
              <Text style={[styles.cardTitle, { color: colors.warning }]}>Privacy Note</Text>
            </View>
            <Text style={[styles.cardText, { color: colors.textSecondary }]}>
              Your exported data contains sensitive information. Please store it securely and only 
              share it with trusted parties. We recommend encrypting the file if you plan to store 
              it long-term.
            </Text>
          </View>

          {/* Stats */}
          <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>
                {memories?.length || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Journal Entries
              </Text>
            </View>
          </View>

          {/* Export Button */}
          <TouchableOpacity
            style={[styles.exportButton, { backgroundColor: colors.primary }]}
            onPress={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="download" size={20} color="#fff" />
                <Text style={styles.exportButtonText}>Export My Data</Text>
              </>
            )}
          </TouchableOpacity>

          {/* GDPR/CCPA Info */}
          <Text style={[styles.legalText, { color: colors.textSecondary }]}>
            This feature is provided in compliance with GDPR and CCPA data portability rights. 
            You have the right to receive your personal data in a structured, commonly used format.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  card: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  cardText: {
    fontSize: 14,
    lineHeight: 20,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  listText: {
    fontSize: 14,
    flex: 1,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  statsCard: {
    padding: 24,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  legalText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ExportDataScreen;

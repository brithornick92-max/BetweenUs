// File: components/ExpoProjectDownload.jsx
// React Native version of the project info/download screen

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../utils/theme';

export default function ExpoProjectDownload() {
  const [copied, setCopied] = useState(null);

  const copyToClipboard = async (text, id) => {
    try {
      await Clipboard.setStringAsync(text);
      setCopied(id);
      Alert.alert('Copied', 'Copied to clipboard');
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const projectStructure = [
    { type: 'folder', name: 'BetweenUs/', indent: 0 },
    { type: 'file', name: 'App.js', indent: 1 },
    { type: 'file', name: 'app.json', indent: 1 },
    { type: 'file', name: 'package.json', indent: 1 },
    { type: 'file', name: 'babel.config.js', indent: 1 },
    { type: 'folder', name: 'components/', indent: 1 },
    { type: 'file', name: 'Button.js', indent: 2 },
    { type: 'file', name: 'Card.js', indent: 2 },
    { type: 'file', name: 'Chip.js', indent: 2 },
    { type: 'file', name: 'Slider.js', indent: 2 },
    { type: 'file', name: 'Input.js', indent: 2 },
    { type: 'file', name: 'LockScreen.js', indent: 2 },
    { type: 'folder', name: 'content/', indent: 1 },
    { type: 'file', name: 'prompts.json', indent: 2 },
    { type: 'file', name: 'dates.json', indent: 2 },
    { type: 'folder', name: 'context/', indent: 1 },
    { type: 'file', name: 'AppContext.js', indent: 2 },
    { type: 'folder', name: 'navigation/', indent: 1 },
    { type: 'file', name: 'Tabs.js', indent: 2 },
    { type: 'file', name: 'RootNavigator.js', indent: 2 },
    { type: 'folder', name: 'screens/', indent: 1 },
    { type: 'file', name: 'OnboardingScreen.js', indent: 2 },
    { type: 'file', name: 'HomeScreen.js', indent: 2 },
    { type: 'file', name: 'PromptAnswerScreen.js', indent: 2 },
    { type: 'file', name: 'RevealScreen.js', indent: 2 },
    { type: 'file', name: 'DateNightScreen.js', indent: 2 },
    { type: 'file', name: 'DateNightDetailScreen.js', indent: 2 },
    { type: 'file', name: 'CheckInScreen.js', indent: 2 },
    { type: 'file', name: 'JournalScreen.js', indent: 2 },
    { type: 'file', name: 'SettingsScreen.js', indent: 2 },
    { type: 'file', name: 'PaywallScreen.js', indent: 2 },
    { type: 'folder', name: 'utils/', indent: 1 },
    { type: 'file', name: 'contentLoader.js', indent: 2 },
    { type: 'file', name: 'storage.js', indent: 2 },
    { type: 'file', name: 'premium.js', indent: 2 },
    { type: 'file', name: 'theme.js', indent: 2 },
  ];

  const installCommands = `# Create project folder and navigate to it
mkdir BetweenUs && cd BetweenUs

# Initialize package.json (copy from below first)
# Then install dependencies:
npm install

# Start the app
npx expo start`;

  const features = [
    { icon: 'heart', title: 'Couple Linking', desc: 'Invite codes, shared premium' },
    { icon: 'auto-fix', title: '100+ Prompts', desc: 'Inclusive, spicy-but-safe' },
    { icon: 'code-tags', title: 'Backend Ready', desc: 'Local storage integration' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <LinearGradient
        colors={[COLORS.warmCharcoal, COLORS.deepPlum + '30', COLORS.warmCharcoal]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.headerSection}>
        <View style={styles.badge}>
          <MaterialCommunityIcons name="heart" size={14} color={COLORS.blushRose} />
          <Text style={styles.badgeText}>React Native Expo Project</Text>
        </View>
        <Text style={styles.title}>Between Us</Text>
        <Text style={styles.tagline}>"Private. Playful. Intimate."</Text>
        <Text style={styles.description}>
          A complete, production-ready couples app built with Expo.
        </Text>
      </View>

      {/* Quick Start */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="console" size={20} color={COLORS.mutedGold} />
          <Text style={styles.cardTitle}>Quick Start</Text>
        </View>
        <Text style={styles.cardDescription}>
          After downloading all files, run these commands:
        </Text>
        <View style={styles.codeBlock}>
          <Text style={styles.codeText}>{installCommands}</Text>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={() => copyToClipboard(installCommands, 'install')}
          >
            <MaterialCommunityIcons
              name={copied === 'install' ? 'check-circle' : 'content-copy'}
              size={18}
              color={COLORS.softCream + '80'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Project Structure */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="folder" size={20} color={COLORS.mutedGold} />
          <Text style={styles.cardTitle}>Project Structure</Text>
        </View>
        <Text style={styles.cardDescription}>
          Create this folder structure in your project directory
        </Text>
        <View style={styles.codeBlock}>
          {projectStructure.map((item, index) => (
            <View
              key={index}
              style={[styles.structureRow, { paddingLeft: item.indent * 20 }]}
            >
              <MaterialCommunityIcons
                name={item.type === 'folder' ? 'folder' : 'file-document-outline'}
                size={16}
                color={item.type === 'folder' ? COLORS.mutedGold : COLORS.blushRose + '70'}
              />
              <Text
                style={[
                  styles.structureText,
                  { color: item.type === 'folder' ? COLORS.mutedGold : COLORS.softCream + '70' },
                ]}
              >
                {item.name}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Features */}
      <View style={styles.featureRow}>
        {features.map((feature, i) => (
          <View key={i} style={styles.featureCard}>
            <MaterialCommunityIcons
              name={feature.icon}
              size={28}
              color={COLORS.blushRose}
              style={styles.featureIcon}
            />
            <Text style={styles.featureTitle}>{feature.title}</Text>
            <Text style={styles.featureDesc}>{feature.desc}</Text>
          </View>
        ))}
      </View>

      {/* Info Note */}
      <View style={styles.infoNote}>
        <Text style={styles.infoText}>
          <Text style={styles.infoBold}>Note: </Text>
          All source code files are available below. Copy each file's content into
          the corresponding file in your project structure.
        </Text>
      </View>

      <View style={{ height: SPACING.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.warmCharcoal,
  },
  content: {
    padding: SPACING.lg,
  },
  headerSection: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.blushRose + '20',
    borderWidth: 1,
    borderColor: COLORS.blushRose + '30',
  },
  badgeText: {
    color: COLORS.blushRose,
    fontSize: 12,
    fontWeight: '500',
  },
  title: {
    ...TYPOGRAPHY.display,
    color: COLORS.softCream,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  tagline: {
    color: COLORS.blushRose,
    fontSize: 16,
    fontStyle: 'italic',
    marginTop: SPACING.xs,
  },
  description: {
    color: COLORS.softCream + '70',
    fontSize: 14,
    textAlign: 'center',
    marginTop: SPACING.sm,
    maxWidth: 300,
  },
  card: {
    backgroundColor: COLORS.deepPlum + '80',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.blushRose + '20',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  cardTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.softCream,
  },
  cardDescription: {
    color: COLORS.softCream + '60',
    fontSize: 13,
    marginBottom: SPACING.md,
  },
  codeBlock: {
    backgroundColor: COLORS.warmCharcoal,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    position: 'relative',
  },
  codeText: {
    color: COLORS.softCream + '90',
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  copyButton: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    padding: SPACING.xs,
  },
  structureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: 2,
  },
  structureText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  featureRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  featureCard: {
    flex: 1,
    backgroundColor: COLORS.deepPlum + '60',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.blushRose + '10',
  },
  featureIcon: {
    marginBottom: SPACING.sm,
  },
  featureTitle: {
    color: COLORS.softCream,
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
  featureDesc: {
    color: COLORS.softCream + '50',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  infoNote: {
    backgroundColor: COLORS.mutedGold + '10',
    borderWidth: 1,
    borderColor: COLORS.mutedGold + '30',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.lg,
  },
  infoText: {
    color: COLORS.mutedGold,
    fontSize: 13,
    textAlign: 'center',
  },
  infoBold: {
    fontWeight: '700',
  },
});

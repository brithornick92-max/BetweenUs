/**
 * Preview screen for all 10 intimacy position illustrations.
 * Temporary — add to navigation to preview, remove when done.
 * 
 * Usage: import and add to your navigator temporarily
 */
import React, { useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet, Image } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { SPACING, withAlpha } from '../utils/theme';

const ILLUSTRATIONS = [
  { file: require('../assets/intimacy-illustrations/1.png'),  name: 'Anchor' },
  { file: require('../assets/intimacy-illustrations/2.png'),  name: 'Bridge' },
  { file: require('../assets/intimacy-illustrations/3.png'),  name: 'Constellation' },
  { file: require('../assets/intimacy-illustrations/4.png'),  name: 'Gravity Well' },
  { file: require('../assets/intimacy-illustrations/5.png'),  name: 'Harbor Alt' },
  { file: require('../assets/intimacy-illustrations/6.png'),  name: 'Harbor' },
  { file: require('../assets/intimacy-illustrations/7.png'),  name: 'Lotus' },
  { file: require('../assets/intimacy-illustrations/8.png'),  name: 'Mirror' },
  { file: require('../assets/intimacy-illustrations/9.png'),  name: 'Overlap' },
  { file: require('../assets/intimacy-illustrations/10.png'), name: 'Pulse Alt' },
  { file: require('../assets/intimacy-illustrations/11.png'), name: 'Pulse Close' },
  { file: require('../assets/intimacy-illustrations/12.png'), name: 'Pulse' },
  { file: require('../assets/intimacy-illustrations/13.png'), name: 'Reveal' },
  { file: require('../assets/intimacy-illustrations/14.png'), name: 'Throne Alt 2' },
  { file: require('../assets/intimacy-illustrations/15.png'), name: 'Throne Alt' },
  { file: require('../assets/intimacy-illustrations/16.png'), name: 'Throne' },
  { file: require('../assets/intimacy-illustrations/17.png'), name: 'Wheelbarrow' },
];

export default function IllustrationPreview() {
  const { colors } = useTheme();

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Illustration Preview</Text>

      {ILLUSTRATIONS.map(({ file, name }, i) => (
        <View key={name} style={styles.card}>
          <Text style={styles.label}>{i + 1}</Text>
          <Text style={styles.title}>{name}</Text>
          <View style={styles.illustrationBox}>
            <Image source={file} resizeMode="contain" style={styles.illustrationImage} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: SPACING.screen,
    paddingTop: 60,
    paddingBottom: 80,
  },
  heading: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    marginBottom: SPACING.xl,
  },
  variantRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: SPACING.xxl,
  },
  pill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: withAlpha(colors.primary, 0.15),
    borderColor: withAlpha(colors.primary, 0.3),
  },
  pillText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextActive: {
    color: colors.primary,
  },
  card: {
    marginBottom: 32,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '400',
    marginBottom: 4,
  },
  commonName: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  illustrationImage: {
    width: '100%',
    height: 200,
  },
  illustrationBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  });
}

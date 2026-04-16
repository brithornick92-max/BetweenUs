/**
 * Preview screen for all 10 intimacy position illustrations.
 * Temporary — add to navigation to preview, remove when done.
 * 
 * Usage: import and add to your navigator temporarily
 */
import React, { useState, useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { SPACING, withAlpha } from '../utils/theme';
import { getIllustration } from '../assets/intimacy-illustrations';

const POSITIONS = [
  { id: 'ip001', title: 'The Lotus', commonName: 'Lotus' },
  { id: 'ip002', title: 'The Slow Melt', commonName: 'Spooning' },
  { id: 'ip003', title: 'The Compass', commonName: 'Reverse Cowgirl' },
  { id: 'ip004', title: 'The Harbor', commonName: 'Doggy Style' },
  { id: 'ip005', title: 'The Bridge', commonName: 'Bridge' },
  { id: 'ip006', title: 'The Whisper', commonName: 'Prone Bone' },
  { id: 'ip007', title: 'The Mirror', commonName: '69' },
  { id: 'ip008', title: 'The Throne', commonName: 'Cowgirl' },
  { id: 'ip009', title: 'The Drift', commonName: 'Lazy Dog' },
  { id: 'ip010', title: 'The Pulse', commonName: 'Missionary' },
];

const VARIANTS = [
  { key: 'him-her', label: 'Him & Her', a: 'rgba(229,229,231,0.55)', b: '#D2121A' },
  { key: 'her-her', label: 'Her & Her', a: '#D2121A', b: '#900C0F' },
  { key: 'him-him', label: 'Him & Him', a: 'rgba(229,229,231,0.55)', b: 'rgba(229,229,231,0.35)' },
];

export default function IllustrationPreview() {
  const { colors } = useTheme();
  const [variantIdx, setVariantIdx] = useState(0);
  const variant = VARIANTS[variantIdx];

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Illustration Preview</Text>

      {/* Variant toggle */}
      <View style={styles.variantRow}>
        {VARIANTS.map((v, i) => (
          <TouchableOpacity
            key={v.key}
            onPress={() => setVariantIdx(i)}
            style={[styles.pill, i === variantIdx && styles.pillActive]}
          >
            <Text style={[styles.pillText, i === variantIdx && styles.pillTextActive]}>
              {v.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {POSITIONS.map(({ id, title, commonName }) => {
        const Illustration = getIllustration(id);
        const isImage = typeof Illustration === 'number';
        return (
          <View key={id} style={styles.card}>
            <Text style={styles.label}>{id}</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.commonName}>{commonName}</Text>
            <View style={styles.illustrationBox}>
              {Illustration ? (
                isImage ? (
                  <Image source={Illustration} resizeMode="contain" style={styles.illustrationImage} />
                ) : (
                  <Illustration
                    width="100%"
                    height={200}
                    figureAColor={variant.a}
                    figureBColor={variant.b}
                  />
                )
              ) : null}
            </View>
          </View>
        );
      })}
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

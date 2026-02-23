/**
 * NicknameSettings — Partner nickname & tone personalization
 * 
 * Integrated into Settings → Partner Connection area.
 * Let partners set how they're referred to.
 * App copy subtly adapts.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { BORDER_RADIUS, SPACING } from '../utils/theme';
import { NicknameEngine } from '../services/PolishEngine';

export default function NicknameSettings({ onConfigChanged }) {
  const { colors } = useTheme();
  const [config, setConfig] = useState(null);

  useEffect(() => {
    (async () => {
      const c = await NicknameEngine.getConfig();
      setConfig(c);
    })();
  }, []);

  const updateField = useCallback(async (field, value) => {
    const updated = await NicknameEngine.setConfig({ [field]: value });
    setConfig(updated);
    onConfigChanged?.(updated);
  }, [onConfigChanged]);

  const selectTone = useCallback(async (toneId) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = await NicknameEngine.setConfig({ tone: toneId });
    setConfig(updated);
    onConfigChanged?.(updated);
  }, [onConfigChanged]);

  if (!config) return null;

  return (
    <View style={styles.container}>
      {/* Nickname Inputs */}
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
          What should we call you?
        </Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          value={config.myNickname}
          onChangeText={(v) => updateField('myNickname', v)}
          placeholder="Your nickname, initials, or 'my love'..."
          placeholderTextColor={colors.textMuted + '60'}
          maxLength={30}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
          What should we call your partner?
        </Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          value={config.partnerNickname}
          onChangeText={(v) => updateField('partnerNickname', v)}
          placeholder="Their nickname, initials, or name..."
          placeholderTextColor={colors.textMuted + '60'}
          maxLength={30}
        />
      </View>

      {/* Tone Selector */}
      <View style={styles.toneSection}>
        <Text style={[styles.toneLabel, { color: colors.textMuted }]}>
          APP TONE
        </Text>
        <Text style={[styles.toneSub, { color: colors.textMuted }]}>
          How should the app talk to you?
        </Text>

        <View style={styles.toneGrid}>
          {NicknameEngine.TONE_OPTIONS.map((tone) => {
            const isActive = config.tone === tone.id;
            return (
              <TouchableOpacity
                key={tone.id}
                style={[
                  styles.toneCard,
                  { borderColor: isActive ? colors.primary : colors.border },
                  isActive && { backgroundColor: colors.primary + '10' },
                ]}
                onPress={() => selectTone(tone.id)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name={tone.icon}
                  size={18}
                  color={isActive ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.toneName, { color: isActive ? colors.primary : colors.text }]}>
                  {tone.label}
                </Text>
                <Text style={[styles.tonePreview, { color: colors.textMuted }]} numberOfLines={1}>
                  {tone.preview.replace('{partner}', config.partnerNickname || 'them')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.lg,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  input: {
    borderBottomWidth: 1,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  toneSection: {
    marginTop: SPACING.sm,
  },
  toneLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  toneSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginBottom: SPACING.md,
    opacity: 0.7,
  },
  toneGrid: {
    gap: SPACING.sm,
  },
  toneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  toneName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    minWidth: 65,
  },
  tonePreview: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
    opacity: 0.6,
  },
});

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from './Icon';
import { SCREEN_TITLE_STYLE, SPACING, SYSTEM_FONT } from '../utils/theme';
import { impact, ImpactFeedbackStyle } from '../utils/haptics';

export const CLOSE_HEADER_STYLES = {
  header: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  title: {
    ...SCREEN_TITLE_STYLE,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 42,
  },
  subtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },
  closeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
};

export default function CloseScreenHeader({
  title,
  subtitle,
  titleColor,
  subtitleColor,
  onClose,
  closeIcon = 'close-outline',
  closeColor,
  rightAccessory,
  leftAccessory,
  accessibilityLabel = 'Close',
}) {
  return (
    <View style={styles.header}>
      {subtitle ? (
        <Text style={[styles.subtitle, subtitleColor && { color: subtitleColor }]} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : (
        <View style={styles.subtitleSpacer} />
      )}
      <View style={styles.titleRow}>
        {leftAccessory || null}
        <View style={styles.titleBlock}>
          {title ? (
            <Text style={[styles.title, titleColor && { color: titleColor }]} numberOfLines={2}>
              {title}
            </Text>
          ) : null}
        </View>
        {rightAccessory ? <View style={styles.rightAccessory}>{rightAccessory}</View> : null}
        <TouchableOpacity
          onPress={() => {
            impact(ImpactFeedbackStyle.Light);
            onClose?.();
          }}
          style={styles.closeButton}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          activeOpacity={0.75}
        >
          <Icon name={closeIcon} size={28} color={closeColor || titleColor} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: CLOSE_HEADER_STYLES.header,
  subtitleSpacer: {
    height: 16,
    marginBottom: SPACING.sm,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleBlock: {
    flex: 1,
    paddingRight: SPACING.md,
  },
  title: CLOSE_HEADER_STYLES.title,
  subtitle: CLOSE_HEADER_STYLES.subtitle,
  rightAccessory: {
    marginRight: SPACING.sm,
  },
  closeButton: CLOSE_HEADER_STYLES.closeButton,
});

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from './Icon';
import GlowOrb from './GlowOrb';
import FilmGrain from './FilmGrain';
import { useTheme } from '../context/ThemeContext';
import {
  SPACING,
  SYSTEM_FONT,
  getGradients,
  withAlpha,
} from '../utils/theme';

export default function EditorialScreenScaffold({
  navigation,
  headerTitle,
  headerSubtitle,
  headerDescription,
  headerRight,
  onBack,
  children,
  footer,
  hero,
  heroIcon,
  heroTitle,
  heroSubtitle,
  heroTint,
  heroTitleColor,
  heroBackgroundColor,
  scroll = true,
  keyboardAvoiding = false,
  contentContainerStyle,
  bodyStyle,
  safeAreaEdges = ['top'],
  showsVerticalScrollIndicator = false,
  backIconName = 'close',
  screenAccentColor,
  headerSubtitleColor,
}) {
  const { colors, isDark } = useTheme();
  const gradients = getGradients(colors);
  const screenAccent = screenAccentColor || colors.primary;
  const screenSecondaryAccent = screenAccentColor || colors.accent || colors.text;
  const accentColor = heroTint || screenAccent;

  const content = (
    <>
      {hero || (heroTitle || heroSubtitle || heroIcon) ? (
        <View style={styles.heroSection}>
          {hero ? hero : (
            <>
              {heroIcon ? (
                <View
                  style={[
                    styles.iconHero,
                    { backgroundColor: heroBackgroundColor || withAlpha(accentColor, 0.1) },
                  ]}
                >
                  <Icon name={heroIcon} size={42} color={accentColor} />
                </View>
              ) : null}
              {heroTitle ? (
                <Text style={[styles.heroTitle, { color: heroTitleColor || colors.text }]}>{heroTitle}</Text>
              ) : null}
              {heroSubtitle ? (
                <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>{heroSubtitle}</Text>
              ) : null}
            </>
          )}
        </View>
      ) : null}
      {children}
      {footer}
    </>
  );

  const body = scroll ? (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      keyboardShouldPersistTaps="handled"
    >
      {content}
    </ScrollView>
  ) : (
    <View style={[styles.body, bodyStyle]}>{content}</View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <LinearGradient
        colors={gradients.screenBackground}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <GlowOrb color={screenAccent} size={420} top={-160} left={220} opacity={isDark ? 0.12 : 0.06} />
      <GlowOrb color={screenSecondaryAccent} size={260} top={560} left={-100} opacity={isDark ? 0.05 : 0.035} />
      <FilmGrain opacity={0.04} />

      <SafeAreaView style={styles.safeArea} edges={safeAreaEdges}>
        <View style={styles.header}>
          {headerSubtitle ? (
            <Text style={[styles.headerSubtitle, { color: headerSubtitleColor || colors.primary }]} numberOfLines={2}>
              {headerSubtitle}
            </Text>
          ) : null}

          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={2}>
              {headerTitle}
            </Text>

            <View style={styles.headerActions}>
              {headerRight || null}
              <TouchableOpacity
                onPress={() => {
                  if (onBack) {
                    onBack();
                    return;
                  }
                  navigation?.goBack?.();
                }}
                style={[
                  styles.closeButton,
                  {
                    backgroundColor: colors.surface2 || colors.surface,
                    borderColor: colors.border || withAlpha(colors.text, 0.08),
                  },
                ]}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close"
                activeOpacity={0.75}
              >
                <Icon name={backIconName} size={26} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {headerDescription ? (
            <Text style={[styles.headerDescription, { color: colors.textMuted }]} numberOfLines={2}>
              {headerDescription}
            </Text>
          ) : null}
        </View>

        {keyboardAvoiding ? (
          <KeyboardAvoidingView
            style={styles.keyboardAvoiding}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {body}
          </KeyboardAvoidingView>
        ) : body}
      </SafeAreaView>
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
  keyboardAvoiding: {
    flex: 1,
  },
  header: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  headerSubtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  headerTitle: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 42,
  },
  headerDescription: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  closeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.screen,
    paddingBottom: 120,
  },
  body: {
    flex: 1,
    paddingHorizontal: SPACING.screen,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: SPACING.section,
  },
  iconHero: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  heroTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.8,
    marginBottom: SPACING.sm,
  },
  heroSubtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    textAlign: 'center',
  },
});

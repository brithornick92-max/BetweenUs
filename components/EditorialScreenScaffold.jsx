import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from './Icon';
import GlowOrb from './GlowOrb';
import FilmGrain from './FilmGrain';
import CloseScreenHeader from './CloseScreenHeader';
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
}) {
  const { colors, isDark } = useTheme();
  const gradients = getGradients(colors);
  const accentColor = heroTint || colors.primary;

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
      <GlowOrb color={colors.primary} size={420} top={-160} left={220} opacity={isDark ? 0.12 : 0.06} />
      <GlowOrb color={colors.accent || colors.text} size={260} top={560} left={-100} opacity={isDark ? 0.05 : 0.035} />
      <FilmGrain opacity={0.04} />

      <SafeAreaView style={styles.safeArea} edges={safeAreaEdges}>
        <CloseScreenHeader
          title={headerTitle}
          subtitle={headerSubtitle}
          titleColor={colors.text}
          subtitleColor={colors.textMuted}
          closeColor={colors.text}
          closeIcon={backIconName}
          rightAccessory={headerRight}
          onClose={() => {
            if (onBack) {
              onBack();
              return;
            }
            navigation?.goBack?.();
          }}
        />

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

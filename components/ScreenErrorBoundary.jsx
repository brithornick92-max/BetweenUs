/**
 * ScreenErrorBoundary — Per-screen error isolation
 *
 * Wraps individual screens so a crash in one screen doesn't take down
 * the entire navigation tree. Unlike the root ErrorBoundary, this
 * component shows an inline recovery surface and provides a
 * "Go back" escape hatch via the optional `onGoBack` prop.
 *
 * Usage in Navigator:
 * <Stack.Screen name="HomeScreen">
 * {(props) => (
 * <ScreenErrorBoundary screenName="Home" navigation={props.navigation}>
 * <HomeScreen {...props} />
 * </ScreenErrorBoundary>
 * )}
 * </Stack.Screen>
 *
 * Or wrap with the provided `withScreenErrorBoundary` HOC:
 * export default withScreenErrorBoundary(HomeScreen, 'Home');
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  SafeAreaView,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import CrashReporting from '../services/CrashReporting';
import { useTheme } from '../context/ThemeContext';
import { BORDER_RADIUS, SPACING, TYPOGRAPHY, withAlpha } from '../utils/theme';
import Icon from './Icon';

const FONTS = {
  serif: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    default: 'serif',
  }),
  body: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'sans-serif',
  }),
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  }),
};

/**
 * Functional component to handle Reanimated and premium UI cleanly
 * outside of the class component lifecycle.
 */
function FallbackUI({ errorMsg, onRetry, onGoBack }) {
  const { colors, isDark } = useTheme();
  const t = {
    background: colors.background,
    surface: colors.surface || (isDark ? 'rgba(28, 28, 30, 0.9)' : 'rgba(255, 255, 255, 0.92)'),
    surfaceSecondary: colors.surface2 || (isDark ? '#2C2C2E' : '#F2F2F7'),
    text: colors.text,
    subtext: colors.textMuted || (isDark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.7)'),
    primary: colors.primary || '#D2121A',
    accent: colors.accent || '#D4AA7E',
    border: colors.border || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
  };
  const styles = createStyles(t, isDark);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <LinearGradient
          colors={isDark ? [t.background, '#120206', '#0A0003', t.background] : [t.background, withAlpha(t.primary, 0.04), t.background]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />

        <Animated.View entering={FadeIn.duration(900)} style={styles.backgroundGlow} pointerEvents="none" />

        <Animated.View entering={FadeInDown.duration(600).springify().damping(20)} style={styles.content}>
          <View style={styles.eyebrowRow}>
            <Text style={styles.eyebrow}>WE HIT A SNAG</Text>
          </View>

          <Text style={styles.title}>Something didn't load</Text>
          <Text style={styles.subtitle}>This part of the app hit a snag. Your data is safe.</Text>

          <View style={styles.card}>
            <View style={styles.iconBadge}>
              <Icon name="leaf-outline" size={22} color={t.primary} />
            </View>

            <Text style={styles.cardTitle}>This screen can recover without losing anything important.</Text>
            <Text style={styles.cardBody}>Try reloading this view. If you were just exploring, you can also go back.</Text>

            {__DEV__ && errorMsg ? (
              <View style={styles.errorPanel}>
                <Icon name="code-slash-outline" size={14} color={t.primary} />
                <Text style={styles.errorText} numberOfLines={3} ellipsizeMode="tail">{errorMsg}</Text>
              </View>
            ) : null}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(600).springify().damping(20)} style={styles.actionsContainer}>
          <TouchableOpacity style={styles.primaryButton} onPress={onRetry} activeOpacity={0.85}>
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </TouchableOpacity>

          {onGoBack ? (
            <TouchableOpacity style={styles.secondaryButton} onPress={onGoBack} activeOpacity={0.7}>
              <Text style={styles.secondaryButtonText}>Go back</Text>
            </TouchableOpacity>
          ) : null}
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

export default class ScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    CrashReporting.captureException(error, {
      componentStack: info?.componentStack,
      source: 'ScreenErrorBoundary',
      screen: this.props.screenName || 'unknown',
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoBack = () => {
    if (this.props.navigation?.canGoBack?.()) {
      this.setState({ hasError: false, error: null });
      this.props.navigation.goBack();
    } else {
      this.handleRetry();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <FallbackUI 
        errorMsg={this.state.error?.message}
        onRetry={this.handleRetry}
        onGoBack={this.props.navigation?.canGoBack?.() ? this.handleGoBack : undefined}
      />
    );
  }
}

/**
 * HOC that wraps a screen component with ScreenErrorBoundary.
 * @param {React.ComponentType} Component
 * @param {string} screenName — used in crash reports
 */
export function withScreenErrorBoundary(Component, screenName) {
  const Wrapped = (props) => (
    <ScreenErrorBoundary screenName={screenName} navigation={props.navigation}>
      <Component {...props} />
    </ScreenErrorBoundary>
  );
  Wrapped.displayName = `ScreenErrorBoundary(${screenName || Component.displayName || Component.name})`;
  return Wrapped;
}

const createStyles = (t, isDark) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: t.background,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.screen,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.xl,
    backgroundColor: t.background,
  },
  backgroundGlow: {
    position: 'absolute',
    top: 120,
    right: -72,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: withAlpha(t.primary, isDark ? 0.16 : 0.08),
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  eyebrowRow: {
    marginBottom: SPACING.sm,
  },
  eyebrow: {
    ...TYPOGRAPHY.caption,
    fontFamily: FONTS.body,
    color: t.primary,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 42,
    lineHeight: 48,
    color: t.text,
    letterSpacing: -0.8,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    fontFamily: FONTS.body,
    color: t.subtext,
    maxWidth: 520,
    marginBottom: SPACING.xl,
  },
  card: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: BORDER_RADIUS?.xl || 24,
    padding: SPACING.xl,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: isDark ? 0.32 : 0.08,
        shadowRadius: 24,
      },
      android: { elevation: 6 },
    }),
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(t.primary, 0.12),
    marginBottom: SPACING.lg,
  },
  cardTitle: {
    fontFamily: FONTS.body,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: t.text,
    letterSpacing: -0.4,
    marginBottom: SPACING.sm,
  },
  cardBody: {
    ...TYPOGRAPHY.bodySecondary,
    fontFamily: FONTS.body,
    color: t.subtext,
  },
  errorPanel: {
    marginTop: SPACING.lg,
    borderRadius: BORDER_RADIUS?.lg || 18,
    padding: SPACING.md,
    backgroundColor: t.surfaceSecondary,
    borderWidth: 1,
    borderColor: withAlpha(t.primary, 0.18),
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  errorText: {
    flex: 1,
    fontFamily: FONTS.mono,
    fontSize: 12,
    lineHeight: 18,
    color: t.subtext,
  },
  actionsContainer: {
    paddingTop: SPACING.lg,
    gap: SPACING.md,
  },
  primaryButton: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.primary,
    ...Platform.select({
      ios: {
        shadowColor: t.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 16,
      },
      android: { elevation: 5 },
    }),
  },
  primaryButtonText: {
    fontFamily: FONTS.body,
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  secondaryButton: {
    alignSelf: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  secondaryButtonText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    fontWeight: '700',
    color: t.subtext,
    textDecorationLine: 'underline',
  },
});

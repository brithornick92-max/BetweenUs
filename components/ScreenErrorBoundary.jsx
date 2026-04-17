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
  Dimensions,
  SafeAreaView,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import CrashReporting from '../services/CrashReporting';

const { width } = Dimensions.get('window');

// Premium Color Palette
const COLORS = {
  midnightSlate: '#0B0D12',
  coral: '#E56B55',
  coralMuted: 'rgba(229, 107, 85, 0.1)',
  coralBorder: 'rgba(229, 107, 85, 0.2)',
  white: '#FFFFFF',
  taupe: '#9A928D',
  glassBg: 'rgba(255, 255, 255, 0.03)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
};

const FONTS = {
  serif: Platform.select({
    ios: 'DMSerifDisplay-Regular',
    android: 'DMSerifDisplay_400Regular',
    default: 'serif',
  }),
  body: Platform.select({
    ios: 'Lato-Regular',
    android: 'Lato_400Regular',
    default: 'sans-serif',
  }),
  bodyBold: Platform.select({
    ios: 'Lato-Bold',
    android: 'Lato_700Bold',
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
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        {/* Subtle Background Glow */}
        <Animated.View 
          entering={FadeIn.duration(1000)}
          style={styles.backgroundGlow} 
          pointerEvents="none"
        />

        <View style={styles.content}>
          {/* Glassmorphic Icon */}
          <Animated.View entering={FadeInDown.duration(600).springify().damping(20)}>
            <BlurView intensity={40} tint="dark" style={styles.iconContainer}>
              <View style={styles.iconInner}>
                <Ionicons name="leaf-outline" size={32} color={COLORS.taupe} />
              </View>
            </BlurView>
          </Animated.View>

          {/* Typography */}
          <Animated.View entering={FadeInDown.delay(100).duration(600).springify().damping(20)} style={styles.textContainer}>
            <Text style={styles.title}>Something didn't load</Text>
            <Text style={styles.subtitle}>
              This part of the app hit a snag. Your data is safe.
            </Text>
          </Animated.View>

          {/* Error Details Panel (Visible in DEV) */}
          {__DEV__ && errorMsg ? (
            <Animated.View entering={FadeInDown.delay(200).duration(600).springify().damping(20)} style={styles.errorWrapper}>
              <BlurView intensity={20} tint="dark" style={styles.errorGlass}>
                <View style={styles.errorInner}>
                  <Ionicons name="terminal-outline" size={14} color={COLORS.coral} style={styles.terminalIcon} />
                  <Text style={styles.errorText} numberOfLines={3} ellipsizeMode="tail">
                    {errorMsg}
                  </Text>
                </View>
              </BlurView>
            </Animated.View>
          ) : null}
        </View>

        {/* Actions */}
        <Animated.View entering={FadeInDown.delay(300).duration(600).springify().damping(20)} style={styles.actionsContainer}>
          <TouchableOpacity 
            style={styles.primaryButton} 
            onPress={onRetry}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </TouchableOpacity>

          {onGoBack && (
            <TouchableOpacity 
              style={styles.secondaryButton} 
              onPress={onGoBack}
              activeOpacity={0.6}
            >
              <Text style={styles.secondaryButtonText}>Go back</Text>
            </TouchableOpacity>
          )}
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.midnightSlate,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingBottom: 40,
    paddingTop: 60,
  },
  backgroundGlow: {
    position: 'absolute',
    top: '30%',
    left: '10%',
    right: '10%',
    height: 300,
    backgroundColor: COLORS.coral,
    opacity: 0.05,
    // Note: React Native style filter requires a relatively modern version
    // If it throws a warning, this can be safely replaced with a static blurred PNG
    filter: [{ blur: 100 }], 
  },
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  iconContainer: {
    borderRadius: 100,
    overflow: 'hidden',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  iconInner: {
    padding: 20,
    backgroundColor: COLORS.glassBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 32,
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.taupe,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  errorWrapper: {
    width: '100%',
    maxWidth: 400,
  },
  errorGlass: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.coralBorder,
  },
  errorInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.coralMuted,
  },
  terminalIcon: {
    marginRight: 12,
    marginTop: 2,
    opacity: 0.8,
  },
  errorText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.taupe,
    flex: 1,
    lineHeight: 20,
  },
  actionsContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 24,
  },
  primaryButton: {
    backgroundColor: COLORS.coral,
    width: '100%',
    maxWidth: 400,
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  primaryButtonText: {
    fontFamily: FONTS.bodyBold,
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontFamily: FONTS.bodyBold,
    color: COLORS.taupe,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(154, 146, 141, 0.4)',
  },
});

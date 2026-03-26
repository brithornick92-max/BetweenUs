/**
 * ErrorBoundary — Production-grade recovery surface
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 * Catches unhandled JS errors and shows a premium recovery UI
 * instead of a white screen crash.
 */

import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  StatusBar, 
  Animated, 
  Easing, 
  Linking,
  Appearance,
  Platform
} from 'react-native';
import CrashReporting from '../services/CrashReporting';
import { SUPPORT_EMAIL } from '../config/constants';
import Icon from './Icon';
import { withAlpha } from '../utils/theme';

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.fadeAnim = new Animated.Value(0);
    this.scaleAnim = new Animated.Value(0.92);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Report to Sentry/Crashlytics
    CrashReporting.captureException(error, {
      componentStack: info?.componentStack,
      source: 'ErrorBoundary',
    });

    console.error('[ErrorBoundary] Uncaught error:', error?.message);

    // High-end Apple-style entrance
    Animated.parallel([
      Animated.timing(this.fadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.spring(this.scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }

  handleReset = () => {
    // Reset animations before state change
    Animated.timing(this.fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      if (this.props.onReset) {
        this.props.onReset();
      }
      this.setState({ hasError: false, error: null });
      this.scaleAnim.setValue(0.92);
    });
  };

  handleContactSupport = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=App%20Crash%20Report`)
      .catch((err) => console.warn('Could not open mail client:', err));
  };

  render() {
    // THEME — respects system color scheme since ErrorBoundary lives outside ThemeProvider
    const isDark = Appearance.getColorScheme() !== 'light';
    const t = isDark ? {
      background: '#070509',
      primary: '#D2121A',
      text: '#F2E9E6',
      subtext: 'rgba(242,233,230,0.55)',
      surface: 'rgba(255,255,255,0.04)',
      border: 'rgba(255,255,255,0.08)',
      barStyle: 'light-content',
    } : {
      background: '#FAF4EE',
      primary: '#D2121A',
      text: '#1C1019',
      subtext: 'rgba(28,16,25,0.55)',
      surface: 'rgba(0,0,0,0.04)',
      border: 'rgba(0,0,0,0.08)',
      barStyle: 'dark-content',
    };

    if (this.state.hasError) {
      return (
        <SafeAreaView style={[styles.container, { backgroundColor: t.background }]} accessibilityRole="alert">
          <StatusBar barStyle={t.barStyle} />
          
          <Animated.View 
            style={[
              styles.content, 
              { 
                opacity: this.fadeAnim,
                transform: [{ scale: this.scaleAnim }]
              }
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: withAlpha(t.primary, 0.12) }]}>
              <Icon name="bandage-outline" size={42} color={t.primary} />
            </View>

            <Text style={[styles.title, { color: t.text }]}>Something went wrong</Text>
            
            <Text style={[styles.subtitle, { color: t.subtext }]}>
              We hit a snag, but don't worry—your data and connection are safe.
            </Text>

            {__DEV__ && this.state.error?.message ? (
              <View style={[styles.devErrorContainer, { backgroundColor: t.surface, borderColor: t.border }]}>
                <Text style={[styles.devError, { color: t.subtext }]} numberOfLines={4}>
                  {this.state.error.message}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: t.primary }]}
              onPress={this.handleReset}
              activeOpacity={0.9}
            >
              <Text style={styles.buttonText}>Try Again</Text>
              <Icon name="refresh-outline" size={16} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.tertiaryButton}
              onPress={this.handleContactSupport}
            >
              <Text style={[styles.tertiaryButtonText, { color: t.subtext }]}>Need help?</Text>
            </TouchableOpacity>

            <View style={[styles.indicator, { backgroundColor: t.primary }]} />
          </Animated.View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 40,
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    fontFamily: SYSTEM_FONT,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  devErrorContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    borderWidth: 1,
  },
  devError: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 28, // High-end pill
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 220,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#D2121A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
      },
      android: { elevation: 4 },
    }),
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    textTransform: 'uppercase',
  },
  tertiaryButton: {
    marginTop: 32,
    padding: 12,
  },
  tertiaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  indicator: {
    marginTop: 40,
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.4,
  }
});

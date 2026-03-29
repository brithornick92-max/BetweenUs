/**
 * ScreenErrorBoundary — Per-screen error isolation
 *
 * Wraps individual screens so a crash in one screen doesn't take down
 * the entire navigation tree. Unlike the root ErrorBoundary, this
 * component shows an inline recovery surface and provides a
 * "Go back" escape hatch via the optional `onGoBack` prop.
 *
 * Usage in Navigator:
 *   <Stack.Screen name="HomeScreen">
 *     {(props) => (
 *       <ScreenErrorBoundary screenName="Home" navigation={props.navigation}>
 *         <HomeScreen {...props} />
 *       </ScreenErrorBoundary>
 *     )}
 *   </Stack.Screen>
 *
 * Or wrap with the provided `withScreenErrorBoundary` HOC:
 *   export default withScreenErrorBoundary(HomeScreen, 'Home');
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Appearance,
} from 'react-native';
import CrashReporting from '../services/CrashReporting';

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

    const isDark = Appearance.getColorScheme() !== 'light';
    const colors = {
      background: isDark ? '#0D0A0E' : '#FAF4EE',
      text: isDark ? '#F2E9E6' : '#1C1019',
      subtext: isDark ? 'rgba(242,233,230,0.5)' : 'rgba(28,16,25,0.5)',
      accent: '#D2121A',
      surface: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    };

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.emoji]}>🌿</Text>
        <Text style={[styles.title, { color: colors.text }]}>
          Something didn't load
        </Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>
          This part of the app hit a snag. Your data is safe.
        </Text>

        {__DEV__ && this.state.error?.message ? (
          <View style={[styles.devBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.devText, { color: colors.subtext }]} numberOfLines={3}>
              {this.state.error.message}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.accent }]}
          onPress={this.handleRetry}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={this.handleGoBack}
          activeOpacity={0.7}
        >
          <Text style={[styles.backText, { color: colors.subtext }]}>Go back</Text>
        </TouchableOpacity>
      </View>
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

const FONT = Platform.select({ ios: 'System', android: 'Roboto' });

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 24,
  },
  title: {
    fontFamily: FONT,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  devBox: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    width: '100%',
  },
  devText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  button: {
    height: 52,
    borderRadius: 26,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 180,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  backButton: {
    marginTop: 20,
    padding: 10,
  },
  backText: {
    fontSize: 15,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});

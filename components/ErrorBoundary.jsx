// components/ErrorBoundary.jsx — Production-grade React error boundary
// Catches unhandled JS errors in the component tree and shows a recovery UI
// instead of a white screen crash.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import CrashReporting from '../services/CrashReporting';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Report to Sentry (no-op if not installed/configured)
    CrashReporting.captureException(error, {
      componentStack: info?.componentStack,
      source: 'ErrorBoundary',
    });
    console.error('[ErrorBoundary] Uncaught error:', error?.message);
    if (__DEV__) {
      console.error('[ErrorBoundary] Component stack:', info?.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container} accessibilityRole="alert">
          <View style={styles.content}>
            <Text style={styles.emoji} accessibilityElementsHidden>💔</Text>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.subtitle}>
              We hit an unexpected issue. Your data is safe.
            </Text>
            {__DEV__ && this.state.error?.message ? (
              <Text style={styles.devError} numberOfLines={4}>
                {this.state.error.message}
              </Text>
            ) : null}
            <TouchableOpacity
              style={styles.button}
              onPress={this.handleReset}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070509',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    color: '#E8E0EC',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#A09AA6',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  devError: {
    color: '#FF6B6B',
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  button: {
    backgroundColor: '#A89060',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  buttonText: {
    color: '#0B0B0B',
    fontSize: 16,
    fontWeight: '700',
  },
});

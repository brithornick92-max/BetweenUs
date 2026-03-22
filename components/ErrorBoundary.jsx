// components/ErrorBoundary.jsx — Production-grade React error boundary
// Catches unhandled JS errors in the component tree and shows a recovery UI
// instead of a white screen crash.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, Animated, Easing, Linking } from 'react-native';
import CrashReporting from '../services/CrashReporting';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.fadeAnim = new Animated.Value(0);
    this.scaleAnim = new Animated.Value(0.95);
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

    // Trigger smooth fade-in
    Animated.parallel([
      Animated.timing(this.fadeAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(this.scaleAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
    ]).start();
  }

  handleReset = () => {
    this.fadeAnim.setValue(0);
    this.scaleAnim.setValue(0.95);
    
    // Optional: Allow the parent app to clear out bad data/state before re-rendering
    if (this.props.onReset) {
      this.props.onReset();
    }
    
    this.setState({ hasError: false, error: null });
  };

  handleContactSupport = () => {
    Linking.openURL('mailto:support@betweenus.app?subject=App%20Crash%20Report')
      .catch((err) => {
        console.warn('Could not open mail client:', err);
        // Fallback or silently fail if user has no mail app installed
      });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container} accessibilityRole="alert">
          <StatusBar barStyle="light-content" backgroundColor="#070509" />
          <Animated.View 
            style={[
              styles.content, 
              { 
                opacity: this.fadeAnim,
                transform: [{ scale: this.scaleAnim }]
              }
            ]}
          >
            <Text style={styles.emoji} accessibilityElementsHidden>🩹</Text>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.subtitle}>
              We hit a snag, but don't worry—your data is safe.
            </Text>
            {__DEV__ && this.state.error?.message ? (
              <View style={styles.devErrorContainer}>
                <Text style={styles.devError} numberOfLines={4}>
                  {this.state.error.message}
                </Text>
              </View>
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

            <TouchableOpacity 
              style={styles.tertiaryButton}
              onPress={this.handleContactSupport}
              accessibilityRole="button"
              accessibilityLabel="Contact Support"
            >
              <Text style={styles.tertiaryButtonText}>Need help?</Text>
            </TouchableOpacity>
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
    backgroundColor: '#070509',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    marginTop: -40, // Optical centering (pushes content slightly above true-center)
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    color: '#F2E9E6',
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  subtitle: {
    color: 'rgba(242,233,230,0.58)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  devErrorContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  devError: {
    color: 'rgba(242,233,230,0.7)',
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#7A1E4E',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: '#F2E9E6',
    fontSize: 16,
    fontWeight: '600',
  },
  tertiaryButton: {
    marginTop: 24,
    padding: 12,
  },
  tertiaryButtonText: {
    color: 'rgba(242,233,230,0.4)',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  }
});

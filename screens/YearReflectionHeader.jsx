// screens/YearReflectionHeader.jsx — Premium Narrative Header
// Flawless Apple Editorial & Sexy Red (#D2121A) Intimacy Integration.
// High-end, unabridged code for the narrative reading view.

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Icon from '../components/Icon';
import { useTheme } from '../context/ThemeContext';
import { SPACING, withAlpha } from '../utils/theme';
import FilmGrain from '../components/FilmGrain';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });
const SERIF_FONT = Platform.select({ ios: "Georgia", android: "serif" });

// ─── THE SEXY RED PALETTE (#D2121A) ───
const PALETTE = {
  sexyRed: '#D2121A', // Sexy Red
  neutral: '#1D1D1F', // Apple Black
  offWhite: '#FBFBFD', // Apple Paper
  lightGray: 'rgba(60, 60, 67, 0.6)', // Apple Subtext
};

/**
 * YearReflectionHeader
 * Flawless Glass Header with Sexy Red & Light Gray Progress.
 */
export default function YearReflectionHeader({ 
  navigation, 
  title, 
  progress, // Animated.Value (0-1)
  handleShare 
}) {
  const { isDark } = useTheme();

  // ─── APPLE EDITORIAL x SEXY RED THEME MAP ───
  const t = useMemo(() => ({
    background: isDark ? '#1D1D1F' : '#F5F5F7', 
    surface: isDark ? 'rgba(44, 44, 46, 0.85)' : '#FFFFFF',
    primary: PALETTE.sexyRed,
    text: isDark ? '#FFFFFF' : '#1D1D1F',
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : PALETTE.lightGray,
    borderGlass: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.05)',
  }), [isDark]);

  // Interpolate progress value for bar width
  const progressBarWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_WIDTH - 40], // Accounts for horizontal padding
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.headerWrapper}>
      <BlurView 
        intensity={isDark ? 50 : 90} 
        tint={isDark ? "dark" : "light"} 
        style={[styles.headerBlur, { borderBottomColor: t.borderGlass }]}
      >
        {/* Optional: Add FilmGrain for high-end texture */}
        <FilmGrain opacity={0.3} />

        <SafeAreaView edges={['top']} style={styles.safe}>
          <View style={styles.container}>
            {/* Back Button */}
            <TouchableOpacity 
              onPress={() => navigation?.goBack()} 
              style={[styles.circleBtn, { backgroundColor: t.surface, borderColor: t.borderGlass }]} 
              activeOpacity={0.8}
            >
              <Icon name="chevron-back" size={24} color={t.text} />
            </TouchableOpacity>

            {/* Editorial Title & Subtitle */}
            <View style={styles.titleWrap}>
              <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
                {title || 'Our Year Together'}
              </Text>
              <Text style={[styles.subtitle, { color: t.primary }]}>PRIVATE STORY</Text>
            </View>

            {/* Share Button (If needed) */}
            {handleShare ? (
              <TouchableOpacity 
                onPress={handleShare} 
                style={[styles.circleBtn, { backgroundColor: t.surface, borderColor: t.borderGlass }]} 
                activeOpacity={0.8}
              >
                <Icon name="share-outline" size={22} color={t.text} />
              </TouchableOpacity>
            ) : (
              // Empty View to maintain flex spacing
              <View style={styles.circleBtnSpacer} />
            )}
          </View>

          {/* ─── PROGRESS SECTION (Sexy Red & Light Gray) ─── */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBase, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
              <Animated.View 
                style={[styles.progressBar, { backgroundColor: t.primary, width: progressBarWidth }]} 
              />
            </View>
          </View>
        </SafeAreaView>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  headerBlur: {
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  safe: {
    paddingBottom: SPACING.md,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    height: 60,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
      android: { elevation: 2 },
    }),
  },
  circleBtnSpacer: {
    width: 44,
    height: 44,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  title: {
    fontFamily: SERIF_FONT,
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 1,
  },
  subtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  // Progress Bar Styles
  progressContainer: {
    paddingHorizontal: 20,
    marginTop: 10,
    alignItems: 'center',
  },
  progressBase: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
});

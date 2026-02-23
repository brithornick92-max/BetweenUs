// screens/VibeSignalScreen.js
import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Text,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import VibeSignal from '../components/VibeSignal';
import { useAppContext } from '../context/AppContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useTheme } from '../context/ThemeContext';
import { SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../utils/theme';
import { vibeStorage } from '../utils/storage';

const VibeSignalScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { state } = useAppContext();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  
  // Animation values
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(50)).current;
  const glowAnimation = useRef(new Animated.Value(0)).current;

  // Real vibe history for the chart
  const [weeklyData, setWeeklyData] = useState(null);

  // Map vibe types to intensity scores for chart display
  const VIBE_INTENSITY = {
    passionate: 90, adventurous: 80, luxurious: 70,
    mysterious: 60, tender: 50, serene: 30,
  };

  useEffect(() => {
    // Load real vibe history for chart
    vibeStorage.getRecentVibes(7).then(vibes => {
      if (!vibes || vibes.length === 0) { setWeeklyData(null); return; }
      // Bucket vibes by day-of-week (0=Sun..6=Sat)
      const buckets = [[], [], [], [], [], [], []];
      for (const v of vibes) {
        const dow = new Date(v.timestamp).getDay();
        const vibeId = v.vibe?.id || v.vibe?.name?.toLowerCase() || '';
        buckets[dow].push(VIBE_INTENSITY[vibeId] ?? 50);
      }
      // Order Mon–Sun, average each day
      const orderedDays = [1, 2, 3, 4, 5, 6, 0]; // Mon first
      const data = orderedDays.map(d => {
        if (buckets[d].length === 0) return 0;
        return Math.round(buckets[d].reduce((a, b) => a + b, 0) / buckets[d].length);
      });
      setWeeklyData(data);
    }).catch(() => setWeeklyData(null));
  }, []);

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // Glow animation
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnimation, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    glowLoop.start();
    return () => glowLoop.stop();
  }, []);

  const handleVibeChange = async (vibe, isAnniversaryVibe) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (__DEV__) console.log('Vibe changed:', vibe.name, isAnniversaryVibe ? '(Anniversary Theme)' : '');
  };

  const handleBackPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const renderHeader = () => (
    <Animated.View 
      style={[
        styles.header,
        {
          opacity: fadeAnimation,
          transform: [{ translateY: slideAnimation }],
        },
      ]}
    >
      <TouchableOpacity
        onPress={handleBackPress}
        style={styles.backButton}
        activeOpacity={0.8}
      >
        <BlurView intensity={20} style={styles.backButtonBlur}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </BlurView>
      </TouchableOpacity>

      <View style={styles.headerContent}>
        <Animated.View
          style={[
            styles.headerGlow,
            {
              opacity: glowAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.8],
              }),
            },
          ]}
        />
        <Text style={styles.headerTitle}>Vibe Signal</Text>
        <Text style={styles.headerSubtitle}>
          Share your current mood and connect with your partner's energy
        </Text>
        
        {isPremium && (
          <View style={styles.premiumBadge}>
            <BlurView intensity={15} style={styles.premiumBadgeBlur}>
              <LinearGradient
                colors={[colors.accent, colors.accent]}
                style={styles.premiumBadgeGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <MaterialCommunityIcons name="crown" size={14} color={colors.background} />
                <Text style={styles.premiumBadgeText}>PREMIUM FEATURE</Text>
              </LinearGradient>
            </BlurView>
          </View>
        )}
      </View>
    </Animated.View>
  );

  const renderConnectionStatus = () => {
    const partnerLabel = state.partnerLabel || "Partner";
    
    return (
      <Animated.View 
        style={[
          styles.connectionStatus,
          {
            opacity: fadeAnimation,
            transform: [{ translateY: slideAnimation }],
          },
        ]}
      >
        <BlurView intensity={15} style={styles.connectionCard}>
          <LinearGradient
            colors={['#151118', '#151118']}
            style={StyleSheet.absoluteFill}
          />
          
          <View style={styles.connectionHeader}>
            <MaterialCommunityIcons name="heart-pulse" size={20} color={colors.primary} />
            <Text style={styles.connectionTitle}>Connection Status</Text>
          </View>
          
          <View style={styles.connectionIndicators}>
            <View style={styles.connectionIndicator}>
              <View style={[styles.connectionDot, { backgroundColor: colors.success }]} />
              <Text style={styles.connectionLabel}>You</Text>
            </View>
            
            <View style={styles.connectionLine} />
            
            <View style={styles.connectionIndicator}>
              <View style={[styles.connectionDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.connectionLabel}>{partnerLabel}</Text>
            </View>
          </View>
          
          <Text style={styles.connectionDescription}>
            Your vibes are synchronized in real-time
          </Text>
        </BlurView>
      </Animated.View>
    );
  };

  const renderVibeHistory = () => {
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const hasData = weeklyData && weeklyData.some(v => v > 0);

    return (
    <Animated.View 
      style={[
        styles.historySection,
        {
          opacity: fadeAnimation,
          transform: [{ translateY: slideAnimation }],
        },
      ]}
    >
      <Text style={[styles.historyTitle, { color: colors.text }]}>Energy Flow</Text>
      <Text style={[styles.historySubtitle, { color: colors.textMuted }]}>
        Your rhythm together this week
      </Text>
      
      <BlurView intensity={10} tint={isDark ? "dark" : "light"} style={styles.historyCard}>
        {hasData ? (
        <View style={styles.chartContainer}>
           {weeklyData.map((value, index) => (
             <View key={index} style={styles.chartColumn}>
               <View style={styles.chartBarTrack}>
                 <Animated.View 
                   style={[
                     styles.chartBarFill, 
                     { 
                       height: `${value}%`,
                       backgroundColor: value > 70 ? colors.primary : colors.textMuted 
                     }
                   ]} 
                 />
               </View>
               <Text style={[styles.chartDayLabel, { color: colors.textMuted }]}>{days[index]}</Text>
             </View>
           ))}
        </View>
        ) : (
        <View style={styles.chartEmptyState}>
          <MaterialCommunityIcons name="heart-pulse" size={28} color={colors.textMuted} />
          <Text style={[styles.chartEmptyText, { color: colors.textMuted }]}>
            Start sending vibes to see your rhythm
          </Text>
        </View>
        )}
      </BlurView>

      {/* Ghost Pulse Button */}
      <TouchableOpacity 
        style={[styles.ghostPulseButton, { borderColor: colors.primary + '40' }]}
        onPress={async () => {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          // In real app: send push notification
        }}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="broadcast" size={20} color={colors.primary} />
        <Text style={[styles.ghostPulseText, { color: colors.primary }]}>Send Heartbeat Signal</Text>
      </TouchableOpacity>
    </Animated.View>
    );
  };

  if (!isPremium) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={[colors.background, colors.surface2 + '80', colors.background]}
          style={StyleSheet.absoluteFill}
          locations={[0, 0.5, 1]}
        />
        
        <View style={styles.paywallContainer}>
          <TouchableOpacity
            onPress={handleBackPress}
            style={styles.backButton}
            activeOpacity={0.8}
          >
            <BlurView intensity={20} style={styles.backButtonBlur}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
            </BlurView>
          </TouchableOpacity>
          
          <View style={styles.paywallContent}>
            <MaterialCommunityIcons name="heart-pulse" size={64} color={colors.primary} />
            <Text style={styles.paywallTitle}>Vibe Signal</Text>
            <Text style={styles.paywallDescription}>
              Share your emotional state in real-time and feel your partner's energy through beautiful, synchronized mood signals.
            </Text>
            
            <TouchableOpacity
              onPress={showPaywall}
              style={styles.upgradeButton}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[colors.accent, colors.accent]}
                style={styles.upgradeButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <MaterialCommunityIcons name="crown" size={20} color={colors.background} />
                <Text style={[styles.upgradeButtonText, { color: '#FFFFFF' }]}>Upgrade to Premium</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[colors.background, colors.surface2 + '80', colors.background]}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.5, 1]}
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderHeader()}
        {renderConnectionStatus()}
        
        <Animated.View
          style={[
            styles.vibeSignalContainer,
            {
              opacity: fadeAnimation,
              transform: [{ translateY: slideAnimation }],
            },
          ]}
        >
          <VibeSignal 
            onVibeChange={handleVibeChange}
            showPartnerVibe={true}
          />
        </Animated.View>
        
        {renderVibeHistory()}
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  
  scrollView: {
    flex: 1,
  },
  
  scrollContent: {
    paddingBottom: SPACING.xl,
  },
  
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    position: 'relative',
  },
  
  backButton: {
    position: 'absolute',
    top: SPACING.xxl,
    left: SPACING.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    zIndex: 10,
  },
  
  backButtonBlur: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  
  headerContent: {
    alignItems: 'center',
    paddingTop: SPACING.xl,
    position: 'relative',
  },
  
  headerGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.primary,
  },
  
  headerTitle: {
    ...TYPOGRAPHY.display,
    color: colors.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
    fontFamily: Platform.select({
      ios: "PlayfairDisplay_700Bold",
      android: "PlayfairDisplay_700Bold",
    }),
  },
  
  headerSubtitle: {
    ...TYPOGRAPHY.body,
    color: colors.text + 'CC',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: SPACING.lg,
  },
  
  premiumBadge: {
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  
  premiumBadgeBlur: {
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  
  premiumBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: 6,
  },
  
  premiumBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.background,
  },
  
  connectionStatus: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  
  connectionCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#151118',
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },
  
  connectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  
  connectionTitle: {
    ...TYPOGRAPHY.h2,
    color: colors.text,
    marginLeft: SPACING.sm,
    fontSize: 18,
  },
  
  connectionIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  
  connectionIndicator: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  
  connectionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  
  connectionLabel: {
    ...TYPOGRAPHY.caption,
    color: colors.text + 'CC',
    fontSize: 12,
  },
  
  connectionLine: {
    width: 60,
    height: 2,
    backgroundColor: colors.primary + '40',
    marginHorizontal: SPACING.lg,
  },
  
  connectionDescription: {
    ...TYPOGRAPHY.body,
    color: colors.text + '99',
    textAlign: 'center',
    fontSize: 14,
  },
  
  vibeSignalContainer: {
    marginTop: -SPACING.xl,
    marginBottom: SPACING.xl,
  },
  
  historySection: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  
  historyTitle: {
    ...TYPOGRAPHY.h1,
    color: colors.text,
    marginBottom: SPACING.xs,
    textAlign: 'center',
    fontFamily: Platform.select({
      ios: "PlayfairDisplay_700Bold",
      android: "PlayfairDisplay_700Bold",
    }),
  },
  
  historySubtitle: {
    ...TYPOGRAPHY.body,
    color: colors.text + 'CC',
    marginBottom: SPACING.lg,
    lineHeight: 22,
    textAlign: 'center',
  },
  
  historyCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 140,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
    }),
  },
  
  historyPlaceholder: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  
  historyPlaceholderText: {
    ...TYPOGRAPHY.body,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  
  // Paywall styles
  paywallContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  
  paywallContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  
  paywallTitle: {
    ...TYPOGRAPHY.display,
    color: colors.text,
    textAlign: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
    fontFamily: Platform.select({
      ios: "PlayfairDisplay_700Bold",
      android: "PlayfairDisplay_700Bold",
    }),
  },
  
  paywallDescription: {
    ...TYPOGRAPHY.body,
    color: colors.text + 'CC',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: SPACING.xl,
  },
  
  upgradeButton: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  
  upgradeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  
  upgradeButtonText: {
    ...TYPOGRAPHY.button,
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },

  // Chart
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 150,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  chartColumn: {
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  chartBarTrack: {
    width: 6,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 3,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: {
    width: '100%',
    borderRadius: 3,
  },
  chartDayLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  chartEmptyState: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: SPACING.lg,
  },
  chartEmptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  ghostPulseButton: {
    marginTop: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  ghostPulseText: {
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.5,
  },
});


export default VibeSignalScreen;
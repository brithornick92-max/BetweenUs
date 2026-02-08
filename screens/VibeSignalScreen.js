// screens/VibeSignalScreen.js
import React, { useRef, useEffect } from 'react';
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
import { usePremiumFeatures } from '../hooks/usePremiumFeatures';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../utils/theme';

const VibeSignalScreen = ({ navigation }) => {
  const { state } = useAppContext();
  const { isPremium, showPaywall } = usePremiumFeatures();
  
  // Animation values
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(50)).current;
  const glowAnimation = useRef(new Animated.Value(0)).current;

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
    Animated.loop(
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
    ).start();
  }, []);

  const handleVibeChange = async (vibe, isAnniversaryVibe) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    console.log('Vibe changed:', vibe.name, isAnniversaryVibe ? '(Anniversary Theme)' : '');
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
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.softCream} />
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
                colors={[COLORS.mutedGold, COLORS.champagneGold]}
                style={styles.premiumBadgeGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <MaterialCommunityIcons name="crown" size={14} color={COLORS.obsidian} />
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
            colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
            style={StyleSheet.absoluteFill}
          />
          
          <View style={styles.connectionHeader}>
            <MaterialCommunityIcons name="heart-pulse" size={20} color={COLORS.blushRose} />
            <Text style={styles.connectionTitle}>Connection Status</Text>
          </View>
          
          <View style={styles.connectionIndicators}>
            <View style={styles.connectionIndicator}>
              <View style={[styles.connectionDot, { backgroundColor: COLORS.success }]} />
              <Text style={styles.connectionLabel}>You</Text>
            </View>
            
            <View style={styles.connectionLine} />
            
            <View style={styles.connectionIndicator}>
              <View style={[styles.connectionDot, { backgroundColor: COLORS.blushRose }]} />
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

  const renderVibeHistory = () => (
    <Animated.View 
      style={[
        styles.historySection,
        {
          opacity: fadeAnimation,
          transform: [{ translateY: slideAnimation }],
        },
      ]}
    >
      <Text style={styles.historyTitle}>Recent Vibes</Text>
      <Text style={styles.historySubtitle}>
        Your emotional journey together over the past week
      </Text>
      
      <BlurView intensity={10} style={styles.historyCard}>
        <LinearGradient
          colors={['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)']}
          style={StyleSheet.absoluteFill}
        />
        
        <View style={styles.historyPlaceholder}>
          <MaterialCommunityIcons name="chart-line" size={32} color={COLORS.mutedGold + '60'} />
          <Text style={styles.historyPlaceholderText}>
            Vibe history will appear here as you and your partner share your moods
          </Text>
        </View>
      </BlurView>
    </Animated.View>
  );

  if (!isPremium) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={[COLORS.warmCharcoal, COLORS.deepPlum + '80', COLORS.warmCharcoal]}
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
              <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.softCream} />
            </BlurView>
          </TouchableOpacity>
          
          <View style={styles.paywallContent}>
            <MaterialCommunityIcons name="heart-pulse" size={64} color={COLORS.blushRose} />
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
                colors={[COLORS.mutedGold, COLORS.champagneGold]}
                style={styles.upgradeButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <MaterialCommunityIcons name="crown" size={20} color={COLORS.obsidian} />
                <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
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
        colors={[COLORS.warmCharcoal, COLORS.deepPlum + '80', COLORS.warmCharcoal]}
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

const styles = StyleSheet.create({
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
    top: SPACING.xl, // Changed from SPACING.lg to move it down
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
    backgroundColor: COLORS.blushRose,
  },
  
  headerTitle: {
    ...TYPOGRAPHY.display,
    color: COLORS.softCream,
    textAlign: 'center',
    marginBottom: SPACING.sm,
    fontFamily: Platform.select({
      ios: "PlayfairDisplay-Bold",
      android: "PlayfairDisplay_700Bold",
    }),
  },
  
  headerSubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.softCream + 'CC',
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
    fontWeight: '800',
    letterSpacing: 0.5,
    color: COLORS.obsidian,
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
    borderColor: 'rgba(255,255,255,0.1)',
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
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
    color: COLORS.softCream,
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
    color: COLORS.softCream + 'CC',
    fontSize: 12,
  },
  
  connectionLine: {
    width: 60,
    height: 2,
    backgroundColor: COLORS.blushRose + '40',
    marginHorizontal: SPACING.lg,
  },
  
  connectionDescription: {
    ...TYPOGRAPHY.body,
    color: COLORS.softCream + '99',
    textAlign: 'center',
    fontSize: 14,
    fontStyle: 'italic',
  },
  
  vibeSignalContainer: {
    marginBottom: SPACING.xl,
  },
  
  historySection: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  
  historyTitle: {
    ...TYPOGRAPHY.h1,
    color: COLORS.softCream,
    marginBottom: SPACING.xs,
    fontFamily: Platform.select({
      ios: "PlayfairDisplay-Bold",
      android: "PlayfairDisplay_700Bold",
    }),
  },
  
  historySubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.softCream + 'CC',
    marginBottom: SPACING.lg,
    lineHeight: 22,
  },
  
  historyCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  historyPlaceholder: {
    alignItems: 'center',
    gap: SPACING.md,
  },
  
  historyPlaceholderText: {
    ...TYPOGRAPHY.body,
    color: COLORS.softCream + '80',
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
    color: COLORS.softCream,
    textAlign: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
    fontFamily: Platform.select({
      ios: "PlayfairDisplay-Bold",
      android: "PlayfairDisplay_700Bold",
    }),
  },
  
  paywallDescription: {
    ...TYPOGRAPHY.body,
    color: COLORS.softCream + 'CC',
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
    color: COLORS.obsidian,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default VibeSignalScreen;
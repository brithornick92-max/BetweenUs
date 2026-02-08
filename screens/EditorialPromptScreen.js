// screens/EditorialPromptScreen.js
import React, { useRef, useEffect } from 'react';
import {
  View,
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
import EditorialPrompt from '../components/EditorialPrompt';
import { useAppContext } from '../context/AppContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../utils/theme';

const EditorialPromptScreen = ({ route, navigation }) => {
  const { promptId, category } = route?.params || {};
  const { state } = useAppContext();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  
  // Animation values
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(50)).current;
  const shimmerAnimation = useRef(new Animated.Value(0)).current;

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

    // Shimmer animation for premium elements
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnimation, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleAnswerSubmit = async (prompt, answer) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (__DEV__) {
      console.log('Answer submitted');
    }
  };

  const handlePartnerAnswerRevealed = async (prompt, partnerAnswer) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (__DEV__) {
      console.log('Partner answer revealed');
    }
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
            styles.headerShimmer,
            {
              opacity: shimmerAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.8],
              }),
            },
          ]}
        />
        
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name="feather" size={32} color="#9B59B6" />
        </View>
        
        <Text style={styles.headerTitle}>
          {category === 'daily_life' ? 'Daily Reflection' : 'Editorial Prompts'}
        </Text>
        <Text style={styles.headerSubtitle}>
          {category === 'daily_life' 
            ? 'Share about your day and connect through daily moments'
            : 'Thoughtful questions designed to deepen your connection through meaningful reflection'
          }
        </Text>
        
        {isPremium && (
          <View style={styles.premiumBadge}>
            <BlurView intensity={15} style={styles.premiumBadgeBlur}>
              <LinearGradient
                colors={['#D4AF37', '#F7E7CE']}
                style={styles.premiumBadgeGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <MaterialCommunityIcons name="crown" size={14} color="#0B0B0B" />
                <Text style={styles.premiumBadgeText}>PREMIUM FEATURE</Text>
              </LinearGradient>
            </BlurView>
          </View>
        )}
      </View>
    </Animated.View>
  );

  const renderCategoryInfo = () => {
    const categoryInfo = {
      reflection: {
        icon: 'mirror',
        name: 'Reflection',
        description: 'Deep questions about your inner world and experiences',
        color: '#3498DB',
      },
      connection: {
        icon: 'heart-multiple',
        name: 'Connection',
        description: 'Prompts to strengthen your bond and understanding',
        color: '#E74C3C',
      },
      growth: {
        icon: 'trending-up',
        name: 'Growth',
        description: 'Questions about personal development and aspirations',
        color: '#2ECC71',
      },
      intimacy: {
        icon: 'heart-pulse',
        name: 'Intimacy',
        description: 'Vulnerable prompts for deeper emotional connection',
        color: '#9B59B6',
      },
      dreams: {
        icon: 'star-outline',
        name: 'Dreams',
        description: 'Explore your hopes, dreams, and future together',
        color: '#F39C12',
      },
    };

    const info = categoryInfo[category] || categoryInfo.reflection;
    
    return (
      <Animated.View 
        style={[
          styles.categoryInfo,
          {
            opacity: fadeAnimation,
            transform: [{ translateY: slideAnimation }],
          },
        ]}
      >
        <BlurView intensity={15} style={styles.categoryCard}>
          <LinearGradient
            colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
            style={StyleSheet.absoluteFill}
          />
          
          <View style={styles.categoryHeader}>
            <View style={[styles.categoryIconContainer, { backgroundColor: info.color + '20' }]}>
              <MaterialCommunityIcons name={info.icon} size={24} color={info.color} />
            </View>
            <View style={styles.categoryTextContainer}>
              <Text style={styles.categoryName}>{info.name}</Text>
              <Text style={styles.categoryDescription}>{info.description}</Text>
            </View>
          </View>
        </BlurView>
      </Animated.View>
    );
  };

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
            <MaterialCommunityIcons 
              name={category === 'daily_life' ? "calendar-heart" : "feather"} 
              size={64} 
              color={category === 'daily_life' ? "#F4A461" : "#9B59B6"} 
            />
            <Text style={styles.paywallTitle}>
              {category === 'daily_life' ? 'Daily Reflection' : 'Editorial Prompts'}
            </Text>
            <Text style={styles.paywallDescription}>
              {category === 'daily_life' 
                ? 'Connect with your partner by sharing daily moments, thoughts, and feelings. Build intimacy through everyday conversations and mutual understanding.'
                : 'Discover thoughtfully crafted questions designed to spark meaningful conversations and deepen your emotional connection. Each prompt is carefully curated to help you explore new dimensions of your relationship.'
              }
            </Text>
            
            <View style={styles.paywallFeatures}>
              <View style={styles.paywallFeature}>
                <MaterialCommunityIcons name="check-circle" size={20} color="#2ECC71" />
                <Text style={styles.paywallFeatureText}>5 unique categories of prompts</Text>
              </View>
              <View style={styles.paywallFeature}>
                <MaterialCommunityIcons name="check-circle" size={20} color="#2ECC71" />
                <Text style={styles.paywallFeatureText}>Privacy-first answer sharing</Text>
              </View>
              <View style={styles.paywallFeature}>
                <MaterialCommunityIcons name="check-circle" size={20} color="#2ECC71" />
                <Text style={styles.paywallFeatureText}>Beautiful magazine-style interface</Text>
              </View>
            </View>
            
            <TouchableOpacity
              onPress={showPaywall}
              style={styles.upgradeButton}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#D4AF37', '#F7E7CE']}
                style={styles.upgradeButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <MaterialCommunityIcons name="crown" size={20} color="#0B0B0B" />
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
      
      {renderHeader()}
      {category && renderCategoryInfo()}
      
      <Animated.View
        style={[
          styles.promptContainer,
          {
            opacity: fadeAnimation,
            transform: [{ translateY: slideAnimation }],
          },
        ]}
      >
        <EditorialPrompt
          promptId={promptId}
          category={category}
          onAnswerSubmit={handleAnswerSubmit}
          onPartnerAnswerRevealed={handlePartnerAnswerRevealed}
        />
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  
  headerShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#9B59B6',
  },
  
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#9B59B620',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
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
    paddingHorizontal: SPACING.md,
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
    color: '#0B0B0B',
  },
  
  categoryInfo: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  
  categoryCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  categoryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  
  categoryTextContainer: {
    flex: 1,
  },
  
  categoryName: {
    ...TYPOGRAPHY.h2,
    color: COLORS.softCream,
    marginBottom: SPACING.xs,
    fontSize: 18,
  },
  
  categoryDescription: {
    ...TYPOGRAPHY.body,
    color: COLORS.softCream + 'CC',
    fontSize: 14,
    lineHeight: 20,
  },
  
  promptContainer: {
    flex: 1,
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
    maxWidth: 320,
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
  
  paywallFeatures: {
    alignSelf: 'stretch',
    marginBottom: SPACING.xl,
  },
  
  paywallFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  
  paywallFeatureText: {
    ...TYPOGRAPHY.body,
    color: COLORS.softCream + 'E6',
    marginLeft: SPACING.sm,
    fontSize: 15,
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
    color: '#0B0B0B',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default EditorialPromptScreen;

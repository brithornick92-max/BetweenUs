// screens/NightRitualScreen.js
import React, { useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import NightRitualMode from '../components/NightRitualMode';
import { useAppContext } from '../context/AppContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { NIGHT_COLORS } from '../components/NightRitualMode';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../utils/theme';

const NightRitualScreen = ({ navigation }) => {
  const { state } = useAppContext();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  
  // Gate: Night Ritual is a premium-only feature (HIDE behavior)
  useEffect(() => {
    if (!isPremium) {
      showPaywall('NIGHT_RITUAL_MODE');
      navigation.goBack();
    }
  }, [isPremium, showPaywall, navigation]);

  // Animation values
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(50)).current;
  const starAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();

    // Star twinkle animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(starAnimation, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(starAnimation, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleRitualComplete = async (ritual, responses) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (__DEV__) {
      console.log('Night ritual completed:', ritual.id);
    }
  };

  const handleElementComplete = async (elementId, response) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (__DEV__) {
      console.log(`Element ${elementId} completed`);
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
          <MaterialCommunityIcons name="arrow-left" size={24} color={NIGHT_COLORS.text} />
        </BlurView>
      </TouchableOpacity>

      <View style={styles.headerContent}>
        <Animated.View
          style={[
            styles.starField,
            {
              opacity: starAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0.4, 1],
              }),
            },
          ]}
        >
          <Text style={styles.star}>✨</Text>
          <Text style={[styles.star, styles.star2]}>⭐</Text>
          <Text style={[styles.star, styles.star3]}>✨</Text>
        </Animated.View>
        
        <Text style={styles.headerTitle}>Night Ritual</Text>
        <Text style={styles.headerSubtitle}>
          A gentle space for bedtime connection and intimacy
        </Text>
        
        <View style={styles.timeIndicator}>
          <BlurView intensity={10} style={styles.timeIndicatorBlur}>
            <MaterialCommunityIcons name="moon-waning-crescent" size={16} color={NIGHT_COLORS.textSecondary} />
            <Text style={styles.timeText}>
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </BlurView>
        </View>
      </View>
    </Animated.View>
  );

  const renderCustomRitualPrompt = () => {
    if (!isPremium) return null;
    
    return (
      <Animated.View 
        style={[
          styles.customRitualPrompt,
          {
            opacity: fadeAnimation,
            transform: [{ translateY: slideAnimation }],
          },
        ]}
      >
        <BlurView intensity={15} style={styles.customRitualCard}>
          <LinearGradient
            colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
            style={StyleSheet.absoluteFill}
          />
          
          <View style={styles.customRitualHeader}>
            <MaterialCommunityIcons name="crown" size={18} color={COLORS.mutedGold} />
            <Text style={styles.customRitualTitle}>Custom Rituals Available</Text>
          </View>
          
          <Text style={styles.customRitualDescription}>
            Create personalized bedtime rituals that are uniquely yours
          </Text>
          
          <TouchableOpacity
            style={styles.customRitualButton}
            onPress={() => navigation.navigate('CustomRitualBuilder')}
            activeOpacity={0.8}
          >
            <Text style={styles.customRitualButtonText}>Design Custom Ritual</Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color={COLORS.mutedGold} />
          </TouchableOpacity>
        </BlurView>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[NIGHT_COLORS.deepNight, NIGHT_COLORS.midnightBlue, NIGHT_COLORS.deepNight]}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.5, 1]}
      />
      
      {renderHeader()}
      {renderCustomRitualPrompt()}
      
      <Animated.View
        style={[
          styles.ritualContainer,
          {
            opacity: fadeAnimation,
            transform: [{ translateY: slideAnimation }],
          },
        ]}
      >
        <NightRitualMode
          onRitualComplete={handleRitualComplete}
          onElementComplete={handleElementComplete}
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
    borderColor: 'rgba(255,255,255,0.1)',
  },
  
  headerContent: {
    alignItems: 'center',
    paddingTop: SPACING.xl,
    position: 'relative',
  },
  
  starField: {
    position: 'absolute',
    top: -20,
    left: 0,
    right: 0,
    height: 60,
  },
  
  star: {
    position: 'absolute',
    fontSize: 16,
    color: NIGHT_COLORS.text,
  },
  
  star2: {
    top: 10,
    right: 30,
    fontSize: 12,
  },
  
  star3: {
    top: 20,
    left: 40,
    fontSize: 14,
  },
  
  headerTitle: {
    ...TYPOGRAPHY.display,
    color: NIGHT_COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
    fontFamily: Platform.select({
      ios: "PlayfairDisplay-Bold",
      android: "PlayfairDisplay_700Bold",
    }),
  },
  
  headerSubtitle: {
    ...TYPOGRAPHY.body,
    color: NIGHT_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: SPACING.lg,
  },
  
  timeIndicator: {
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  
  timeIndicatorBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  
  timeText: {
    ...TYPOGRAPHY.caption,
    color: NIGHT_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  
  customRitualPrompt: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  
  customRitualCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.mutedGold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  
  customRitualHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  
  customRitualTitle: {
    ...TYPOGRAPHY.h3,
    color: NIGHT_COLORS.text,
    marginLeft: SPACING.sm,
    fontSize: 16,
  },
  
  customRitualDescription: {
    ...TYPOGRAPHY.body,
    color: NIGHT_COLORS.textSecondary,
    marginBottom: SPACING.md,
    fontSize: 14,
    lineHeight: 20,
  },
  
  customRitualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  
  customRitualButtonText: {
    ...TYPOGRAPHY.button,
    color: COLORS.mutedGold,
    fontSize: 14,
  },
  
  ritualContainer: {
    flex: 1,
  },
});

export default NightRitualScreen;

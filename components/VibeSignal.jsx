// components/VibeSignal.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAppContext } from '../context/AppContext';
import { useMemoryContext } from '../context/MemoryContext';
import { storage, STORAGE_KEYS } from '../utils/storage';
import { COLORS, GRADIENTS, GLASS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '../utils/theme';

const { width: screenWidth } = Dimensions.get('window');

// Vibe Color Definitions with Metallic Shimmer Gradients
export const VIBE_COLORS = {
  PASSIONATE: {
    id: 'passionate',
    name: 'Passionate',
    primary: '#4A0E0E',
    secondary: '#2D0A0A',
    glow: 'rgba(74, 14, 14, 0.5)',
    gradient: ['#6B1414', '#4A0E0E', '#2D0A0A', '#4A0E0E'], // Metallic red shimmer
    emotion: 'Intense & Romantic',
  },
  TENDER: {
    id: 'tender',
    name: 'Tender',
    primary: '#4A1E2E',
    secondary: '#2D1219',
    glow: 'rgba(74, 30, 46, 0.5)',
    gradient: ['#6B2A42', '#4A1E2E', '#2D1219', '#4A1E2E'], // Metallic pink shimmer
    emotion: 'Gentle & Loving',
  },
  LUXURIOUS: {
    id: 'luxurious',
    name: 'Luxurious',
    primary: '#4A3A0E',
    secondary: '#2D2308',
    glow: 'rgba(74, 58, 14, 0.5)',
    gradient: ['#6B5414', '#4A3A0E', '#2D2308', '#4A3A0E'], // Metallic gold shimmer
    emotion: 'Elegant & Refined',
  },
  MYSTERIOUS: {
    id: 'mysterious',
    name: 'Mysterious',
    primary: '#1A1A1A',
    secondary: '#0D0D0D',
    glow: 'rgba(26, 26, 26, 0.5)',
    gradient: ['#2D2D2D', '#1A1A1A', '#0D0D0D', '#1A1A1A'], // Pure black metallic shimmer
    emotion: 'Intriguing & Seductive',
  },
  SERENE: {
    id: 'serene',
    name: 'Serene',
    primary: '#1A3A1A', // Pure green, no blue tint
    secondary: '#0F230F', // Deeper pure green
    glow: 'rgba(26, 58, 26, 0.5)',
    gradient: ['#26542A', '#1A3A1A', '#0F230F', '#1A3A1A'], // Pure green metallic shimmer
    emotion: 'Peaceful & Connected',
  },
  ADVENTUROUS: {
    id: 'adventurous',
    name: 'Adventurous',
    primary: '#2B0F1E',
    secondary: '#1A0A12',
    glow: 'rgba(43, 15, 30, 0.5)',
    gradient: ['#3D1529', '#2B0F1E', '#1A0A12', '#2B0F1E'], // Metallic plum shimmer
    emotion: 'Bold & Exciting',
  },
};

const VibeSignal = ({ 
  style,
  onVibeChange,
  showPartnerVibe = true,
  compact = false 
}) => {
  const { state: appState, actions: appActions } = useAppContext();
  const { actions: memoryActions } = useMemoryContext();
  
  const [selectedVibe, setSelectedVibe] = useState(appState.currentVibe);
  const [partnerVibe, setPartnerVibe] = useState(appState.partnerVibe);
  const [isAnimating, setIsAnimating] = useState(false);
  const [anniversaryThemes, setAnniversaryThemes] = useState([]);
  const [availableVibes, setAvailableVibes] = useState(Object.values(VIBE_COLORS));
  
  // Sync local state with app state
  useEffect(() => {
    setSelectedVibe(appState.currentVibe);
  }, [appState.currentVibe]);

  useEffect(() => {
    setPartnerVibe(appState.partnerVibe);
  }, [appState.partnerVibe]);
  
  // Animation values
  const glowAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const partnerGlowAnimation = useRef(new Animated.Value(0)).current;

  // Load anniversary themes on mount
  useEffect(() => {
    const loadAnniversaryThemes = async () => {
      try {
        const themes = await storage.get(STORAGE_KEYS.ANNIVERSARY_THEMES) || [];
        const todayThemes = themes.filter(theme => {
          const themeDate = new Date(theme.anniversaryDate);
          const today = new Date();
          return themeDate.getMonth() === today.getMonth() && 
                 themeDate.getDate() === today.getDate();
        });
        
        setAnniversaryThemes(todayThemes);
        
        // Add anniversary themes to available vibes
        const anniversaryVibes = todayThemes.map(theme => ({
          id: theme.id,
          name: theme.name,
          primary: theme.primary,
          secondary: theme.secondary,
          glow: theme.glow,
          gradient: theme.gradient,
          emotion: `Anniversary: ${theme.name}`,
          isAnniversaryTheme: true,
          anniversaryDate: theme.anniversaryDate,
        }));
        
        setAvailableVibes([...Object.values(VIBE_COLORS), ...anniversaryVibes]);
      } catch (error) {
        console.error('Failed to load anniversary themes:', error);
      }
    };
    
    loadAnniversaryThemes();
  }, []);

  // Update local state when app state changes
  useEffect(() => {
    setSelectedVibe(appState.currentVibe);
    setPartnerVibe(appState.partnerVibe);
  }, [appState.currentVibe, appState.partnerVibe]);

  // Animate partner vibe changes
  useEffect(() => {
    if (partnerVibe) {
      Animated.sequence([
        Animated.timing(partnerGlowAnimation, {
          toValue: 1,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.timing(partnerGlowAnimation, {
          toValue: 0.7,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [partnerVibe]);

  const handleVibeSelection = async (vibe) => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    
    // Haptic feedback for selection
    await Haptics.selectionAsync();
    
    // Scale animation for selection feedback
    Animated.sequence([
      Animated.timing(scaleAnimation, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Glow animation
    Animated.timing(glowAnimation, {
      toValue: 1,
      duration: 400,
      useNativeDriver: false,
    }).start();

    // Update state
    setSelectedVibe(vibe);
    appActions.setVibe(vibe);
    
    // Special handling for anniversary themes
    if (vibe.isAnniversaryTheme) {
      // Create a special anniversary vibe entry
      const anniversaryVibeEntry = {
        ...vibe,
        selectedOn: new Date(),
        isSpecialOccasion: true,
      };
      
      // Store anniversary vibe selection
      const anniversaryVibeHistory = await storage.get(STORAGE_KEYS.ANNIVERSARY_VIBE_HISTORY) || [];
      anniversaryVibeHistory.push(anniversaryVibeEntry);
      await storage.set(STORAGE_KEYS.ANNIVERSARY_VIBE_HISTORY, anniversaryVibeHistory);
    }
    
    if (onVibeChange) {
      onVibeChange(vibe, vibe.isAnniversaryTheme);
    }
    
    setTimeout(() => setIsAnimating(false), 500);
  };

  const renderVibeOption = (vibe, isSelected) => {
    const animatedStyle = isSelected ? {
      transform: [{ scale: scaleAnimation }],
    } : {};

    const glowStyle = isSelected ? {
      shadowColor: vibe.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: glowAnimation,
      shadowRadius: 20,
      elevation: 8,
    } : {};

    return (
      <TouchableOpacity
        key={vibe.id}
        onPress={() => handleVibeSelection(vibe)}
        disabled={isAnimating}
        style={[styles.vibeOption, glowStyle]}
        activeOpacity={0.8}
      >
        <Animated.View style={[styles.vibeOptionInner, animatedStyle]}>
          <BlurView intensity={20} style={styles.vibeBlur}>
            <LinearGradient
              colors={vibe.gradient}
              style={styles.vibeGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              locations={[0, 0.3, 0.7, 1]} // Creates shimmer effect
            >
              <View style={[styles.vibeContent, { opacity: isSelected ? 1 : 0.8 }]}>
                <Text style={[styles.vibeName, { color: COLORS.pureWhite }]}>
                  {vibe.name}
                </Text>
                {!compact && (
                  <Text style={[styles.vibeEmotion, { color: COLORS.softCream }]}>
                    {vibe.emotion}
                  </Text>
                )}
              </View>
            </LinearGradient>
          </BlurView>
          
          {/* Glassmorphism border */}
          <View style={[
            styles.glassBorder,
            { 
              borderColor: isSelected ? COLORS.pureWhite : 'rgba(255, 211, 233, 0.3)',
              borderWidth: isSelected ? 2 : 0.5,
              shadowColor: isSelected ? COLORS.pureWhite : 'transparent',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: isSelected ? 0.8 : 0,
              shadowRadius: isSelected ? 8 : 0,
              elevation: isSelected ? 4 : 0,
            }
          ]} />
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderPartnerVibeDisplay = () => {
    if (!showPartnerVibe || !partnerVibe) return null;

    return (
      <View style={styles.partnerVibeContainer}>
        <Text style={styles.partnerVibeLabel}>Partner's Vibe</Text>
        <Animated.View style={[
          styles.partnerVibeDisplay,
          {
            shadowColor: partnerVibe.primary,
            shadowOpacity: partnerGlowAnimation,
            shadowRadius: 15,
            elevation: 6,
          }
        ]}>
          <BlurView intensity={15} style={styles.partnerVibeBlur}>
            <LinearGradient
              colors={partnerVibe.gradient}
              style={styles.partnerVibeGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.partnerVibeName}>{partnerVibe.name}</Text>
              <Text style={styles.partnerVibeEmotion}>{partnerVibe.emotion}</Text>
            </LinearGradient>
          </BlurView>
        </Animated.View>
      </View>
    );
  };

  const renderSyncStatus = () => {
    const { syncStatus } = appState;
    const statusColor = {
      'synced': COLORS.success,
      'syncing': COLORS.mutedGold,
      'offline': COLORS.error,
    }[syncStatus] || COLORS.error;

    const statusText = {
      'synced': 'Connected',
      'syncing': 'Syncing...',
      'offline': 'Offline',
    }[syncStatus] || 'Unknown';

    return (
      <View style={styles.syncStatusContainer}>
        <View style={[styles.syncStatusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.syncStatusText, { color: statusColor }]}>
          {statusText}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Send a Vibe</Text>
        <Text style={styles.subtitle}>Share how you're feeling right now</Text>
        {renderSyncStatus()}
      </View>

      {/* Vibe Options */}
      <View style={styles.vibeGrid}>
        {availableVibes.map(vibe => {
          const isSelected = selectedVibe && (
            (typeof selectedVibe === 'string' && selectedVibe === vibe.id) ||
            (typeof selectedVibe === 'object' && selectedVibe.id === vibe.id)
          );
          return renderVibeOption(vibe, isSelected);
        })}
      </View>

      {/* Anniversary Theme Notice */}
      {anniversaryThemes.length > 0 && (
        <View style={styles.anniversaryNotice}>
          <BlurView intensity={10} style={styles.anniversaryNoticeBlur}>
            <Text style={styles.anniversaryNoticeIcon}>🎉</Text>
            <Text style={styles.anniversaryNoticeText}>
              Special anniversary themes available today!
            </Text>
          </BlurView>
        </View>
      )}

      {/* Partner Vibe Display */}
      {renderPartnerVibeDisplay()}

      {/* Selected Vibe Info */}
      {selectedVibe && (
        <View style={styles.selectedVibeInfo}>
          <BlurView intensity={10} style={styles.selectedVibeBlur}>
            <Text style={styles.selectedVibeText}>
              You're feeling <Text style={[styles.selectedVibeName, { color: selectedVibe.primary }]}>
                {selectedVibe.name.toLowerCase()}
              </Text>
            </Text>
            <Text style={styles.selectedVibeTime}>
              {appState.vibeLastUpdated ? 
                `Updated ${new Date(appState.vibeLastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` :
                'Just now'
              }
            </Text>
          </BlurView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: SPACING.lg,
  },
  
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  
  title: {
    ...TYPOGRAPHY.h1,
    color: COLORS.softCream,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.creamSubtle,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  
  syncStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  
  syncStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.xs,
  },
  
  syncStatusText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
  },
  
  vibeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
    gap: SPACING.md, // Use gap for consistent spacing
  },
  
  vibeOption: {
    flexBasis: '47%', // Back to 2 per row for larger size
    aspectRatio: 1, // Makes perfect squares
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  
  vibeOptionInner: {
    position: 'relative',
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    flex: 1,
  },
  
  vibeBlur: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    flex: 1,
  },
  
  vibeGradient: {
    flex: 1,
    padding: SPACING.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  vibeContent: {
    alignItems: 'center',
  },
  
  vibeName: {
    ...TYPOGRAPHY.h3,
    fontSize: 14, // Made smaller
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  
  vibeEmotion: {
    ...TYPOGRAPHY.caption,
    fontSize: 10, // Made smaller
    textAlign: 'center',
    opacity: 0.9,
  },
  
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 0.5,
    borderRadius: BORDER_RADIUS.xl,
    pointerEvents: 'none',
  },
  
  partnerVibeContainer: {
    marginBottom: SPACING.xl,
    alignItems: 'center',
  },
  
  partnerVibeLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.creamSubtle,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  
  partnerVibeDisplay: {
    width: screenWidth - SPACING.lg * 2,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  
  partnerVibeBlur: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  
  partnerVibeGradient: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  
  partnerVibeName: {
    ...TYPOGRAPHY.h2,
    color: COLORS.pureWhite,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  
  partnerVibeEmotion: {
    ...TYPOGRAPHY.body,
    color: COLORS.softCream,
    textAlign: 'center',
    opacity: 0.9,
  },
  
  selectedVibeInfo: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  
  selectedVibeBlur: {
    backgroundColor: COLORS.pureWhite,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  
  selectedVibeText: {
    ...TYPOGRAPHY.body,
    color: COLORS.charcoal,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  
  selectedVibeName: {
    fontWeight: '700',
  },
  
  selectedVibeTime: {
    ...TYPOGRAPHY.caption,
    color: COLORS.charcoal,
    opacity: 0.7,
    textAlign: 'center',
  },
  
  anniversaryNotice: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  
  anniversaryNoticeBlur: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: COLORS.mutedGold + '40',
  },
  
  anniversaryNoticeIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
  },
  
  anniversaryNoticeText: {
    ...TYPOGRAPHY.body,
    color: COLORS.mutedGold,
    fontWeight: '600',
  },
});

export default VibeSignal;
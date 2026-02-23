// components/VibeSignal.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAppContext } from '../context/AppContext';
import { useMemoryContext } from '../context/MemoryContext';
import { useTheme } from '../context/ThemeContext';
import { storage, STORAGE_KEYS } from '../utils/storage';
import { GRADIENTS, GLASS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '../utils/theme';

const { width: screenWidth } = Dimensions.get('window');

// Vibe Color Definitions with Metallic Shimmer Gradients
export const VIBE_COLORS = {
  PASSIONATE: {
    id: 'passionate',
    name: 'Passionate',
    primary: '#6B1414',
    secondary: '#2D0A0A',
    glow: 'rgba(107, 20, 20, 0.4)',
    gradient: ['#8F2D56', '#6B1414', '#2D0A0A', '#6B1414'], // Deep wine metallic shimmer
    emotion: 'Intense & Romantic',
  },
  TENDER: {
    id: 'tender',
    name: 'Tender',
    primary: '#4A1E2E',
    secondary: '#2D1219',
    glow: 'rgba(74, 30, 46, 0.4)',
    gradient: ['#8F2D56', '#4A1E2E', '#2D1219', '#4A1E2E'], // Mulberry shimmer
    emotion: 'Gentle & Loving',
  },
  LUXURIOUS: {
    id: 'luxurious',
    name: 'Luxurious',
    primary: '#4A3A0E',
    secondary: '#2D2308',
    glow: 'rgba(168, 144, 96, 0.3)',
    gradient: ['#A89060', '#4A3A0E', '#2D2308', '#4A3A0E'], // Matte gold shimmer
    emotion: 'Elegant & Refined',
  },
  MYSTERIOUS: {
    id: 'mysterious',
    name: 'Mysterious',
    primary: '#151118',
    secondary: '#0E0B10',
    glow: 'rgba(0, 0, 0, 0.5)',
    gradient: ['#1C1620', '#151118', '#0E0B10', '#151118'], // Ink-black shimmer
    emotion: 'Mystic & Allure',
  },
  SERENE: {
    id: 'serene',
    name: 'Serene',
    primary: '#1A0F18', // Deep Charcoal-Plum
    secondary: '#0E0B10',
    glow: 'rgba(26, 15, 24, 0.4)',
    gradient: ['#241B23', '#1A0F18', '#0E0B10', '#1A0F18'], // Midnight shimmer
    emotion: 'Peaceful & Bonded',
  },
  ADVENTUROUS: {
    id: 'adventurous',
    name: 'Adventurous',
    primary: '#2B0F1E',
    secondary: '#1A0A12',
    glow: 'rgba(43, 15, 30, 0.4)',
    gradient: ['#8F2D56', '#2B0F1E', '#1A0A12', '#2B0F1E'], // Deep plum shimmer
    emotion: 'Bold & Daring',
  },
};

const VibeSignal = ({ 
  style,
  onVibeChange,
  showPartnerVibe = true,
  compact = false 
}) => {
  const { colors, isDark } = useTheme();
  const { state: appState, actions: appActions } = useAppContext();
  const animTimerRef = useRef(null);
  const { actions: memoryActions } = useMemoryContext();
  
  const styles = useMemo(() => createStyles(colors), [colors]);

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
        const themes = await storage.get(STORAGE_KEYS.ANNIVERSARY_THEMES, []);
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
      const anniversaryVibeHistory = await storage.get(STORAGE_KEYS.ANNIVERSARY_VIBE_HISTORY, []);
      anniversaryVibeHistory.push(anniversaryVibeEntry);
      await storage.set(STORAGE_KEYS.ANNIVERSARY_VIBE_HISTORY, anniversaryVibeHistory);
    }
    
    if (onVibeChange) {
      onVibeChange(vibe, vibe.isAnniversaryTheme);
    }
    
    animTimerRef.current = setTimeout(() => setIsAnimating(false), 500);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, []);

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
              colors={vibe.gradient || [colors.primary, colors.primary + 'CC']}
              style={styles.vibeGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
                locations={[0, 0.3, 0.7, 1]}
              >
                <View style={styles.vibeGradientContent}>
                  <Text style={[styles.vibeName, { color: colors.text }]}>{vibe.name}</Text>
                  {!compact && (
                    <Text style={[styles.vibeEmotion, { color: colors.textMuted }]}> 
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
              borderColor: isSelected ? colors.text : 'rgba(255, 211, 233, 0.3)',
              borderWidth: isSelected ? 2 : 0.5,
              shadowColor: isSelected ? colors.text : 'transparent',
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
        <Text style={[styles.partnerVibeLabel, { color: colors.textMuted }]}>Partner's Vibe</Text>
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
              colors={partnerVibe.gradient || [colors.primary, colors.primary + 'CC']}
              style={styles.partnerVibeGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={[styles.partnerVibeName, { color: colors.text }]}>{partnerVibe.name}</Text>
              <Text style={[styles.partnerVibeEmotion, { color: colors.softCream || "#F3E5D8" }]}>{partnerVibe.emotion}</Text>
            </LinearGradient>
          </BlurView>
        </Animated.View>
      </View>
    );
  };

  const renderSyncStatus = () => {
    const { syncStatus } = appState;
    const statusColor = {
      'synced': "#4CAF50",
      'syncing': "#FFD700",
      'offline': "#F44336",
    }[syncStatus] || "#F44336";

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
        <Text style={[styles.title, { color: colors.text }]}>Send a Vibe</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>Share how you're feeling right now</Text>
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
            <Text style={[styles.anniversaryNoticeText, { color: colors.primary }]}>
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
          <BlurView intensity={10} style={[styles.selectedVibeBlur, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.selectedVibeText, { color: colors.text }]}>
              You're feeling <Text style={[styles.selectedVibeName, { color: selectedVibe.primary }]}>
                {selectedVibe.name.toLowerCase()}
              </Text>
            </Text>
            <Text style={[styles.selectedVibeTime, { color: colors.textMuted }]}>
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

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '600' },
  subtitle: { fontSize: 14 },
  syncStatusContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  syncStatusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  syncStatusText: { fontSize: 12 },
  vibeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  vibeOption: {
    width: (screenWidth - 64) / 2,
    height: (screenWidth - 64) / 2,
    marginBottom: 16,
    marginHorizontal: 8,
  },
  vibeOptionInner: {
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
    height: '100%',
  },
  vibeBlur: {
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
    height: '100%',
  },
  vibeGradient: {
    padding: 12,
    borderRadius: 12,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
  },
  vibeGradientContent: { alignItems: 'center' },
  vibeName: { fontSize: 14, fontWeight: '700' },
  vibeEmotion: { fontSize: 12, marginTop: 6 },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 12 },
  partnerVibeContainer: { marginTop: 16 },
  partnerVibeLabel: { fontSize: 12 },
  partnerVibeDisplay: { borderRadius: 12, overflow: 'hidden' },
  partnerVibeBlur: { padding: 12 },
  partnerVibeGradient: { padding: 12 },
  partnerVibeName: { fontSize: 16, fontWeight: '700' },
  partnerVibeEmotion: { fontSize: 12 },
  anniversaryNotice: { position: 'absolute', bottom: 16, left: 16, right: 16 },
  anniversaryNoticeBlur: { padding: 12, borderRadius: 12, alignItems: 'center', flexDirection: 'row' },
  anniversaryNoticeIcon: { marginRight: 8 },
  anniversaryNoticeText: { fontSize: 14 },
  selectedVibeInfo: { position: 'absolute', bottom: 16, left: 16, right: 16 },
  selectedVibeBlur: { padding: 12, borderRadius: 12 },
  selectedVibeText: { fontSize: 14 },
  selectedVibeName: { fontWeight: '700' },
  selectedVibeTime: { fontSize: 12 },
});

export default VibeSignal;
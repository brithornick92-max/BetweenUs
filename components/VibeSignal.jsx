// components/VibeSignal.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { selection } from '../utils/haptics';
import { useAppContext } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { storage, STORAGE_KEYS } from '../utils/storage';
import { SPACING } from '../utils/theme';

// Note: MaterialCommunityIcons does not support setNativeProps, so we cannot use
// Animated.createAnimatedComponent with it. Use crossfade instead.
const { width: screenWidth } = Dimensions.get('window');

// Vibe Color Definitions — Pure Apple System Colors
export const VIBE_COLORS = {
  PASSIONATE: {
    id: 'passionate',
    name: 'Passionate',
    primary: '#FF3B30', // iOS Red
    icon: 'fire',
    emotion: 'Intense & Romantic',
  },
  TENDER: {
    id: 'tender',
    name: 'Tender',
    primary: '#FF2D55', // iOS Pink
    icon: 'heart',
    emotion: 'Gentle & Loving',
  },
  LUXURIOUS: {
    id: 'luxurious',
    name: 'Luxurious',
    primary: '#D4AF37', // Crisp Gold
    icon: 'diamond-stone',
    emotion: 'Elegant & Refined',
  },
  MYSTERIOUS: {
    id: 'mysterious',
    name: 'Mysterious',
    primary: '#5856D6', // iOS Purple
    icon: 'weather-night',
    emotion: 'Mystical & Alluring',
  },
  SERENE: {
    id: 'serene',
    name: 'Serene',
    primary: '#32ADE6', // iOS Cyan
    icon: 'water',
    emotion: 'Peaceful & Bonded',
  },
  ADVENTUROUS: {
    id: 'adventurous',
    name: 'Adventurous',
    primary: '#FF9500', // iOS Orange
    icon: 'compass',
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

  // STRICT Apple Editorial Theme Map
  const t = useMemo(() => ({
    background: isDark ? '#000000' : '#F2F2F7', 
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    surfaceSecondary: isDark ? '#2C2C2E' : '#E5E5EA',
    primary: colors.primary,
    text: isDark ? '#FFFFFF' : '#000000',
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);
  
  const styles = useMemo(() => createStyles(t, isDark, compact), [t, isDark, compact]);

  const [selectedVibe, setSelectedVibe] = useState(appState.currentVibe);
  const [partnerVibe, setPartnerVibe] = useState(appState.partnerVibe);
  const [isAnimating, setIsAnimating] = useState(false);
  const [anniversaryThemes, setAnniversaryThemes] = useState([]);
  const [availableVibes, setAvailableVibes] = useState(Object.values(VIBE_COLORS));
  
  const partnerGlowAnimation = useRef(new Animated.Value(0)).current;

  // Sync local state with app state
  useEffect(() => {
    setSelectedVibe(appState.currentVibe);
  }, [appState.currentVibe]);

  useEffect(() => {
    setPartnerVibe(appState.partnerVibe);
  }, [appState.partnerVibe]);

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
        
        const anniversaryVibes = todayThemes.map(theme => ({
          id: theme.id,
          name: theme.name,
          primary: theme.primary || t.primary,
          icon: 'party-popper',
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
  }, [t.primary]);

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
          duration: 250,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [partnerVibe, partnerGlowAnimation]);

  const handleVibeSelection = async (vibe) => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    selection();

    setSelectedVibe(vibe);
    appActions.setVibe(vibe);
    
    if (vibe.isAnniversaryTheme) {
      const anniversaryVibeEntry = {
        ...vibe,
        selectedOn: new Date(),
        isSpecialOccasion: true,
      };
      
      const anniversaryVibeHistory = await storage.get(STORAGE_KEYS.ANNIVERSARY_VIBE_HISTORY, []);
      anniversaryVibeHistory.push(anniversaryVibeEntry);
      await storage.set(STORAGE_KEYS.ANNIVERSARY_VIBE_HISTORY, anniversaryVibeHistory);
    }
    
    if (onVibeChange) {
      onVibeChange(vibe, vibe.isAnniversaryTheme);
    }
    
    animTimerRef.current = setTimeout(() => setIsAnimating(false), 500);
  };

  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, []);

  const renderVibeOption = (vibe) => {
    const isSelected = selectedVibe && (
      (typeof selectedVibe === 'string' && selectedVibe === vibe.id) ||
      (typeof selectedVibe === 'object' && selectedVibe.id === vibe.id)
    );

    // Individual animations for each card
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: isSelected ? 1 : 0,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.spring(scaleAnim, {
          toValue: isSelected ? 0.96 : 1,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        })
      ]).start();
    }, [isSelected, fadeAnim, scaleAnim]);

    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.92,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: isSelected ? 0.96 : 1,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }).start();
    };

    // Pure Apple Editorial Color Interpolations
    const backgroundColor = fadeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [t.surface, vibe.primary] 
    });

    const iconCircleBg = fadeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [t.surfaceSecondary, 'rgba(255,255,255,0.25)']
    });

    const textColor = fadeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [t.text, '#FFFFFF']
    });

    return (
      <Animated.View 
        key={vibe.id}
        style={[
          styles.vibeCardWrapper, 
          { transform: [{ scale: scaleAnim }] }
        ]}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={() => handleVibeSelection(vibe)}
          disabled={isAnimating}
          style={styles.vibeTouchableArea}
        >
          <Animated.View style={[styles.vibeCard, { backgroundColor }]}>
            <Animated.View style={[styles.vibeIconContainer, { backgroundColor: iconCircleBg }]}>
              {/* Crossfade between two static icons to avoid setNativeProps crash */}
              <View style={{ width: compact ? 24 : 28, height: compact ? 24 : 28 }}>
                <MaterialCommunityIcons
                  name={vibe.icon || 'star'}
                  size={compact ? 24 : 28}
                  color={vibe.primary}
                  style={{ position: 'absolute' }}
                />
                <Animated.View style={{ opacity: fadeAnim }}>
                  <MaterialCommunityIcons
                    name={vibe.icon || 'star'}
                    size={compact ? 24 : 28}
                    color="#FFFFFF"
                  />
                </Animated.View>
              </View>
            </Animated.View>
            <Animated.Text style={[styles.vibeCardLabel, { color: textColor }]} numberOfLines={1}>
              {vibe.name}
            </Animated.Text>
            {!compact && (
              <Animated.Text style={[styles.vibeEmotion, { color: textColor, opacity: 0.8 }]} numberOfLines={1}>
                {vibe.emotion}
              </Animated.Text>
            )}
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderPartnerVibeDisplay = () => {
    if (!showPartnerVibe || !partnerVibe) return null;

    // Use fallback colors if full object isn't available
    const pColor = partnerVibe.primary || t.primary;

    return (
      <View style={styles.partnerVibeContainer}>
        <Text style={styles.sectionLabel}>PARTNER'S VIBE</Text>
        <View style={styles.partnerVibeCard}>
          <View style={[styles.partnerIconWrap, { backgroundColor: pColor + '20' }]}>
            <MaterialCommunityIcons name={partnerVibe.icon || 'heart'} size={24} color={pColor} />
          </View>
          <View style={styles.partnerTextWrap}>
            <Text style={styles.partnerVibeName}>{partnerVibe.name}</Text>
            <Text style={styles.partnerVibeEmotion}>{partnerVibe.emotion}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {/* Flush-Left Editorial Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Choose Your Vibe</Text>
        <Text style={styles.subtitle}>Tap to share how you're feeling.</Text>
      </View>

      {/* Vibe Options Grid */}
      <View style={styles.vibeGrid}>
        {availableVibes.map(vibe => renderVibeOption(vibe))}
      </View>

      {/* Anniversary Theme Notice */}
      {anniversaryThemes.length > 0 && (
        <View style={styles.anniversaryNotice}>
          <Text style={styles.anniversaryIcon}>🎉</Text>
          <Text style={[styles.anniversaryText, { color: t.primary }]}>
            Special anniversary themes available today!
          </Text>
        </View>
      )}

      {/* Partner Vibe Display */}
      {renderPartnerVibeDisplay()}

      {/* Selected Vibe Info */}
      {selectedVibe && (
        <View style={styles.selectedVibeInfo}>
          <Text style={styles.selectedVibeText}>
            You're feeling <Text style={[styles.selectedVibeName, { color: selectedVibe.primary || t.primary }]}>
              {selectedVibe.name ? selectedVibe.name.toLowerCase() : 'connected'}
            </Text>
          </Text>
          <Text style={styles.selectedVibeTime}>
            {appState.vibeLastUpdated ? 
              `Updated ${new Date(appState.vibeLastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` :
              'Just now'
            }
          </Text>
        </View>
      )}
    </View>
  );
};

// ------------------------------------------------------------------
// STYLES - Pure Apple Editorial 
// ------------------------------------------------------------------
const createStyles = (t, isDark, compact) => {
  const systemFont = Platform.select({ ios: "System", android: "Roboto" });

  return StyleSheet.create({
    container: {
      width: '100%',
    },
    
    // ── Header ──
    header: {
      alignItems: 'flex-start',
      marginBottom: SPACING.xl,
      paddingHorizontal: 4,
    },
    title: { 
      fontFamily: systemFont,
      fontSize: 28,
      fontWeight: '800',
      color: t.text,
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    subtitle: { 
      fontSize: 15,
      fontWeight: '500',
      color: t.subtext,
    },

    // ── Vibe Grid ──
    vibeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 12,
    },
    vibeCardWrapper: {
      width: compact ? '31%' : '48%', // 3 columns if compact, 2 if normal
      marginBottom: 4,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0 : 0.06,
          shadowRadius: 10,
        },
        android: { elevation: 2 },
      }),
    },
    vibeTouchableArea: {
      width: '100%',
    },
    vibeCard: {
      borderRadius: 24, // iOS Squircle
      padding: compact ? SPACING.md : SPACING.lg,
      alignItems: 'flex-start', // Editorial flush-left inside cards
      justifyContent: 'center',
      aspectRatio: compact ? 1 : 1.1, 
      borderWidth: 1,
      borderColor: t.border,
    },
    vibeIconContainer: {
      width: compact ? 40 : 48,
      height: compact ? 40 : 48,
      borderRadius: compact ? 20 : 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.md,
    },
    vibeCardLabel: {
      fontFamily: systemFont,
      fontSize: compact ? 14 : 16,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    vibeEmotion: {
      fontSize: 12,
      fontWeight: '500',
      marginTop: 4,
    },

    // ── Partner Vibe ──
    partnerVibeContainer: {
      marginTop: SPACING.xxl,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: t.subtext,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: SPACING.sm,
      paddingLeft: 4,
    },
    partnerVibeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.surface,
      borderRadius: 20,
      padding: SPACING.lg,
      borderWidth: 1,
      borderColor: t.border,
      gap: 16,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.04, shadowRadius: 8 },
        android: { elevation: 2 },
      }),
    },
    partnerIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    partnerTextWrap: {
      flex: 1,
    },
    partnerVibeName: {
      fontSize: 16,
      fontWeight: '700',
      color: t.text,
      marginBottom: 2,
      letterSpacing: -0.2,
    },
    partnerVibeEmotion: {
      fontSize: 14,
      fontWeight: '500',
      color: t.subtext,
    },

    // ── Special Notices ──
    anniversaryNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.surfaceSecondary,
      padding: SPACING.lg,
      borderRadius: 16,
      marginTop: SPACING.xl,
      gap: 12,
    },
    anniversaryIcon: {
      fontSize: 20,
    },
    anniversaryText: {
      fontSize: 14,
      fontWeight: '600',
      flex: 1,
    },

    // ── Selected Vibe Info ──
    selectedVibeInfo: {
      marginTop: SPACING.xl,
      backgroundColor: t.surfaceSecondary,
      padding: SPACING.lg,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: t.border,
    },
    selectedVibeText: {
      fontSize: 15,
      fontWeight: '500',
      color: t.text,
      marginBottom: 4,
    },
    selectedVibeName: {
      fontWeight: '700',
    },
    selectedVibeTime: {
      fontSize: 13,
      fontWeight: '500',
      color: t.subtext,
    },
  });
};

export default VibeSignal;

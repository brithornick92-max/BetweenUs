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
import Icon from './Icon';
import { selection } from '../utils/haptics';
import { useAppContext } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { storage, STORAGE_KEYS } from '../utils/storage';
import { SPACING, withAlpha } from '../utils/theme';

const { width: screenWidth } = Dimensions.get('window');

// Vibe Color Definitions — Sexy Red & Midnight Intimacy Palette
export const VIBE_COLORS = {
  PASSIONATE: {
    id: 'passionate',
    name: 'Passionate',
    primary: '#D2121A', // Sexy Red
    icon: 'flame-outline',
    emotion: 'Intense & Romantic',
  },
  TENDER: {
    id: 'tender',
    name: 'Tender',
    primary: '#FF2D55', // iOS Pink (Intimate variant)
    icon: 'heart-outline',
    emotion: 'Gentle & Loving',
  },
  LUXURIOUS: {
    id: 'luxurious',
    name: 'Luxurious',
    primary: '#A89060', // Matte Gold
    icon: 'diamond-outline',
    emotion: 'Elegant & Refined',
  },
  MYSTERIOUS: {
    id: 'mysterious',
    name: 'Mysterious',
    primary: '#5E5CE6', // iOS Indigo
    icon: 'moon-outline',
    emotion: 'Mystical & Alluring',
  },
  SERENE: {
    id: 'serene',
    name: 'Serene',
    primary: '#64D2FF', // iOS Cyan
    icon: 'water-outline',
    emotion: 'Peaceful & Bonded',
  },
  ADVENTUROUS: {
    id: 'adventurous',
    name: 'Adventurous',
    primary: '#FF9F0A', // iOS Orange
    icon: 'compass-outline',
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

  // Midnight Intimacy x Apple Editorial Theme Map
  const t = useMemo(() => ({
    background: colors.background, 
    surface: isDark ? '#131016' : '#FFFFFF',
    surfaceSecondary: isDark ? '#1C1520' : '#F2F2F7',
    primary: colors.primary || '#D2121A',
    text: colors.text,
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);
  
  const styles = useMemo(() => createStyles(t, isDark, compact), [t, isDark, compact]);

  const [selectedVibe, setSelectedVibe] = useState(appState.currentVibe);
  const [partnerVibe, setPartnerVibe] = useState(appState.partnerVibe);
  const [isAnimating, setIsAnimating] = useState(false);
  const [anniversaryThemes, setAnniversaryThemes] = useState([]);
  const [availableVibes, setAvailableVibes] = useState(
    Object.values(VIBE_COLORS).map(v => v.id === 'passionate' ? { ...v, primary: t.primary } : v)
  );
  
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
          icon: 'sparkles-outline',
          emotion: `Anniversary: ${theme.name}`,
          isAnniversaryTheme: true,
          anniversaryDate: theme.anniversaryDate,
        }));
        
        setAvailableVibes([
          ...Object.values(VIBE_COLORS).map(v => v.id === 'passionate' ? { ...v, primary: t.primary } : v),
          ...anniversaryVibes
        ]);
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

    const scaleAnim = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: isSelected ? 1 : 0,
          duration: 240,
          useNativeDriver: false,
        }),
        Animated.spring(scaleAnim, {
          toValue: isSelected ? 0.96 : 1,
          friction: 9,
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
              <View style={{ width: compact ? 28 : 34, height: compact ? 28 : 34 }}>
                <Icon
                  name={vibe.icon}
                  size={compact ? 28 : 34}
                  color={vibe.primary}
                  style={{ position: 'absolute' }}
                />
                <Animated.View style={{ opacity: fadeAnim }}>
                  <Icon
                    name={vibe.icon}
                    size={compact ? 28 : 34}
                    color="#FFFFFF"
                  />
                </Animated.View>
              </View>
            </Animated.View>
            <Animated.Text style={[styles.vibeCardLabel, { color: textColor }]} numberOfLines={1}>
              {vibe.name}
            </Animated.Text>
            {!compact && (
              <Animated.Text style={[styles.vibeEmotion, { color: textColor, opacity: 0.7 }]} numberOfLines={1}>
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
    const pColor = partnerVibe.primary || t.primary;

    return (
      <View style={styles.partnerVibeContainer}>
        <Text style={styles.sectionLabel}>PARTNER'S VIBE</Text>
        <View style={styles.partnerVibeCard}>
          <View style={[styles.partnerIconWrap, { backgroundColor: withAlpha(pColor, 0.15) }]}>
            <Icon name={partnerVibe.icon || 'heart'} size={24} color={pColor} />
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
      {/* Editorial Header */}
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
        <View style={[styles.anniversaryNotice, { backgroundColor: withAlpha(t.primary, 0.08) }]}>
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

const createStyles = (t, isDark, compact) => {
  const systemFont = Platform.select({ ios: "System", android: "Roboto" });

  return StyleSheet.create({
    container: {
      width: '100%',
    },
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
      fontFamily: systemFont,
      fontSize: 15,
      fontWeight: '500',
      color: t.subtext,
    },
    vibeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 12,
    },
    vibeCardWrapper: {
      width: compact ? '31%' : '48%',
      marginBottom: 4,
    },
    vibeTouchableArea: {
      width: '100%',
    },
    vibeCard: {
      borderRadius: 24, // Deep Apple Squircle
      padding: compact ? SPACING.md : SPACING.lg,
      alignItems: 'flex-start',
      justifyContent: 'center',
      aspectRatio: compact ? 1 : 1.1, 
      borderWidth: 1,
      borderColor: t.border,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: isDark ? 0.3 : 0.05,
          shadowRadius: 12,
        },
        android: { elevation: 2 },
      }),
    },
    vibeIconContainer: {
      width: compact ? 48 : 58,
      height: compact ? 48 : 58,
      borderRadius: compact ? 24 : 29,
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
      fontFamily: systemFont,
      fontSize: 12,
      fontWeight: '500',
      marginTop: 2,
    },
    partnerVibeContainer: {
      marginTop: SPACING.xxl,
    },
    sectionLabel: {
      fontFamily: systemFont,
      fontSize: 12,
      fontWeight: '800',
      color: t.subtext,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      marginBottom: SPACING.sm,
      paddingLeft: 4,
    },
    partnerVibeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.surface,
      borderRadius: 24,
      padding: SPACING.lg,
      borderWidth: 1,
      borderColor: t.border,
      gap: 16,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.2 : 0.04, shadowRadius: 8 },
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
      fontFamily: systemFont,
      fontSize: 16,
      fontWeight: '700',
      color: t.text,
      marginBottom: 2,
      letterSpacing: -0.2,
    },
    partnerVibeEmotion: {
      fontFamily: systemFont,
      fontSize: 14,
      fontWeight: '500',
      color: t.subtext,
    },
    anniversaryNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.lg,
      borderRadius: 16,
      marginTop: SPACING.xl,
      borderWidth: 1,
      borderColor: t.border,
      gap: 12,
    },
    anniversaryIcon: {
      fontSize: 20,
    },
    anniversaryText: {
      fontFamily: systemFont,
      fontSize: 14,
      fontWeight: '700',
      flex: 1,
    },
    selectedVibeInfo: {
      marginTop: SPACING.xl,
      backgroundColor: t.surfaceSecondary,
      padding: SPACING.lg,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: t.border,
    },
    selectedVibeText: {
      fontFamily: systemFont,
      fontSize: 16,
      fontWeight: '500',
      color: t.text,
      marginBottom: 4,
    },
    selectedVibeName: {
      fontWeight: '800',
    },
    selectedVibeTime: {
      fontFamily: systemFont,
      fontSize: 13,
      fontWeight: '600',
      color: t.subtext,
    },
  });
};

export default VibeSignal;

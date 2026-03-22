// screens/HeatLevelSettingsScreen.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  Platform,
  StatusBar,
} from 'react-native';
import Icon from '../components/Icon';
import { impact, selection, ImpactFeedbackStyle, NotificationFeedbackType, notification } from '../utils/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useContent } from '../context/ContentContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { SPACING } from '../utils/theme';

const HEAT_LEVELS = [
  {
    level: 1,
    icon: 'spa-outline',
    color: '#5856D6', // iOS Purple
    title: 'Emotional',
    description: 'Intimacy & trust, non-sexual',
  },
  {
    level: 2,
    icon: 'star-four-points-outline',
    color: '#C3113D',
    title: 'Romantic',
    description: 'Flirty attraction & romance',
  },
  {
    level: 3,
    icon: 'cards-heart-outline',
    color: '#FF9500', // iOS Orange
    title: 'Sensual',
    description: 'Relationship-focused desire',
  },
  {
    level: 4,
    icon: 'water-outline',
    color: '#A84848',
    title: 'Steamy',
    description: 'Adventurous & heated topics',
  },
  {
    level: 5,
    icon: 'fire',
    color: '#8A0021', // Deep Crimson
    title: 'Explicit',
    description: 'Intensely passionate exploration',
  },
];

export default function HeatLevelSettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  
  // STRICT Apple Editorial Theme Map 
  const t = useMemo(() => ({
    background: isDark ? '#000000' : '#F2F2F7', 
    surface: isDark ? '#1C1C1E' : '#FFFFFF',
    surfaceSecondary: isDark ? '#2C2C2E' : '#E5E5EA',
    primary: colors.primary,
    accent: colors.accent || '#D4AA7E',
    text: isDark ? '#FFFFFF' : '#000000',
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark, insets), [t, isDark, insets]);
  
  const { userProfile, updateProfile } = useAuth();
  const { loadContentProfile } = useContent();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  
  const [selectedLevel, setSelectedLevel] = useState(3);
  const [isSaving, setIsSaving] = useState(false);

  // Entrance animations
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnimation, {
        toValue: 0,
        friction: 9,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnimation, slideAnimation]);

  useEffect(() => {
    if (userProfile?.heatLevelPreference) {
      setSelectedLevel(userProfile.heatLevelPreference);
    }
  }, [userProfile]);

  const handleLevelSelect = (level) => {
    if (level >= 4 && !isPremium) {
      impact(ImpactFeedbackStyle.Light);
      showPaywall('heatLevels4to5');
      return;
    }
    
    if (level === selectedLevel) return;

    setSelectedLevel(level);
    selection();
  };

  const handleSave = async () => {
    setIsSaving(true);
    impact(ImpactFeedbackStyle.Medium);
    try {
      await updateProfile({
        heatLevelPreference: selectedLevel,
      });

      if (loadContentProfile) {
        await loadContentProfile();
      }
      
      notification(NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      console.error('Failed to update heat level:', error);
      notification(NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update preferences. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    impact(ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />

      {/* Velvet background gradient */}
      <LinearGradient
        colors={isDark 
          ? [t.background, '#0F0A1A', '#0D081A', t.background] 
          : [t.background, '#EBEBF5', t.background]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnimation, transform: [{ translateY: slideAnimation }] }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
            <Icon name="chevron-left" size={32} color={t.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerEditorial}>
          <Text style={styles.headerTitle}>Comfort</Text>
          <Text style={styles.headerSubtitle}>Set your boundary for prompts.</Text>
        </View>
      </Animated.View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        <Animated.View style={{ opacity: fadeAnimation, transform: [{ translateY: slideAnimation }] }}>
          
          <Text style={styles.sectionTitle}>LEVEL</Text>
          <View style={styles.widgetCard}>
            {HEAT_LEVELS.map((heatLevel, index) => {
              const isSelected = selectedLevel === heatLevel.level;
              const isLocked = heatLevel.level >= 4 && !isPremium;
              const isLast = index === HEAT_LEVELS.length - 1;

              return (
                <View key={heatLevel.level}>
                  <TouchableOpacity
                    style={[
                      styles.listOptionRow,
                      isLocked && { opacity: 0.5 }
                    ]}
                    onPress={() => handleLevelSelect(heatLevel.level)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconWrap, { backgroundColor: isSelected ? heatLevel.color + '15' : t.surfaceSecondary }]}>
                      <Icon 
                        name={heatLevel.icon} 
                        size={20} 
                        color={isSelected ? heatLevel.color : t.subtext} 
                      />
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={[styles.optionName, { color: isSelected ? heatLevel.color : t.text }]}>
                        {heatLevel.title}
                      </Text>
                      <Text style={styles.optionDesc} numberOfLines={1}>
                        {heatLevel.description}
                      </Text>
                    </View>
                    {isLocked ? (
                      <Icon name="lock" size={20} color={t.subtext} />
                    ) : isSelected ? (
                      <Icon name="check" size={24} color={heatLevel.color} />
                    ) : null}
                  </TouchableOpacity>
                  {!isLast && <View style={styles.dividerIndent} />}
                </View>
              );
            })}
          </View>

          <View style={styles.infoCard}>
            <Icon name="information" size={20} color={t.subtext} />
            <Text style={styles.infoText}>
              Higher levels automatically include all content from the levels below them.
            </Text>
          </View>

        </Animated.View>
      </ScrollView>

      {/* Sticky Save Button */}
      <Animated.View style={[styles.actionSection, { opacity: fadeAnimation, transform: [{ translateY: slideAnimation }] }]}>
        <TouchableOpacity
          style={[styles.primaryButton, isSaving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <Icon name="loading" size={20} color={isDark ? '#000' : '#FFF'} />
          ) : null}
          <Text style={styles.primaryButtonText}>
            {isSaving ? 'Updating...' : 'Save Comfort Level'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ------------------------------------------------------------------
// STYLES - Apple Editorial (Native Dashboard Look)
// ------------------------------------------------------------------
const createStyles = (t, isDark, insets) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: t.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xxxl + 40,
  },

  // ── Header ──
  header: {
    paddingHorizontal: SPACING.xl,
    paddingTop: Math.max(insets.top, Platform.OS === 'android' ? SPACING.xl : SPACING.sm),
    paddingBottom: SPACING.lg,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    marginLeft: -8, 
  },
  backButton: {
    padding: 8,
  },
  headerEditorial: {
    paddingRight: SPACING.xl, 
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: t.text,
    letterSpacing: 0.3,
    marginBottom: 4,
    fontFamily: Platform.select({ ios: "System", android: "Roboto" }),
  },
  headerSubtitle: {
    fontSize: 15,
    color: t.subtext,
    fontWeight: '500',
  },

  // ── Widgets ──
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: t.subtext,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
    paddingLeft: SPACING.xs,
  },
  widgetCard: {
    backgroundColor: t.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: t.border,
    marginBottom: SPACING.xl,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.04, shadowRadius: 10 },
      android: { elevation: 2 },
    }),
  },

  // ── List Items ──
  listOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18, 
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
  },
  optionName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  optionDesc: {
    fontSize: 14,
    color: t.subtext,
  },
  dividerIndent: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.border,
    marginLeft: 68, // Indent past the icon
  },

  // ── Info Card ──
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.lg,
    borderRadius: 20,
    backgroundColor: t.surfaceSecondary,
    borderWidth: 1,
    borderColor: t.border,
    marginBottom: SPACING.xl,
    gap: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
    color: t.subtext,
    fontWeight: '500',
  },

  // ── Action Button ──
  actionSection: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, SPACING.md) : SPACING.xl,
    paddingTop: SPACING.sm,
    backgroundColor: t.background,
  },
  primaryButton: {
    backgroundColor: t.text, // Solid, high contrast Apple Action Button
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 28,
    gap: 8,
  },
  primaryButtonText: {
    color: t.surface,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
});

/**
 * HeatLevelSettingsScreen.js
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 * Allows users to set boundaries on intimacy prompts.
 * ✅ Full original logic preserved.
 */

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
  ActivityIndicator,
} from 'react-native';
import Icon from '../components/Icon';
import { impact, selection, ImpactFeedbackStyle, NotificationFeedbackType, notification } from '../utils/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useContent } from '../context/ContentContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { PremiumFeature } from '../utils/featureFlags';
import { SPACING, withAlpha } from '../utils/theme';

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

// Editorial Heat Mapping
const HEAT_LEVELS = [
  {
    level: 1,
    icon: 'leaf-outline',
    color: '#FF85C2', // Soft Orchid Pink
    title: 'Emotional',
    description: 'Intimacy & trust, non-sexual',
  },
  {
    level: 2,
    icon: 'sparkles-outline',
    color: '#FF1493', // Deep Pink
    title: 'Romantic',
    description: 'Flirty attraction & romance',
  },
  {
    level: 3,
    icon: 'heart-outline',
    color: '#FF006E', // Vivid Magenta-Red
    title: 'Sensual',
    description: 'Relationship-focused desire',
  },
  {
    level: 4,
    icon: 'flame-outline',
    color: '#F00049', // Carmine
    title: 'Steamy',
    description: 'Adventurous & heated topics',
  },
  {
    level: 5,
    icon: 'infinite-outline',
    color: '#D2121A', // Deep Red (primary)
    title: 'Explicit',
    description: 'Intensely passionate exploration',
  },
];

export default function HeatLevelSettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  
  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    background: colors.background, 
    surface: isDark ? '#131016' : '#FFFFFF',
    surfaceSecondary: isDark ? '#1C1520' : '#F2F2F7',
    primary: colors.primary || '#D2121A', // Sexy Red
    text: colors.text,
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
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
        duration: 500,
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
      showPaywall(PremiumFeature.HEAT_LEVELS_4_5);
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
      Alert.alert('Update Failed', 'We could not save your comfort level. Please try again.');
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
      <StatusBar barStyle="light-content" />

      {/* Velvet background gradient */}
      <LinearGradient
        colors={[t.background, isDark ? '#120206' : '#F9F6F4', t.background]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Editorial Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnimation, transform: [{ translateY: slideAnimation }] }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Icon name="chevron-back" size={28} color={t.text} />
        </TouchableOpacity>
        <View style={styles.headerEditorial}>
          <Text style={styles.headerTitle}>Intensity</Text>
          <Text style={styles.headerSubtitle}>Set your boundary for closeness.</Text>
        </View>
      </Animated.View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        <Animated.View style={{ opacity: fadeAnimation, transform: [{ translateY: slideAnimation }] }}>
          
          <Text style={styles.sectionTitle}>SELECT LEVEL</Text>
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
                    activeOpacity={0.9}
                  >
                    <View style={[styles.iconWrap, { backgroundColor: isSelected ? withAlpha(heatLevel.color, 0.15) : t.surfaceSecondary }]}>
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
                      <Icon name="lock-closed" size={18} color={t.subtext} />
                    ) : isSelected ? (
                      <Icon name="checkmark-circle" size={24} color={heatLevel.color} />
                    ) : null}
                  </TouchableOpacity>
                  {!isLast && <View style={styles.dividerIndent} />}
                </View>
              );
            })}
          </View>

          <View style={styles.infoCard}>
            <Icon name="information-circle-outline" size={24} color={t.subtext} />
            <Text style={styles.infoText}>
              Higher intensity levels automatically unlock all intimate prompts from the levels beneath them.
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
          activeOpacity={0.9}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Apply Changes</Text>
          )}
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
    paddingHorizontal: 24,
    paddingTop: SPACING.sm,
    paddingBottom: 100,
  },

  // ── Header ──
  header: {
    paddingHorizontal: 16,
    paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 40 : 20),
    paddingBottom: 24,
  },
  backButton: {
    padding: 8,
    marginBottom: 8,
  },
  headerEditorial: {
    paddingHorizontal: 8, 
  },
  headerTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 42,
    color: t.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    color: t.subtext,
    fontWeight: '500',
    lineHeight: 22,
  },

  // ── Widgets ──
  sectionTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '900',
    color: t.subtext,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
    marginTop: 32,
    paddingLeft: 4,
  },
  widgetCard: {
    backgroundColor: t.surface,
    borderRadius: 24, // Deep Apple Squircle
    borderWidth: 1,
    borderColor: t.border,
    paddingVertical: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.04, shadowRadius: 10 },
      android: { elevation: 2 },
    }),
  },

  // ── List Items ──
  listOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20, 
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
  },
  optionName: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  optionDesc: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    color: t.subtext,
    fontWeight: '500',
  },
  dividerIndent: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.border,
    marginLeft: 76, 
  },

  // ── Info Card ──
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    borderRadius: 20,
    backgroundColor: withAlpha(t.text, 0.03),
    borderWidth: 1,
    borderColor: t.border,
    marginTop: 32,
    gap: 12,
  },
  infoText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
    color: t.subtext,
    fontWeight: '500',
  },

  // ── Action Button ──
  actionSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 40) : 24,
    paddingTop: 16,
  },
  primaryButton: {
    backgroundColor: t.primary, // Sexy Red Call to Action
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 28,
    gap: 8,
    ...Platform.select({
      ios: { shadowColor: '#D2121A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    textTransform: 'uppercase',
  },
});

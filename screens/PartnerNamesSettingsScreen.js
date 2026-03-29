/**
 * PartnerNamesSettingsScreen.js
 * Sexy Red Intimacy & Apple Editorial Updates Integrated.
 * Allows users to customize how they see themselves and their partner in the app.
 * ✅ Full original logic preserved.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { LinearGradient } from 'expo-linear-gradient';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { NicknameEngine } from '../services/PolishEngine';
import { SPACING, withAlpha } from '../utils/theme';
import Input from '../components/Input';

const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });

export default function PartnerNamesSettingsScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { user, userProfile, updateProfile } = useAuth();
  const { actions } = useAppContext();
  
  const [myName, setMyName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // ─── SEXY RED x APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    background: colors.background, 
    surface: isDark ? '#131016' : '#FFFFFF',
    surfaceSecondary: isDark ? '#1C1520' : '#F2F2F7',
    primary: colors.primary || '#D2121A', // Sexy Red
    accent: colors.accent || '#D4AA7E',
    text: colors.text,
    subtext: isDark ? 'rgba(242,233,230,0.6)' : 'rgba(60, 60, 67, 0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

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
    const nextMyName =
      userProfile?.partnerNames?.myName ||
      userProfile?.displayName ||
      user?.displayName ||
      '';
    const nextPartnerName = userProfile?.partnerNames?.partnerName || '';

    setMyName(nextMyName);
    setPartnerName(nextPartnerName);
  }, [user, userProfile]);

  const handleBack = () => {
    impact(ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleSave = async () => {
    if (!myName.trim() || !partnerName.trim()) {
      notification(NotificationFeedbackType.Error);
      Alert.alert('Missing Names', 'Please enter a name for both you and your partner.');
      return;
    }

    try {
      setIsSaving(true);
      impact(ImpactFeedbackStyle.Medium);

      await updateProfile({
        partnerNames: {
          myName: myName.trim(),
          partnerName: partnerName.trim(),
        },
        display_name: myName.trim(),
        // Persist the recipient-facing partner label to Supabase so the
        // notification trigger can use the name the user assigned their partner.
        preferences: {
          ...(userProfile?.preferences || {}),
          partnerLabel: partnerName.trim(),
        },
      });
      await actions.updateProfile({
        partnerNames: {
          myName: myName.trim(),
          partnerName: partnerName.trim(),
        },
      });

      // Propagate immediately so the rest of the session reflects the new names
      await NicknameEngine.setConfig({
        myNickname: myName.trim(),
        partnerNickname: partnerName.trim(),
      });

      notification(NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      console.error('Failed to update partner names:', error);
      notification(NotificationFeedbackType.Error);
      Alert.alert('Error', 'We could not update your names at this time. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Velvet background gradient */}
      <LinearGradient
        colors={[t.background, isDark ? '#120206' : '#F9F6F4', t.background]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Editorial Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnimation, transform: [{ translateY: slideAnimation }] }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Icon name="chevron-back" size={28} color={t.text} />
          </TouchableOpacity>
          <View style={styles.headerEditorial}>
            <Text style={styles.headerTitle}>Identity</Text>
            <Text style={styles.headerSubtitle}>Customize how you appear in prompts and notifications.</Text>
          </View>
        </Animated.View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={true}
          >
            <Animated.View style={{ opacity: fadeAnimation, transform: [{ translateY: slideAnimation }] }}>
              
              {/* Input Widget */}
              <View style={styles.widgetCard}>
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>YOUR NAME</Text>
                  <Input
                    value={myName}
                    onChangeText={(val) => { setMyName(val); }}
                    placeholder="e.g. Sarah, Me"
                    placeholderTextColor={t.subtext}
                    autoCorrect={false}
                    returnKeyType="next"
                    style={styles.inputOverrides}
                    selectionColor={t.primary}
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>PARTNER'S NAME</Text>
                  <Input
                    value={partnerName}
                    onChangeText={(val) => { setPartnerName(val); }}
                    placeholder="e.g. John, Partner"
                    placeholderTextColor={t.subtext}
                    autoCorrect={false}
                    returnKeyType="done"
                    style={styles.inputOverrides}
                    selectionColor={t.primary}
                  />
                </View>
              </View>

              {/* Examples Widget */}
              <Text style={styles.sectionTitle}>LIVE PREVIEW</Text>
              <View style={styles.widgetCard}>
                <View style={styles.exampleRow}>
                  <View style={[styles.iconWrap, { backgroundColor: withAlpha(t.primary, 0.1) }]}>
                    <Icon name="chatbubble-ellipses-outline" size={20} color={t.primary} />
                  </View>
                  <Text style={styles.exampleText}>
                    "What does <Text style={styles.highlightText}>{myName || 'You'}</Text> love most about <Text style={styles.highlightText}>{partnerName || 'your partner'}</Text>?"
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.exampleRow}>
                  <View style={[styles.iconWrap, { backgroundColor: withAlpha(t.primary, 0.1) }]}>
                    <Icon name="heart-outline" size={20} color={t.primary} />
                  </View>
                  <Text style={styles.exampleText}>
                    "<Text style={styles.highlightText}>{myName || 'Your'}</Text> and <Text style={styles.highlightText}>{partnerName || 'their'}</Text> favorite memory together."
                  </Text>
                </View>
              </View>

              {/* Info Widget */}
              <View style={styles.infoCard}>
                <Icon name="information-circle-outline" size={24} color={t.subtext} />
                <Text style={styles.infoText}>
                  You can change these names anytime. They are strictly for app personalization and will not alter your account identity.
                </Text>
              </View>

            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>

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
      </SafeAreaView>
    </View>
  );
}

// ------------------------------------------------------------------
// STYLES - Apple Editorial (Native Dashboard Look)
// ------------------------------------------------------------------
const createStyles = (t, isDark) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: t.background,
  },
  safeArea: {
    flex: 1,
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
    paddingTop: Platform.OS === 'android' ? 40 : 20,
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
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
    color: t.text,
    marginBottom: 6,
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
  divider: {
    height: 1,
    backgroundColor: t.border,
    marginHorizontal: 20,
  },

  // ── Inputs ──
  inputSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  inputLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 10,
    fontWeight: '800',
    color: t.subtext,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  inputOverrides: {
    fontFamily: SYSTEM_FONT,
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingBottom: 0,
    fontSize: 22,
    fontWeight: '700',
    color: t.text,
    letterSpacing: -0.5,
  },

  // ── Examples ──
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exampleText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    flex: 1,
    lineHeight: 24,
    color: t.text,
    fontWeight: '500',
  },
  highlightText: {
    fontWeight: '800',
    color: t.primary,
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
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
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

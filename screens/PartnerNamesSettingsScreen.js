// screens/PartnerNamesSettingsScreen.js
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { LinearGradient } from 'expo-linear-gradient';
import { impact, notification, selection, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { SPACING } from '../utils/theme';
import Input from '../components/Input';

/**
 * Partner Names Settings Screen
 * Allows users to customize how they see themselves and their partner in the app
 */
export default function PartnerNamesSettingsScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { userProfile, updateProfile } = useAuth();
  
  const [myName, setMyName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

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
    if (userProfile?.partnerNames) {
      setMyName(userProfile.partnerNames.myName || '');
      setPartnerName(userProfile.partnerNames.partnerName || '');
    }
  }, [userProfile]);

  const handleBack = () => {
    impact(ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleSave = async () => {
    if (!myName.trim() || !partnerName.trim()) {
      notification(NotificationFeedbackType.Error);
      Alert.alert('Names Required', 'Please enter both names');
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
      });

      notification(NotificationFeedbackType.Success);
      Alert.alert('Success', 'Partner names updated successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Failed to update partner names:', error);
      notification(NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update names. Please try again.');
    } finally {
      setIsSaving(false);
    }
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

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnimation, transform: [{ translateY: slideAnimation }] }]}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
              <Icon name="chevron-left" size={32} color={t.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.headerEditorial}>
            <Text style={styles.headerTitle}>Names</Text>
            <Text style={styles.headerSubtitle}>Customize how you appear in prompts.</Text>
          </View>
        </Animated.View>

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
                <Text style={styles.inputLabel}>My Name</Text>
                <Input
                  value={myName}
                  onChangeText={(val) => { selection(); setMyName(val); }}
                  placeholder="e.g. Sarah, Alex, Me"
                  autoCorrect={false}
                  returnKeyType="next"
                  style={styles.inputOverrides}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>My Partner's Name</Text>
                <Input
                  value={partnerName}
                  onChangeText={(val) => { selection(); setPartnerName(val); }}
                  placeholder="e.g. John, Emma, Partner"
                  autoCorrect={false}
                  returnKeyType="done"
                  style={styles.inputOverrides}
                />
              </View>
            </View>

            {/* Examples Widget */}
            <Text style={styles.sectionTitle}>Preview</Text>
            <View style={styles.widgetCard}>
              <View style={styles.exampleRow}>
                <View style={[styles.iconWrap, { backgroundColor: t.primary + '15' }]}>
                  <Icon name="chat-processing" size={18} color={t.primary} />
                </View>
                <Text style={styles.exampleText}>
                  "What does <Text style={styles.highlightText}>{myName || 'You'}</Text> love most about <Text style={styles.highlightText}>{partnerName || 'your partner'}</Text>?"
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.exampleRow}>
                <View style={[styles.iconWrap, { backgroundColor: t.accent + '15' }]}>
                  <Icon name="cards-heart" size={18} color={t.accent} />
                </View>
                <Text style={styles.exampleText}>
                  "<Text style={styles.highlightText}>{myName || 'Your'}</Text> and <Text style={styles.highlightText}>{partnerName || 'their'}</Text> favorite memory"
                </Text>
              </View>
            </View>

            {/* Info Widget */}
            <View style={styles.infoCard}>
              <Icon name="information" size={20} color={t.subtext} />
              <Text style={styles.infoText}>
                You can change these names anytime. They're just for personalization and won't affect your account details.
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
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Text>
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
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xxxl + 40,
  },

  // ── Header ──
  header: {
    paddingHorizontal: SPACING.xl,
    paddingTop: Platform.OS === 'android' ? SPACING.xl : SPACING.sm,
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
    fontSize: 14,
    fontWeight: '700',
    color: t.subtext,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
    paddingLeft: SPACING.xs,
  },
  widgetCard: {
    backgroundColor: t.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: t.border,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.xl,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.04, shadowRadius: 10 },
      android: { elevation: 2 },
    }),
  },
  divider: {
    height: 1,
    backgroundColor: t.border,
    marginHorizontal: SPACING.lg,
  },

  // ── Inputs ──
  inputSection: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: t.subtext,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  inputOverrides: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingBottom: 0,
    fontSize: 17,
    fontWeight: '500',
    color: t.text,
  },

  // ── Examples ──
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exampleText: {
    fontSize: 15,
    flex: 1,
    lineHeight: 22,
    color: t.text,
    fontWeight: '400',
  },
  highlightText: {
    fontWeight: '700',
    color: t.primary,
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
    paddingBottom: Platform.OS === 'ios' ? SPACING.md : SPACING.xl,
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

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
  ActivityIndicator,
  TextInput,
} from 'react-native';
import Icon from '../components/Icon';
import { impact, notification, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { NicknameEngine } from '../services/PolishEngine';
import {
  BORDER_RADIUS,
  SPACING,
  SYSTEM_FONT,
  TYPOGRAPHY,
  getShadows,
  withAlpha,
} from '../utils/theme';
import EditorialScreenScaffold from '../components/EditorialScreenScaffold';

export default function PartnerNamesSettingsScreen({ navigation }) {
  const { colors } = useTheme();
  const { user, userProfile, updateProfile } = useAuth();
  
  const [myName, setMyName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const t = useMemo(() => ({
    surface: colors.surface,
    surfaceSecondary: colors.surface2 || colors.surface,
    surfaceGlass: colors.surfaceGlass || colors.surface,
    primary: colors.primary,
    text: colors.text,
    subtext: colors.textMuted || colors.textSecondary,
    border: colors.borderGlass || colors.border,
  }), [colors]);

  const shadows = useMemo(() => getShadows(colors), [colors]);
  const styles = useMemo(() => createStyles(t, shadows), [t, shadows]);

  // Entrance animations
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const anim = Animated.parallel([
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
    ]);
    anim.start();
    return () => anim.stop();
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

      // Update profile via AuthContext (handles both Supabase and local state)
      await updateProfile({
        partnerNames: {
          myName: myName.trim(),
          partnerName: partnerName.trim(),
        },
        display_name: myName.trim(),
        displayName: myName.trim(),
        // Persist the recipient-facing partner label to Supabase so the
        // notification trigger can use the name the user assigned their partner.
        preferences: {
          ...(userProfile?.preferences || {}),
          partnerLabel: partnerName.trim(),
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
      if (__DEV__) console.error('Failed to update partner names:', error);
      notification(NotificationFeedbackType.Error);
      Alert.alert('Error', 'We could not update your names at this time. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <EditorialScreenScaffold
      navigation={navigation}
      headerTitle="Identity"
      headerSubtitle="ACTIVE PROFILE"
      screenAccentColor={t.primary}
      scroll={false}
      bodyStyle={styles.body}
      keyboardAvoiding
      onBack={handleBack}
      footer={(
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
      )}
    >
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={true}
          >
            <Animated.View style={{ opacity: fadeAnimation, transform: [{ translateY: slideAnimation }] }}>
              <Text style={[styles.sectionTitle, styles.firstSectionTitle]}>NAMES</Text>
              <View style={styles.widgetCard}>
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>YOUR NAME</Text>
                  <TextInput
                    value={myName}
                    onChangeText={(val) => { setMyName(val); }}
                    placeholder="e.g. Sarah, Me"
                    placeholderTextColor={t.subtext}
                    autoCorrect={false}
                    returnKeyType="next"
                    style={styles.inputOverrides}
                    selectionColor={t.primary}
                    accessibilityLabel="Your name"
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>PARTNER'S NAME</Text>
                  <TextInput
                    value={partnerName}
                    onChangeText={(val) => { setPartnerName(val); }}
                    placeholder="e.g. John, Partner"
                    placeholderTextColor={t.subtext}
                    autoCorrect={false}
                    returnKeyType="done"
                    style={styles.inputOverrides}
                    selectionColor={t.primary}
                    accessibilityLabel="Partner's name"
                  />
                </View>
              </View>

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

              <View style={styles.infoCard}>
                <Icon name="information-circle-outline" size={24} color={t.subtext} />
                <Text style={styles.infoText}>
                  You can change these names anytime. They are strictly for app personalization and will not alter your account identity.
                </Text>
              </View>

            </Animated.View>
          </ScrollView>
    </EditorialScreenScaffold>
  );
}

const createStyles = (t, shadows) => StyleSheet.create({
  body: {
    paddingHorizontal: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.screen,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xxxl * 2,
  },
  sectionTitle: {
    ...TYPOGRAPHY.label,
    color: t.subtext,
    marginBottom: SPACING.md,
    marginTop: SPACING.section,
    paddingLeft: SPACING.xs,
  },
  firstSectionTitle: {
    marginTop: 0,
  },
  widgetCard: {
    backgroundColor: t.surface,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    borderColor: t.border,
    paddingVertical: SPACING.sm,
    ...shadows.small,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.border,
    marginHorizontal: SPACING.xl,
  },
  inputSection: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  inputLabel: {
    ...TYPOGRAPHY.label,
    color: t.subtext,
    marginBottom: SPACING.sm,
  },
  inputOverrides: {
    fontFamily: SYSTEM_FONT,
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    margin: 0,
    minHeight: 34,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: t.text,
    letterSpacing: 0,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl,
    gap: SPACING.lg,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.full,
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
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: t.surfaceGlass,
    borderWidth: 1,
    borderColor: t.border,
    marginTop: SPACING.section,
    gap: SPACING.md,
  },
  infoText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
    color: t.subtext,
    fontWeight: '500',
  },
  actionSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.screen,
    paddingBottom: Platform.OS === 'ios' ? SPACING.xxl + SPACING.md : SPACING.screen,
    paddingTop: SPACING.lg,
  },
  primaryButton: {
    backgroundColor: t.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.sm,
    ...shadows.glow,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
});

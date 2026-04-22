import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Platform,
  Linking,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { impact, ImpactFeedbackStyle } from '../utils/haptics';
import Icon from '../components/Icon';
import { SPACING, withAlpha } from '../utils/theme';
import EditorialScreenScaffold from '../components/EditorialScreenScaffold';

/**
 * Delete Account Screen
 * Apple Editorial & Velvet Glass Design Implementation
 * Guides users carefully through the destructive GDPR/CCPA process.
 */
export default function DeleteAccountScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { deleteUserAccount, signOutLocal } = useAuth();
  const { isPremiumEffective: isPremium } = useEntitlements();
  
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // ─── APPLE EDITORIAL THEME MAP ───
  const t = useMemo(() => ({
    background: colors.background,
    surface: colors.surface,
    surfaceSecondary: colors.surface2,
    primary: colors.primary || '#D2121A',
    text: colors.text,
    subtext: colors.textMuted,
    border: colors.border,
    danger: colors.primary || '#D2121A',
  }), [colors]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  const handleTextChange = (text) => {
    setConfirmText(text);
    if (text.trim().toLowerCase() === 'delete' && confirmText.trim().toLowerCase() !== 'delete') {
      impact(ImpactFeedbackStyle.Heavy);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmText.trim().toLowerCase() !== 'delete') {
      impact(ImpactFeedbackStyle.Light);
      Alert.alert('Confirmation Required', 'Please type DELETE to confirm');
      return;
    }

    impact(ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Final Confirmation',
      'This action cannot be undone. All your data will be permanently deleted within 30 days.\n\nAre you absolutely sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              impact(ImpactFeedbackStyle.Heavy);
              await deleteUserAccount();
              Alert.alert(
                'Account Deleted',
                'Your account and all data have been scheduled for deletion. You will be signed out now.',
                [{ text: 'OK' }]
              );
            } catch (error) {
              if (__DEV__) console.error('Delete account error:', error);
              Alert.alert(
                'Error',
                'Failed to delete account. Please try again or contact support.',
                [{ text: 'OK' }]
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <EditorialScreenScaffold
      navigation={navigation}
      headerTitle="Delete Account"
      heroIcon="warning-outline"
      heroTitle="Delete Account"
      heroSubtitle="This action is permanent and cannot be undone."
      heroTint={t.danger}
      heroTitleColor={t.danger}
      keyboardAvoiding
      backIconName="arrow-back-outline"
    >
          {/* ─── What Will Be Deleted (Danger Card) ─── */}
          <View style={[styles.card, { backgroundColor: withAlpha(t.danger, 0.05), borderColor: withAlpha(t.danger, 0.2) }]}>
            <Text style={[styles.cardTitle, { color: t.danger }]}>What Will Be Deleted</Text>
            
            {[
              'All journal entries (cannot be recovered)',
              'All prompt responses',
              'Account information and preferences',
              'Partner connection (your partner will be notified)',
              'Premium subscription access',
              'All date night plans'
            ].map((item, idx) => (
              <View key={idx} style={styles.listItem}>
                <Icon name="close-circle" size={18} color={t.danger} />
                <Text style={[styles.listText, { color: t.text }]}>{item}</Text>
              </View>
            ))}
          </View>

          {/* ─── Before You Go ─── */}
          <View style={styles.card}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Before You Go</Text>
            <Text style={[styles.cardText, { color: t.subtext }]}>
              Your subscription will be cancelled, but you won't receive a refund for the current period. If you're linked with a partner, they will lose premium access if you're the subscriber. You can create a new account later, but your data cannot be restored.
            </Text>
            
            <TouchableOpacity
              style={[styles.actionRow, { backgroundColor: t.surfaceSecondary }]}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('ExportData')}
            >
              <View style={styles.actionInfo}>
                <Text style={[styles.actionTitle, { color: t.text }]}>Export My Data</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={t.border} />
            </TouchableOpacity>
          </View>

          {/* ─── Alternative Options ─── */}
          <View style={styles.card}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Need a Break Instead?</Text>
            <Text style={[styles.cardText, { color: t.subtext, marginBottom: SPACING.md }]}>
              Your account stays on our servers, but signing out clears this device's session and local cache. Consider these alternatives:
            </Text>
            
            <TouchableOpacity
              style={[styles.actionRow, { backgroundColor: t.surfaceSecondary, marginBottom: 8 }]}
              activeOpacity={0.7}
              onPress={async () => {
                Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign Out', style: 'destructive', onPress: async () => {
                      try { await signOutLocal(); } catch (error) { Alert.alert('Error', 'Failed to sign out.'); }
                  }},
                ]);
              }}
            >
              <View style={styles.actionInfo}>
                <Text style={[styles.actionTitle, { color: t.text }]}>Sign out temporarily</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={t.border} />
            </TouchableOpacity>

            {isPremium && (
              <TouchableOpacity
                style={[styles.actionRow, { backgroundColor: t.surfaceSecondary, marginBottom: 8 }]}
                activeOpacity={0.7}
                onPress={() => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('https://apps.apple.com/account/subscriptions');
                  } else {
                    Linking.openURL('https://play.google.com/store/account/subscriptions');
                  }
                }}
              >
                <View style={styles.actionInfo}>
                  <Text style={[styles.actionTitle, { color: t.text }]}>Cancel subscription</Text>
                </View>
                <Icon name="chevron-forward" size={20} color={t.border} />
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[styles.actionRow, { backgroundColor: t.surfaceSecondary }]}
              activeOpacity={0.7}
              onPress={() => {
                Alert.alert(
                  'Unlink Partner',
                  'To unlink from your partner, go back to Settings and tap "Partner" under the connection section.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Go to Settings', onPress: () => navigation.popToTop() }
                  ]
                );
              }}
            >
              <View style={styles.actionInfo}>
                <Text style={[styles.actionTitle, { color: t.text }]}>Unlink from partner</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={t.border} />
            </TouchableOpacity>
          </View>

          {/* ─── Confirmation Input ─── */}
          <View style={[styles.card, styles.confirmCard]}>
            <Text style={[styles.confirmTitle, { color: t.text }]}>
              Type DELETE to confirm
            </Text>
            <Text style={[styles.confirmSubtitle, { color: t.subtext }]}>
              This helps prevent accidental deletions.
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: t.surfaceSecondary,
                  color: t.text,
                  borderColor: confirmText.trim().toLowerCase() === 'delete' ? t.danger : t.border,
                },
              ]}
              placeholder="Type DELETE here"
              placeholderTextColor={t.subtext}
              value={confirmText}
              onChangeText={handleTextChange}
              autoCapitalize="characters"
              autoCorrect={false}
              accessibilityLabel="Confirmation field"
            />
          </View>

          {/* ─── Actions ─── */}
          
          {/* Primary Action (Save them!) -> Uses Sexy Red */}
          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: t.primary }]}
            activeOpacity={0.8}
            onPress={() => navigation.goBack()}
            disabled={isDeleting}
          >
            <Text style={styles.btnPrimaryText}>
              Cancel, Keep My Account
            </Text>
          </TouchableOpacity>

          {/* Destructive Action -> Uses native iOS Danger Red */}
          <TouchableOpacity
            style={[
              styles.btnDestructive,
              {
                borderColor: t.danger,
                opacity: confirmText.trim().toLowerCase() === 'delete' ? 1 : 0.4,
              },
            ]}
            activeOpacity={0.7}
            onPress={handleDeleteAccount}
            disabled={isDeleting || confirmText.trim().toLowerCase() !== 'delete'}
          >
            {isDeleting ? (
                <ActivityIndicator color={t.danger} />
              ) : (
                <>
                  <Icon name="trash-outline" size={20} color={t.danger} />
                  <Text style={[styles.btnDestructiveText, { color: t.danger }]}>Delete My Account Forever</Text>
                </>
              )}
          </TouchableOpacity>

          <Text style={[styles.legalText, { color: t.subtext }]}>
            Account deletion is permanent and complies with GDPR and CCPA right to erasure. 
            All data will be permanently deleted within 30 days. Some anonymized usage data may 
            be retained for legal and security purposes.
          </Text>

    </EditorialScreenScaffold>
  );
}

const systemFont = Platform.select({ ios: "System", android: "Roboto" });

const createStyles = (t, isDark) => StyleSheet.create({
  card: {
    backgroundColor: t.surface,
    borderRadius: 24,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: t.border,
  },
  cardTitle: {
    fontFamily: systemFont,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: SPACING.md,
  },
  cardText: {
    fontFamily: systemFont,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },

  // Lists
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
    gap: 12,
  },
  listText: {
    fontFamily: systemFont,
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
    fontWeight: '500',
  },

  // Action Rows
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: 16,
    marginTop: SPACING.md,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontFamily: systemFont,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },

  // Confirm Card
  confirmCard: {
    marginTop: SPACING.sm,
  },
  confirmTitle: {
    fontFamily: systemFont,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  confirmSubtitle: {
    fontFamily: systemFont,
    fontSize: 14,
    marginBottom: SPACING.lg,
  },
  input: {
    fontFamily: systemFont,
    paddingVertical: 16,
    paddingHorizontal: SPACING.lg,
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Buttons
  btnPrimary: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  btnPrimaryText: {
    fontFamily: systemFont,
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  btnDestructive: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginBottom: SPACING.xl,
    gap: 8,
  },
  btnDestructiveText: {
    fontFamily: systemFont,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  // Legal
  legalText: {
    fontFamily: systemFont,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: SPACING.md,
  },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

/**
 * Delete Account Screen
 * Allows users to permanently delete their account and all data
 * GDPR/CCPA compliance feature
 */
const DeleteAccountScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { user, deleteUserAccount } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (confirmText.toLowerCase() !== 'delete') {
      Alert.alert('Confirmation Required', 'Please type DELETE to confirm');
      return;
    }

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

              // Delete account
              await deleteUserAccount();

              Alert.alert(
                'Account Deleted',
                'Your account and all data have been scheduled for deletion. You will be signed out now.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Navigation will be handled by auth state change
                    },
                  },
                ]
              );
            } catch (error) {
              console.error('Delete account error:', error);
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Delete Account</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          {/* Warning Icon */}
          <View style={[styles.iconContainer, { backgroundColor: colors.error + '20' }]}>
            <Ionicons name="warning" size={48} color={colors.error} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.error }]}>Delete Account</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            This action is permanent and cannot be undone
          </Text>

          {/* What Will Be Deleted */}
          <View style={[styles.card, { backgroundColor: colors.error + '10', borderColor: colors.error }]}>
            <Text style={[styles.cardTitle, { color: colors.error }]}>What Will Be Deleted</Text>
            
            <View style={styles.listItem}>
              <Ionicons name="close-circle" size={20} color={colors.error} />
              <Text style={[styles.listText, { color: colors.textSecondary }]}>
                All journal entries (cannot be recovered)
              </Text>
            </View>

            <View style={styles.listItem}>
              <Ionicons name="close-circle" size={20} color={colors.error} />
              <Text style={[styles.listText, { color: colors.textSecondary }]}>
                All prompt responses
              </Text>
            </View>

            <View style={styles.listItem}>
              <Ionicons name="close-circle" size={20} color={colors.error} />
              <Text style={[styles.listText, { color: colors.textSecondary }]}>
                Account information and preferences
              </Text>
            </View>

            <View style={styles.listItem}>
              <Ionicons name="close-circle" size={20} color={colors.error} />
              <Text style={[styles.listText, { color: colors.textSecondary }]}>
                Partner connection (your partner will be notified)
              </Text>
            </View>

            <View style={styles.listItem}>
              <Ionicons name="close-circle" size={20} color={colors.error} />
              <Text style={[styles.listText, { color: colors.textSecondary }]}>
                Premium subscription access
              </Text>
            </View>

            <View style={styles.listItem}>
              <Ionicons name="close-circle" size={20} color={colors.error} />
              <Text style={[styles.listText, { color: colors.textSecondary }]}>
                All custom rituals and date night plans
              </Text>
            </View>
          </View>

          {/* Before You Go */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Before You Go</Text>
            <Text style={[styles.cardText, { color: colors.textSecondary }]}>
              • Consider exporting your data first (Settings → Export My Data){'\n\n'}
              • Your subscription will be cancelled, but you won't receive a refund for the current period{'\n\n'}
              • If you're linked with a partner, they will lose premium access if you're the subscriber{'\n\n'}
              • You can create a new account later, but your data cannot be restored
            </Text>
          </View>

          {/* Alternative Options */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Need a Break Instead?</Text>
            <Text style={[styles.cardText, { color: colors.textSecondary }]}>
              If you're not ready to delete everything, you can:{'\n\n'}
              • Sign out and take a break{'\n'}
              • Cancel your subscription but keep your account{'\n'}
              • Unlink from your partner temporarily{'\n\n'}
              Your data will be safe and waiting when you return.
            </Text>
          </View>

          {/* Confirmation Input */}
          <View style={[styles.confirmCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.confirmTitle, { color: colors.text }]}>
              Type DELETE to confirm
            </Text>
            <Text style={[styles.confirmSubtitle, { color: colors.textSecondary }]}>
              This helps prevent accidental deletions
            </Text>
            <TextInput
              style={[
                styles.confirmInput,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Type DELETE here"
              placeholderTextColor={colors.textSecondary}
              value={confirmText}
              onChangeText={setConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
              accessibilityLabel="Confirmation field"
              accessibilityHint="Type DELETE in capital letters to confirm account deletion"
            />
          </View>

          {/* Delete Button */}
          <TouchableOpacity
            style={[
              styles.deleteButton,
              {
                backgroundColor: confirmText.toLowerCase() === 'delete' ? colors.error : colors.border,
              },
            ]}
            onPress={handleDeleteAccount}
            disabled={isDeleting || confirmText.toLowerCase() !== 'delete'}
            accessibilityRole="button"
            accessibilityLabel="Delete my account forever"
            accessibilityState={{ disabled: isDeleting || confirmText.toLowerCase() !== 'delete' }}
          >
            {isDeleting ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <>
                  <Ionicons name="trash" size={20} color={colors.text} />
                  <Text style={[styles.deleteButtonText, { color: colors.text }]}>Delete My Account Forever</Text>
                </>
              )}
          </TouchableOpacity>

          {/* Cancel Button */}
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: colors.border }]}
            onPress={() => navigation.goBack()}
            disabled={isDeleting}
            accessibilityRole="button"
            accessibilityLabel="Cancel, keep my account"
          >
            <Text style={[styles.cancelButtonText, { color: colors.text }]}>
              Cancel, Keep My Account
            </Text>
          </TouchableOpacity>

          {/* Legal Text */}
          <Text style={[styles.legalText, { color: colors.textSecondary }]}>
            Account deletion is permanent and complies with GDPR and CCPA right to erasure. 
            All data will be permanently deleted within 30 days. Some anonymized usage data may 
            be retained for legal and security purposes.
          </Text>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  card: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  cardText: {
    fontSize: 14,
    lineHeight: 22,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  listText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  confirmCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  confirmSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  confirmInput: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  legalText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});

export default DeleteAccountScreen;

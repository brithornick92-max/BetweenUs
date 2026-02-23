/**
 * InsideJokesScreen — Full-page Private Language Vault
 * 
 * Accessed from HomeScreen or Settings.
 * Shows the full list of nicknames, jokes, rituals, and shared references.
 */

import React, { useEffect } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import InsideJokes from '../components/InsideJokes';

export default function InsideJokesScreen({ navigation }) {
  const { colors } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();

  const headerBar = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
        <MaterialCommunityIcons name="arrow-left" size={26} color={colors.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.text }]}>Our Private Language</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (!isPremium) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {headerBar}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
          <MaterialCommunityIcons name="lock-outline" size={56} color={colors.primary} style={{ marginBottom: 16 }} />
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '600', marginBottom: 8, textAlign: 'center' }}>
            Inside Jokes is Premium
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
            Your private language vault — nicknames, jokes, and shared references — is a premium feature.
          </Text>
          <TouchableOpacity
            onPress={() => showPaywall?.('unlimitedJournalHistory')}
            style={{ backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 }}
            activeOpacity={0.85}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Upgrade to Premium</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {headerBar}
      <InsideJokes compact={false} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
});

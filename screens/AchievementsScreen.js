import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { evaluateAchievements } from '../utils/achievementEngine';
import DataLayer from '../services/data/DataLayer';

const CATEGORY_LABELS = {
  journal: 'Journal',
  prompt: 'Prompts',
  checkin: 'Check-ins',
  lovenote: 'Love Notes',
  memory: 'Memories',
  ritual: 'Rituals',
  vibe: 'Vibes',
  exploration: 'Exploration',
};

export default function AchievementsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  const styles = createStyles(colors);

  const load = useCallback(async () => {
    try {
      const dl = await DataLayer.getInstance();
      const results = await evaluateAchievements(dl);
      setAchievements(results || []);
    } catch {
      setAchievements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unlocked = achievements.filter((a) => a.unlocked);
  const locked = achievements.filter((a) => !a.unlocked);

  const renderItem = ({ item }) => {
    const progressPercent = Math.round((item.progress || 0) * 100);
    return (
      <View
        style={[styles.card, !item.unlocked && styles.cardLocked]}
        accessibilityLabel={`${item.name}: ${item.description}. ${item.unlocked ? 'Unlocked' : `${progressPercent}% complete`}`}
        accessibilityRole="text"
      >
        <Text style={styles.icon}>{item.icon}</Text>
        <View style={styles.cardBody}>
          <Text style={[styles.name, !item.unlocked && styles.nameLocked]}>{item.name}</Text>
          <Text style={styles.description}>{item.description}</Text>
          {!item.unlocked && (
            <View style={styles.progressBar} accessibilityLabel={`${progressPercent}% progress`}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>
          )}
        </View>
        {item.unlocked && <Text style={styles.checkmark}>✓</Text>}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} accessibilityRole="header">Achievements</Text>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={[...unlocked, ...locked]}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={styles.summary} accessibilityRole="text">
              {unlocked.length} of {achievements.length} unlocked
            </Text>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 60,
    },
    backText: {
      fontSize: 17,
      color: colors.primary,
    },
    title: {
      flex: 1,
      textAlign: 'center',
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    headerRight: {
      width: 60,
    },
    loader: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    summary: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 16,
    },
    list: {
      padding: 16,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
    },
    cardLocked: {
      opacity: 0.55,
    },
    icon: {
      fontSize: 28,
      marginRight: 14,
    },
    cardBody: {
      flex: 1,
    },
    name: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    nameLocked: {
      color: colors.textSecondary,
    },
    description: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    progressBar: {
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      marginTop: 8,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 2,
    },
    checkmark: {
      fontSize: 18,
      color: colors.primary,
      marginLeft: 8,
    },
  });
}

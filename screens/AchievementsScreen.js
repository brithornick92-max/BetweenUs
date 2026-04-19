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
import { evaluateAchievements } from '../utils/achievementEngine';
import DataLayer from '../services/data/DataLayer';

export default function AchievementsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);

  const styles = createStyles(colors);

  const load = useCallback(async () => {
    try {
      const dl = await DataLayer.getInstance();
      const results = await evaluateAchievements(dl);
      setMilestones(results || []);
    } catch {
      setMilestones([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reached = milestones.filter((m) => m.unlocked);
  const ahead = milestones.filter((m) => !m.unlocked);

  const renderReached = ({ item }) => (
    <View
      style={styles.card}
      accessibilityLabel={`${item.name}: ${item.description}`}
      accessibilityRole="text"
    >
      <Text style={styles.icon}>{item.icon}</Text>
      <View style={styles.cardBody}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>
    </View>
  );

  const renderAhead = ({ item }) => (
    <View
      style={styles.cardAhead}
      accessibilityLabel={item.description}
      accessibilityRole="text"
    >
      <Text style={styles.iconAhead}>{item.icon}</Text>
      <Text style={styles.descriptionAhead}>{item.description}</Text>
    </View>
  );

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
        <Text style={styles.title} accessibilityRole="header">Your Story</Text>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={[
            ...(reached.length > 0 ? [{ _type: 'section', id: '_s1', label: 'Moments you\'ve shared' }] : []),
            ...reached.map((m) => ({ ...m, _type: 'reached' })),
            ...(ahead.length > 0 ? [{ _type: 'section', id: '_s2', label: 'Still ahead…' }] : []),
            ...ahead.map((m) => ({ ...m, _type: 'ahead' })),
          ]}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            if (item._type === 'section') {
              return <Text style={styles.sectionLabel}>{item.label}</Text>;
            }
            if (item._type === 'reached') return renderReached({ item });
            return renderAhead({ item });
          }}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>Your story is just beginning.</Text>
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
    list: {
      padding: 16,
      paddingBottom: 40,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginTop: 20,
      marginBottom: 10,
      marginLeft: 2,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
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
    description: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    cardAhead: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 4,
      marginBottom: 6,
    },
    iconAhead: {
      fontSize: 20,
      marginRight: 12,
      opacity: 0.4,
    },
    descriptionAhead: {
      fontSize: 13,
      color: colors.textSecondary,
      opacity: 0.6,
      flex: 1,
    },
    empty: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 60,
    },
  });
}

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { evaluateAchievements } from '../utils/achievementEngine';
import DataLayer from '../services/data/DataLayer';
import Icon from '../components/Icon';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';
import { impact, ImpactFeedbackStyle } from '../utils/haptics';
import { SPACING, withAlpha } from '../utils/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });
const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif' });

export default function AchievementsScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);

  const t = useMemo(() => ({
    background: colors.background,
    surface: colors.surface || (isDark ? '#1C1C1E' : '#FFFFFF'),
    surfaceSecondary: colors.surface2 || (isDark ? '#2C2C2E' : '#F2F2F7'),
    primary: colors.primary || '#D2121A',
    accent: colors.accent || '#D4AA7E',
    text: colors.text,
    subtext: colors.textMuted || (isDark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.6)'),
    border: colors.border || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

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
    <Animated.View entering={FadeInDown.springify().damping(18)}>
      <View style={styles.card} accessibilityLabel={`${item.name}: ${item.description}`} accessibilityRole="text">
        <Text style={styles.icon}>{item.icon}</Text>
        <View style={styles.cardBody}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.description}>{item.description}</Text>
        </View>
        <Icon name="checkmark-circle-outline" size={20} color={t.primary} />
      </View>
    </Animated.View>
  );

  const renderAhead = ({ item }) => (
    <View style={styles.cardAhead} accessibilityLabel={item.description} accessibilityRole="text">
      <Text style={styles.iconAhead}>{item.icon}</Text>
      <Text style={styles.descriptionAhead}>{item.description}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient
        colors={isDark ? [t.background, '#120206', '#0A0003', t.background] : [t.background, t.surfaceSecondary, t.background]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <GlowOrb color={t.primary} size={460} top={-180} left={SCREEN_W - 220} opacity={isDark ? 0.18 : 0.08} />
      <GlowOrb color={t.accent} size={260} top={580} left={-80} opacity={isDark ? 0.12 : 0.05} />
      <FilmGrain opacity={0.1} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.navHeader}>
          <TouchableOpacity
            onPress={() => { impact(ImpactFeedbackStyle.Light); navigation.goBack(); }}
            style={styles.iconButton}
            hitSlop={16}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Icon name="arrow-back" size={24} color={t.text} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={t.primary} />
          </View>
        ) : (
          <FlatList
            data={[
              { _type: 'header', id: '_header' },
              ...(reached.length > 0 ? [{ _type: 'section', id: '_s1', label: "Moments you've shared" }] : []),
              ...reached.map((m) => ({ ...m, _type: 'reached' })),
              ...(ahead.length > 0 ? [{ _type: 'section', id: '_s2', label: 'Still ahead…' }] : []),
              ...ahead.map((m) => ({ ...m, _type: 'ahead' })),
            ]}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => {
              if (item._type === 'header') {
                return (
                  <Animated.View entering={FadeIn.duration(500)} style={styles.editorialHeader}>
                    <Text style={[styles.headerSubtitle, { color: t.primary }]}>YOUR JOURNEY</Text>
                    <Text style={[styles.headerTitle, { color: t.text }]}>Your Story</Text>
                  </Animated.View>
                );
              }
              if (item._type === 'section') {
                return <Text style={[styles.sectionLabel, { color: t.subtext }]}>{item.label}</Text>;
              }
              if (item._type === 'reached') return renderReached({ item, index });
              return renderAhead({ item });
            }}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: t.subtext }]}>Your story is just beginning.</Text>
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function createStyles(t, isDark) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.background },
    safeArea: { flex: 1 },
    navHeader: {
      paddingHorizontal: SPACING.screen,
      paddingTop: 12,
      paddingBottom: 4,
      flexDirection: 'row',
      zIndex: 10,
    },
    iconButton: { padding: 8, marginLeft: -8 },
    editorialHeader: {
      paddingTop: SPACING.md,
      paddingBottom: SPACING.lg,
    },
    headerSubtitle: {
      fontFamily: SYSTEM_FONT,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 2,
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    headerTitle: {
      fontFamily: SYSTEM_FONT,
      fontSize: 34,
      fontWeight: '800',
      letterSpacing: -0.5,
      lineHeight: 40,
    },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: {
      paddingHorizontal: SPACING.screen,
      paddingBottom: 160,
    },
    sectionLabel: {
      fontFamily: SYSTEM_FONT,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginTop: SPACING.xl,
      marginBottom: SPACING.md,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: t.border,
      padding: SPACING.lg,
      marginBottom: SPACING.sm,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.3 : 0.06, shadowRadius: 12 },
        android: { elevation: 3 },
      }),
    },
    icon: { fontSize: 28, marginRight: SPACING.md },
    cardBody: { flex: 1 },
    name: {
      fontFamily: SYSTEM_FONT,
      fontSize: 15,
      fontWeight: '700',
      color: t.text,
      marginBottom: 2,
    },
    description: {
      fontFamily: SYSTEM_FONT,
      fontSize: 13,
      fontWeight: '400',
      color: t.subtext,
    },
    cardAhead: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 4,
      marginBottom: 6,
      opacity: 0.5,
    },
    iconAhead: { fontSize: 20, marginRight: SPACING.md },
    descriptionAhead: {
      fontFamily: SYSTEM_FONT,
      fontSize: 13,
      fontWeight: '400',
      color: t.subtext,
      flex: 1,
    },
    empty: {
      fontFamily: SYSTEM_FONT,
      fontSize: 15,
      textAlign: 'center',
      marginTop: 60,
    },
  });
}

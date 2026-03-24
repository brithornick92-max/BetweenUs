/**
 * InsideJokesScreen — Full-page Private Language Vault
 * Integrated with Velvet Glass & Apple Editorial System
 * * Accessed from HomeScreen or Settings.
 * Shows the full list of nicknames, jokes, rituals, and shared references.
 */

import React, { useEffect, useMemo } from 'react';
import { 
  SafeAreaView, 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  StatusBar,
  Dimensions,
  Platform
} from 'react-native';
import Icon from '../components/Icon';
import { LinearGradient } from 'expo-linear-gradient';
import ReAnimated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { selection, impact, ImpactFeedbackStyle } from '../utils/haptics';
import { PremiumFeature } from '../utils/featureFlags';
import { withAlpha, SPACING, BORDER_RADIUS } from '../utils/theme';
import InsideJokes from '../components/InsideJokes';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';

const { width: SCREEN_W } = Dimensions.get('window');

export default function InsideJokesScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();

  // Integrated logic: Haptic on entry
  useEffect(() => {
    impact(ImpactFeedbackStyle.Light);
  }, []);

  const headerBar = (
    <View style={styles.header}>
      <TouchableOpacity 
        onPress={() => { selection(); navigation.goBack(); }} 
        style={[styles.backButton, { backgroundColor: withAlpha(colors.text, 0.05) }]} 
        activeOpacity={0.7}
      >
        <Icon name="chevron-left" size={28} color={colors.text} />
      </TouchableOpacity>
      <View style={styles.headerTextStack}>
        <Text style={[styles.headerSubtitle, { color: colors.primary }]}>PRIVATE VAULT</Text>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Private Language</Text>
      </View>
      <View style={{ width: 44 }} />
    </View>
  );

  // High-End Premium Gate
  if (!isPremium) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle="light-content" />
        <FilmGrain opacity={0.3} />
        <GlowOrb color={colors.primary} size={400} top={-100} left={SCREEN_W - 200} opacity={0.15} />
        <GlowOrb color={isDark ? '#FFFFFF' : '#F2F2F7'} size={300} top={650} left={-100} opacity={isDark ? 0.1 : 0.06} />
        
        <SafeAreaView style={{ flex: 1 }}>
          {headerBar}
          <ReAnimated.View 
            entering={FadeInUp.duration(800).springify()} 
            style={styles.premiumGateContainer}
          >
            <View style={[styles.gateIconFrame, { backgroundColor: withAlpha(colors.primary, 0.1), borderColor: withAlpha(colors.primary, 0.2) }]}>
              <Icon name="comment-heart-outline" size={48} color={colors.primary} />
              <View style={styles.lockBadge}>
                <Icon name="lock" size={14} color="#FFF" />
              </View>
            </View>

            <Text style={[styles.gateTitle, { color: colors.text }]}>The Secret Language of You</Text>
            <Text style={[styles.gateSub, { color: colors.textMuted }]}>
              A dedicated vault for the words only you two understand—nicknames, internal references, and the jokes that define your world.
            </Text>

            <TouchableOpacity
              onPress={() => showPaywall?.(PremiumFeature.INSIDE_JOKES)}
              style={[styles.premiumBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.1)']}
                style={StyleSheet.absoluteFill}
              />
              <Icon name="crown" size={20} color="#FFF" />
              <Text style={styles.premiumBtnText}>Unlock the Vault</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={styles.notNowBtn}
            >
              <Text style={[styles.notNowText, { color: colors.textMuted }]}>Not now</Text>
            </TouchableOpacity>
          </ReAnimated.View>
        </SafeAreaView>
      </View>
    );
  }

  // Premium Immersive Experience
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <FilmGrain opacity={0.1} />
      <GlowOrb color={colors.primary} size={500} top={-200} left={SCREEN_W - 200} opacity={isDark ? 0.15 : 0.08} />
      <GlowOrb color={isDark ? '#FFFFFF' : '#F2F2F7'} size={300} top={650} left={-100} opacity={isDark ? 0.1 : 0.06} />
      
      <SafeAreaView style={{ flex: 1 }}>
        <ReAnimated.View entering={FadeInDown.duration(600)}>
          {headerBar}
        </ReAnimated.View>
        
        <ReAnimated.View 
          entering={FadeInDown.delay(200).duration(800)} 
          style={{ flex: 1 }}
        >
          <InsideJokes compact={false} />
        </ReAnimated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  headerTextStack: {
    flex: 1,
    marginLeft: 12,
  },
  headerSubtitle: {
    fontFamily: 'Lato_700Bold',
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 42,
  },

  // Premium Gate Aesthetic
  premiumGateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  gateIconFrame: {
    width: 100,
    height: 100,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    position: 'relative',
  },
  lockBadge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    backgroundColor: '#D2121A',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#000',
  },
  gateTitle: {
    fontFamily: Platform.select({
      ios: 'DMSerifDisplay-Regular',
      android: 'DMSerifDisplay_400Regular',
    }),
    fontSize: 32,
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 16,
  },
  gateSub: {
    fontFamily: 'Lato_400Regular',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
    opacity: 0.8,
  },
  premiumBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    width: '100%',
    borderRadius: 30,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
      },
      android: { elevation: 8 }
    })
  },
  premiumBtnText: {
    color: '#FFF',
    fontFamily: 'Lato_700Bold',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  notNowBtn: {
    marginTop: 24,
    padding: 12,
  },
  notNowText: {
    fontFamily: 'Lato_700Bold',
    fontSize: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  }
});

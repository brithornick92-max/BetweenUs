// screens/YearReflectionScreen.jsx — End-of-Year Narrative (Premium)
// Sexy Red (#D2121A) & Apple Editorial White/Light Gray Edition.
// High-end, unabridged code. Integrated Snapshot Export.

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
// react-native-view-shot requires a native build — load lazily so a stale dev
// client doesn't crash the entire app if the native module is missing yet.
let ViewShot = null;
try {
  ViewShot = require('react-native-view-shot').default;
} catch (_) {
  // Native module not compiled into this build — export feature will be disabled.
}
import Icon from '../components/Icon';
import { LinearGradient } from 'expo-linear-gradient';
import { impact, selection, notification, ImpactFeedbackStyle, NotificationFeedbackType } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { PremiumFeature } from '../utils/featureFlags';
import { SPACING, withAlpha } from '../utils/theme';
import { YearReflection } from '../services/PolishEngine';
import GlowOrb from '../components/GlowOrb';
import FilmGrain from '../components/FilmGrain';
import SnapshotView from '../components/SnapshotView';
import ExportService from '../services/ExportService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SYSTEM_FONT = Platform.select({ ios: "System", android: "Roboto" });
const SERIF_FONT = Platform.select({ ios: "Georgia", android: "serif" });

const PALETTE = {
  sexyRed: '#D2121A',
  lightGray: '#F2F2F7',
  white: '#FFFFFF',
  textSubtle: 'rgba(60, 60, 67, 0.6)',
  border: 'rgba(0, 0, 0, 0.05)',
};

// ------------------------------------------------------------------
// HIGH-END FADE SECTION
// ------------------------------------------------------------------
function FadeSection({ children, delay = 0 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(15)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 900, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, friction: 10, tension: 35, delay, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [delay]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ------------------------------------------------------------------
// MAIN SCREEN COMPONENT
// ------------------------------------------------------------------
export default function YearReflectionScreen({ navigation }) {
  const { isDark } = useTheme();
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const [reflection, setReflection] = useState(null);
  const [loading, setLoading] = useState(true);

  // Selection + export state
  const [isSelectingForExport, setIsSelectingForExport] = useState(false);
  const [selectedParagraph, setSelectedParagraph] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Ref for the off-screen ViewShot wrapper
  const snapshotRef = useRef(null);

  const year = new Date().getFullYear();

  const t = useMemo(() => ({
    background: isDark ? '#1D1D1F' : '#F5F5F7',
    surface: isDark ? 'rgba(44, 44, 46, 0.7)' : 'rgba(255, 255, 255, 0.85)',
    text: isDark ? '#FFFFFF' : '#1D1D1F',
    subtext: isDark ? 'rgba(235, 235, 245, 0.6)' : PALETTE.textSubtle,
    border: isDark ? 'rgba(255, 255, 255, 0.1)' : PALETTE.border,
  }), [isDark]);

  useEffect(() => {
    (async () => {
      let data = await YearReflection.getCached(year);
      if (!data) {
        data = await YearReflection.generate(year);
        await YearReflection.cache(data);
      }
      setReflection(data);
      setLoading(false);
    })();
  }, []);

  const toggleSelectMode = useCallback(() => {
    impact(ImpactFeedbackStyle.Medium);
    setIsSelectingForExport(prev => !prev);
    setSelectedParagraph(null);
  }, []);

  const handleSelectParagraph = useCallback((index) => {
    if (!isSelectingForExport) return;
    selection();
    setSelectedParagraph(prev => (prev === index ? null : index));
  }, [isSelectingForExport]);

  const handleExport = useCallback(async () => {
    if (selectedParagraph === null || !reflection) return;
    setIsExporting(true);
    impact(ImpactFeedbackStyle.Heavy);

    try {
      const result = await ExportService.exportParagraphSnapshot(snapshotRef, year);
      if (result.success) {
        notification(NotificationFeedbackType.Success);
        setIsSelectingForExport(false);
        setSelectedParagraph(null);
      } else if (result.cancelled) {
        impact(ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      notification(NotificationFeedbackType.Error);
      Alert.alert('Export Failed', "We couldn't create your snapshot right now.");
    } finally {
      setIsExporting(false);
    }
  }, [selectedParagraph, reflection, year]);

  if (!isPremium) {
    return (
      <View style={[styles.container, { backgroundColor: t.background }]}>
        <LinearGradient colors={[PALETTE.sexyRed, '#9A0D12']} style={styles.premiumHeaderGrad} />
        <SafeAreaView style={styles.premiumGate}>
          <Icon name="sparkles-outline" size={48} color="#FFF" />
          <Text style={[styles.gateTitle, { color: '#FFF' }]}>The Year in Review</Text>
          <Text style={[styles.gateSub, { color: 'rgba(255,255,255,0.8)' }]}>
            Experience a curated journey of your love. Unlock your private narrative with Pro.
          </Text>
          <TouchableOpacity
            style={styles.premiumButton}
            onPress={() => { selection(); showPaywall(PremiumFeature.YEAR_REFLECTION); }}
          >
            <Text style={styles.premiumButtonText}>Unlock Your Story</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // Derive the current paragraph text for the off-screen snapshot
  const snapshotText = (selectedParagraph !== null && reflection?.sections[selectedParagraph])
    ? reflection.sections[selectedParagraph].text
    : '';

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle={isSelectingForExport ? "light-content" : (isDark ? "light-content" : "dark-content")} />

      {/* CHROMATIC LUME BACKGROUND */}
      <View style={styles.orbContainer}>
        <GlowOrb color={PALETTE.sexyRed} size={500} top={-150} left={SCREEN_WIDTH - 200} opacity={isDark ? 0.2 : 0.12} />
        <GlowOrb color={isDark ? '#FFFFFF' : PALETTE.lightGray} size={400} top={SCREEN_HEIGHT * 0.7} left={-100} opacity={isDark ? 0.1 : 0.08} />
      </View>

      <FilmGrain opacity={0.2} />

      {/* SELECTION MODE BLUR OVERLAY */}
      {isSelectingForExport && (
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFillObject} />
      )}

      {/* OFF-SCREEN SNAPSHOT: always mounted, invisible, positioned below the fold */}
      <View pointerEvents="none" style={styles.hiddenSnapshotContainer}>
        {ViewShot ? (
          <ViewShot
            ref={snapshotRef}
            options={{ format: 'jpg', quality: 0.95, result: 'tmpfile' }}
            collapsable={false}
          >
            <SnapshotView text={snapshotText} year={year} isDark={isDark} />
          </ViewShot>
        ) : (
          <View ref={snapshotRef}>
            <SnapshotView text={snapshotText} year={year} isDark={isDark} />
          </View>
        )}
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        {/* DYNAMIC HEADER */}
        <View style={styles.header}>
          {!isSelectingForExport ? (
            <>
              <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.circleBtn, { backgroundColor: t.surface }]}>
                <Icon name="chevron-back" size={24} color={t.text} />
              </TouchableOpacity>
              <Text style={[styles.headerYear, { color: t.subtext }]}>{year}</Text>
              <TouchableOpacity onPress={toggleSelectMode} style={[styles.circleBtn, { backgroundColor: t.surface }]}>
                <Icon name="share-outline" size={22} color={t.text} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={toggleSelectMode} style={styles.textBtn}>
                <Text style={[styles.textBtnText, { color: '#FFF' }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.headerPrompt, { color: '#FFF' }]}>Select a Paragraph</Text>
              <TouchableOpacity
                onPress={handleExport}
                style={[
                  styles.exportBtn,
                  { backgroundColor: selectedParagraph !== null ? PALETTE.sexyRed : 'rgba(255,255,255,0.15)' },
                ]}
                disabled={selectedParagraph === null || isExporting}
              >
                {isExporting
                  ? <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 6 }} />
                  : <Icon name="share-outline" size={16} color="#FFF" />
                }
                <Text style={styles.exportBtnText}>{isExporting ? 'Creating...' : 'Share'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ARTICLE SCROLL */}
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <BlurView
            intensity={isSelectingForExport ? 20 : (isDark ? 30 : 70)}
            tint={isDark || isSelectingForExport ? "dark" : "light"}
            style={[styles.article, { borderColor: isSelectingForExport ? 'rgba(255,255,255,0.1)' : t.border }]}
          >
            {!isSelectingForExport && (
              <FadeSection delay={200}>
                <Text style={[styles.kicker, { color: PALETTE.sexyRed }]}>{year} PRIVATE ARCHIVE</Text>
                <Text style={[styles.mainTitle, { color: t.text }]}>The Story of Us</Text>
                <View style={[styles.divider, { backgroundColor: PALETTE.sexyRed }]} />
              </FadeSection>
            )}

            {loading ? (
              <Text style={[styles.bodyText, { color: t.subtext, fontStyle: 'italic' }]}>
                Writing your narrative...
              </Text>
            ) : (
              reflection?.sections.map((section, i) => (
                <FadeSection key={i} delay={isSelectingForExport ? 0 : 400 + (i * 180)}>
                  <TouchableOpacity
                    activeOpacity={isSelectingForExport ? 0.9 : 1}
                    onPress={() => handleSelectParagraph(i)}
                    disabled={!isSelectingForExport}
                    style={[
                      styles.section,
                      isSelectingForExport && styles.sectionSelectable,
                      selectedParagraph === i && styles.sectionSelected,
                      selectedParagraph !== null && selectedParagraph !== i && styles.sectionDimmed,
                    ]}
                  >
                    {isSelectingForExport && (
                      <View style={[styles.selectRadio, selectedParagraph === i && styles.selectRadioActive]} />
                    )}
                    <Text
                      style={[
                        styles.bodyText,
                        isSelectingForExport && styles.bodyTextExport,
                        { color: isSelectingForExport ? '#FFF' : t.text },
                      ]}
                    >
                      {section.text}
                    </Text>
                  </TouchableOpacity>
                </FadeSection>
              ))
            )}

            {!isSelectingForExport && (
              <FadeSection delay={1500}>
                <View style={styles.footer}>
                  <View style={styles.endMark}>
                    <Icon name="heart-outline" size={18} color={PALETTE.sexyRed} />
                  </View>
                  <Text style={[styles.footerText, { color: t.subtext }]}>Between Us • {year}</Text>
                </View>
              </FadeSection>
            )}
          </BlurView>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  orbContainer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },

  // Off-screen ViewShot: always rendered, invisible, below the fold
  hiddenSnapshotContainer: {
    position: 'absolute',
    top: SCREEN_HEIGHT + 100,
    left: 0,
    opacity: 0,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    zIndex: 100,
    height: 64,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerYear: { fontFamily: SYSTEM_FONT, fontWeight: '800', fontSize: 16 },

  // Selection Mode Header
  textBtn: { padding: 10, paddingLeft: 0 },
  textBtnText: { fontFamily: SYSTEM_FONT, fontWeight: '600', fontSize: 16 },
  headerPrompt: { fontFamily: SERIF_FONT, fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    gap: 6,
  },
  exportBtnText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: '#FFF',
    letterSpacing: 0.5,
  },

  scroll: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 140 },
  article: {
    padding: 32,
    borderRadius: 40,
    borderWidth: 1,
    minHeight: SCREEN_HEIGHT * 0.7,
    overflow: 'hidden',
  },
  kicker: { fontFamily: SYSTEM_FONT, fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 8 },
  mainTitle: { fontFamily: SERIF_FONT, fontSize: 42, fontWeight: '700', letterSpacing: -1.5, lineHeight: 48 },
  divider: { width: 50, height: 4, borderRadius: 2, marginTop: 28, marginBottom: 44 },

  // Paragraph Section Styles
  section: { marginBottom: 36 },
  sectionSelectable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  sectionSelected: { backgroundColor: 'rgba(210, 18, 26, 0.12)' },
  sectionDimmed: { opacity: 0.3 },
  selectRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    marginTop: 5,
    flexShrink: 0,
  },
  selectRadioActive: {
    borderColor: PALETTE.sexyRed,
    backgroundColor: PALETTE.sexyRed,
  },
  bodyText: {
    fontFamily: SERIF_FONT,
    fontSize: 20,
    lineHeight: 32,
    letterSpacing: -0.2,
  },
  bodyTextExport: { flex: 1 },

  footer: { marginTop: 40, paddingTop: 40, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)', alignItems: 'center' },
  endMark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(210, 18, 26, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  footerText: { fontFamily: SYSTEM_FONT, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5 },

  // Premium Gate
  premiumHeaderGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: '65%' },
  premiumGate: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  gateTitle: { fontFamily: SERIF_FONT, fontSize: 34, fontWeight: '700', textAlign: 'center', marginTop: 24 },
  gateSub: { fontFamily: SYSTEM_FONT, fontSize: 16, textAlign: 'center', marginTop: 14, lineHeight: 24, marginBottom: 44 },
  premiumButton: { backgroundColor: '#FFF', paddingVertical: 20, paddingHorizontal: 36, borderRadius: 100 },
  premiumButtonText: { color: '#D2121A', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
});

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Platform,
  StatusBar,
  ScrollView,
  ImageBackground,
  Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

import { useTheme } from "../context/ThemeContext";

// Mood-based gradient colors (no external image dependency)
const MOOD_GRADIENTS = {
  calm: ['#A8DADC', '#457B9D'],
  connected: ['#F4A0A0', '#D66B6B'],
  reflective: ['#B8C6DB', '#6A89A7'],
  energized: ['#FFC971', '#FF9F43'],
  default: ['#DCD6F7', '#A6B1E1'],
};

const MOOD_EMOJI = {
  calm: '🌿',
  connected: '💕',
  reflective: '🌙',
  energized: '✨',
  default: '💫',
};

const getEntryMood = (entry) => {
  const moodKey = String(entry?.mood || "").toLowerCase();
  return MOOD_GRADIENTS[moodKey] ? moodKey : 'default';
};

const getEntryImageSource = (entry) => {
  const candidate =
    entry?.imageUri ||
    entry?.photoUri ||
    entry?.mediaUri ||
    (Array.isArray(entry?.photos) ? entry.photos[0] : null);
  if (candidate) return { uri: candidate };
  return null; // No external image — use mood gradient instead
};
import { journalStorage } from "../utils/storage";
import { DataLayer } from "../services/localfirst";
import { useEntitlements } from "../context/EntitlementsContext";
import { FREE_LIMITS } from "../utils/featureFlags";
import { TYPOGRAPHY, SPACING, BORDER_RADIUS } from "../utils/theme";

const { width, height } = Dimensions.get("window");
const ITEM_WIDTH = width * 0.85;
const ITEM_SPACING = (width - ITEM_WIDTH) / 2;

// Standard Polaroid Background Color
const POLAROID_WHITE = "#FAF9F6";

const MemoryCard = ({ item, index, scrollX, onPress, isLocked, colors }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * ITEM_WIDTH,
      index * ITEM_WIDTH,
      (index + 1) * ITEM_WIDTH,
    ];

    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.9, 1, 0.9],
      Extrapolation.CLAMP
    );

    const rotate = interpolate(
      scrollX.value,
      inputRange,
      [index % 2 === 0 ? -3 : 3, 0, index % 2 === 0 ? 3 : -3],
      Extrapolation.CLAMP
    );

    const translateY = interpolate(
      scrollX.value,
      inputRange,
      [20, 0, 20],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { scale },
        { rotate: `${rotate}deg` },
        { translateY },
      ],
      opacity: interpolate(
        scrollX.value,
        inputRange,
        [0.7, 1, 0.7],
        Extrapolation.CLAMP
      ),
    };
  });

  const entryDate = new Date(item.date || item.createdAt);
  const formattedDate = entryDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Animated.View style={[styles.cardContainer, animatedStyle]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onPress(item)}
        style={styles.polaroidWrapper}
      >
        <View style={styles.polaroidInner}>
          {getEntryImageSource(item) ? (
            <ImageBackground
              source={getEntryImageSource(item)}
              style={styles.photoArea}
              imageStyle={styles.photoImage}
            >
              <LinearGradient
                colors={["#0D0D0E66", "#0D0D0ECC"]}
                style={styles.photoGradient}
              />
              <View style={styles.imageTextOverlay}>
                <Text style={[styles.imageTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.title || "A Beautiful Moment"}
                </Text>
                <Text style={[styles.imageDate, { color: colors.textMuted }]}>{formattedDate}</Text>
              </View>
              {isLocked ? (
                <View style={styles.lockedOverlay}>
                  <MaterialCommunityIcons name="lock-outline" size={32} color={colors.primary} />
                  <Text style={[styles.lockedText, { color: colors.primary }]}>Premium Memory</Text>
                </View>
              ) : (
                <MaterialCommunityIcons
                  name={item.mood === "calm" ? "leaf" : "heart-outline"}
                  size={64}
                  color="#FFFFFF"
                />
              )}
            </ImageBackground>
          ) : (
            <LinearGradient
              colors={MOOD_GRADIENTS[getEntryMood(item)]}
              style={styles.photoArea}
            >
              <View style={styles.imageTextOverlay}>
                <Text style={[styles.imageTitle, { color: '#FFFFFF' }]} numberOfLines={1}>
                  {item.title || "A Beautiful Moment"}
                </Text>
                <Text style={[styles.imageDate, { color: '#FFFFFFCC' }]}>{formattedDate}</Text>
              </View>
              {isLocked ? (
                <View style={styles.lockedOverlay}>
                  <MaterialCommunityIcons name="lock-outline" size={32} color="#FFFFFF" />
                  <Text style={[styles.lockedText, { color: '#FFFFFF' }]}>Premium Memory</Text>
                </View>
              ) : (
                <Text style={{ fontSize: 64 }}>{MOOD_EMOJI[getEntryMood(item)]}</Text>
              )}
            </LinearGradient>
          )}

          <View style={styles.captionArea}>
            <Text style={[styles.captionTitle, { color: colors.text }]} numberOfLines={1}>
              {item.title || "A Beautiful Moment"}
            </Text>
            <Text style={[styles.captionDate, { color: colors.textMuted }]}>{formattedDate}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const ExpandedMemory = ({ entry, onDismiss, onEdit, colors }) => {
  if (!entry) return null;

  const entryDate = new Date(entry.date || entry.createdAt);
  const formattedDate = entryDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Animated.View 
      entering={FadeIn.duration(300)} 
      exiting={FadeOut.duration(200)}
      style={styles.expandedOverlayContainer}
    >
      <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
      
      <SafeAreaView style={styles.expandedSafeArea}>
        <Animated.View 
          layout={LinearTransition.springify().damping(15)}
          style={styles.expandedCard}
        >
          <ScrollView 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={styles.expandedScrollContent}
          >
            {getEntryImageSource(entry) ? (
              <ImageBackground
                source={getEntryImageSource(entry)}
                style={styles.expandedPhotoContainer}
                imageStyle={styles.photoImageExpanded}
              >
                <LinearGradient
                  colors={["#0D0D0E55", "#0D0D0EDD"]}
                  style={styles.photoGradient}
                />
                <MaterialCommunityIcons
                  name={entry.mood === "calm" ? "leaf" : "heart-outline"}
                  size={120}
                  color="#FFFFFF"
                />
              </ImageBackground>
            ) : (
              <LinearGradient
                colors={MOOD_GRADIENTS[getEntryMood(entry)]}
                style={styles.expandedPhotoContainer}
              >
                <Text style={{ fontSize: 120 }}>{MOOD_EMOJI[getEntryMood(entry)]}</Text>
              </LinearGradient>
            )}
            
            <View style={styles.expandedTextContainer}>
              <Text style={styles.expandedDateLabel}>{formattedDate}</Text>
              <Text style={styles.expandedTitleText}>{entry.title || "Untitled Moment"}</Text>
              
              <View style={[styles.expandedDivider, { backgroundColor: colors.primary }]} />
              
              <Text style={styles.expandedBodyText}>
                {entry.content || "This moment is waiting for your words. Reflect on the feelings, the laughter, or the quiet beauty of your time together."}
              </Text>

              <TouchableOpacity 
                style={styles.expandedEditBtn}
                onPress={onEdit}
              >
                <Text style={[styles.expandedEditBtnText, { color: colors.primary }]}>Edit Reflection</Text>
                <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </ScrollView>
          
          <TouchableOpacity 
            style={styles.closeIconButton} 
            onPress={onDismiss}
          >
            <MaterialCommunityIcons name="close" size={28} color="#0D0D0E" />
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </Animated.View>
  );
};

export default function JournalScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState("journal");
  const [entries, setEntries] = useState([]);
  const [loveNotes, setLoveNotes] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const { isPremiumEffective: isPremium } = useEntitlements();

  const scrollX = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const loadData = async () => {
    const [j, n] = await Promise.all([
      journalStorage.getEntries(),
      DataLayer.getLoveNotes(),
    ]);
    setEntries(Array.isArray(j) ? j : []);
    setLoveNotes(Array.isArray(n) ? n : []);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleNotePress = async (note) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!note.isRead && !note.isOwn) {
      await DataLayer.markLoveNoteRead(note.id);
      setLoveNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, isRead: true } : n)));
    }
    navigation.navigate("LoveNoteDetail", { noteId: note.id });
  };

  const handleEntryPress = (entry, index) => {
    const isLocked = !isPremium && index >= FREE_LIMITS.JOURNAL_ENTRIES_VISIBLE;
    if (isLocked) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      navigation.navigate("Paywall");
    } else {
      Haptics.selectionAsync();
      setExpandedId(entry.id);
    }
  };

  const expandedEntry = useMemo(() => 
    entries.find(e => e.id === expandedId), 
    [entries, expandedId]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <SafeAreaView style={styles.safeArea}>
        {/* Editorial Header */}
        <View style={styles.header}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>
              {activeTab === 'journal' ? 'THE ARCHIVE' : 'LOVE NOTES'}
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>
              {activeTab === 'journal' ? 'Memories' : 'Notes'}
            </Text>
        </View>

        {/* Minimalist Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            onPress={() => setActiveTab("journal")}
            style={[styles.tab, activeTab === "journal" && { backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: colors.border }]}
          >
            <Text style={[styles.tabLabel, { color: colors.textMuted }, activeTab === "journal" && { color: colors.text }]}>Reflections</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("notes")}
            style={[styles.tab, activeTab === "notes" && { backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: colors.border }]}
          >
            <Text style={[styles.tabLabel, { color: colors.textMuted }, activeTab === "notes" && { color: colors.text }]}>Love Notes</Text>
            {loveNotes.filter(n => !n.isRead).length > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.unreadBadgeText}>{loveNotes.filter(n => !n.isRead).length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {activeTab === "journal" ? (
          <View style={styles.stackContainer}>
            <Animated.FlatList
              data={entries}
              keyExtractor={(item, index) => item.id || index.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              snapToInterval={ITEM_WIDTH}
              snapToAlignment="center"
              decelerationRate="fast"
              onScroll={scrollHandler}
              scrollEventThrottle={16}
              renderItem={({ item, index }) => (
                <MemoryCard
                  item={item}
                  index={index}
                  scrollX={scrollX}
                  isLocked={!isPremium && index >= FREE_LIMITS.JOURNAL_ENTRIES_VISIBLE}
                  onPress={() => handleEntryPress(item, index)}
                  colors={colors}
                />
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="book-open-outline" size={64} color={colors.textMuted + '20'} />
                  <Text style={[styles.emptyText, { color: colors.textMuted + '40' }]}>Tap + to capture a moment.</Text>
                </View>
              }
            />

            {/* Float Action Button */}
            <TouchableOpacity
              style={[styles.fab, { shadowColor: colors.primary }]}
              onPress={() => {
                if (!isPremium) {
                  navigation.navigate('Premium');
                  return;
                }
                navigation.navigate("JournalEntry");
              }}
            >
              <LinearGradient
                colors={[colors.primary, colors.primary + "AA"]}
                style={styles.fabGradient}
              >
                <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : activeTab === "notes" ? (
          <View style={{ flex: 1 }}>
            <Animated.FlatList
              data={loveNotes}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.notesRow}
              contentContainerStyle={[styles.notesList, loveNotes.length === 0 && { flex: 1 }]}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />
              }
              renderItem={({ item, index }) => {
                const hasImage = !!item.imageUri;
                const STATIONERY_MAP = {
                  love:    { bg: ["#9A2E5E", "#7A1E4E"], emoji: "💌" },
                  heart:   { bg: ["#A8516E", "#8B3A5C"], emoji: "💕" },
                  sparkle: { bg: ["#6E4B7A", "#4A2E5E"], emoji: "✨" },
                  rose:    { bg: ["#B8606A", "#9A3E4E"], emoji: "🌹" },
                  sunset:  { bg: ["#D4856A", "#A85A4A"], emoji: "🌅" },
                  night:   { bg: ["#3A4A7A", "#1E2E5E"], emoji: "🌙" },
                };
                const STATIONERY_FALLBACK = [
                  STATIONERY_MAP.love, STATIONERY_MAP.heart, STATIONERY_MAP.sparkle,
                  STATIONERY_MAP.rose, STATIONERY_MAP.sunset, STATIONERY_MAP.night,
                ];
                const stationery = (item.stationeryId && STATIONERY_MAP[item.stationeryId])
                  || STATIONERY_FALLBACK[index % STATIONERY_FALLBACK.length];

                const isLocked = item.locked;

                const timeAgo = (() => {
                  const diff = Date.now() - item.createdAt;
                  const mins = Math.floor(diff / 60000);
                  if (mins < 1) return "Just now";
                  if (mins < 60) return `${mins}m ago`;
                  const hrs = Math.floor(mins / 60);
                  if (hrs < 24) return `${hrs}h ago`;
                  const days = Math.floor(hrs / 24);
                  if (days === 1) return "Yesterday";
                  if (days < 7) return `${days}d ago`;
                  return new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                })();

                return (
                  <Animated.View entering={FadeIn.delay(index * 60).duration(400)}>
                    <TouchableOpacity
                      style={[styles.noteCard, { borderColor: colors.border }]}
                      onPress={() => handleNotePress(item)}
                      activeOpacity={0.85}
                    >
                      {hasImage ? (
                        <Image source={{ uri: item.imageUri }} style={styles.noteCardImage} />
                      ) : (
                        <LinearGradient colors={stationery.bg} style={styles.noteCardGradient}>
                          <Text style={styles.noteCardEmoji}>{stationery.emoji}</Text>
                        </LinearGradient>
                      )}
                      <LinearGradient
                        colors={["transparent", "rgba(0,0,0,0.7)"]}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={styles.noteCardContent}>
                        {isLocked ? (
                          <>
                            <MaterialCommunityIcons name="lock-outline" size={24} color="#F2E9E6" />
                            <Text style={[styles.noteCardText, { marginTop: 4 }]}>Encrypted note</Text>
                          </>
                        ) : (
                          <Text style={styles.noteCardText} numberOfLines={3}>{item.text}</Text>
                        )}
                        <View style={styles.noteCardMeta}>
                          <Text style={styles.noteCardTime}>{timeAgo}</Text>
                          {!item.isRead && !item.isOwn && <View style={[styles.noteUnreadDot, { backgroundColor: colors.primary }]} />}
                        </View>
                      </View>
                      {item.senderName && (
                        <View style={styles.noteCardSender}>
                          <Text style={styles.noteCardSenderText}>From {item.senderName}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={{ fontSize: 64, marginBottom: 16 }}>💌</Text>
                  <Text style={[styles.emptyText, { color: colors.textMuted + '60' }]}>No love notes yet</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: "center", marginTop: 6 }}>
                    Send a note to make your partner's day
                  </Text>
                </View>
              }
            />

            {/* Compose FAB */}
            <TouchableOpacity
              style={[styles.fab, { shadowColor: colors.primary }]}
              onPress={() => {
                if (!isPremium) {
                  navigation.navigate('Premium');
                  return;
                }
                navigation.navigate("ComposeLoveNote");
              }}
            >
              <LinearGradient
                colors={[colors.primary, colors.primary + "AA"]}
                style={styles.fabGradient}
              >
                <MaterialCommunityIcons name="pencil-plus" size={26} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : null}
      </SafeAreaView>

      {/* Expanded Memory Modal */}
      {expandedId && (
        <ExpandedMemory 
            entry={expandedEntry} 
            onDismiss={() => setExpandedId(null)} 
            onEdit={() => {
                const entry = expandedEntry;
                setExpandedId(null);
                navigation.navigate("JournalEntry", { entry });
            }}
            colors={colors}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: SPACING.gutter,
    paddingTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  eyebrow: {
    fontFamily: TYPOGRAPHY.label.fontFamily,
    fontSize: 12,
    letterSpacing: 3,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: TYPOGRAPHY.display.fontFamily,
    fontSize: 42,
    lineHeight: 48,
  },
  tabContainer: {
    flexDirection: "row",
    marginHorizontal: SPACING.gutter,
    marginBottom: SPACING.xl,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 10,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  stackContainer: {
    flex: 1,
    justifyContent: "center",
  },
  horizontalList: {
    paddingHorizontal: ITEM_SPACING,
    alignItems: "center",
    paddingBottom: 100,
  },
  cardContainer: {
    width: ITEM_WIDTH,
    height: ITEM_WIDTH * 1.35,
    justifyContent: "center",
    alignItems: "center",
  },
  polaroidWrapper: {
    width: ITEM_WIDTH - 30,
    height: (ITEM_WIDTH - 30) * 1.3,
    backgroundColor: "transparent",
    padding: 0,
    paddingBottom: 0,
    borderRadius: 18,
    overflow: "hidden",
    ...Platform.select({
        ios: {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.10,
            shadowRadius: 15,
        },
        android: {
            elevation: 10,
        }
    }),
  },
  polaroidInner: {
    flex: 1,
  },
  photoArea: {
    flex: 1,
    backgroundColor: "#F0EFEA",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  photoGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  photoImage: {
    borderRadius: 18,
  },
  captionArea: {
    paddingTop: 20,
    alignItems: "center",
    paddingHorizontal: 10,
  },
  captionTitle: {
    fontFamily: TYPOGRAPHY.display.fontFamily,
    fontSize: 20,
    color: "#FFFFFF",
    marginBottom: 4,
    textAlign: "center",
  },
  captionDate: {
    fontFamily: TYPOGRAPHY.label.fontFamily,
    fontSize: 10,
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 1,
  },
  imageTextOverlay: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
  },
  imageTitle: {
    fontFamily: TYPOGRAPHY.display.fontFamily,
    fontSize: 18,
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  imageDate: {
    marginTop: 4,
    fontFamily: TYPOGRAPHY.label.fontFamily,
    fontSize: 10,
    letterSpacing: 1,
    color: "rgba(255,255,255,0.9)",
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  lockedOverlay: {
    alignItems: "center",
    justifyContent: "center",
  },
  lockedText: {
    fontFamily: TYPOGRAPHY.label.fontFamily,
    fontSize: 10,
    marginTop: 8,
  },
  fab: {
    position: "absolute",
    bottom: 80,
    right: 30,
    width: 64,
    height: 64,
    borderRadius: 32,
    ...Platform.select({
        ios: {
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
        },
        android: {
            elevation: 8,
        }
    }),
  },
  fabGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    marginTop: 16,
    fontFamily: TYPOGRAPHY.display.fontFamily,
    textAlign: "center",
  },
  expandedOverlayContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  expandedSafeArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  expandedCard: {
    width: width * 0.92,
    height: height * 0.85,
    backgroundColor: POLAROID_WHITE,
    borderRadius: 4,
    overflow: "hidden",
    ...Platform.select({
        ios: {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: 0.12,
            shadowRadius: 30,
        },
        android: {
            elevation: 20,
        }
    }),
  },
  expandedScrollContent: {
    paddingBottom: 40,
  },
  expandedPhotoContainer: {
    width: "100%",
    height: height * 0.3,
    backgroundColor: "#F0EFEA",
    justifyContent: "center",
    alignItems: "center",
  },
  photoImageExpanded: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  expandedTextContainer: {
    padding: 30,
  },
  expandedDateLabel: {
    fontFamily: TYPOGRAPHY.label.fontFamily,
    color: "rgba(13,13,14,0.6)",
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 8,
  },
  expandedTitleText: {
    fontFamily: TYPOGRAPHY.display.fontFamily,
    fontSize: 32,
    color: "#0D0D0E",
    lineHeight: 38,
    marginBottom: 20,
  },
  expandedDivider: {
    width: 40,
    height: 3,
    marginBottom: 25,
  },
  expandedBodyText: {
    fontFamily: TYPOGRAPHY.body.fontFamily,
    fontSize: 18,
    lineHeight: 32,
    color: "rgba(13,13,14,0.75)",
  },
  expandedEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  expandedEditBtnText: {
    fontFamily: TYPOGRAPHY.label.fontFamily,
    fontSize: 12,
    marginRight: 8,
  },
  closeIconButton: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },

  // ─── Love Notes Tab Styles ───────────────────
  unreadBadge: {
    position: "absolute",
    top: 4,
    right: 8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  unreadBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
  },
  notesList: {
    paddingHorizontal: SPACING.gutter,
    paddingBottom: 120,
  },
  notesRow: {
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },
  noteCard: {
    width: (width - SPACING.gutter * 2 - SPACING.md) / 2,
    height: 220,
    borderRadius: BORDER_RADIUS.lg,
    overflow: "hidden",
    borderWidth: 1,
  },
  noteCardImage: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
  },
  noteCardGradient: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  noteCardEmoji: {
    fontSize: 48,
    opacity: 0.3,
  },
  noteCardContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  noteCardText: {
    color: "#F2E9E6",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  noteCardMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 6,
  },
  noteCardTime: {
    color: "rgba(242,233,230,0.6)",
    fontSize: 11,
  },
  noteUnreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  noteCardSender: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  noteCardSenderText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "600",
  },
});


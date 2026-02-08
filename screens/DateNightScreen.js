import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Alert,
  Animated,
  Dimensions,
  Platform,
  Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from 'expo-haptics';
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import {
  filterDates,
  surpriseMeDate,
  getAvailableMoods,
  getAllDates,
} from "../utils/contentLoader";
import { myDatesStorage } from "../utils/storage";
import { useEntitlements } from "../context/EntitlementsContext";
import { FREE_LIMITS } from "../utils/featureFlags";
import {
  TYPOGRAPHY,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  COLORS,
  getGlassStyle,
} from "../utils/theme";
import { SurpriseMeHeader } from "../components/SurpriseMeHeader";
import { ChipGroup } from "../components/Chip";

const { width } = Dimensions.get("window");

// Generate image URL based on date content
const getDateImage = (item) => {
  // Use Unsplash for dynamic images based on keywords
  const keywords = [];
  
  // Add location-based keywords
  if (item.location === "home") {
    keywords.push("cozy", "home", "intimate");
  } else {
    keywords.push("adventure", "outdoor", "city");
  }
  
  // Add mood-based keywords
  if (Array.isArray(item.moods)) {
    keywords.push(...item.moods);
  }
  
  // Add activity-based keywords from title
  const title = item.title?.toLowerCase() || "";
  if (title.includes("dance")) keywords.push("dance");
  if (title.includes("cook")) keywords.push("cooking");
  if (title.includes("art") || title.includes("paint")) keywords.push("art");
  if (title.includes("music") || title.includes("record")) keywords.push("music");
  if (title.includes("food") || title.includes("restaurant")) keywords.push("food");
  if (title.includes("nature") || title.includes("garden")) keywords.push("nature");
  if (title.includes("book")) keywords.push("books");
  if (title.includes("wine")) keywords.push("wine");
  if (title.includes("spa") || title.includes("massage")) keywords.push("spa");
  
  // Default to romantic couple if no specific keywords
  const searchTerm = keywords.length > 0 ? keywords.slice(0, 2).join(",") : "romantic,couple";
  
  // Use Unsplash with specific dimensions for consistency
  return `https://source.unsplash.com/400x200/?${searchTerm}&sig=${item.id}`;
};

const DURATION_OPTIONS = [
  { value: 60, label: "60 min" },
  { value: 90, label: "90 min" },
  { value: 120, label: "120+ min" },
];

const LOCATION_OPTIONS = [
  { value: "either", label: "Either" },
  { value: "home", label: "At Home" },
  { value: "out", label: "Going Out" },
];

// Animated Date Card Component
function AnimatedDateCard({ item, onPress, theme, isDark, index, navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity onPress={async () => {
        await Haptics.selectionAsync();
        onPress();
      }} activeOpacity={0.9}>
        <BlurView
          intensity={isDark ? 35 : 60}
          tint={isDark ? "dark" : "light"}
          style={styles.dateCard}
        >
          <LinearGradient
            colors={
              isDark
                ? ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.01)"]
                : ["rgba(255,255,255,0.9)", "rgba(255,255,255,0.6)"]
            }
            style={StyleSheet.absoluteFill}
          />

          {item.__custom && (
            <View style={[styles.customBadge, { backgroundColor: theme.blushRose }]}>
              <Text style={styles.customBadgeText}>YOURS</Text>
            </View>
          )}

          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <View style={styles.titleRow}>
                <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                {item.__custom && (
                  <MaterialCommunityIcons name="pencil-heart" size={18} color={theme.blushRose} />
                )}
              </View>

              <View style={[styles.durationBadge, { backgroundColor: theme.blushRose + "20" }]}>
                <MaterialCommunityIcons name="clock-outline" size={14} color={theme.blushRose} />
                <Text style={[styles.durationText, { color: theme.blushRose }]}>
                  {item.minutes}m
                </Text>
              </View>
            </View>

            <View style={styles.cardMeta}>
              <MaterialCommunityIcons
                name={item.location === "home" ? "home-variant" : "map-marker"}
                size={14}
                color={theme.textSecondary}
              />
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                {item.location === "home" ? "Cozy at Home" : "A Night Out"}
              </Text>
              {Array.isArray(item.moods) && item.moods.length > 0 && (
                <>
                  <View style={[styles.metaDot, { backgroundColor: theme.textSecondary }]} />
                  <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                    {item.moods[0]}
                  </Text>
                </>
              )}
            </View>

            <View style={styles.cardActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionSecondary]}
                onPress={async () => {
                  await Haptics.selectionAsync();
                  // Add to calendar functionality
                  const stepsText = Array.isArray(item.steps) && item.steps.length 
                    ? `• ${item.steps.join("\n• ")}` 
                    : "";
                  const prefill = {
                    __token: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
                    title: `Date: ${item.title || "Date Night"}`,
                    dateStr: new Date().toLocaleDateString('en-US', { 
                      month: '2-digit', 
                      day: '2-digit', 
                      year: 'numeric' 
                    }),
                    timeStr: "7:30 PM",
                    location: item?.location === "home" ? "Our Home" : "Out & About",
                    notes: stepsText,
                    isDateNight: true,
                  };
                  navigation.navigate("Calendar", { prefill });
                }}
                activeOpacity={0.9}
              >
                <View style={[styles.actionSecondaryInner, { borderColor: theme.blushRose + "40" }]}>
                  <MaterialCommunityIcons name="calendar-plus" size={14} color={theme.blushRose} />
                  <Text style={[styles.actionTextSecondary, { color: theme.blushRose }]}>Add to Calendar</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.actionPrimary]}
                onPress={async () => {
                  await Haptics.selectionAsync();
                  onPress();
                }}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={[theme.blushRose, theme.burgundy || "#99004C"]}
                  style={styles.actionGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.actionTextPrimary}>View Details</Text>
                  <MaterialCommunityIcons name="arrow-right" size={16} color="#FFF" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function DateNightScreen({ navigation }) {
  const { state } = useAppContext();
  const { theme: activeTheme, isDark } = useTheme();

  const t = useMemo(() => {
    const base = activeTheme?.colors ? activeTheme.colors : activeTheme;
    return {
      background: base?.background ?? (isDark ? COLORS.warmCharcoal : COLORS.softCream),
      surface: base?.surface ?? (isDark ? COLORS.deepPlum : "#FFFFFF"),
      text: base?.text ?? (isDark ? COLORS.softCream : COLORS.charcoal),
      textSecondary:
        base?.textSecondary ?? (isDark ? "rgba(246,242,238,0.70)" : "rgba(51,51,51,0.68)"),
      border: base?.border ?? (isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"),
      accent: base?.accent ?? COLORS.blushRose,
      primary: base?.primary ?? (isDark ? COLORS.vividCoral : COLORS.burgundy),
      onPrimary: base?.onPrimary ?? (isDark ? COLORS.warmCharcoal : "#FFFFFF"),
      blushRose: COLORS.blushRose,
      blushRoseLight: COLORS.blushRoseLight,
      burgundy: COLORS.burgundy,
      mutedGold: COLORS.mutedGold,
    };
  }, [activeTheme, isDark]);

  const [dates, setDates] = useState([]);
  const [myDates, setMyDates] = useState([]);
  const [location, setLocation] = useState(state.dateNightDefaults?.location || "either");
  const [selectedMoods, setSelectedMoods] = useState(state.dateNightDefaults?.moods || []);
  const [duration, setDuration] = useState(state.dateNightDefaults?.duration || 60);
  const { isPremiumEffective: isPremium, showPaywall } = useEntitlements();
  const [showFilters, setShowFilters] = useState(false);
  const [showAllDates, setShowAllDates] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(0); // Track which group of 20 we're showing

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.85],
    extrapolate: "clamp",
  });

  const moods = getAvailableMoods();

  const loadMyDates = async () => {
    const list = await myDatesStorage.getMyDates();
    const safe = Array.isArray(list) ? list : [];
    const normalized = safe.map((d) => ({
      ...d,
      __custom: true,
      title: d.title || "My Date",
      minutes: typeof d.minutes === "number" ? d.minutes : 60,
    }));
    setMyDates(normalized);
  };

  useEffect(() => {
    // subscription context is source of truth
  }, [isPremium]);

  useFocusEffect(
    useCallback(() => {
      loadMyDates();
    }, [])
  );

  const allPreloadedDates = useMemo(() => getAllDates(), []);
  const combinedDates = useMemo(
    () => [...myDates, ...allPreloadedDates],
    [myDates, allPreloadedDates]
  );

  useEffect(() => {
    applyFilters();
    setShowAllDates(false); // Reset to show limited view when filters change
  }, [location, selectedMoods, duration, isPremium, myDates]);

  const applyFilters = () => {
    let maxMinutes = duration === 60 ? 75 : duration === 90 ? 105 : Infinity;

    const filtered = filterDates(combinedDates, {
      location,
      moods: selectedMoods,
      minMinutes: duration === 120 ? 105 : duration,
      maxMinutes,
    });

    if (!isPremium) {
      const freeIds = allPreloadedDates
        .slice(0, FREE_LIMITS.VISIBLE_DATE_IDEAS)
        .map((d) => d.id);
      setDates(filtered.filter((d) => d.__custom || freeIds.includes(d.id)));
    } else {
      // Create 10 diverse groups of 20 dates each
      const diverseGroups = createDiverseGroups(filtered, 10, 20);
      const currentGroupDates = diverseGroups[currentGroup] || [];
      setDates(currentGroupDates);
    }
  };

  // Function to create diverse groups of dates
  const createDiverseGroups = (allDates, numGroups, groupSize) => {
    if (allDates.length === 0) return [];
    
    const groups = Array.from({ length: numGroups }, () => []);
    const remaining = [...allDates];
    
    // Characteristics for diversity scoring
    const getDateCharacteristics = (date) => ({
      location: date.location || 'either',
      duration: getDurationCategory(date.minutes || 60),
      moods: Array.isArray(date.moods) ? date.moods : [],
      activityType: getActivityType(date.title || ''),
    });
    
    const getDurationCategory = (minutes) => {
      if (minutes <= 60) return 'quick';
      if (minutes <= 90) return 'medium';
      if (minutes <= 120) return 'long';
      return 'extended';
    };
    
    const getActivityType = (title) => {
      const t = title.toLowerCase();
      if (t.includes('cook') || t.includes('food') || t.includes('eat')) return 'culinary';
      if (t.includes('art') || t.includes('paint') || t.includes('create')) return 'creative';
      if (t.includes('walk') || t.includes('hike') || t.includes('outdoor')) return 'outdoor';
      if (t.includes('dance') || t.includes('music') || t.includes('sing')) return 'musical';
      if (t.includes('game') || t.includes('play') || t.includes('fun')) return 'playful';
      if (t.includes('spa') || t.includes('massage') || t.includes('relax')) return 'wellness';
      if (t.includes('shop') || t.includes('market') || t.includes('store')) return 'shopping';
      if (t.includes('book') || t.includes('read') || t.includes('story')) return 'literary';
      if (t.includes('wine') || t.includes('drink') || t.includes('bar')) return 'beverage';
      return 'general';
    };
    
    // Calculate diversity score between two dates
    const getDiversityScore = (date1, date2) => {
      const char1 = getDateCharacteristics(date1);
      const char2 = getDateCharacteristics(date2);
      
      let score = 0;
      
      // Location diversity (high weight)
      if (char1.location !== char2.location) score += 3;
      
      // Duration diversity (medium weight)
      if (char1.duration !== char2.duration) score += 2;
      
      // Activity type diversity (high weight)
      if (char1.activityType !== char2.activityType) score += 3;
      
      // Mood diversity (medium weight)
      const commonMoods = char1.moods.filter(mood => char2.moods.includes(mood));
      const totalMoods = [...new Set([...char1.moods, ...char2.moods])].length;
      const moodDiversity = totalMoods - commonMoods.length;
      score += moodDiversity;
      
      return score;
    };
    
    // Fill groups with maximum diversity
    for (let groupIndex = 0; groupIndex < numGroups && remaining.length > 0; groupIndex++) {
      const currentGroup = groups[groupIndex];
      
      // Add first date randomly
      if (remaining.length > 0) {
        const firstIndex = Math.floor(Math.random() * remaining.length);
        currentGroup.push(remaining.splice(firstIndex, 1)[0]);
      }
      
      // Add remaining dates to maximize diversity
      while (currentGroup.length < groupSize && remaining.length > 0) {
        let bestDate = null;
        let bestScore = -1;
        let bestIndex = -1;
        
        // Find the date that maximizes diversity with current group
        remaining.forEach((candidate, index) => {
          let totalScore = 0;
          
          // Calculate average diversity score with all dates in current group
          currentGroup.forEach(existingDate => {
            totalScore += getDiversityScore(candidate, existingDate);
          });
          
          const averageScore = totalScore / currentGroup.length;
          
          if (averageScore > bestScore) {
            bestScore = averageScore;
            bestDate = candidate;
            bestIndex = index;
          }
        });
        
        if (bestDate) {
          currentGroup.push(bestDate);
          remaining.splice(bestIndex, 1);
        } else {
          // Fallback: add random date if no good diversity match
          if (remaining.length > 0) {
            const randomIndex = Math.floor(Math.random() * remaining.length);
            currentGroup.push(remaining.splice(randomIndex, 1)[0]);
          }
        }
      }
    }
    
    // Distribute any remaining dates
    let groupIndex = 0;
    while (remaining.length > 0) {
      groups[groupIndex % numGroups].push(remaining.shift());
      groupIndex++;
    }
    
    return groups;
  };

  // Function to get next group of dates
  const loadNextGroup = () => {
    const nextGroup = (currentGroup + 1) % 10; // Cycle through 10 groups
    setCurrentGroup(nextGroup);
    setShowAllDates(false); // Reset to show limited view
  };

  // Function to get diverse selection of dates
  const getDiverseSelection = (dates, count) => {
    if (dates.length <= count) return dates;

    const selected = [];
    const remaining = [...dates];
    
    // Group dates by characteristics for diversity
    const byLocation = {
      home: remaining.filter(d => d.location === 'home'),
      out: remaining.filter(d => d.location === 'out'),
    };
    
    const byDuration = {
      short: remaining.filter(d => (d.minutes || 0) <= 75),
      medium: remaining.filter(d => (d.minutes || 0) > 75 && (d.minutes || 0) <= 105),
      long: remaining.filter(d => (d.minutes || 0) > 105),
    };
    
    const moods = ['romantic', 'playful', 'emotional', 'intimate', 'spicy', 'adventurous', 'calm'];
    const byMood = {};
    moods.forEach(mood => {
      byMood[mood] = remaining.filter(d => 
        Array.isArray(d.moods) && d.moods.includes(mood)
      );
    });

    // Ensure diversity by picking from different categories
    const categories = [
      { key: 'location', groups: byLocation },
      { key: 'duration', groups: byDuration },
      { key: 'mood', groups: byMood },
    ];

    // Round-robin selection for diversity
    let attempts = 0;
    const maxAttempts = count * 3; // Prevent infinite loops
    
    while (selected.length < count && remaining.length > 0 && attempts < maxAttempts) {
      attempts++;
      
      // Try to pick from underrepresented categories
      let added = false;
      
      for (const category of categories) {
        if (selected.length >= count) break;
        
        // Find the least represented group in this category
        const groupCounts = {};
        Object.keys(category.groups).forEach(groupKey => {
          groupCounts[groupKey] = selected.filter(d => {
            if (category.key === 'location') return d.location === groupKey;
            if (category.key === 'duration') {
              const mins = d.minutes || 0;
              if (groupKey === 'short') return mins <= 75;
              if (groupKey === 'medium') return mins > 75 && mins <= 105;
              if (groupKey === 'long') return mins > 105;
            }
            if (category.key === 'mood') {
              return Array.isArray(d.moods) && d.moods.includes(groupKey);
            }
            return false;
          }).length;
        });
        
        // Find group with least representation
        const sortedGroups = Object.keys(groupCounts)
          .sort((a, b) => groupCounts[a] - groupCounts[b]);
        
        for (const groupKey of sortedGroups) {
          const availableInGroup = category.groups[groupKey].filter(d => 
            remaining.includes(d)
          );
          
          if (availableInGroup.length > 0) {
            // Pick random from this group
            const randomIndex = Math.floor(Math.random() * availableInGroup.length);
            const picked = availableInGroup[randomIndex];
            
            selected.push(picked);
            remaining.splice(remaining.indexOf(picked), 1);
            added = true;
            break;
          }
        }
        
        if (added) break;
      }
      
      // If no category-based selection worked, pick randomly
      if (!added && remaining.length > 0) {
        const randomIndex = Math.floor(Math.random() * remaining.length);
        const picked = remaining[randomIndex];
        selected.push(picked);
        remaining.splice(randomIndex, 1);
      }
    }
    
    // Fill remaining slots randomly if needed
    while (selected.length < count && remaining.length > 0) {
      const randomIndex = Math.floor(Math.random() * remaining.length);
      selected.push(remaining.splice(randomIndex, 1)[0]);
    }
    
    return selected;
  };

  const handleSurpriseMe = async () => {
    await Haptics.selectionAsync();
    
    if (!isPremium) {
      navigation.navigate("Paywall");
      return;
    }
    const date = surpriseMeDate(combinedDates, {
      location,
      moods: selectedMoods,
      minMinutes: duration,
    });
    date
      ? navigation.navigate("DateNightDetail", { date })
      : Alert.alert("No match", "Try adjusting filters.");
  };

  const renderDateCard = ({ item, index }) => (
    <AnimatedDateCard
      item={item}
      index={index}
      onPress={() => navigation.navigate("DateNightDetail", { date: item })}
      theme={t}
      isDark={isDark}
      navigation={navigation}
    />
  );

  // Limit displayed dates to 3 initially
  const displayedDates = showAllDates ? dates : dates.slice(0, 3);
  const hasMoreDates = dates.length > 3;

  const renderViewMoreButton = () => {
    if (!hasMoreDates || showAllDates) return null;

    return (
      <View style={styles.viewMoreContainer}>
        <TouchableOpacity
          style={styles.viewMoreButton}
          onPress={async () => {
            await Haptics.selectionAsync();
            setShowAllDates(true);
          }}
          activeOpacity={0.9}
        >
          <BlurView
            intensity={isDark ? 40 : 70}
            tint={isDark ? "dark" : "light"}
            style={styles.viewMoreBlur}
          >
            <LinearGradient
              colors={
                isDark
                  ? ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.02)"]
                  : ["rgba(255,255,255,0.9)", "rgba(255,255,255,0.6)"]
              }
              style={StyleSheet.absoluteFill}
            />
            
            <View style={styles.viewMoreContent}>
              <Text style={[styles.viewMoreText, { color: t.text }]}>
                View {dates.length - 3} More Experiences
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={20} color={t.accent} />
            </View>
          </BlurView>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.viewMoreButton, { marginTop: SPACING.sm }]}
          onPress={async () => {
            await Haptics.selectionAsync();
            loadNextGroup();
          }}
          activeOpacity={0.9}
        >
          <BlurView
            intensity={isDark ? 40 : 70}
            tint={isDark ? "dark" : "light"}
            style={styles.viewMoreBlur}
          >
            <LinearGradient
              colors={[t.accent + "20", t.accent + "10"]}
              style={StyleSheet.absoluteFill}
            />
            
            <View style={styles.viewMoreContent}>
              <Text style={[styles.viewMoreText, { color: t.accent }]}>
                Next Group of Dates (Group {currentGroup + 1}/10)
              </Text>
              <MaterialCommunityIcons name="refresh" size={20} color={t.accent} />
            </View>
          </BlurView>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      {/* Background Gradient */}
      <LinearGradient
        colors={
          isDark
            ? [COLORS.warmCharcoal, COLORS.deepPlum + "40", COLORS.warmCharcoal]
            : [COLORS.softCream, COLORS.blushRose + "15", COLORS.softCream]
        }
        style={StyleSheet.absoluteFill}
        locations={[0, 0.5, 1]}
      />

      <SafeAreaView style={styles.safeArea}>
        <Animated.FlatList
          data={displayedDates}
          renderItem={renderDateCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          ListHeaderComponent={
            <>
              {/* Magazine Header */}
              <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
                <View style={styles.headerTop}>
                  <View>
                    <Text style={[styles.headerEyebrow, { color: t.mutedGold }]}>
                      CURATED EXPERIENCES
                    </Text>
                    <Text style={[styles.headerTitle, { color: t.text }]}>Date Night</Text>
                  </View>

                  <TouchableOpacity
                    onPress={async () => {
                      await Haptics.selectionAsync();
                      setShowFilters((v) => !v);
                    }}
                    style={styles.filterButton}
                    activeOpacity={0.9}
                  >
                    <BlurView
                      intensity={isDark ? 30 : 50}
                      tint={isDark ? "dark" : "light"}
                      style={styles.filterButtonBlur}
                    >
                      <MaterialCommunityIcons
                        name={showFilters ? "close" : "tune-variant"}
                        size={22}
                        color={t.accent}
                      />
                    </BlurView>
                  </TouchableOpacity>
                </View>
              </Animated.View>

              {/* Surprise Me Feature */}
              <View style={styles.surpriseSection}>
                <SurpriseMeHeader onReveal={handleSurpriseMe} />
              </View>

              {/* Filter Drawer */}
              {showFilters && (
                <BlurView
                  intensity={isDark ? 40 : 70}
                  tint={isDark ? "dark" : "light"}
                  style={styles.filterDrawer}
                >
                  <LinearGradient
                    colors={
                      isDark
                        ? ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.02)"]
                        : ["rgba(255,255,255,0.9)", "rgba(255,255,255,0.6)"]
                    }
                    style={StyleSheet.absoluteFill}
                  />

                  <View style={styles.filterContent}>
                    <Text style={[styles.filterTitle, { color: t.text }]}>Filter Preferences</Text>

                    <View style={styles.filterGroup}>
                      <Text style={[styles.filterLabel, { color: t.textSecondary }]}>
                        Location
                      </Text>
                      <ChipGroup
                        items={LOCATION_OPTIONS}
                        selectedItems={[location]}
                        onSelectionChange={(val) => setLocation(val[0])}
                      />
                    </View>

                    <View style={styles.filterGroup}>
                      <Text style={[styles.filterLabel, { color: t.textSecondary }]}>Mood</Text>
                      <ChipGroup
                        items={moods.map((m) => ({ value: m, label: m }))}
                        selectedItems={selectedMoods}
                        onSelectionChange={setSelectedMoods}
                      />
                    </View>
                  </View>
                </BlurView>
              )}

              {/* Section Divider */}
              <View style={styles.sectionDivider}>
                <Text style={[styles.resultsText, { color: t.textSecondary }]}>
                  {dates.length} {dates.length === 1 ? "experience" : "experiences"} available
                </Text>
              </View>
            </>
          }
          ListFooterComponent={
            <>
              {renderViewMoreButton()}
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="heart-broken" size={64} color={t.border} />
              <Text style={[styles.emptyTitle, { color: t.text }]}>No dates found</Text>
              <Text style={[styles.emptySubtext, { color: t.textSecondary }]}>
                Try adjusting your filters
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  listContent: { paddingBottom: 100 },

  // Header
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 20,
    marginBottom: 30,
  },

  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  headerEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginBottom: 8,
  },

  headerTitle: {
    fontFamily: Platform.select({
      ios: "PlayfairDisplay-Bold",
      android: "PlayfairDisplay_700Bold",
    }),
    fontSize: 42,
    lineHeight: 48,
    letterSpacing: -0.5,
  },

  filterButton: {
    width: 48,
    height: 48,
  },

  filterButtonBlur: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },

  // Surprise Section
  surpriseSection: {
    paddingHorizontal: SPACING.lg,
    marginBottom: 30,
  },

  // Filter Drawer
  filterDrawer: {
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    overflow: "hidden",
    marginBottom: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },

  filterContent: {
    padding: 24,
  },

  filterTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 20,
  },

  filterGroup: {
    marginBottom: 20,
  },

  filterLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
  },

  // Section Divider
  sectionDivider: {
    paddingHorizontal: SPACING.lg,
    marginBottom: 20,
  },

  resultsText: {
    fontSize: 13,
    fontStyle: "italic",
  },

  // Date Cards
  cardWrapper: {
    marginHorizontal: SPACING.lg,
    marginBottom: 20,
  },

  dateCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
    }),
  },

  customBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    zIndex: 10,
  },

  customBadgeText: {
    color: "#FFF",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },

  cardContent: {
    padding: 20,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },

  titleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingRight: 12,
  },

  cardTitle: {
    flex: 1,
    fontSize: 16, // Made smaller (was 20)
    fontWeight: "700",
    lineHeight: 22, // Adjusted line height proportionally
  },

  durationBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    gap: 4,
  },

  durationText: {
    fontSize: 12,
    fontWeight: "700",
  },

  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },

  metaText: {
    fontSize: 13,
  },

  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },

  cardActions: {
    flexDirection: "row",
    gap: 10,
  },

  actionButton: {
    flex: 1,
    height: 32, // Made much smaller (was 48)
    borderRadius: BORDER_RADIUS.sm, // Smaller border radius
    overflow: "hidden",
  },

  actionPrimary: {},

  actionSecondary: {},

  actionGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6, // Smaller gap
  },

  actionSecondaryInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6, // Smaller gap
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.sm, // Smaller border radius
  },

  actionTextPrimary: {
    color: "#FFF",
    fontSize: 12, // Much smaller text
    fontWeight: "700",
  },

  actionTextSecondary: {
    fontSize: 12, // Much smaller text
    fontWeight: "700",
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: 80,
    paddingHorizontal: 40,
  },

  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 20,
  },

  emptySubtext: {
    fontSize: 15,
    marginTop: 8,
    textAlign: "center",
  },

  // View More Button
  viewMoreContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },

  viewMoreButton: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: "hidden",
  },

  viewMoreBlur: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },

  viewMoreContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    gap: 8,
  },

  viewMoreText: {
    fontSize: 14,
    fontWeight: "600",
  },
});

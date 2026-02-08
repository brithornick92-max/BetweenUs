// components/OurStoryTimeline.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useMemoryContext } from '../context/MemoryContext';
import { MEMORY_TYPES } from '../context/MemoryContext';
import { COLORS, GRADIENTS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '../utils/theme';

const { width: screenWidth } = Dimensions.get('window');

// Memory type icons and colors
const MEMORY_TYPE_CONFIG = {
  [MEMORY_TYPES.FIRST]: {
    icon: '✨',
    color: COLORS.mutedGold,
    gradient: GRADIENTS.goldShimmer,
    label: 'First',
  },
  [MEMORY_TYPES.ANNIVERSARY]: {
    icon: '💕',
    color: COLORS.deepRed,
    gradient: [COLORS.deepRed, COLORS.beetroot],
    label: 'Anniversary',
  },
  [MEMORY_TYPES.MILESTONE]: {
    icon: '🎯',
    color: COLORS.blushRose,
    gradient: GRADIENTS.roseDepth,
    label: 'Milestone',
  },
  [MEMORY_TYPES.INSIDE_JOKE]: {
    icon: '😄',
    color: COLORS.champagneGold,
    gradient: [COLORS.champagneGold, COLORS.mutedGold],
    label: 'Inside Joke',
  },
  [MEMORY_TYPES.MOMENT]: {
    icon: '💫',
    color: COLORS.platinum,
    gradient: [COLORS.platinum, COLORS.softCream],
    label: 'Moment',
  },
};

const OurStoryTimeline = ({ 
  style,
  onMemoryPress,
  showFilters = true,
  compact = false,
  dateRange = null,
}) => {
  const { state: memoryState, actions: memoryActions } = useMemoryContext();
  
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [filteredMemories, setFilteredMemories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedMemory, setExpandedMemory] = useState(null);
  
  // Animation values
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(50)).current;

  // Filter memories based on selected filter and date range
  useEffect(() => {
    let memories = memoryState.timeline;
    
    // Apply type filter
    if (selectedFilter !== 'all') {
      memories = memories.filter(memory => memory.type === selectedFilter);
    }
    
    // Apply date range filter
    if (dateRange) {
      memories = memories.filter(memory => {
        const memoryDate = new Date(memory.date);
        return memoryDate >= dateRange.start && memoryDate <= dateRange.end;
      });
    }
    
    setFilteredMemories(memories);
    
    // Animate in new content
    Animated.parallel([
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [memoryState.timeline, selectedFilter, dateRange]);

  const handleFilterChange = async (filter) => {
    if (filter === selectedFilter) return;
    
    await Haptics.selectionAsync();
    
    // Fade out current content
    Animated.parallel([
      Animated.timing(fadeAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnimation, {
        toValue: 30,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSelectedFilter(filter);
    });
  };

  const handleMemoryPress = async (memory) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (expandedMemory === memory.id) {
      setExpandedMemory(null);
    } else {
      setExpandedMemory(memory.id);
    }
    
    if (onMemoryPress) {
      onMemoryPress(memory);
    }
  };

  const renderFilterButtons = () => {
    if (!showFilters) return null;
    
    const filters = [
      { key: 'all', label: 'All', icon: '📖' },
      ...Object.entries(MEMORY_TYPE_CONFIG).map(([type, config]) => ({
        key: type,
        label: config.label,
        icon: config.icon,
      })),
    ];

    return (
      <View style={styles.filterContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {filters.map(filter => (
            <TouchableOpacity
              key={filter.key}
              onPress={() => handleFilterChange(filter.key)}
              style={[
                styles.filterButton,
                selectedFilter === filter.key && styles.filterButtonActive,
              ]}
              activeOpacity={0.8}
            >
              <BlurView intensity={10} style={styles.filterBlur}>
                <Text style={styles.filterIcon}>{filter.icon}</Text>
                <Text style={[
                  styles.filterLabel,
                  selectedFilter === filter.key && styles.filterLabelActive,
                ]}>
                  {filter.label}
                </Text>
              </BlurView>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderTimelineItem = (memory, index) => {
    const config = MEMORY_TYPE_CONFIG[memory.type] || MEMORY_TYPE_CONFIG[MEMORY_TYPES.MOMENT];
    const isExpanded = expandedMemory === memory.id;
    const isEven = index % 2 === 0;

    return (
      <Animated.View
        key={memory.id}
        style={[
          styles.timelineItem,
          { 
            opacity: fadeAnimation,
            transform: [{ translateY: slideAnimation }],
          },
          isEven ? styles.timelineItemLeft : styles.timelineItemRight,
        ]}
      >
        {/* Timeline connector */}
        <View style={[styles.timelineConnector, { backgroundColor: config.color }]} />
        
        {/* Memory card */}
        <TouchableOpacity
          onPress={() => handleMemoryPress(memory)}
          style={styles.memoryCard}
          activeOpacity={0.9}
        >
          <BlurView intensity={15} style={styles.memoryBlur}>
            <LinearGradient
              colors={[...config.gradient, 'transparent']}
              style={styles.memoryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.memoryContent}>
                {/* Header */}
                <View style={styles.memoryHeader}>
                  <View style={styles.memoryTypeContainer}>
                    <Text style={styles.memoryTypeIcon}>{config.icon}</Text>
                    <Text style={styles.memoryTypeLabel}>{config.label}</Text>
                  </View>
                  <Text style={styles.memoryDate}>{memory.formattedDate}</Text>
                </View>
                
                {/* Title */}
                <Text style={styles.memoryTitle} numberOfLines={compact ? 1 : 2}>
                  {memory.title}
                </Text>
                
                {/* Description (expanded) */}
                {isExpanded && memory.description && (
                  <Text style={styles.memoryDescription}>
                    {memory.description}
                  </Text>
                )}
                
                {/* Tags */}
                {memory.tags && memory.tags.length > 0 && (
                  <View style={styles.memoryTags}>
                    {memory.tags.slice(0, isExpanded ? memory.tags.length : 2).map(tag => (
                      <View key={tag} style={styles.memoryTag}>
                        <Text style={styles.memoryTagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
                
                {/* Anniversary indicator */}
                {memory.isAnniversary && (
                  <View style={styles.anniversaryIndicator}>
                    <Text style={styles.anniversaryText}>Anniversary Today! 🎉</Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </BlurView>
          
          {/* Glassmorphism border */}
          <View style={[
            styles.glassBorder,
            { borderColor: isExpanded ? config.color : 'rgba(255, 211, 233, 0.3)' }
          ]} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>📖</Text>
      <Text style={styles.emptyStateTitle}>Your Story Awaits</Text>
      <Text style={styles.emptyStateSubtitle}>
        Start building your relationship timeline by adding your first memory
      </Text>
    </View>
  );

  const renderStats = () => {
    if (compact) return null;
    
    const totalMemories = filteredMemories.length;
    const oldestMemory = filteredMemories[0];
    const newestMemory = filteredMemories[filteredMemories.length - 1];
    
    return (
      <View style={styles.statsContainer}>
        <BlurView intensity={10} style={styles.statsBlur}>
          <View style={styles.statsContent}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{totalMemories}</Text>
              <Text style={styles.statLabel}>Memories</Text>
            </View>
            
            {oldestMemory && (
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {Math.floor((new Date() - new Date(oldestMemory.date)) / (1000 * 60 * 60 * 24 * 365))}
                </Text>
                <Text style={styles.statLabel}>Years Together</Text>
              </View>
            )}
            
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {memoryState.anniversaries.length}
              </Text>
              <Text style={styles.statLabel}>Anniversaries</Text>
            </View>
          </View>
        </BlurView>
      </View>
    );
  };

  if (memoryState.isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, style]}>
        <Text style={styles.loadingText}>Loading your story...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Our Story</Text>
        <Text style={styles.subtitle}>The timeline of your love</Text>
      </View>

      {/* Stats */}
      {renderStats()}

      {/* Filters */}
      {renderFilterButtons()}

      {/* Timeline */}
      <ScrollView 
        style={styles.timelineContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.timelineContent}
      >
        {filteredMemories.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.timeline}>
            {/* Timeline line */}
            <View style={styles.timelineLine} />
            
            {/* Timeline items */}
            {filteredMemories.map((memory, index) => 
              renderTimelineItem(memory, index)
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  loadingText: {
    ...TYPOGRAPHY.body,
    color: COLORS.creamSubtle,
  },
  
  header: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  
  title: {
    ...TYPOGRAPHY.h1,
    color: COLORS.softCream,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.creamSubtle,
    textAlign: 'center',
  },
  
  statsContainer: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  
  statsBlur: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 211, 233, 0.3)',
  },
  
  statsContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: SPACING.lg,
  },
  
  statItem: {
    alignItems: 'center',
  },
  
  statNumber: {
    ...TYPOGRAPHY.h2,
    color: COLORS.blushRose,
    marginBottom: SPACING.xs,
  },
  
  statLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.creamSubtle,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  
  filterContainer: {
    marginBottom: SPACING.lg,
  },
  
  filterScrollContent: {
    paddingHorizontal: SPACING.lg,
  },
  
  filterButton: {
    marginRight: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  
  filterButtonActive: {
    transform: [{ scale: 1.05 }],
  },
  
  filterBlur: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 211, 233, 0.3)',
  },
  
  filterIcon: {
    fontSize: 16,
    marginRight: SPACING.xs,
  },
  
  filterLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.creamSubtle,
    fontWeight: '600',
  },
  
  filterLabelActive: {
    color: COLORS.blushRose,
  },
  
  timelineContainer: {
    flex: 1,
  },
  
  timelineContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  
  timeline: {
    position: 'relative',
  },
  
  timelineLine: {
    position: 'absolute',
    left: screenWidth / 2 - 1,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(255, 211, 233, 0.3)',
  },
  
  timelineItem: {
    marginBottom: SPACING.xl,
    position: 'relative',
  },
  
  timelineItemLeft: {
    paddingRight: screenWidth / 2 + SPACING.lg,
  },
  
  timelineItemRight: {
    paddingLeft: screenWidth / 2 + SPACING.lg,
  },
  
  timelineConnector: {
    position: 'absolute',
    top: SPACING.lg,
    width: 12,
    height: 12,
    borderRadius: 6,
    left: screenWidth / 2 - 6,
    zIndex: 2,
  },
  
  memoryCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  
  memoryBlur: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  
  memoryGradient: {
    padding: SPACING.lg,
  },
  
  memoryContent: {
    // Content styling handled by children
  },
  
  memoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  
  memoryTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  memoryTypeIcon: {
    fontSize: 16,
    marginRight: SPACING.xs,
  },
  
  memoryTypeLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.creamSubtle,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  
  memoryDate: {
    ...TYPOGRAPHY.caption,
    color: COLORS.creamSubtle,
  },
  
  memoryTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.softCream,
    marginBottom: SPACING.sm,
  },
  
  memoryDescription: {
    ...TYPOGRAPHY.body,
    color: COLORS.creamSubtle,
    marginBottom: SPACING.sm,
    lineHeight: 22,
  },
  
  memoryTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.sm,
  },
  
  memoryTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    marginRight: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  
  memoryTagText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.blushRose,
    fontWeight: '600',
  },
  
  anniversaryIndicator: {
    backgroundColor: COLORS.mutedGold + '20',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
    alignItems: 'center',
  },
  
  anniversaryText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.mutedGold,
    fontWeight: '700',
  },
  
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 0.5,
    borderRadius: BORDER_RADIUS.xl,
    pointerEvents: 'none',
  },
  
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
  },
  
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: SPACING.lg,
  },
  
  emptyStateTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.softCream,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  
  emptyStateSubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.creamSubtle,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
});

export default OurStoryTimeline;
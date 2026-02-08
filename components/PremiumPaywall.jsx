// components/PremiumPaywall.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSubscription } from '../context/SubscriptionContext';
import { useContent } from '../context/ContentContext';
import analytics from '../utils/analytics';
// import { useMemoryContext } from '../context/MemoryContext';
// import { useRitualContext } from '../context/RitualContext';
import { PREMIUM_FEATURES, SUBSCRIPTION_TIERS } from '../utils/premiumFeatures';
import { COLORS, GRADIENTS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '../utils/theme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Gallery invitation color palette - sophisticated and luxurious
const GALLERY_COLORS = {
  deepCharcoal: '#0B0B0B',
  richCharcoal: '#1A1A1A',
  warmCharcoal: '#2A2A2A',
  elegantGold: '#D4AF37',
  champagneGold: '#F7E7CE',
  roseGold: '#E8B4B8',
  platinumWhite: '#F8F8F8',
  creamAccent: '#FFF4E8',
  luxuryBorder: '#3A3A3A',
};

const PremiumPaywall = ({
  style,
  feature = null,
  onSubscribe,
  onClose,
  showCloseButton = true,
}) => {
  const { offerings, purchasePackage, restorePurchases } = useSubscription();
  const { getRelationshipDurationText, getDurationCategory, getRelationshipDuration } = useContent();
  // const { state: memoryState } = useMemoryContext();
  // const { state: ritualState } = useRitualContext();
  
  // Fallback data for missing contexts
  const memoryState = { memories: [] };
  const ritualState = { ritualHistory: [] };
  
  const [selectedTier, setSelectedTier] = useState('PREMIUM');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [showBenefits, setShowBenefits] = useState(false);
  
  // Animation values
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(50)).current;
  const goldShimmerAnimation = useRef(new Animated.Value(0)).current;
  const benefitsAnimation = useRef(new Animated.Value(0)).current;

  // Initialize animations and track paywall view
  useEffect(() => {
    // Track paywall view
    const relationshipDuration = getRelationshipDuration();
    const durationCategory = getDurationCategory(relationshipDuration);
    
    analytics.trackFeatureUsage('premium', 'paywall_viewed', {
      feature: feature?.name || 'general',
      relationship_duration: durationCategory,
      duration_days: relationshipDuration
    });
    
    // Main entrance animation
    Animated.parallel([
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // Gold shimmer animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(goldShimmerAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(goldShimmerAnimation, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Show benefits after a delay
    setTimeout(() => {
      setShowBenefits(true);
      Animated.timing(benefitsAnimation, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }, 1000);
  }, []);

  const resolveSelectedPackage = () => {
    const packages = offerings?.packages || [];
    if (!packages.length) return null;

    if (packages.length === 1) return packages[0];

    const preferred = packages.find((pkg) => {
      const id = pkg?.identifier || '';
      const productId = pkg?.product?.identifier || '';
      return `${id}${productId}`.toLowerCase().includes('premium');
    });

    return preferred || packages[0];
  };

  const handleSubscribe = async () => {
    if (isSubscribing) return;
    
    setIsSubscribing(true);
    
    try {
      const selectedPackage = resolveSelectedPackage();
      if (!selectedPackage) {
        throw new Error('No subscription packages available.');
      }

      // Track subscription attempt
      const relationshipDuration = getRelationshipDuration();
      const durationCategory = getDurationCategory(relationshipDuration);
      
      await analytics.trackFeatureUsage('premium', 'subscription_attempted', {
        tier: selectedTier,
        feature: feature?.name || 'general',
        relationship_duration: durationCategory,
        duration_days: relationshipDuration
      });
      
      // Haptic feedback for premium action
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const purchaseResult = await purchasePackage(selectedPackage);
      if (purchaseResult.cancelled) {
        return;
      }
      if (!purchaseResult.success) {
        throw new Error(purchaseResult.error || 'Purchase failed');
      }
      
      // Track successful subscription
      await analytics.trackFeatureUsage('premium', 'subscription_completed', {
        tier: selectedTier,
        feature: feature?.name || 'general',
        relationship_duration: durationCategory
      });
      
      if (onSubscribe) {
        onSubscribe(selectedTier);
      }
      
    } catch (error) {
      console.error('Subscription failed:', error);
      
      // Track subscription failure
      await analytics.trackUserBehavior('subscription_failed', {
        error: error.message,
        tier: selectedTier
      });
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleRestore = async () => {
    if (isSubscribing) return;
    setIsSubscribing(true);
    try {
      const result = await restorePurchases();
      if (!result?.success) {
        throw new Error(result?.error || 'Restore failed');
      }
    } catch (error) {
      console.error('Restore failed:', error);
    } finally {
      setIsSubscribing(false);
    }
  };

  const renderGalleryHeader = () => (
    <View style={styles.galleryHeader}>
      {/* Close button */}
      {showCloseButton && (
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeButton}
          activeOpacity={0.8}
        >
          <Text style={styles.closeButtonText}>×</Text>
        </TouchableOpacity>
      )}

      {/* Gallery invitation */}
      <View style={styles.invitationContainer}>
        <Text style={styles.galleryTitle}>You're Invited</Text>
        <Text style={styles.gallerySubtitle}>To preserve your love story forever</Text>
        
        {/* Gold accent line */}
        <Animated.View 
          style={[
            styles.goldAccentLine,
            {
              opacity: goldShimmerAnimation,
            },
          ]}
        />
      </View>
    </View>
  );

  const renderMemoryPreservation = () => {
    const memoryCount = memoryState.memories.length;
    const ritualCount = ritualState.ritualHistory.length;
    
    return (
      <View style={styles.preservationSection}>
        <BlurView intensity={10} style={styles.preservationBlur}>
          <Text style={styles.preservationTitle}>Your Love Story So Far</Text>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{memoryCount}</Text>
              <Text style={styles.statLabel}>Precious Memories</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{ritualCount}</Text>
              <Text style={styles.statLabel}>Intimate Moments</Text>
            </View>
          </View>
          
          <Text style={styles.preservationMessage}>
            These moments are irreplaceable. Premium ensures they're protected, 
            preserved, and enhanced forever.
          </Text>
        </BlurView>
      </View>
    );
  };

  const renderRelationshipPersonalization = () => {
    const duration = getRelationshipDuration();
    const durationText = getRelationshipDurationText();
    const category = getDurationCategory(duration);
    
    if (duration === 0) return null; // Don't show if no anniversary date set
    
    const personalizedBenefits = {
      new: {
        icon: '🌱',
        title: 'New Love Premium',
        description: 'Perfect for couples just beginning their journey',
        benefits: [
          'Getting-to-know-you prompts tailored for new relationships',
          'Gentle intimacy building exercises',
          'Memory preservation from day one',
          'Foundation-building conversation starters'
        ]
      },
      developing: {
        icon: '🌸',
        title: 'Growing Together Premium',
        description: 'Designed for couples building deeper connections',
        benefits: [
          'Connection-deepening prompts for developing relationships',
          'Trust-building intimate conversations',
          'Milestone celebration features',
          'Relationship growth tracking'
        ]
      },
      established: {
        icon: '🌳',
        title: 'Committed Love Premium',
        description: 'Enhanced features for established partnerships',
        benefits: [
          'Deep intimacy prompts for committed couples',
          'Advanced relationship exploration tools',
          'Shared memory timeline creation',
          'Long-term planning conversation guides'
        ]
      },
      mature: {
        icon: '🏛️',
        title: 'Seasoned Partnership Premium',
        description: 'Sophisticated tools for mature relationships',
        benefits: [
          'Life navigation prompts for seasoned couples',
          'Legacy building memory preservation',
          'Advanced intimacy exploration',
          'Relationship wisdom documentation'
        ]
      },
      long_term: {
        icon: '💎',
        title: 'Timeless Love Premium',
        description: 'Premium features for enduring partnerships',
        benefits: [
          'Deep partnership prompts for long-term couples',
          'Lifetime memory archive creation',
          'Generational story preservation',
          'Wisdom sharing and reflection tools'
        ]
      }
    };
    
    const personalizedContent = personalizedBenefits[category];
    
    return (
      <View style={styles.personalizationSection}>
        <BlurView intensity={12} style={styles.personalizationBlur}>
          <View style={styles.personalizationHeader}>
            <Text style={styles.personalizationIcon}>{personalizedContent.icon}</Text>
            <View style={styles.personalizationTitleContainer}>
              <Text style={styles.personalizationTitle}>{personalizedContent.title}</Text>
              <Text style={styles.personalizationDuration}>Together for {durationText}</Text>
            </View>
          </View>
          
          <Text style={styles.personalizationDescription}>
            {personalizedContent.description}
          </Text>
          
          <View style={styles.personalizedBenefitsList}>
            {personalizedContent.benefits.map((benefit, index) => (
              <View key={index} style={styles.personalizedBenefit}>
                <Text style={styles.personalizedBullet}>✨</Text>
                <Text style={styles.personalizedBenefitText}>{benefit}</Text>
              </View>
            ))}
          </View>
          
          <View style={styles.personalizationFooter}>
            <Text style={styles.personalizationFooterText}>
              Premium adapts to your relationship stage, ensuring every feature feels perfectly tailored to where you are in your journey together.
            </Text>
          </View>
        </BlurView>
      </View>
    );
  };

  const renderPremiumBenefits = () => {
    const benefits = [
      {
        icon: '🔥',
        title: 'All Heat Levels',
        description: 'Access to adventurous and passionate prompts (Heat 4-5)',
        emotional: 'Explore deeper intimacy without limits',
      },
      {
        icon: '🏛️',
        title: 'Memory Vault',
        description: 'Export your complete timeline as a beautiful PDF keepsake',
        emotional: 'Never lose your precious memories',
      },
      {
        icon: '🌙',
        title: 'Dark Mode',
        description: 'Elegant dark theme for intimate evening conversations',
        emotional: 'Create the perfect ambiance for connection',
      },
      {
        icon: '☁️',
        title: 'Cloud Sanctuary',
        description: 'Secure cloud backup ensures your love story is always safe',
        emotional: 'Peace of mind for your relationship history',
      },
      {
        icon: '✨',
        title: 'Unlimited Prompts',
        description: 'No daily limits - explore as much as your heart desires',
        emotional: 'Never run out of ways to connect',
      },
      {
        icon: '🔒',
        title: 'Advanced Privacy',
        description: 'Biometric locks and enhanced security for intimate content',
        emotional: 'Keep your private moments truly private',
      },
    ];

    return (
      <Animated.View 
        style={[
          styles.benefitsSection,
          {
            opacity: benefitsAnimation,
            transform: [{
              translateY: benefitsAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [30, 0],
              }),
            }],
          },
        ]}
      >
        <Text style={styles.benefitsTitle}>Premium Collection</Text>
        <Text style={styles.benefitsSubtitle}>
          Tools to protect, preserve, and enhance your relationship
        </Text>
        
        <View style={styles.benefitsList}>
          {benefits.map((benefit, index) => (
            <View key={index} style={styles.benefitItem}>
              <BlurView intensity={5} style={styles.benefitBlur}>
                <View style={styles.benefitHeader}>
                  <Text style={styles.benefitIcon}>{benefit.icon}</Text>
                  <View style={styles.benefitTitleContainer}>
                    <Text style={styles.benefitTitle}>{benefit.title}</Text>
                    <Text style={styles.benefitDescription}>{benefit.description}</Text>
                  </View>
                </View>
                <Text style={styles.benefitEmotional}>{benefit.emotional}</Text>
              </BlurView>
            </View>
          ))}
        </View>
      </Animated.View>
    );
  };

  const renderSubscriptionTier = () => {
    const selectedPackage = resolveSelectedPackage();
    const tier = SUBSCRIPTION_TIERS[selectedTier] || {
      name: 'Premium',
      price: '$7.99/month',
      emotionalBenefits: [
        'Unlimited access to all prompts and features',
        'Advanced personalization for your relationship stage',
        'Secure memory preservation and export',
        'Premium themes and enhanced privacy'
      ]
    };
    
    return (
      <View style={styles.subscriptionSection}>
        <BlurView intensity={15} style={styles.subscriptionBlur}>
          <View style={styles.tierHeader}>
            <Text style={styles.tierName}>{tier.name}</Text>
            <Text style={styles.tierPrice}>
              {selectedPackage?.product?.priceString || tier.price}
            </Text>
          </View>
          
          <Text style={styles.tierDescription}>
            Complete access to all premium features that protect and enhance your love story
          </Text>
          
          {/* Emotional benefits */}
          <View style={styles.emotionalBenefits}>
            <Text style={styles.emotionalTitle}>What This Means for Your Relationship:</Text>
            {tier.emotionalBenefits.map((benefit, index) => (
              <View key={index} style={styles.emotionalBenefit}>
                <Text style={styles.emotionalBullet}>♡</Text>
                <Text style={styles.emotionalBenefitText}>{benefit}</Text>
              </View>
            ))}
          </View>
          
          {/* Subscribe button */}
          <TouchableOpacity
            onPress={handleSubscribe}
            disabled={isSubscribing}
            style={[styles.subscribeButton, isSubscribing && styles.subscribeButtonDisabled]}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[GALLERY_COLORS.elegantGold, GALLERY_COLORS.champagneGold]}
              style={styles.subscribeButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.subscribeButtonText}>
                {isSubscribing ? 'Processing...' : 'Protect Our Story'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleRestore}
            disabled={isSubscribing}
            style={styles.restoreButton}
            activeOpacity={0.8}
          >
            <Text style={styles.restoreText}>Restore purchases</Text>
          </TouchableOpacity>
          
          {/* Trust indicators */}
          <View style={styles.trustIndicators}>
            <Text style={[styles.trustText, styles.trustTextLeft]}>✓ Cancel anytime</Text>
            <Text style={[styles.trustText, { left: '49%', transform: [{ translateX: -50 }] }]}>✓ Secure payment</Text>
            <Text style={[styles.trustText, { left: '75%' }]}>✓ Instant access</Text>
          </View>
        </BlurView>
      </View>
    );
  };

  const renderFeatureSpotlight = () => {
    if (!feature) return null;
    
    return (
      <View style={styles.spotlightSection}>
        <BlurView intensity={8} style={styles.spotlightBlur}>
          <Text style={styles.spotlightIcon}>{feature.icon || '✨'}</Text>
          <Text style={styles.spotlightTitle}>{feature.name}</Text>
          <Text style={styles.spotlightDescription}>{feature.description}</Text>
          <Text style={styles.spotlightEmotional}>"{feature.emotionalValue}"</Text>
        </BlurView>
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={[GALLERY_COLORS.deepCharcoal, GALLERY_COLORS.richCharcoal, GALLERY_COLORS.warmCharcoal]}
        style={styles.backgroundGradient}
      >
        <Animated.View 
          style={[
            styles.content,
            {
              opacity: fadeAnimation,
              transform: [{ translateY: slideAnimation }],
            },
          ]}
        >
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Gallery Header */}
            {renderGalleryHeader()}
            
            {/* Feature Spotlight */}
            {renderFeatureSpotlight()}
            
            {/* Memory Preservation */}
            {renderMemoryPreservation()}
            
            {/* Relationship Personalization */}
            {renderRelationshipPersonalization()}
            
            {/* Premium Benefits */}
            {showBenefits && renderPremiumBenefits()}
            
            {/* Subscription Tier */}
            {renderSubscriptionTier()}
            
            {/* Gallery Footer */}
            <View style={styles.galleryFooter}>
              <Text style={styles.footerQuote}>
                "The best things in life are the people we love, the places we've been, 
                and the memories we've made along the way."
              </Text>
            </View>
          </ScrollView>
        </Animated.View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  backgroundGradient: {
    flex: 1,
  },
  
  content: {
    flex: 1,
  },
  
  scrollView: {
    flex: 1,
  },
  
  scrollContent: {
    paddingVertical: SPACING.xl,
  },
  
  galleryHeader: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  
  closeButton: {
    position: 'absolute',
    top: 0,
    right: SPACING.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GALLERY_COLORS.luxuryBorder,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  
  closeButtonText: {
    fontSize: 24,
    color: GALLERY_COLORS.platinumWhite,
    fontWeight: '300',
  },
  
  invitationContainer: {
    alignItems: 'center',
    paddingTop: SPACING.xl,
  },
  
  galleryTitle: {
    ...TYPOGRAPHY.display,
    color: GALLERY_COLORS.platinumWhite,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  
  gallerySubtitle: {
    ...TYPOGRAPHY.h3,
    color: GALLERY_COLORS.champagneGold,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: SPACING.lg,
  },
  
  goldAccentLine: {
    width: 60,
    height: 2,
    backgroundColor: GALLERY_COLORS.elegantGold,
  },
  
  spotlightSection: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  
  spotlightBlur: {
    backgroundColor: GALLERY_COLORS.elegantGold + '20',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: GALLERY_COLORS.elegantGold + '40',
  },
  
  spotlightIcon: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  
  spotlightTitle: {
    ...TYPOGRAPHY.h1,
    color: GALLERY_COLORS.platinumWhite,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  
  spotlightDescription: {
    ...TYPOGRAPHY.body,
    color: GALLERY_COLORS.creamAccent,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  
  spotlightEmotional: {
    ...TYPOGRAPHY.pullQuote,
    color: GALLERY_COLORS.elegantGold,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  
  preservationSection: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  
  preservationBlur: {
    backgroundColor: GALLERY_COLORS.warmCharcoal + '60',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: GALLERY_COLORS.luxuryBorder,
  },
  
  preservationTitle: {
    ...TYPOGRAPHY.h2,
    color: GALLERY_COLORS.platinumWhite,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  
  statItem: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  
  statNumber: {
    ...TYPOGRAPHY.display,
    fontSize: 36,
    color: GALLERY_COLORS.elegantGold,
    marginBottom: SPACING.xs,
  },
  
  statLabel: {
    ...TYPOGRAPHY.caption,
    color: GALLERY_COLORS.creamAccent,
    textAlign: 'center',
  },
  
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: GALLERY_COLORS.luxuryBorder,
  },
  
  preservationMessage: {
    ...TYPOGRAPHY.body,
    color: GALLERY_COLORS.creamAccent,
    textAlign: 'center',
    lineHeight: 24,
    fontStyle: 'italic',
  },
  
  // Relationship Personalization Section
  personalizationSection: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  
  personalizationBlur: {
    backgroundColor: GALLERY_COLORS.elegantGold + '15',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: GALLERY_COLORS.elegantGold + '30',
  },
  
  personalizationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  
  personalizationIcon: {
    fontSize: 32,
    marginRight: SPACING.md,
  },
  
  personalizationTitleContainer: {
    flex: 1,
  },
  
  personalizationTitle: {
    ...TYPOGRAPHY.h2,
    color: GALLERY_COLORS.platinumWhite,
    marginBottom: SPACING.xs,
  },
  
  personalizationDuration: {
    ...TYPOGRAPHY.caption,
    color: GALLERY_COLORS.elegantGold,
    fontWeight: '600',
  },
  
  personalizationDescription: {
    ...TYPOGRAPHY.body,
    color: GALLERY_COLORS.creamAccent,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 22,
  },
  
  personalizedBenefitsList: {
    marginBottom: SPACING.lg,
  },
  
  personalizedBenefit: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  
  personalizedBullet: {
    ...TYPOGRAPHY.body,
    color: GALLERY_COLORS.elegantGold,
    marginRight: SPACING.sm,
    marginTop: 2,
  },
  
  personalizedBenefitText: {
    ...TYPOGRAPHY.body,
    color: GALLERY_COLORS.creamAccent,
    flex: 1,
    lineHeight: 22,
  },
  
  personalizationFooter: {
    borderTopWidth: 1,
    borderTopColor: GALLERY_COLORS.elegantGold + '20',
    paddingTop: SPACING.md,
  },
  
  personalizationFooterText: {
    ...TYPOGRAPHY.caption,
    color: GALLERY_COLORS.champagneGold,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  
  benefitsSection: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  
  benefitsTitle: {
    ...TYPOGRAPHY.h1,
    color: GALLERY_COLORS.platinumWhite,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  
  benefitsSubtitle: {
    ...TYPOGRAPHY.body,
    color: GALLERY_COLORS.champagneGold,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    fontStyle: 'italic',
  },
  
  benefitsList: {
    // Benefits list styling
  },
  
  benefitItem: {
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  
  benefitBlur: {
    backgroundColor: GALLERY_COLORS.warmCharcoal + '40',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 0.5,
    borderColor: GALLERY_COLORS.luxuryBorder,
  },
  
  benefitHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  
  benefitIcon: {
    fontSize: 24,
    marginRight: SPACING.md,
    marginTop: SPACING.xs,
  },
  
  benefitTitleContainer: {
    flex: 1,
  },
  
  benefitTitle: {
    ...TYPOGRAPHY.h3,
    color: GALLERY_COLORS.platinumWhite,
    marginBottom: SPACING.xs,
  },
  
  benefitDescription: {
    ...TYPOGRAPHY.body,
    color: GALLERY_COLORS.creamAccent,
    lineHeight: 22,
  },
  
  benefitEmotional: {
    ...TYPOGRAPHY.caption,
    color: GALLERY_COLORS.elegantGold,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  
  subscriptionSection: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  
  subscriptionBlur: {
    backgroundColor: GALLERY_COLORS.richCharcoal + '80',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: GALLERY_COLORS.elegantGold + '30',
  },
  
  tierHeader: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  
  tierName: {
    ...TYPOGRAPHY.h1,
    color: GALLERY_COLORS.platinumWhite,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  
  tierPrice: {
    ...TYPOGRAPHY.h2,
    color: GALLERY_COLORS.elegantGold,
  },
  
  tierDescription: {
    ...TYPOGRAPHY.body,
    color: GALLERY_COLORS.creamAccent,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 24,
  },
  
  emotionalBenefits: {
    marginBottom: SPACING.xl,
  },
  
  emotionalTitle: {
    ...TYPOGRAPHY.h3,
    color: GALLERY_COLORS.champagneGold,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  
  emotionalBenefit: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  
  emotionalBullet: {
    ...TYPOGRAPHY.body,
    color: GALLERY_COLORS.elegantGold,
    marginRight: SPACING.sm,
    marginTop: 2,
  },
  
  emotionalBenefitText: {
    ...TYPOGRAPHY.body,
    color: GALLERY_COLORS.creamAccent,
    flex: 1,
    lineHeight: 22,
  },
  
  subscribeButton: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  
  subscribeButtonDisabled: {
    opacity: 0.7,
  },
  
  subscribeButtonGradient: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  
  subscribeButtonText: {
    ...TYPOGRAPHY.button,
    fontSize: 16,
    color: GALLERY_COLORS.deepCharcoal,
    fontWeight: '700',
    textAlign: 'center',
  },

  restoreButton: {
    alignSelf: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },

  restoreText: {
    ...TYPOGRAPHY.caption,
    color: GALLERY_COLORS.champagneGold,
    textDecorationLine: 'underline',
  },
  
  trustIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 0,
    position: 'relative',
    height: 20,
  },
  
  trustText: {
    ...TYPOGRAPHY.caption,
    color: GALLERY_COLORS.champagneGold,
    fontSize: 9,
    position: 'absolute',
  },

  trustTextLeft: {
    left: -20,
  },

  trustTextRight: {
    right: 0,
  },
  
  galleryFooter: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: GALLERY_COLORS.luxuryBorder,
    marginHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  
  footerQuote: {
    ...TYPOGRAPHY.pullQuote,
    color: GALLERY_COLORS.champagneGold,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 28,
  },
});

export default PremiumPaywall;

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';

const FAQ_DATA = [
  {
    category: 'Getting Started',
    questions: [
      {
        q: 'What is Between Us?',
        a: 'Between Us is a couples app built around one idea: where closeness deepens. Through daily prompts, shared journaling, and intimate rituals, it gives you and your partner a private space to connect more meaningfully.\n\nBetween Us is designed for couples who already have a loving foundation — it\'s for those who want to explore even deeper intimacy and connection together.',
      },
      {
        q: 'Who is Between Us for?',
        a: 'Between Us is for couples who are already in a good place and want to go deeper. If your relationship has a strong foundation and you want to make it even richer, this app is for you.\n\nIt\'s not a therapy app and isn\'t designed for couples navigating serious relationship concerns. If that\'s where you are, we\'d gently encourage professional counseling.',
      },
      {
        q: 'How much does it cost?',
        a: 'Free version: Preview 3 read-only prompts (Heat levels 1-3)\n\nPremium:\n• Monthly: $7.99/month per couple\n• Yearly: $49.99/year (save 48%!)\n• Lifetime: $69.99 one-time payment\n\nPremium unlocks unlimited prompts, responses, love notes, calendar, partner connection, and more. One subscription covers both partners.',
      },
      {
        q: 'How do I get started?',
        a: '1. Create your account\n2. Customize your partner names\n3. Link with your partner (optional)\n4. Start exploring prompts!',
      },
    ],
  },
  {
    category: 'Account & Setup',
    questions: [
      {
        q: 'Do I need my partner to use the app?',
        a: 'No! You can use Between Us solo to journal, reflect, and prepare conversation topics. However, linking with your partner unlocks shared features and makes the experience more interactive.',
      },
      {
        q: 'How do I link with my partner?',
        a: '1. Both partners create accounts\n2. One partner generates a link code\n3. The other partner enters the code\n4. Both partners confirm the link\n5. You\'re connected!',
      },
      {
        q: 'Can I unlink from my partner?',
        a: 'Yes, either partner can unlink at any time. Your individual data remains private, shared content is removed from both accounts, and you can relink later if desired.',
      },
    ],
  },
  {
    category: 'Privacy & Security',
    questions: [
      {
        q: 'Is my data private?',
        a: 'Absolutely! Your journal entries are end-to-end encrypted, we never sell your data, we can\'t read your encrypted content, and only you and your linked partner can see shared content.',
      },
      {
        q: 'Can my partner see everything I write?',
        a: 'No! You control what you share. Private entries stay private, you choose what to share and when, and your partner can\'t access your private thoughts.',
      },
      {
        q: 'What happens if we break up?',
        a: 'You can unlink from your partner, your data remains yours, shared content is removed, and you can delete your account if desired. Your ex-partner cannot access your new content.',
      },
      {
        q: 'Can Between Us read my journal entries?',
        a: 'No! Your intimate content is end-to-end encrypted on your device before sending. We can\'t decrypt your content - only you and your linked partner have the keys.',
      },
    ],
  },
  {
    category: 'Features & Usage',
    questions: [
      {
        q: 'What are heat levels?',
        a: 'Heat 1: Pure emotional connection (non-sexual)\nHeat 2: Flirty and romantic\nHeat 3: Intimate and moderately sexual\nHeat 4: Playfully sexual and adventurous\nHeat 5: Intensely passionate\n\nYou can adjust your heat level anytime based on your mood.',
      },
      {
        q: 'How do prompts work?',
        a: '1. Open the app to see your daily prompt\n2. Read and reflect on the question\n3. Write your response\n4. Share with your partner (optional)\n5. Read their response when ready\n6. Continue the conversation!',
      },
      {
        q: 'Can I skip prompts I don\'t like?',
        a: 'Yes! You can skip to the next prompt, refresh for a different one, mark prompts as favorites, or hide prompts you don\'t want to see again.',
      },
      {
        q: 'What if a prompt makes me uncomfortable?',
        a: 'Skip it immediately, adjust your heat level, provide feedback, or use content filtering in settings. You\'re always in control.',
      },
    ],
  },
  {
    category: 'Subscription & Billing',
    questions: [
      {
        q: 'What\'s included in Premium?',
        a: '• All heat levels (1-5)\n• Unlimited daily prompts\n• Love notes with photo attachments\n• Date night catalog with planning tools\n• Night rituals and custom routines\n• Calendar and scheduling\n• Partner connection and cloud sync\n• Vibe Signals (share your mood)\n• Moment Signals (thinking of you taps)\n• Energy Matcher (content for your energy level)\n• Inside Jokes vault\n• Year Reflection narratives\n• Surprise Tonight (spontaneous date ideas)\n• Reveal Together (simultaneous answer sharing)\n• Soft Boundaries (hide content privately)\n• Data export (journals, prompts, memories, and more)\n• Both partners get access',
      },
      {
        q: 'How do I subscribe?',
        a: '1. Tap "Upgrade to Premium" in the app\n2. Choose your plan (Monthly, Yearly, or Lifetime)\n3. Confirm through your app store\n4. Enjoy premium features immediately!\n5. Your linked partner automatically gets access too',
      },
      {
        q: 'Can I cancel anytime?',
        a: 'Yes! Cancel through your app store:\n\niOS: Settings > Apple ID > Subscriptions\nAndroid: Google Play > Subscriptions\n\nYour premium access continues until the end of your billing period.',
      },
      {
        q: 'Can I share Premium with my partner?',
        a: 'Yes! Premium is per couple. When one partner subscribes, both get premium features when linked. No need for both to pay separately.',
      },
    ],
  },
  {
    category: 'Technical Support',
    questions: [
      {
        q: 'The app isn\'t working. What should I do?',
        a: '1. Force close and reopen the app\n2. Check for app updates\n3. Restart your device\n4. Check your internet connection\n5. Contact support if this continues',
      },
      {
        q: 'My partner and I aren\'t syncing. Help!',
        a: 'Check that:\n• Both partners are connected to internet\n• You\'re both logged in\n• Your accounts are properly linked\n• You\'ve both updated to the latest version\n• Try unlinking and relinking if needed',
      },
      {
        q: 'How do I delete my account?',
        a: '1. Go to Settings > Privacy & Security\n2. Tap "Delete Account"\n3. Confirm your decision\n4. Your data will be permanently deleted\n\nWarning: This cannot be undone!',
      },
    ],
  },
  {
    category: 'About Between Us & Your Relationship',
    questions: [
      {
        q: 'Is Between Us a substitute for therapy?',
        a: 'No. Between Us is a connection experience, not therapy. It\'s designed for couples who already have a loving foundation and want to go deeper — it\'s not a space for navigating serious relationship concerns.\n\nIf you\'re in a place that needs professional support, we\'d always encourage reaching out to a licensed therapist.',
      },
      {
        q: 'When should we NOT use Between Us?',
        a: 'Between Us may not be the right fit if you\'re:\n• Navigating a relationship crisis\n• Working through trust concerns\n• Experiencing abuse of any kind\n• Considering separation or divorce\n• Feeling unsafe with your partner\n\nThis app is for couples who are in a good place — it\'s built to deepen what\'s already beautiful. For serious concerns, please reach out to a licensed therapist.',
      },
      {
        q: 'Is Between Us right for every couple?',
        a: 'Between Us is designed for couples who are already in a loving place and want to explore deeper intimacy and connection. It\'s not a substitute for professional support. If your relationship needs that kind of care, a licensed therapist or counselor is the right next step.',
      },
    ],
  },
];

export default function FAQScreen({ navigation }) {
  const [expandedItems, setExpandedItems] = useState({});
  const { colors } = useTheme();

  const toggleItem = (categoryIndex, questionIndex) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const key = `${categoryIndex}-${questionIndex}`;
    setExpandedItems(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleContactSupport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Contact Support', 'Email: brittanyapps@outlook.com\nResponse time: 24-48 hours');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>FAQ</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Introduction */}
        <View style={[styles.intro, { backgroundColor: colors.surface }]}>
          <Text style={[styles.introTitle, { color: colors.text }]}>Frequently Asked Questions</Text>
          <Text style={[styles.introText, { color: colors.textSecondary }]}>
            Find answers to common questions about Between Us. Can't find what you're looking for? Contact support below.
          </Text>
        </View>

        {/* FAQ Categories */}
        {FAQ_DATA.map((category, categoryIndex) => (
          <View key={categoryIndex} style={[styles.category, { backgroundColor: colors.surface }]}>
            <Text style={[styles.categoryTitle, { color: colors.blushRose }]}>{category.category}</Text>
            
            {category.questions.map((item, questionIndex) => {
              const key = `${categoryIndex}-${questionIndex}`;
              const isExpanded = expandedItems[key];
              
              return (
                <TouchableOpacity
                  key={questionIndex}
                  style={[styles.faqItem, { borderTopColor: colors.border }]}
                  onPress={() => toggleItem(categoryIndex, questionIndex)}
                  activeOpacity={0.7}
                >
                  <View style={styles.questionRow}>
                    <Text style={[styles.question, { color: colors.text }]}>{item.q}</Text>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={colors.textSecondary}
                      style={styles.chevron}
                    />
                  </View>
                  
                  {isExpanded && (
                    <Text style={[styles.answer, { color: colors.textSecondary }]}>{item.a}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Contact Support */}
        <View style={[styles.supportSection, { backgroundColor: colors.surface }]}>
          <Text style={[styles.supportTitle, { color: colors.text }]}>Still have questions?</Text>
          <Text style={[styles.supportText, { color: colors.textSecondary }]}>
            We're here to help! Contact our support team and we'll get back to you within 24-48 hours.
          </Text>
          
          <TouchableOpacity
            style={[styles.supportButton, { backgroundColor: colors.primary }]}
            onPress={handleContactSupport}
            activeOpacity={0.8}
          >
            <Ionicons name="mail-outline" size={20} color={'#FFFFFF'} />
            <Text style={[styles.supportButtonText, { color: '#FFFFFF' }]}>Contact Support</Text>
          </TouchableOpacity>
          
          <Text style={[styles.supportEmail, { color: colors.textSecondary }]}>brittanyapps@outlook.com</Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  intro: {
    padding: 20,
    marginBottom: 12,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  introText: {
    fontSize: 15,
    lineHeight: 22,
  },
  category: {
    marginBottom: 12,
    paddingTop: 20,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  faqItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  question: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    marginRight: 12,
  },
  chevron: {
    marginTop: 2,
  },
  answer: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  supportSection: {
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  supportTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  supportText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  supportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 8,
  },
  supportEmail: {
    fontSize: 14,
  },
  bottomPadding: {
    height: 40,
  },
});

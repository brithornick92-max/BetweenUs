import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const FAQ_DATA = [
  {
    category: 'Getting Started',
    questions: [
      {
        q: 'What is Between Us?',
        a: 'Between Us is a relationship app designed to help thriving couples deepen their connection through daily prompts, journaling, and shared experiences. We provide conversation starters, intimate questions, and tools to help you and your partner grow closer.\n\nImportant: Between Us is for couples who are already doing well and want to do even better. It\'s not designed for couples experiencing serious relationship difficulties.',
      },
      {
        q: 'Who is Between Us for?',
        a: 'Between Us is for thriving couples who want to deepen their connection. It\'s NOT appropriate for couples struggling with serious conflicts, trust issues, communication breakdowns, or considering separation.\n\nIf you\'re experiencing relationship difficulties, please seek professional counseling.',
      },
      {
        q: 'How much does it cost?',
        a: 'Free version: Basic prompts (Heat levels 1-2)\n\nPremium:\n• Monthly: $7.99/month per couple\n• Yearly: $49.99/year (save 48%!)\n• Lifetime: $69.99 one-time payment\n\nPremium is per couple - when one partner subscribes, both get premium features when linked.',
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
        a: '• All heat levels (1-5)\n• Unlimited daily prompts\n• Advanced personalization\n• Custom rituals and routines\n• Memory export features\n• Priority support\n• Ad-free experience\n• Both partners get access',
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
        a: '1. Force close and reopen the app\n2. Check for app updates\n3. Restart your device\n4. Check your internet connection\n5. Contact support if issues persist',
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
    category: 'Relationship Advice',
    questions: [
      {
        q: 'Is Between Us a substitute for therapy?',
        a: 'No. Between Us is a tool for connection, not therapy. The app is designed for thriving couples, not those in crisis. Serious issues need professional help.\n\nSeek professional help if you\'re experiencing ongoing conflict, trust issues, abuse, or considering separation.',
      },
      {
        q: 'When should we NOT use Between Us?',
        a: 'Don\'t use Between Us if you\'re:\n• In active conflict or crisis\n• Dealing with infidelity or trust issues\n• Experiencing abuse\n• Considering separation or divorce\n• Feeling unsafe with your partner\n\nBetween Us is for thriving couples who want to deepen their connection, not for couples in crisis.',
      },
      {
        q: 'Can Between Us save a struggling relationship?',
        a: 'No. Between Us is not designed for couples in crisis. It\'s for thriving couples who want to deepen their connection. If you\'re experiencing serious relationship problems, please seek professional help from a licensed therapist or counselor.',
      },
    ],
  },
];

export default function FAQScreen({ navigation }) {
  const [expandedItems, setExpandedItems] = useState({});

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
    // In a real app, this would open email or contact form
    alert('Contact Support\n\nEmail: brittanyapps@outlook.com\nResponse time: 24-48 hours');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FAQ</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Introduction */}
        <View style={styles.intro}>
          <Text style={styles.introTitle}>Frequently Asked Questions</Text>
          <Text style={styles.introText}>
            Find answers to common questions about Between Us. Can't find what you're looking for? Contact support below.
          </Text>
        </View>

        {/* FAQ Categories */}
        {FAQ_DATA.map((category, categoryIndex) => (
          <View key={categoryIndex} style={styles.category}>
            <Text style={styles.categoryTitle}>{category.category}</Text>
            
            {category.questions.map((item, questionIndex) => {
              const key = `${categoryIndex}-${questionIndex}`;
              const isExpanded = expandedItems[key];
              
              return (
                <TouchableOpacity
                  key={questionIndex}
                  style={styles.faqItem}
                  onPress={() => toggleItem(categoryIndex, questionIndex)}
                  activeOpacity={0.7}
                >
                  <View style={styles.questionRow}>
                    <Text style={styles.question}>{item.q}</Text>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color="#666"
                      style={styles.chevron}
                    />
                  </View>
                  
                  {isExpanded && (
                    <Text style={styles.answer}>{item.a}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Contact Support */}
        <View style={styles.supportSection}>
          <Text style={styles.supportTitle}>Still have questions?</Text>
          <Text style={styles.supportText}>
            We're here to help! Contact our support team and we'll get back to you within 24-48 hours.
          </Text>
          
          <TouchableOpacity
            style={styles.supportButton}
            onPress={handleContactSupport}
            activeOpacity={0.8}
          >
            <Ionicons name="mail-outline" size={20} color="#FFF" />
            <Text style={styles.supportButtonText}>Contact Support</Text>
          </TouchableOpacity>
          
          <Text style={styles.supportEmail}>brittanyapps@outlook.com</Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  intro: {
    backgroundColor: '#FFF',
    padding: 20,
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  introText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  category: {
    backgroundColor: '#FFF',
    marginBottom: 16,
    paddingTop: 20,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  faqItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
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
    color: '#333',
    lineHeight: 22,
    marginRight: 12,
  },
  chevron: {
    marginTop: 2,
  },
  answer: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginTop: 12,
  },
  supportSection: {
    backgroundColor: '#FFF',
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  supportTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  supportText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B9D',
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
    color: '#999',
  },
  bottomPadding: {
    height: 40,
  },
});

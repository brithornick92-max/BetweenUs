/**
 * PartnerNotifications — Trigger push notifications to partner on key events
 *
 * Centralizes all partner-triggered notification logic so any feature
 * can notify the partner with a single call.
 */

import { getSupabaseOrThrow } from '../config/supabase';
import PushNotificationService from './PushNotificationService';
import DeepLinkHandler from './DeepLinkHandler';

const PartnerNotifications = {
  /**
   * Partner answered today's prompt.
   */
  async promptAnswered(senderName, promptId) {
    const name = senderName || 'Your partner';
    await this._send({
      title: `${name} just shared something 💬`,
      body: "Answer today's prompt to reveal what they wrote.",
      data: {
        type: 'prompt_answered',
        ...DeepLinkHandler.buildNotificationData('prompt', promptId ? { id: promptId } : {}),
      },
    });
  },

  /**
   * Partner sent a vibe signal.
   */
  async vibeSent(senderName, vibeLabel) {
    const name = senderName || 'Your partner';
    await this._send({
      title: `${name} is thinking of you`,
      body: 'They sent you a vibe. Open the app to feel it.',
      data: {
        type: 'vibe_sent',
        ...(vibeLabel ? { vibeLabel } : {}),
        ...DeepLinkHandler.buildNotificationData('vibe'),
      },
    });
  },

  /**
   * Partner added a date to the calendar.
   */
  async datePlanned(senderName, dateTitle) {
    const name = senderName || 'Your partner';
    await this._send({
      title: `${name} planned something for you two 📅`,
      body: 'A date night idea is waiting in your calendar.',
      data: {
        type: 'date_planned',
        ...(dateTitle ? { title: dateTitle } : {}),
        ...DeepLinkHandler.buildNotificationData('calendar'),
      },
    });
  },

  /**
   * Partner shared a journal entry.
   */
  async journalShared(senderName) {
    const name = senderName || 'Your partner';
    await this._send({
      title: `${name} shared a journal entry 📝`,
      body: "Read what's on their mind.",
      data: {
        type: 'journal_shared',
        ...DeepLinkHandler.buildNotificationData('journal'),
      },
    });
  },

  /**
   * Partner saved a shared memory (moment, anniversary, first, etc.).
   */
  async memorySaved(senderName, memoryType) {
    const name = senderName || 'Your partner';
    const typeLabel = memoryType && memoryType !== 'moment' ? memoryType : 'moment';
    const emoji = typeLabel === 'anniversary' ? '🎉' : typeLabel === 'first' ? '⭐️' : '📸';

    await this._send({
      title: `${name} saved a memory ${emoji}`,
      body: 'A new moment was added to your shared archive.',
      data: {
        type: 'memory_saved',
        memoryType: typeLabel,
        ...DeepLinkHandler.buildNotificationData('saved-moments'),
      },
    });
  },

  /**
   * Streak at risk — partner hasn't checked in today.
   * (Called from a scheduled check, not from partner action.)
   */
  async streakAtRisk(currentStreak) {
    await this._send({
      title: `Your ${currentStreak}-day streak is at risk 🔥`,
      body: 'Check in before midnight to keep it alive.',
      data: {
        type: 'streak_at_risk',
        streak: currentStreak,
        ...DeepLinkHandler.buildNotificationData('home'),
      },
    });
  },

  /**
   * Partner sent a "Thinking of You" photo.
   */
  async thinkingOfYouPhoto(senderName, reactionLabel) {
    const name = senderName || 'Your partner';
    const body = reactionLabel
      ? `"${reactionLabel}" — they sent you a photo.`
      : 'They sent you a photo. Open to see it.';
    await this._send({
      title: `${name} is thinking of you 📸`,
      body,
      data: {
        type: 'thinking_of_you_photo',
        ...DeepLinkHandler.buildNotificationData('saved-moments'),
      },
    });
  },

  /** Internal: send via PushNotificationService.notifyPartner */
  async _send({ title, body, data }) {
    try {
      const supabase = getSupabaseOrThrow();
      await PushNotificationService.notifyPartner(supabase, { title, body, data });
    } catch (e) {
      // Non-critical — never crash the app for a failed notification
      if (__DEV__) console.warn('[PartnerNotifications]', e?.message);
    }
  },
};

export default PartnerNotifications;

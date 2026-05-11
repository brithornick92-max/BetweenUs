/**
 * PartnerNotifications — Trigger push notifications to partner on key events
 *
 * Centralizes all partner-triggered notification logic so any feature
 * can notify the partner with a single call.
 */

import { getSupabaseOrThrow } from '../config/supabase';
import PushNotificationService from './PushNotificationService';
import DeepLinkHandler from './DeepLinkHandler';

const normalizeNotificationName = (value) => {
  const name = String(value || '').replace(/\s+/g, ' ').trim();
  return name ? name.slice(0, 40) : 'Your partner';
};

const PartnerNotifications = {
  /**
   * Partner answered today's prompt.
   */
  async promptAnswered(senderName, promptId, dateKey = null) {
    const name = normalizeNotificationName(senderName);
    const routeParams = promptId ? { id: promptId } : {};
    if (dateKey) {
      routeParams.dateKey = dateKey;
    }

    await this._send({
      title: `${name} answered today's question`,
      body: 'A private answer is waiting. Add yours to reveal.',
      data: {
        type: 'prompt_answered',
        ...DeepLinkHandler.buildNotificationData('prompt', routeParams),
      },
    });
  },

  /**
   * Partner sent a vibe signal.
   */
  async vibeSent(senderName, vibeLabel) {
    const name = normalizeNotificationName(senderName);
    await this._send({
      title: `${name} left a small moment for you`,
      body: 'Open it whenever you want to feel close.',
      data: {
        type: 'vibe_sent',
        ...DeepLinkHandler.buildNotificationData('vibe'),
      },
    });
  },

  /**
   * Partner added a date to the calendar.
   */
  async datePlanned(senderName, dateTitle) {
    const name = normalizeNotificationName(senderName);
    await this._send({
      title: `${name} picked a date idea`,
      body: 'Something for the two of you is waiting.',
      data: {
        type: 'date_planned',
        ...DeepLinkHandler.buildNotificationData('calendar'),
      },
    });
  },

  /**
   * Partner shared a journal entry.
   */
  async journalShared(senderName) {
    const name = normalizeNotificationName(senderName);
    await this._send({
      title: `${name} left a private note`,
      body: 'A thought from your partner is waiting.',
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
    const name = normalizeNotificationName(senderName);

    await this._send({
      title: `${name} saved a moment`,
      body: 'A new piece of your story was added to Keepsake.',
      data: {
        type: 'memory_saved',
        ...DeepLinkHandler.buildNotificationData('our-story'),
      },
    });
  },

  /**
   * Partner added something to the shared calendar.
   */
  async calendarEventCreated(senderName, eventTitle) {
    const name = normalizeNotificationName(senderName);
    await this._send({
      title: `${name} added something to your calendar`,
      body: 'Open Calendar to see what changed.',
      data: {
        type: 'calendar_event_created',
        ...DeepLinkHandler.buildNotificationData('calendar'),
      },
    });
  },

  /**
   * Partner answered the daily quiz.
   */
  async quizAnswered(senderName) {
    const name = normalizeNotificationName(senderName);
    await this._send({
      title: `${name} answered the Daily Quiz`,
      body: 'Add yours to reveal both answers.',
      data: {
        type: 'quiz_answered',
        ...DeepLinkHandler.buildNotificationData('quiz'),
      },
    });
  },

  /**
   * Soft rhythm invitation.
   * (Called from a scheduled check, not from partner action.)
   */
  async streakAtRisk(currentStreak) {
    await this._send({
      title: `${currentStreak} connected days between you`,
      body: "Today could be another small moment, if you want one.",
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
  async thinkingOfYouPhoto(senderName) {
    const name = normalizeNotificationName(senderName);
    await this._send({
      title: `${name} left you a photo`,
      body: 'A private photo is waiting.',
      data: {
        type: 'thinking_of_you_photo',
        ...DeepLinkHandler.buildNotificationData('our-story'),
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

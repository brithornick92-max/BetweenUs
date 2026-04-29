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
      title: `${name} answered today's question`,
      body: 'A private answer is waiting. Add yours to reveal.',
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
      title: `${name} left a small moment for you`,
      body: 'Open it whenever you want to feel close.',
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
      title: `${name} picked a date idea`,
      body: 'Something for the two of you is waiting.',
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
    const name = senderName || 'Your partner';
    const typeLabel = memoryType && memoryType !== 'moment' ? memoryType : 'moment';

    await this._send({
      title: `${name} saved a ${typeLabel === 'moment' ? 'moment' : typeLabel}`,
      body: 'A new piece of your story was added to your Keepsake archive.',
      data: {
        type: 'memory_saved',
        memoryType: typeLabel,
        ...DeepLinkHandler.buildNotificationData('our-story'),
      },
    });
  },

  /**
   * Partner added something to the shared calendar.
   */
  async calendarEventCreated(senderName, eventTitle) {
    const name = senderName || 'Your partner';
    await this._send({
      title: `${name} added something to your calendar`,
      body: eventTitle ? `${eventTitle} is on your shared calendar.` : 'Open Calendar to see what changed.',
      data: {
        type: 'calendar_event_created',
        ...(eventTitle ? { title: eventTitle } : {}),
        ...DeepLinkHandler.buildNotificationData('calendar'),
      },
    });
  },

  /**
   * Partner answered the daily quiz.
   */
  async quizAnswered(senderName) {
    const name = senderName || 'Your partner';
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
    const name = senderName || 'Your partner';
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

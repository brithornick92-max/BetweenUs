/**
 * PartnerNotifications — Trigger push notifications to partner on key events
 *
 * Centralizes all partner-triggered notification logic so any feature
 * can notify the partner with a single call.
 */

import { getSupabaseOrThrow } from '../config/supabase';
import PushNotificationService from './PushNotificationService';

const PartnerNotifications = {
  /**
   * Partner answered today's prompt.
   */
  async promptAnswered(senderName) {
    const name = senderName || 'Your partner';
    await this._send({
      title: `${name} just shared something 💬`,
      body: 'Answer today\'s prompt to reveal what they wrote.',
      data: { type: 'prompt_answered' },
    });
  },

  /**
   * Partner sent a love note.
   */
  async loveNoteSent(senderName) {
    const name = senderName || 'Your partner';
    await this._send({
      title: `${name} wrote you something 💌`,
      body: 'A private note, just for you.',
      data: { type: 'love_note_sent' },
    });
  },

  /**
   * Partner sent a vibe signal.
   */
  async vibeSent(senderName, vibeLabel) {
    const name = senderName || 'Your partner';
    const suffix = vibeLabel ? `: ${vibeLabel}` : '';
    await this._send({
      title: `${name} is thinking of you`,
      body: 'They sent you a vibe. Open the app to feel it.',
      data: { type: 'vibe_sent' },
    });
  },

  /**
   * Partner added a date to the calendar.
   */
  async datePlanned(senderName, dateTitle) {
    const name = senderName || 'Your partner';
    const suffix = dateTitle ? ` — ${dateTitle}` : '';
    await this._send({
      title: `${name} planned something for you two 📅`,
      body: 'A date night idea is waiting in your calendar.',
      data: { type: 'date_planned' },
    });
  },

  /**
   * Partner completed a ritual check-in.
   */
  async ritualCompleted(senderName) {
    const name = senderName || 'Your partner';
    await this._send({
      title: `${name} lit tonight's ritual 🌙`,
      body: 'Join them — it only takes a moment.',
      data: { type: 'ritual_completed' },
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
      data: { type: 'streak_at_risk', streak: currentStreak },
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

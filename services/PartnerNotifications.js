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
      title: `${name} just answered 💬`,
      body: 'Tap to see their response and share yours.',
      data: { type: 'prompt_answered' },
    });
  },

  /**
   * Partner sent a love note.
   */
  async loveNoteSent(senderName) {
    const name = senderName || 'Your partner';
    await this._send({
      title: `${name} sent you a love note 💌`,
      body: 'Open it to read their words.',
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
      title: `${name} shared a vibe${suffix}`,
      body: 'See how they\'re feeling right now.',
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
      title: `${name} planned a date${suffix} 📅`,
      body: 'Check your shared calendar.',
      data: { type: 'date_planned' },
    });
  },

  /**
   * Partner completed a ritual check-in.
   */
  async ritualCompleted(senderName) {
    const name = senderName || 'Your partner';
    await this._send({
      title: `${name} completed tonight's ritual 🌙`,
      body: 'Join them to keep your streak going.',
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

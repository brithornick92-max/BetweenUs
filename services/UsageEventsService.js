import { supabase } from '../config/supabase';
import { storage } from '../utils/storage';
import { FREE_LIMITS, UsageEventType } from '../utils/featureFlags';
import { getDailyContentDateKey } from '../utils/dailyContentDate';

/**
 * Supabase-backed usage service with a cache-only fallback.
 */
export const FREE_TIER_LIMITS = {
  promptsPerDay: FREE_LIMITS.PROMPTS_PER_DAY,
  visiblePromptsPerWeek: FREE_LIMITS.VISIBLE_PROMPTS_PER_WEEK,
  visibleDates: FREE_LIMITS.VISIBLE_DATE_IDEAS_PER_WEEK,
  visibleDatesPerWeek: FREE_LIMITS.VISIBLE_DATE_IDEAS_PER_WEEK,
  visiblePositionsPerWeek: FREE_LIMITS.VISIBLE_POSITIONS_PER_WEEK,
  fullDateFlowsPerWeek: FREE_LIMITS.FULL_DATE_FLOWS_PER_WEEK,
  journalEntriesVisible: FREE_LIMITS.JOURNAL_ENTRIES_VISIBLE,
  surpriseMeEnabled: FREE_LIMITS.SURPRISE_ME_ENABLED,
};

const CACHE_PREFIX = '@betweenus:cache:usage';
const REMOTE_EVENT_ALIASES = Object.freeze({
  prompts: UsageEventType.PROMPT_VIEWED,
  dates: UsageEventType.DATE_IDEA_VIEWED,
});

class UsageEventsService {
  constructor() {
    this.prefix = 'usage';
  }

  _todayKey() {
    return getDailyContentDateKey();
  }

  _weekKey(date = new Date()) {
    const d = date instanceof Date ? new Date(date) : new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diffToMonday = (day + 6) % 7;
    d.setDate(d.getDate() - diffToMonday);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dateOfMonth = String(d.getDate()).padStart(2, '0');
    return `${year}-W-${month}-${dateOfMonth}`;
  }

  _cacheKey(userId, periodKey) {
    return `${CACHE_PREFIX}:${userId || 'anonymous'}:${periodKey}`;
  }

  _remoteWriteType(eventType) {
    return REMOTE_EVENT_ALIASES[eventType] || eventType;
  }

  _remoteReadTypes(eventType) {
    const canonical = this._remoteWriteType(eventType);
    return canonical === eventType ? [eventType] : [canonical, eventType];
  }

  async _getCoupleId(userId = null) {
    if (!supabase) return null;

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user?.id) return null;
    if (userId && authData.user.id !== userId) return null;

    const { data } = await supabase
      .from('couple_members')
      .select('couple_id')
      .eq('user_id', authData.user.id)
      .maybeSingle();
    return data?.couple_id || null;
  }

  async _countRemote(userId, eventType, periodKey) {
    if (!supabase || !userId || String(userId).startsWith('user_')) return null;
    const eventTypes = this._remoteReadTypes(eventType);
    let query = supabase
      .from('usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('local_day_key', periodKey);

    query = eventTypes.length === 1
      ? query.eq('event_type', eventTypes[0])
      : query.in('event_type', eventTypes);

    const { count, error } = await query;
    if (error) return null;
    return count || 0;
  }

  async _writeRemote(userId, eventType, periodKey, metadata = {}) {
    if (!supabase || !userId || String(userId).startsWith('user_')) return false;
    const coupleId = await this._getCoupleId(userId).catch(() => null);
    if (!coupleId) return false;

    const { error } = await supabase
      .from('usage_events')
      .insert({
        couple_id: coupleId,
        user_id: userId,
        event_type: this._remoteWriteType(eventType),
        local_day_key: periodKey,
        metadata,
      });
    return !error;
  }

  async _getCachedUsage(userId, periodKey, empty) {
    return storage.get(this._cacheKey(userId, periodKey), empty);
  }

  async _setCachedUsage(userId, periodKey, value) {
    return storage.set(this._cacheKey(userId, periodKey), value);
  }

  async resetIfNewDay(userId) {
    await this.getDailyUsage(userId);
  }

  async getDailyUsage(userId) {
    const today = this._todayKey();
    const empty = { date: today, prompts: 0, dates: 0, challenges: 0 };
    const cached = await this._getCachedUsage(userId, today, empty);

    const [prompts, dates, challenges] = await Promise.all([
      this._countRemote(userId, 'prompts', today),
      this._countRemote(userId, 'dates', today),
      this._countRemote(userId, 'challenges', today),
    ]);

    const usage = {
      ...empty,
      ...cached,
      prompts: prompts ?? cached.prompts ?? 0,
      dates: dates ?? cached.dates ?? 0,
      challenges: challenges ?? cached.challenges ?? 0,
    };
    await this._setCachedUsage(userId, today, usage);
    return usage;
  }

  async incrementDailyUsage(userId, type) {
    const usage = await this.getDailyUsage(userId);
    usage[type] = (usage[type] || 0) + 1;
    usage.lastUpdated = new Date().toISOString();
    await this._setCachedUsage(userId, usage.date, usage);
    await this._writeRemote(userId, type, usage.date).catch(() => false);
    return usage;
  }

  async getWeeklyUsage(userId) {
    const week = this._weekKey();
    const empty = { week, prompts: 0, dates: 0, dateFlows: 0, unlockedDateId: null };
    const cached = await this._getCachedUsage(userId, week, empty);
    const [remotePrompts, remoteDates, remoteDateFlows] = await Promise.all([
      this._countRemote(userId, 'prompts', week),
      this._countRemote(userId, 'dates', week),
      this._countRemote(userId, 'dateFlows', week),
    ]);
    const usage = {
      ...empty,
      ...cached,
      prompts: remotePrompts ?? cached.prompts ?? 0,
      dates: remoteDates ?? cached.dates ?? 0,
      dateFlows: remoteDateFlows ?? cached.dateFlows ?? 0,
    };
    await this._setCachedUsage(userId, week, usage);
    return usage;
  }

  async incrementWeeklyUsage(userId, type, metadata = {}) {
    const usage = await this.getWeeklyUsage(userId);
    usage[type] = (usage[type] || 0) + 1;
    if (metadata.unlockedDateId !== undefined) {
      usage.unlockedDateId = metadata.unlockedDateId;
    }
    usage.lastUpdated = new Date().toISOString();
    await this._setCachedUsage(userId, usage.week, usage);
    await this._writeRemote(userId, type, usage.week, metadata).catch(() => false);
    return usage;
  }

  async getPeriodUsage(userId, periodKey, types = []) {
    const safePeriodKey = periodKey || this._weekKey();
    const empty = { periodKey: safePeriodKey };
    types.forEach((type) => {
      empty[type] = 0;
    });

    const cached = await this._getCachedUsage(userId, safePeriodKey, empty);
    const remoteCounts = await Promise.all(
      types.map((type) => this._countRemote(userId, type, safePeriodKey))
    );

    const usage = {
      ...empty,
      ...cached,
      periodKey: safePeriodKey,
    };

    types.forEach((type, index) => {
      usage[type] = remoteCounts[index] ?? cached[type] ?? 0;
    });

    await this._setCachedUsage(userId, safePeriodKey, usage);
    return usage;
  }

  async incrementPeriodUsage(userId, periodKey, type, metadata = {}) {
    const safePeriodKey = periodKey || this._weekKey();
    const usage = await this.getPeriodUsage(userId, safePeriodKey, [type]);
    usage[type] = (usage[type] || 0) + 1;
    const itemId = metadata.itemId || metadata.promptId || metadata.dateId || null;
    if (itemId) {
      usage.usedItemIds = {
        ...(usage.usedItemIds || {}),
        [type]: Array.from(new Set([
          ...((usage.usedItemIds || {})[type] || []),
          String(itemId),
        ])),
      };
    }
    usage.lastUpdated = new Date().toISOString();
    await this._setCachedUsage(userId, safePeriodKey, usage);
    await this._writeRemote(userId, type, safePeriodKey, metadata).catch(() => false);
    return usage;
  }
}

export default new UsageEventsService();

// screens/OurStoryScreen.js
/**
 * BETWEEN US - KEEPSAKE / OUR STORY
 * Premium grouped memory cards + timeline moments.
 * Long press a Keepsake card to edit or delete.
 */

import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator,
  Animated as RNAnimated,
  Image,
  Modal,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ReAnimated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

import Icon from '../components/Icon';
import { useTheme } from '../context/ThemeContext';
import { DataLayer } from '../services/localfirst';
import AttachmentCacheService from '../services/AttachmentCacheService';
import { getPromptById, getDateById } from '../utils/contentLoader';
import { impact, selection, ImpactFeedbackStyle } from '../utils/haptics';
import { SPACING, withAlpha } from '../utils/theme';
import { settingsStorage, storage } from '../utils/storage';
import { KEEPSAKE_CATEGORY_COLORS } from '../config/constants';
import EditorialScreenScaffold from '../components/EditorialScreenScaffold';
import MediaLightbox from '../components/MediaLightbox';
import { NicknameEngine } from '../services/PolishEngine';
import { useEntitlements } from '../context/EntitlementsContext';
import positionsData from '../content/intimacy-positions.json';
import { addRestoredDeckItem } from '../utils/contentDeckRestores';

const HEARTS_KEY = '@betweenus:cache:momentHearts';
const HIDDEN_KEEPSAKES_KEY = '@betweenus:cache:hiddenKeepsakes';
const OCCURRENCE_OVERRIDES_KEY = '@betweenus:cache:keepsakeOccurrenceOverrides';

const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'Roboto' });
const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif' });

const MEMORY_TYPE_META = {
  snapshot: { label: 'Memory', icon: 'images-outline' },
  moment: { label: 'Saved Moment', icon: 'sparkles-outline' },
  thinking_of_you: { label: 'Memory', icon: 'paper-plane-outline' },
  date_saved: { label: 'Saved Date', icon: 'bookmark-outline' },
  anniversary: { label: 'Anniversary', icon: 'heart-outline' },
  milestone: { label: 'Milestone', icon: 'ribbon-outline' },
  intimacy_favorite: { label: 'Sex Position Favorite', icon: 'heart-outline' },
  intimacy_tried: { label: 'Sex Position Tried', icon: 'checkmark-circle-outline' },
  date_tried: { label: 'Date Tried', icon: 'calendar-outline' },
  memory: { label: 'Memory', icon: 'time-outline' },
};

const DEFAULT_KEEPSAKE_SETTINGS = {
  prompts: true,
  memories: true,
  dates: true,
  positions: true,
};

const POSITION_ITEMS = Array.isArray(positionsData?.items) ? positionsData.items : [];
const POSITION_BY_ID = new Map(POSITION_ITEMS.map((position) => [position.id, position]));
const FREE_KEEPSAKE_ARCHIVE_DAYS = 30;
const FREE_KEEPSAKE_LOAD_LIMIT = 10000;
const PREMIUM_KEEPSAKE_LOAD_LIMIT = Infinity;

function normalizeKeepsakeSettings(settings) {
  return {
    prompts: settings?.prompts ?? DEFAULT_KEEPSAKE_SETTINGS.prompts,
    memories: settings?.memories ?? DEFAULT_KEEPSAKE_SETTINGS.memories,
    dates: settings?.dates ?? DEFAULT_KEEPSAKE_SETTINGS.dates,
    positions: settings?.positions ?? DEFAULT_KEEPSAKE_SETTINGS.positions,
  };
}

function formatDateLabel(value) {
  if (!value) return '';

  const date = typeof value === 'string' && value.length === 10
    ? new Date(`${value}T00:00:00`)
    : new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getSortTime(item) {
  const raw = item.sortAt || item.created_at || item.date_key || item.date;

  if (!raw) return 0;

  const value = typeof raw === 'string' && raw.length === 10
    ? new Date(`${raw}T00:00:00`).getTime()
    : new Date(raw).getTime();

  return Number.isNaN(value) ? 0 : value;
}

function getDateGroupKey(item) {
  const raw = item?.sortAt || item?.created_at || item?.date_key || item?.date;
  if (!raw) return 'undated';

  const date = typeof raw === 'string' && raw.length === 10
    ? new Date(`${raw}T00:00:00`)
    : new Date(raw);

  if (Number.isNaN(date.getTime())) return 'undated';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getDateGroupLabel(item) {
  const raw = item?.sortAt || item?.created_at || item?.date_key || item?.date;
  return formatDateLabel(raw) || 'Undated';
}

function getMediaKind(mimeType, uri) {
  if (mimeType?.startsWith('video/')) return 'video';
  if (mimeType?.startsWith('image/')) return 'image';
  return uri ? 'image' : null;
}

function getSnapshotGroupId(row) {
  return row?.snapshot_id || null;
}

function getSnapshotIndex(row) {
  const index = row?.snapshot_index ?? 0;
  return Number.isFinite(Number(index)) ? Number(index) : 0;
}

function isKeepsakeMemoryRow(row) {
  if (!row?.id) return false;

  // These rows back dedicated Keepsake lanes. Showing them as raw memories would
  // duplicate those entries and expose their serialized payloads.
  return !['date_saved', 'date_tried', 'intimacy_favorite', 'intimacy_tried'].includes(row.type);
}

function markCurrentUserRows(rows = [], currentUserId = null) {
  return (rows || []).map((row) => ({
    ...row,
    isOwn: !currentUserId || !row?.user_id || row.user_id === currentUserId,
  }));
}

function isNoDeletableRowError(error) {
  return String(error?.message || '').includes('No deletable row found');
}

function canManageKeepsakeRow(row) {
  return row?.isOwn !== false;
}

async function resolveRowMedia(row) {
  const directUri = row.mediaUri || row.photo_uri || row.photoUri || null;
  const directMimeType = row.mediaType || row.mime_type || row.mimeType || null;

  if (directUri) {
    return {
      uri: directUri,
      mimeType: directMimeType || 'image/jpeg',
      kind: row.mediaKind || getMediaKind(directMimeType, directUri),
    };
  }

  const mediaRef = row.media_ref || row.mediaRef || null;
  if (!mediaRef) return null;

  try {
    const uri = await AttachmentCacheService.getCachedUri(mediaRef);
    if (!uri) return null;
    const mimeType = directMimeType || 'image/jpeg';

    return {
      uri,
      mimeType,
      kind: getMediaKind(mimeType, uri),
    };
  } catch {
    return null;
  }
}

function dedupeRows(rows) {
  const seen = new Set();

  return (rows || []).filter((row) => {
    if (!row?.id || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function getPromptRowPromptId(row) {
  return row?.prompt_id || row?.promptId || row?.value?.promptId || null;
}

function getPromptRowDateKey(row) {
  return row?.date_key || row?.dateKey || row?.value?.dateKey || null;
}

function getPromptRowAnswer(row) {
  return row?.answer || row?.value?.answer || null;
}

function isPromptKeepsakeSelected(row) {
  return row?.includeInKeepsake === true
    || row?.include_in_keepsake === true
    || row?.value?.includeInKeepsake === true;
}

function getPromptGroupKey(row) {
  const promptId = getPromptRowPromptId(row);
  if (!promptId) return null;
  return `${getPromptRowDateKey(row) || row?.created_at || 'undated'}:${promptId}`;
}

function parseMemoryPayload(content) {
  if (!content) return null;

  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function titleCaseLabel(value) {
  const text = String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return '';

  return text
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function joinDetails(parts, fallback) {
  const details = (parts || []).filter(Boolean);
  return details.length ? details.join(' • ') : fallback;
}

function cleanKeepsakeSentence(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]+$/g, '');
}

function firstKeepsakeSentence(value) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';

  const match = clean.match(/^(.+?[.!?])(?:\s|$)/);
  return cleanKeepsakeSentence(match ? match[1] : clean);
}

function lowercaseFirst(value) {
  const text = String(value || '');
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : '';
}

function capitalizeFirst(value) {
  const text = String(value || '');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

const LEADING_ACTION_PAST = [
  [/^wake up\b/i, 'woke up'],
  [/^take turns\b/i, 'took turns'],
  [/^take\b/i, 'took'],
  [/^go\b/i, 'went'],
  [/^make\b/i, 'made'],
  [/^put\b/i, 'put'],
  [/^set\b/i, 'set'],
  [/^hit\b/i, 'hit'],
  [/^let\b/i, 'let'],
  [/^write\b/i, 'wrote'],
  [/^light\b/i, 'lit'],
  [/^find\b/i, 'found'],
  [/^choose\b/i, 'chose'],
  [/^pick\b/i, 'picked'],
  [/^grab\b/i, 'grabbed'],
  [/^read\b/i, 'read'],
  [/^seal\b/i, 'sealed'],
  [/^share\b/i, 'shared'],
  [/^try\b/i, 'tried'],
  [/^explore\b/i, 'explored'],
  [/^discover\b/i, 'discovered'],
  [/^create\b/i, 'created'],
  [/^settle\b/i, 'settled'],
  [/^turn\b/i, 'turned'],
  [/^unleash\b/i, 'unleashed'],
  [/^experience\b/i, 'experienced'],
  [/^indulge\b/i, 'indulged'],
  [/^craft\b/i, 'crafted'],
  [/^enjoy\b/i, 'enjoyed'],
  [/^wander\b/i, 'wandered'],
  [/^unwind\b/i, 'unwound'],
  [/^ignite\b/i, 'ignited'],
  [/^savor\b/i, 'savored'],
  [/^embrace\b/i, 'embraced'],
  [/^engage\b/i, 'engaged'],
  [/^dive\b/i, 'dove'],
  [/^capture\b/i, 'captured'],
  [/^deepen\b/i, 'deepened'],
  [/^learn\b/i, 'learned'],
  [/^curate\b/i, 'curated'],
  [/^escape\b/i, 'escaped'],
  [/^revisit\b/i, 'revisited'],
  [/^start\b/i, 'started'],
  [/^build\b/i, 'built'],
  [/^stroll\b/i, 'strolled'],
  [/^connect\b/i, 'connected'],
  [/^step\b/i, 'stepped'],
  [/^navigate\b/i, 'navigated'],
  [/^move\b/i, 'moved'],
  [/^relive\b/i, 'relived'],
  [/^design\b/i, 'designed'],
  [/^cultivate\b/i, 'cultivated'],
  [/^delight\b/i, 'delighted'],
  [/^witness\b/i, 'witnessed'],
  [/^use\b/i, 'used'],
  [/^spend\b/i, 'spent'],
  [/^gather\b/i, 'gathered'],
  [/^surprise\b/i, 'surprised'],
  [/^dedicate\b/i, 'dedicated'],
  [/^walk\b/i, 'walked'],
  [/^journey\b/i, 'journeyed'],
  [/^team\b/i, 'teamed'],
  [/^strengthen\b/i, 'strengthened'],
  [/^visualize\b/i, 'visualized'],
  [/^chart\b/i, 'charted'],
  [/^release\b/i, 'released'],
  [/^reconnect\b/i, 'reconnected'],
  [/^address\b/i, 'addressed'],
  [/^reflect\b/i, 'reflected'],
  [/^melt\b/i, 'melted'],
  [/^rediscover\b/i, 'rediscovered'],
  [/^slip\b/i, 'slipped'],
  [/^master\b/i, 'mastered'],
  [/^soar\b/i, 'soared'],
  [/^relax\b/i, 'relaxed'],
  [/^test\b/i, 'tested'],
  [/^unveil\b/i, 'unveiled'],
  [/^ascend\b/i, 'ascended'],
  [/^glide\b/i, 'glided'],
  [/^greet\b/i, 'greeted'],
  [/^host\b/i, 'hosted'],
  [/^challenge\b/i, 'challenged'],
  [/^delve\b/i, 'delved'],
  [/^co-create\b/i, 'co-created'],
  [/^sink\b/i, 'sank'],
  [/^snuggle\b/i, 'snuggled'],
  [/^serve\b/i, 'served'],
  [/^transform\b/i, 'transformed'],
  [/^unfold\b/i, 'unfolded'],
  [/^paddle\b/i, 'paddled'],
  [/^order\b/i, 'ordered'],
  [/^identify\b/i, 'identified'],
  [/^hide\b/i, 'hid'],
  [/^dance\b/i, 'danced'],
  [/^rent\b/i, 'rented'],
  [/^feed\b/i, 'fed'],
];

function makePastTenseLine(value) {
  let line = firstKeepsakeSentence(value)
    .replace(/^together,\s*/i, '')
    .replace(/^then,\s*/i, '')
    .replace(/^finally,\s*/i, '')
    .replace(/^each\s+/i, '')
    .replace(/^both\s+/i, '');

  if (!line) return '';

  for (const [pattern, replacement] of LEADING_ACTION_PAST) {
    if (pattern.test(line)) {
      line = line.replace(pattern, replacement);
      break;
    }
  }

  line = line
    .replace(/\band leave\b/gi, 'and left')
    .replace(/\band write\b/gi, 'and wrote')
    .replace(/\band create\b/gi, 'and created')
    .replace(/\band choose\b/gi, 'and chose')
    .replace(/\band take\b/gi, 'and took')
    .replace(/\band make\b/gi, 'and made')
    .replace(/\band share\b/gi, 'and shared')
    .replace(/\band find\b/gi, 'and found')
    .replace(/\band pick\b/gi, 'and picked')
    .replace(/\byou actually want to keep\b/gi, 'worth keeping')
    .replace(/\byou both\b/gi, 'you both')
    .replace(/\bfeels\b/gi, 'felt')
    .replace(/\bkeeps\b/gi, 'kept')
    .replace(/\bmakes\b/gi, 'made')
    .replace(/\binvites\b/gi, 'invited')
    .replace(/\bcreates\b/gi, 'created')
    .replace(/\boffers\b/gi, 'offered')
    .replace(/\bgives\b/gi, 'gave')
    .replace(/\buses\b/gi, 'used')
    .replace(/\badds\b/gi, 'added')
    .replace(/\bcenters\b/gi, 'centered')
    .replace(/\bturns\b/gi, 'turned')
    .replace(/\bhelps\b/gi, 'helped')
    .replace(/\blets\b/gi, 'let')
    .replace(/\bworks\b/gi, 'worked')
    .replace(/\bis\b/gi, 'was')
    .replace(/\bare\b/gi, 'were')
    .replace(/\bcan\b/gi, 'could');

  return `${capitalizeFirst(line)}.`;
}

function buildDateActionLineFromSteps(steps) {
  const actions = (Array.isArray(steps) ? steps : [])
    .map((step) => makePastTenseLine(step).replace(/[.!?]+$/g, ''))
    .filter(Boolean)
    .slice(0, 3);

  if (!actions.length) return '';

  const line = actions.reduce((acc, action, index) => {
    const next = index === 0 ? action : lowercaseFirst(action);
    if (!acc) return next;
    if (index === actions.length - 1) return `${acc}, and ${next}`;
    return `${acc}, ${next}`;
  }, '');

  return `${capitalizeFirst(line)}.`;
}

function resolveDateCatalogEntry(row) {
  const dateId = row?.dateId || row?.date_id || row?.id;
  return dateId ? getDateById(dateId) : null;
}

function getDateCopySource(row) {
  const catalog = resolveDateCatalogEntry(row) || {};
  return {
    ...catalog,
    ...row,
    description: row?.description || catalog.description || catalog.vibe || catalog.setup || '',
    steps: Array.isArray(row?.steps) ? row.steps : catalog.steps,
  };
}

function buildDateKeepsakeLine(row, fallback = 'Date night') {
  const source = getDateCopySource(row);

  if (source.title === 'Golden Hour Photos' || source.id === 'd004' || source.dateId === 'd004' || source.date_id === 'd004') {
    return 'Took a peaceful walk and picked a few favorite photos together.';
  }

  if (source.title === 'Next Year Letters' || source.id === 'd013' || source.dateId === 'd013' || source.date_id === 'd013') {
    return 'Wrote letters for next year and saved them to open together later.';
  }

  const fromDescription = makePastTenseLine(source.description);
  if (fromDescription) return fromDescription;

  const fromSteps = buildDateActionLineFromSteps(source.steps);
  if (fromSteps) return fromSteps;

  return buildDateDetails(row, fallback);
}

function buildSavedDateKeepsakeLine(row, fallback = 'Saved for later') {
  const source = getDateCopySource(row);
  const line = firstKeepsakeSentence(source.description);

  if (line) {
    const connector = /^(a|an|the)\s/i.test(line) ? 'for' : 'to';
    return `Saved a date ${connector} ${lowercaseFirst(line)}.`;
  }

  return buildDateDetails(row, fallback);
}

function findPositionByLabel(label) {
  const normalized = String(label || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  return POSITION_ITEMS.find((position) => {
    const title = String(position.title || '').toLowerCase();
    const commonName = String(position.commonName || '').toLowerCase();
    const fullLabel = commonName ? `${commonName}: ${title}` : title;
    return normalized === title || normalized === commonName || normalized === fullLabel;
  }) || null;
}

function resolvePositionCatalogEntry(row) {
  const positionId = row?.positionId || row?.position_id || row?.id;
  if (positionId && POSITION_BY_ID.has(positionId)) return POSITION_BY_ID.get(positionId);

  const label = row?.commonName && row?.title ? `${row.commonName}: ${row.title}` : row?.title;
  return findPositionByLabel(label);
}

function getPositionCopySource(row) {
  const catalog = resolvePositionCatalogEntry(row) || {};
  return {
    ...catalog,
    ...row,
    shortSummary: row?.shortSummary || catalog.shortSummary || '',
    focus: row?.focus || catalog.focus || '',
  };
}

function buildPositionPhrase(row) {
  const source = getPositionCopySource(row);
  const raw = firstKeepsakeSentence(source.shortSummary || source.focus);

  if (!raw) return '';

  let phrase = raw
    .replace(/\bintimacy\b/gi, 'sex')
    .replace(/\bpleasure point\b/gi, 'pleasure');

  if (!/\bsex position\b/i.test(phrase)) {
    if (/\bposition\b/i.test(phrase)) {
      phrase = phrase.replace(/\bposition\b/i, 'sex position');
    } else {
      phrase = phrase.replace(
        /\b(straddle|carry|wrap|hold|variation|recline|alignment|shape|angle|embrace|rhythm|rock|cuddle)\b/i,
        'sex position'
      );
    }
  }

  phrase = phrase
    .replace(/\bfeels\b/gi, 'felt')
    .replace(/\bkeeps\b/gi, 'kept')
    .replace(/\bmakes\b/gi, 'made')
    .replace(/\binvites\b/gi, 'invited')
    .replace(/\bcreates\b/gi, 'created')
    .replace(/\boffers\b/gi, 'offered')
    .replace(/\bgives\b/gi, 'gave')
    .replace(/\buses\b/gi, 'used')
    .replace(/\badds\b/gi, 'added')
    .replace(/\bcenters\b/gi, 'centered')
    .replace(/\bturns\b/gi, 'turned')
    .replace(/\bhelps\b/gi, 'helped')
    .replace(/\blets\b/gi, 'let')
    .replace(/\bworks\b/gi, 'worked')
    .replace(/\bis\b/gi, 'was')
    .replace(/\bare\b/gi, 'were')
    .replace(/\bcan\b/gi, 'could');

  return lowercaseFirst(phrase);
}

function buildPositionKeepsakeLine(row, fallback = 'Sex position') {
  const phrase = buildPositionPhrase(row);
  if (phrase) return `Tried ${phrase}.`;

  return buildPositionDetails(row, fallback);
}

function buildSavedPositionKeepsakeLine(row, fallback = 'Saved sex position') {
  const phrase = buildPositionPhrase(row);
  if (phrase) return `Saved ${phrase}.`;

  return buildPositionDetails(row, fallback);
}

function formatDateLocation(value) {
  if (!value) return '';
  if (value === 'home') return 'At home';
  if (value === 'out') return 'Out';
  return titleCaseLabel(value);
}

function formatDateLoad(value) {
  if (value === null || value === undefined || value === '') return '';

  const numeric = Number(value);
  if (numeric === 1) return 'Low effort';
  if (numeric === 2) return 'Moderate effort';
  if (numeric === 3) return 'More active';

  return titleCaseLabel(value);
}

function formatHeat(value) {
  if (value === null || value === undefined || value === '') return '';
  return `Heat ${value}`;
}

function formatRating(value) {
  if (!value) return '';

  const normalized = String(value).toLowerCase();
  const labels = {
    love: 'Loved',
    like: 'Liked',
    neutral: 'Neutral',
    pass: 'Not for us',
    dislike: 'Not for us',
  };

  return labels[normalized] || titleCaseLabel(value);
}

function buildDateDetails(row, fallback = 'Date night') {
  return joinDetails([
    row?.minutes ? `${row.minutes} min` : '',
    formatDateLocation(row?.location),
    titleCaseLabel(row?.style),
    formatDateLoad(row?.load),
    formatHeat(row?.heat),
    formatRating(row?.rating),
  ], fallback);
}

function buildPositionDetails(row, fallback = 'Sex position') {
  return joinDetails([
    titleCaseLabel(row?.mood),
    formatHeat(row?.heat),
    formatRating(row?.rating),
  ], fallback);
}

async function safeLoad(loader) {
  try {
    return await loader();
  } catch {
    return [];
  }
}

function buildPromptItem(row, media = null, myName = 'You', partnerName = 'Partner') {
  const promptId = getPromptRowPromptId(row);
  const prompt = getPromptById(promptId);
  const answer = getPromptRowAnswer(row);

  const answers = [];
  if (row.locked) {
    // No structured answers for locked items.
  } else if (row.is_revealed && row.partnerAnswer) {
    if (answer) {
      answers.push({ name: myName, text: answer });
    }
    answers.push({ name: partnerName, text: row.partnerAnswer });
  } else if (answer) {
    answers.push({ name: myName, text: answer });
  }

  const body = row.locked
    ? 'This reflection is locked on this device.'
    : (row.is_revealed && row.partnerAnswer
      ? `${myName}: ${answer || ''}\n\n${partnerName}: ${row.partnerAnswer}`.trim()
      : (answer || ''));
  const canManage = canManageKeepsakeRow(row);

  return {
    id: `prompt:${row.id}`,
    kind: 'prompt',
    sourceId: row.id,
    contentId: promptId,
    title: prompt?.text || 'Saved reflection',
    body,
    answers,
    eyebrow: row.is_revealed ? 'Prompt' : 'Sealed prompt',
    icon: row.is_revealed ? 'chatbubbles-outline' : 'lock-closed-outline',
    accent: KEEPSAKE_CATEGORY_COLORS.prompt,
    meta: row.heat_level ? `Heat ${row.heat_level}` : 'Prompt',
    dateLabel: formatDateLabel(row.date_key || row.created_at),
    sortAt: row.created_at || row.date_key,
    media,
    editable: false,
    deletable: canManage,
    hideable: !canManage,
    isOwn: row.isOwn,
  };
}

function buildPromptKeepsakeItems(rows = [], myName = 'You', partnerName = 'Partner') {
  const groups = new Map();

  for (const row of rows || []) {
    const promptId = getPromptRowPromptId(row);
    if (!promptId || String(promptId).startsWith('quiz:')) continue;

    const key = getPromptGroupKey(row);
    if (!key) continue;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  return Array.from(groups.values())
    .filter((groupRows) => groupRows.some((row) => row.isOwn !== false && isPromptKeepsakeSelected(row)))
    .map((groupRows) => {
      const ownRow = groupRows.find((row) => row.isOwn !== false && isPromptKeepsakeSelected(row))
        || groupRows.find((row) => row.isOwn !== false)
        || groupRows[0];
      const rowWithPartnerAnswer = groupRows.find((row) => row.partnerAnswer);
      const partnerRow = groupRows.find((row) => row.isOwn === false && getPromptRowAnswer(row));
      const baseRow = rowWithPartnerAnswer || ownRow;
      const answer = getPromptRowAnswer(ownRow) || getPromptRowAnswer(baseRow);
      const partnerAnswer = baseRow?.partnerAnswer || getPromptRowAnswer(partnerRow);

      return buildPromptItem({
        ...baseRow,
        id: ownRow?.id || baseRow?.id,
        user_id: ownRow?.user_id || baseRow?.user_id,
        answer,
        partnerAnswer,
        is_revealed: !!(baseRow?.is_revealed || ownRow?.is_revealed || (answer && partnerAnswer)),
        isOwn: ownRow?.isOwn !== false,
        includeInKeepsake: true,
      }, null, myName, partnerName);
    });
}

function buildMemoryItem(row, media = null) {
  const memoryType = MEMORY_TYPE_META[row.type] || MEMORY_TYPE_META.moment;
  const isIntimacyFavorite = row.type === 'intimacy_favorite';
  const canManage = canManageKeepsakeRow(row);

  return {
    id: `memory:${row.id}`,
    kind: 'memory',
    sourceId: row.id,
    title: memoryType.label,
    body: row.locked ? 'This moment is locked on this device.' : (row.content || ''),
    eyebrow: isIntimacyFavorite ? 'Sex position favorite' : 'Memory',
    icon: memoryType.icon,
    accent: isIntimacyFavorite ? KEEPSAKE_CATEGORY_COLORS.position : KEEPSAKE_CATEGORY_COLORS.memory,
    meta: isIntimacyFavorite ? 'Sex position' : (row.mood ? String(row.mood).toUpperCase() : memoryType.label),
    dateLabel: formatDateLabel(row.created_at || row.date),
    sortAt: row.snapshot_created_at || row.created_at || row.date,
    mediaRef: row.media_ref || null,
    mimeType: row.mime_type || null,
    rawDate: row.created_at || row.date || null,
    snapshotGroupId: getSnapshotGroupId(row),
    snapshotIndex: getSnapshotIndex(row),
    media,
    row,
    editable: canManage,
    deletable: canManage,
    hideable: !canManage,
    isOwn: row.isOwn,
  };
}

function buildSnapshotItem(groupId, items) {
  const sortedItems = [...items].sort((a, b) => a.snapshotIndex - b.snapshotIndex);
  const first = sortedItems[0];
  const body = first?.body || '';
  const canManage = sortedItems.some((item) => item.isOwn !== false);

  const mediaItems = sortedItems
    .filter((item) => item.media?.uri)
    .map((item, index) => ({
      id: `${item.id}:media:${index}`,
      uri: item.media.uri,
      mimeType: item.media.mimeType,
      mime: item.media.mimeType,
      kind: item.media.kind,
      media: item.media,
      caption: body,
      body,
      title: 'Memory',
      date: item.rawDate || item.sortAt,
      dateLabel: item.dateLabel,
      sourceItem: item,
    }));

  return {
    id: `snapshot:${groupId}`,
    kind: 'snapshot',
    sourceId: groupId,
    title: 'Memory',
    body,
    eyebrow: 'Memory',
    icon: 'images-outline',
    accent: KEEPSAKE_CATEGORY_COLORS.memory,
    meta: mediaItems.length === 1 ? '1 item' : `${mediaItems.length} items`,
    dateLabel: first?.dateLabel || '',
    sortAt: first?.sortAt || null,
    mediaItems,
    rawItems: sortedItems,
    editable: canManage,
    deletable: canManage,
    hideable: !canManage,
    isOwn: canManage,
  };
}

function groupMemoryItems(memoryItems) {
  const grouped = new Map();
  const standalone = [];

  for (const item of memoryItems || []) {
    if (item.snapshotGroupId) {
      if (!grouped.has(item.snapshotGroupId)) {
        grouped.set(item.snapshotGroupId, []);
      }

      grouped.get(item.snapshotGroupId).push(item);
      continue;
    }

    const isLegacyUngroupedSnapshot =
      item.row?.type === 'snapshot'
      || item.title === 'Snapshot'
      || item.kind === 'snapshot';

    if (isLegacyUngroupedSnapshot) {
      // Old Snapshot rows created before snapshot_id existed.
      // Hide them so they do not appear as separate broken Keepsake cards.
      continue;
    }

    standalone.push(item);
  }

  const snapshots = Array.from(grouped.entries()).map(([groupId, items]) =>
    buildSnapshotItem(groupId, items)
  );

  return [...snapshots, ...standalone];
}

function buildDateItem(row) {
  const details = buildDateDetails(row, 'Date night');
  const body = buildDateKeepsakeLine(row, details);
  const canManage = canManageKeepsakeRow(row);

  return {
    id: `date:${row.id}`,
    kind: 'date',
    sourceId: row.id,
    contentId: row.id,
    title: row.title || 'Date tried',
    body,
    eyebrow: 'Date tried',
    icon: 'calendar-outline',
    accent: KEEPSAKE_CATEGORY_COLORS.date,
    meta: details,
    dateLabel: formatDateLabel(row.addedAt),
    sortAt: row.addedAt,
    memoryId: row.memoryId || null,
    editable: false,
    deletable: canManage && !!row.memoryId,
    hideable: !canManage,
    isOwn: row.isOwn,
  };
}

function buildDateItemFromMemoryRow(row) {
  const payload = parseMemoryPayload(row?.content) || {};
  const dateId = payload.dateId || payload.id || row?.id;

  if (!dateId) return null;

  if (row?.type === 'date_saved') {
    return {
      ...buildSavedDateItem({
        date_id: dateId,
        title: payload.title || row?.title || 'Saved date',
        heat: payload.heat ?? null,
        load: payload.load ?? null,
        style: payload.style ?? null,
        minutes: payload.minutes ?? null,
        location: payload.location ?? null,
        description: payload.description || null,
        steps: payload.steps || null,
        created_at: row?.created_at || row?.date,
        isOwn: row?.isOwn,
      }),
      memoryId: row?.id || null,
      deletable: row?.isOwn !== false && !!row?.id,
      hideable: row?.isOwn === false,
    };
  }

  return buildDateItem({
    id: dateId,
    title: payload.title || row?.title || 'Date tried',
    heat: payload.heat ?? null,
    load: payload.load ?? null,
    style: payload.style ?? null,
    minutes: payload.minutes ?? null,
    location: payload.location ?? null,
    description: payload.description || null,
    steps: payload.steps || null,
    rating: payload.rating ?? null,
    addedAt: row?.created_at || row?.date || Date.now(),
    memoryId: row?.id || null,
    isOwn: row?.isOwn,
  });
}

function buildSavedDateItem(row) {
  const dateId = row?.date_id || row?.dateId || row?.id;
  if (!dateId) return null;
  const details = buildDateDetails(row, 'Saved for later');
  const body = buildSavedDateKeepsakeLine(row, details);
  const canManage = canManageKeepsakeRow(row);

  return {
    id: `date-saved:${dateId}`,
    kind: 'date_saved',
    sourceId: dateId,
    title: row?.title || 'Saved date',
    body,
    eyebrow: 'Saved date',
    icon: 'bookmark-outline',
    accent: KEEPSAKE_CATEGORY_COLORS.date,
    meta: details,
    dateLabel: formatDateLabel(row?.created_at || row?.addedAt || row?.savedAt),
    sortAt: row?.created_at || row?.addedAt || row?.savedAt,
    editable: false,
    deletable: canManage && !!row?.memoryId,
    hideable: !canManage,
    isOwn: row?.isOwn,
  };
}

function buildPositionTriedItem(row) {
  const label = row.commonName ? `${row.commonName}: ${row.title}` : row.title;
  const details = buildPositionDetails(row, 'Sex position marked as tried');
  const body = buildPositionKeepsakeLine(row, details);
  const canManage = canManageKeepsakeRow(row);

  return {
    id: `position-tried:${row.positionId}`,
    kind: 'position_tried',
    sourceId: row.positionId,
    contentId: row.positionId,
    title: label || 'Sex position tried',
    body,
    eyebrow: 'Sex position tried',
    icon: 'checkmark-circle-outline',
    accent: KEEPSAKE_CATEGORY_COLORS.position,
    meta: row.mood ? String(row.mood).toUpperCase() : 'Sex position',
    dateLabel: formatDateLabel(row.triedAt),
    sortAt: row.triedAt,
    memoryId: row.memoryId || null,
    editable: false,
    deletable: canManage && !!row.memoryId,
    hideable: !canManage,
    isOwn: row.isOwn,
  };
}

function buildPositionFavoriteItemFromMemoryRow(row) {
  const payload = parseMemoryPayload(row?.content);
  const positionId = payload?.positionId || payload?.id || row?.id;
  const title = payload
    ? (payload.commonName ? `${payload.commonName}: ${payload.title}` : payload.title)
    : String(row?.content || '').replace(/^Shared (?:intimacy|sex position) favorite:\s*/i, '').trim();
  const details = buildPositionDetails({
    mood: payload?.mood || row?.mood || null,
    heat: payload?.heat ?? null,
    rating: payload?.rating ?? null,
  }, 'Saved sex position');
  const body = buildSavedPositionKeepsakeLine({
    positionId,
    title,
    commonName: payload?.commonName || null,
    shortSummary: payload?.shortSummary || null,
    focus: payload?.focus || null,
    mood: payload?.mood || row?.mood || null,
    heat: payload?.heat ?? null,
    rating: payload?.rating ?? null,
  }, details);
  const canManage = canManageKeepsakeRow(row);

  return {
    id: `position-favorite-memory:${row.id}`,
    kind: 'position_favorite',
    sourceId: positionId,
    title: title || 'Saved sex position',
    body,
    eyebrow: 'Saved sex position',
    icon: 'heart-outline',
    accent: KEEPSAKE_CATEGORY_COLORS.position,
    meta: row.mood ? String(row.mood).toUpperCase() : 'Sex position',
    dateLabel: formatDateLabel(row.created_at || row.date),
    sortAt: row.created_at || row.date,
    memoryId: row.id || null,
    editable: false,
    deletable: canManage && !!row.id,
    hideable: !canManage,
    isOwn: row.isOwn,
  };
}

function buildPositionTriedItemFromMemoryRow(row) {
  const payload = parseMemoryPayload(row?.content) || {};
  const positionId = payload.positionId || payload.id || row?.id;

  if (!positionId) return null;

  return buildPositionTriedItem({
    positionId,
    title: payload.title || row?.title || 'Sex position tried',
    commonName: payload.commonName || null,
    shortSummary: payload.shortSummary || null,
    focus: payload.focus || null,
    mood: payload.mood || row?.mood || null,
    heat: payload.heat ?? null,
    rating: payload.rating ?? null,
    triedAt: row?.created_at || row?.date || new Date().toISOString(),
    memoryId: row?.id || null,
    isOwn: row?.isOwn,
  });
}

export async function buildKeepsakeEntriesFromSources({
  sharedPrompts = [],
  personalPrompts = [],
  sharedMemories = [],
  personalMemories = [],
  keepsakeSettingsRaw = {},
  myName = 'You',
  partnerName = 'Partner',
  currentUserId = null,
  resolveMedia = resolveRowMedia,
} = {}) {
  const keepsakeSettings = normalizeKeepsakeSettings(keepsakeSettingsRaw);

  const promptItems = keepsakeSettings.prompts
    ? buildPromptKeepsakeItems(
      markCurrentUserRows(dedupeRows([...(sharedPrompts || []), ...(personalPrompts || [])]), currentUserId),
      myName,
      partnerName
    )
    : [];

  const ownedMemoryRows = markCurrentUserRows(personalMemories, currentUserId)
    .filter((row) => row.isOwn);
  const sharedMemoryRows = markCurrentUserRows(sharedMemories, currentUserId);
  const memoryRows = dedupeRows([...ownedMemoryRows, ...sharedMemoryRows]);

  const rawMemoryItems = keepsakeSettings.memories
    ? await Promise.all(
      memoryRows
        .filter(isKeepsakeMemoryRow)
        .map(async (row) => buildMemoryItem(row, await resolveMedia(row)))
    )
    : [];

  const memoryItems = groupMemoryItems(rawMemoryItems);

  const memoryDateItems = keepsakeSettings.dates
    ? memoryRows
      .filter((row) => row?.type === 'date_saved' || row?.type === 'date_tried')
      .map((row) => buildDateItemFromMemoryRow(row))
      .filter(Boolean)
    : [];

  const memoryPositionItems = keepsakeSettings.positions
    ? memoryRows
      .filter((row) => row?.type === 'intimacy_tried')
      .map((row) => buildPositionTriedItemFromMemoryRow(row))
      .filter(Boolean)
    : [];

  const memoryFavoritePositionItems = keepsakeSettings.positions
    ? memoryRows
      .filter((row) => row?.type === 'intimacy_favorite')
      .map((row) => buildPositionFavoriteItemFromMemoryRow(row))
      .filter(Boolean)
    : [];

  return [
    ...promptItems,
    ...memoryItems,
    ...memoryDateItems,
    ...memoryPositionItems,
    ...memoryFavoritePositionItems,
  ].sort((a, b) => {
    return getSortTime(b) - getSortTime(a);
  });
}

export function buildDateGroupedKeepsakeList(entries = []) {
  const rows = [];
  let currentGroupKey = null;

  for (const entry of entries || []) {
    const groupKey = getDateGroupKey(entry);

    if (groupKey !== currentGroupKey) {
      currentGroupKey = groupKey;
      rows.push({
        id: `date-header:${groupKey}`,
        kind: 'date_header',
        title: getDateGroupLabel(entry),
        sortAt: entry?.sortAt || null,
      });
    }

    rows.push(entry);
  }

  return rows;
}

function applyOccurrenceOverrides(entries = [], overrides = {}) {
  if (!overrides || typeof overrides !== 'object') return entries;

  return (entries || []).map((entry) => {
    const override = overrides[entry?.id];
    if (!override) return entry;

    const date = new Date(override);
    if (Number.isNaN(date.getTime())) return entry;

    return {
      ...entry,
      sortAt: override,
      dateLabel: formatDateLabel(override),
    };
  }).sort((a, b) => getSortTime(b) - getSortTime(a));
}

export function filterKeepsakeEntriesByDateWindow(entries = [], days = FREE_KEEPSAKE_ARCHIVE_DAYS, referenceDate = new Date()) {
  const windowDays = Number(days);
  if (!Number.isFinite(windowDays) || windowDays <= 0) return [];

  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const cutoff = now.getTime() - (windowDays * 24 * 60 * 60 * 1000);

  return (entries || []).filter((entry) => {
    const sortTime = getSortTime(entry);
    return sortTime > 0 && sortTime >= cutoff;
  });
}

export function getKeepsakeEntriesForTier(entries = [], { isPremium = false, referenceDate = new Date() } = {}) {
  if (isPremium) return entries || [];
  return filterKeepsakeEntriesByDateWindow(entries, FREE_KEEPSAKE_ARCHIVE_DAYS, referenceDate);
}

function getKeepsakeLoadLimitForTier(isPremium) {
  return isPremium ? PREMIUM_KEEPSAKE_LOAD_LIMIT : FREE_KEEPSAKE_LOAD_LIMIT;
}

export default function OurStoryScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const { isPremiumEffective: isPremium } = useEntitlements();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [occurrenceEditor, setOccurrenceEditor] = useState(null);
  const [hearts, setHearts] = useState({});
  const scrollY = useRef(new RNAnimated.Value(0)).current;

  const t = useMemo(() => ({
    background: colors.background,
    surface: isDark ? 'rgba(28, 28, 30, 0.45)' : 'rgba(255, 255, 255, 0.65)',
    solidSurface: isDark ? '#1C1C1E' : '#FFFFFF',
    solidSurfaceSecondary: isDark ? '#2C2C2E' : '#F2F2F7',
    surfaceSecondary: isDark ? 'rgba(44, 44, 46, 0.8)' : 'rgba(242, 242, 247, 0.8)',
    primary: colors.primary || KEEPSAKE_CATEGORY_COLORS.position,
    neutralAccent: isDark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.58)',
    text: colors.text,
    subtext: colors.textMuted || (isDark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.6)'),
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    borderGlass: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
  }), [colors, isDark]);

  const styles = useMemo(() => createStyles(t, isDark), [t, isDark]);

  const groupedEntries = useMemo(
    () => buildDateGroupedKeepsakeList(entries),
    [entries]
  );

  const loadEntries = useCallback(async () => {
    try {
      const keepsakeLoadLimit = getKeepsakeLoadLimitForTier(isPremium);
      const [
        sharedPrompts,
        personalPrompts,
        sharedMemories,
        personalMemories,
        keepsakeSettingsRaw,
        myName,
        partnerName,
        currentUserId,
        hiddenKeepsakeIds,
        occurrenceOverrides,
      ] = await Promise.all([
        safeLoad(() => DataLayer.getSharedPromptAnswers({ limit: keepsakeLoadLimit })),
        safeLoad(() => DataLayer.getPromptAnswers({ limit: keepsakeLoadLimit })),
        safeLoad(() => DataLayer.getSharedMemories({ limit: keepsakeLoadLimit })),
        safeLoad(() => DataLayer.getMemories({ limit: keepsakeLoadLimit })),
        safeLoad(() => settingsStorage.getKeepsakeSettings()),
        NicknameEngine.getMyName('You'),
        NicknameEngine.getPartnerName('Partner'),
        Promise.resolve(typeof DataLayer.getCurrentUserId === 'function' ? DataLayer.getCurrentUserId() : null),
        storage.get(HIDDEN_KEEPSAKES_KEY, []),
        storage.get(OCCURRENCE_OVERRIDES_KEY, {}),
      ]);

      const merged = await buildKeepsakeEntriesFromSources({
        sharedPrompts,
        personalPrompts,
        sharedMemories,
        personalMemories,
        keepsakeSettingsRaw,
        myName,
        partnerName,
        currentUserId,
      });

      const hidden = new Set(Array.isArray(hiddenKeepsakeIds) ? hiddenKeepsakeIds : []);
      const visible = merged.filter((entry) => !hidden.has(entry.id));
      const resolvedEntries = applyOccurrenceOverrides(visible, occurrenceOverrides);
      setEntries(getKeepsakeEntriesForTier(resolvedEntries, { isPremium }));
    } catch (error) {
      if (__DEV__) console.warn('[OurStory] Load failed:', error?.message);
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isPremium]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadEntries();
    }, [loadEntries])
  );

  useEffect(() => {
    storage.get(HEARTS_KEY, {}).then((saved) => {
      if (saved && typeof saved === 'object') {
        setHearts(saved);
      }
    });
  }, []);

  const handleHeartToggle = useCallback(async (itemId) => {
    impact(ImpactFeedbackStyle.Light);

    setHearts((prev) => {
      const current = prev[itemId] || { count: 0, hearted: false };

      const updated = {
        ...prev,
        [itemId]: {
          count: current.hearted ? Math.max(0, current.count - 1) : current.count + 1,
          hearted: !current.hearted,
        },
      };

      storage.set(HEARTS_KEY, updated);
      return updated;
    });
  }, []);

  const onRefresh = useCallback(() => {
    selection();
    setRefreshing(true);
    loadEntries();
  }, [loadEntries]);

  const handleBack = useCallback(() => {
    impact(ImpactFeedbackStyle.Light);
    navigation.goBack();
  }, [navigation]);

  const normalizeLightboxItem = useCallback((item) => {
    if (!item) return null;

    if (item.uri) {
      return item;
    }

    if (item.media?.uri) {
      return {
        ...item,
        uri: item.media.uri,
        mimeType: item.media.mimeType,
        mime: item.media.mimeType,
        kind: item.media.kind,
      };
    }

    return null;
  }, []);

  const openLightbox = useCallback((item, allItems = null, startIndex = 0) => {
    const normalizedItems = Array.isArray(allItems) && allItems.length > 0
      ? allItems.map(normalizeLightboxItem).filter(Boolean)
      : [normalizeLightboxItem(item)].filter(Boolean);

    if (normalizedItems.length === 0) return;

    const safeIndex = Math.min(
      Math.max(Number(startIndex) || 0, 0),
      normalizedItems.length - 1
    );

    impact(ImpactFeedbackStyle.Medium);

    setLightbox({
      items: normalizedItems,
      index: safeIndex,
    });
  }, [normalizeLightboxItem]);

  const closeLightbox = useCallback(() => {
    setLightbox(null);
  }, []);

  const goToPreviousLightboxItem = useCallback(() => {
    setLightbox((current) => {
      if (!current?.items?.length) return current;

      const nextIndex = current.index <= 0
        ? current.items.length - 1
        : current.index - 1;

      return {
        ...current,
        index: nextIndex,
      };
    });
  }, []);

  const goToNextLightboxItem = useCallback(() => {
    setLightbox((current) => {
      if (!current?.items?.length) return current;

      const nextIndex = current.index >= current.items.length - 1
        ? 0
        : current.index + 1;

      return {
        ...current,
        index: nextIndex,
      };
    });
  }, []);

  const getDeleteCopy = useCallback((item) => {
    switch (item?.kind) {
      case 'snapshot':
        return {
          title: 'Delete Memory?',
          message: 'This will remove all photos and videos in this memory from Keepsake.',
          action: 'Delete Memory',
        };
      case 'prompt':
        return {
          title: 'Delete Prompt?',
          message: 'This will remove this prompt response from Keepsake.',
          action: 'Delete Prompt',
        };
      case 'date':
      case 'date_saved':
        return {
          title: 'Delete Date?',
          message: 'This will remove this date from Keepsake.',
          action: 'Delete Date',
        };
      case 'position_tried':
      case 'position_favorite':
        return {
          title: 'Delete Sex Position?',
          message: 'This will remove this sex position from Keepsake.',
          action: 'Delete Sex Position',
        };
      default:
        return {
          title: 'Delete Memory?',
          message: 'This will remove this memory from Keepsake.',
          action: 'Delete Memory',
        };
    }
  }, []);

  const getMatchingOwnedMemoryIds = useCallback(async (item) => {
    const typeByKind = {
      date: 'date_tried',
      date_saved: 'date_saved',
      position_tried: 'intimacy_tried',
      position_favorite: 'intimacy_favorite',
    };
    const memoryType = typeByKind[item?.kind];

    if (!memoryType || !item?.sourceId) return [];

    const rows = await DataLayer.getMemories({ type: memoryType, limit: 500, ownedOnly: true });
    return (rows || [])
      .filter((row) => {
        const payload = parseMemoryPayload(row?.content) || {};
        const sourceId = payload.positionId || payload.dateId || payload.id || row?.id || null;
        return String(sourceId) === String(item.sourceId);
      })
      .map((row) => row.id)
      .filter(Boolean);
  }, []);

  const hideKeepsakeItem = useCallback(async (item) => {
    if (!item?.id) return;

    const hiddenKeepsakeIds = await storage.get(HIDDEN_KEEPSAKES_KEY, []);
    const nextHiddenKeepsakeIds = [
      ...new Set([
        ...(Array.isArray(hiddenKeepsakeIds) ? hiddenKeepsakeIds : []),
        item.id,
      ]),
    ];

    await storage.set(HIDDEN_KEEPSAKES_KEY, nextHiddenKeepsakeIds);
    setEntries((current) => current.filter((entry) => entry.id !== item.id));
  }, []);

  const deleteKeepsakeItem = useCallback(async (item) => {
    const currentUserId = typeof DataLayer.getCurrentUserId === 'function'
      ? DataLayer.getCurrentUserId()
      : null;

    if (item?.isOwn === false) {
      throw new Error('No deletable row found for this account.');
    }

    if (item.kind === 'snapshot') {
      const ownRawItems = (item.rawItems || [])
        .filter((rawItem) => rawItem?.sourceId)
        .filter((rawItem) => !currentUserId || rawItem?.row?.user_id === currentUserId);

      if (!ownRawItems.length) {
        throw new Error('No deletable row found for this account.');
      }

      await Promise.all(ownRawItems.map((rawItem) => DataLayer.deleteMemory(rawItem.sourceId)));
      return;
    }

    if (item.kind === 'prompt') {
      await DataLayer.deletePromptAnswer(item.sourceId);
      return;
    }

    if (['date', 'date_saved', 'position_tried', 'position_favorite'].includes(item.kind)) {
      const matchingMemoryIds = await getMatchingOwnedMemoryIds(item);

      if (!matchingMemoryIds.length) {
        throw new Error('No deletable row found for this account.');
      }

      await Promise.all([...new Set(matchingMemoryIds)].map((memoryId) => DataLayer.deleteMemory(memoryId)));
      return;
    }

    const directMemoryId = item.memoryId || item.sourceId;
    const matchingMemoryIds = await getMatchingOwnedMemoryIds(item);
    const memoryIds = [...new Set([
      directMemoryId,
      ...matchingMemoryIds,
    ].filter(Boolean))];

    if (!memoryIds.length) {
      throw new Error('No deletable row found for this account.');
    }

    await Promise.all(memoryIds.map((memoryId) => DataLayer.deleteMemory(memoryId)));
  }, [getMatchingOwnedMemoryIds]);

  const canEditOccurrence = useCallback((item) => (
    ['date', 'position_tried'].includes(item?.kind)
      && !!item?.deletable
  ), []);

  const openOccurrenceEditor = useCallback((item) => {
    if (!canEditOccurrence(item)) return;

    const initialDate = new Date(item.sortAt || Date.now());
    setOccurrenceEditor({
      item,
      value: Number.isNaN(initialDate.getTime()) ? new Date() : initialDate,
      saving: false,
    });
  }, [canEditOccurrence]);

  const closeOccurrenceEditor = useCallback(() => {
    setOccurrenceEditor(null);
  }, []);

  const updateOccurrenceEditorValue = useCallback((nextDate) => {
    if (!nextDate || Number.isNaN(new Date(nextDate).getTime())) return;
    setOccurrenceEditor((current) => (
      current ? { ...current, value: new Date(nextDate) } : current
    ));
  }, []);

  const saveLocalOccurrenceOverride = useCallback(async (item, occurredAt) => {
    if (!item?.id || !occurredAt) return;

    const existing = await storage.get(OCCURRENCE_OVERRIDES_KEY, {});
    const next = {
      ...(existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {}),
      [item.id]: occurredAt,
    };

    await storage.set(OCCURRENCE_OVERRIDES_KEY, next);
  }, []);

  const saveOccurrenceEditor = useCallback(async () => {
    const item = occurrenceEditor?.item;
    const value = occurrenceEditor?.value;
    if (!item || !value) return;

    setOccurrenceEditor((current) => current ? { ...current, saving: true } : current);

    try {
      const matchingMemoryIds = await getMatchingOwnedMemoryIds(item);
      const memoryIds = [...new Set([
        ...matchingMemoryIds,
        item.memoryId,
      ].filter(Boolean))];

      if (!memoryIds.length) {
        throw new Error('No editable row found for this account.');
      }

      for (const memoryId of memoryIds) {
        try {
          await DataLayer.updateMemory(memoryId, { occurred_at: value.toISOString() });
        } catch (error) {
          if (!String(error?.message || '').includes('No matching row found')) {
            throw error;
          }
        }
      }

      await saveLocalOccurrenceOverride(item, value.toISOString());

      selection();
      setOccurrenceEditor(null);
      await loadEntries();
    } catch (error) {
      if (__DEV__) console.warn('[OurStory] Occurrence edit failed:', error?.message);
      setOccurrenceEditor((current) => current ? { ...current, saving: false } : current);
      Alert.alert('Could not update', 'Please try again.');
    }
  }, [getMatchingOwnedMemoryIds, loadEntries, occurrenceEditor, saveLocalOccurrenceOverride]);

  const confirmDeleteItem = useCallback((item) => {
    const deleteCopy = getDeleteCopy(item);

    Alert.alert(
      deleteCopy.title,
      deleteCopy.message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: deleteCopy.action,
          style: 'destructive',
          onPress: async () => {
            try {
              impact(ImpactFeedbackStyle.Medium);
              await deleteKeepsakeItem(item);
              await loadEntries();
            } catch (error) {
              if (isNoDeletableRowError(error)) {
                await hideKeepsakeItem(item);
                return;
              }

              if (__DEV__) console.warn('[OurStory] Delete failed:', error?.message);
              Alert.alert('Could not delete', 'Please try again.');
            }
          },
        },
      ]
    );
  }, [deleteKeepsakeItem, getDeleteCopy, hideKeepsakeItem, loadEntries]);

  const handleEditItem = useCallback((item) => {
    if (!item?.editable) return;

    impact(ImpactFeedbackStyle.Light);

    navigation.navigate('AddMemory', {
      mode: 'edit',
      editItem: item,
      editKind: item.kind,
      sourceId: item.sourceId,
    });
  }, [navigation]);

  const getRestoreTarget = useCallback((item) => {
    if (item?.kind === 'prompt' && item?.contentId) {
      return { type: 'prompts', itemId: item.contentId, label: 'Show Prompt In Deck Again' };
    }

    if (item?.kind === 'date' && item?.contentId) {
      return { type: 'dates', itemId: item.contentId, label: 'Show Date In Deck Again' };
    }

    if (item?.kind === 'position_tried' && item?.contentId) {
      return { type: 'positions', itemId: item.contentId, label: 'Show Position In Deck Again' };
    }

    return null;
  }, []);

  const handleLongPressItem = useCallback((item) => {
    const restoreTarget = getRestoreTarget(item);
    if (!restoreTarget && !item?.editable && !item?.deletable && !item?.hideable) return;

    impact(ImpactFeedbackStyle.Medium);

    Alert.alert(
      'Keepsake Options',
      null,
      [
        restoreTarget ? {
          text: restoreTarget.label,
          onPress: async () => {
            await addRestoredDeckItem(restoreTarget.type, restoreTarget.itemId);
          },
        } : null,
        canEditOccurrence(item) ? {
          text: 'Edit Date & Time',
          onPress: () => openOccurrenceEditor(item),
        } : null,
        item.editable ? {
          text: 'Edit Memory',
          onPress: () => handleEditItem(item),
        } : null,
        item.deletable ? {
          text: getDeleteCopy(item).action,
          style: 'destructive',
          onPress: () => confirmDeleteItem(item),
        } : null,
        item.hideable ? {
          text: 'Hide From Keepsake',
          onPress: () => hideKeepsakeItem(item),
        } : null,
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ].filter(Boolean)
    );
  }, [canEditOccurrence, confirmDeleteItem, getDeleteCopy, getRestoreTarget, handleEditItem, hideKeepsakeItem, openOccurrenceEditor]);

  const renderSnapshotTile = (media, index, mediaItems, tileStyle, options = {}) => {
    const isVideo = media.kind === 'video' || media.mimeType?.startsWith('video/');
    const hasMoreOverlay = options.remaining > 0;

    return (
      <TouchableOpacity
        key={media.id}
        activeOpacity={0.9}
        delayLongPress={360}
        onPress={() => openLightbox(media, mediaItems, index)}
        onLongPress={options.onLongPress}
        style={[styles.snapshotGridTile, tileStyle]}
      >
        {isVideo ? (
          <View style={styles.snapshotVideoTile}>
            <Icon
              name="play-circle-outline"
              size={options.small ? 30 : 46}
              color="#FFF"
            />
            {!options.small ? (
              <Text style={styles.snapshotVideoText}>Video</Text>
            ) : null}
          </View>
        ) : (
          <Image
            source={{ uri: media.uri }}
            style={styles.snapshotImage}
            resizeMode="contain"
          />
        )}

        {hasMoreOverlay ? (
          <View pointerEvents="none" style={styles.remainingOverlay}>
            <Text style={styles.remainingText}>+{options.remaining}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderSnapshotGrid = (item) => {
    const mediaItems = item.mediaItems || [];
    const count = mediaItems.length;

    if (count === 0) return null;

    if (count === 1) {
      return (
        <View style={styles.snapshotMediaBlock}>
          <View style={[styles.facebookGrid, styles.facebookGridSingle]}>
            {renderSnapshotTile(mediaItems[0], 0, mediaItems, styles.singleTile, {
              onLongPress: () => handleLongPressItem(item),
            })}
          </View>
        </View>
      );
    }

    if (count === 2) {
      return (
        <View style={styles.snapshotMediaBlock}>
          <View style={[styles.facebookGrid, styles.facebookGridTwo]}>
            {renderSnapshotTile(mediaItems[0], 0, mediaItems, styles.twoTile, {
              onLongPress: () => handleLongPressItem(item),
            })}
            {renderSnapshotTile(mediaItems[1], 1, mediaItems, styles.twoTile, {
              onLongPress: () => handleLongPressItem(item),
            })}
          </View>
        </View>
      );
    }

    if (count === 3) {
      return (
        <View style={styles.snapshotMediaBlock}>
          <View style={[styles.facebookGrid, styles.facebookGridThree]}>
            {renderSnapshotTile(mediaItems[0], 0, mediaItems, styles.threeLargeTile, {
              onLongPress: () => handleLongPressItem(item),
            })}
            <View style={styles.threeSideStack}>
              {renderSnapshotTile(mediaItems[1], 1, mediaItems, styles.threeSmallTile, {
                small: true,
                onLongPress: () => handleLongPressItem(item),
              })}
              {renderSnapshotTile(mediaItems[2], 2, mediaItems, styles.threeSmallTile, {
                small: true,
                onLongPress: () => handleLongPressItem(item),
              })}
            </View>
          </View>
        </View>
      );
    }

    const remaining = Math.max(0, count - 4);

    return (
      <View style={styles.snapshotMediaBlock}>
        <View style={[styles.facebookGrid, styles.facebookGridFour]}>
          <View style={styles.facebookGridRow}>
            {renderSnapshotTile(mediaItems[0], 0, mediaItems, styles.fourTile, {
              small: true,
              onLongPress: () => handleLongPressItem(item),
            })}
            {renderSnapshotTile(mediaItems[1], 1, mediaItems, styles.fourTile, {
              small: true,
              onLongPress: () => handleLongPressItem(item),
            })}
          </View>

          <View style={styles.facebookGridRow}>
            {renderSnapshotTile(mediaItems[2], 2, mediaItems, styles.fourTile, {
              small: true,
              onLongPress: () => handleLongPressItem(item),
            })}
            {renderSnapshotTile(mediaItems[3], 3, mediaItems, styles.fourTile, {
              small: true,
              remaining,
              onLongPress: () => handleLongPressItem(item),
            })}
          </View>
        </View>
      </View>
    );
  };

  const renderItem = ({ item, index }) => {
    if (item.kind === 'date_header') {
      return (
        <View style={styles.dateHeaderRow}>
          <Text style={[styles.dateHeaderText, { color: t.text }]}>
            {item.title}
          </Text>
        </View>
      );
    }

    const heartState = hearts[item.id] || { count: 0, hearted: false };
    const isSnapshot = item.kind === 'snapshot';
    const isVideo = item.media?.kind === 'video' || item.media?.mimeType?.startsWith('video/');

    return (
      <ReAnimated.View
        entering={FadeInDown.delay(index * 35).springify().damping(18)}
        style={styles.timelineRow}
      >
        <View style={styles.timelineSpine}>
          <View style={[styles.timelineDot, { backgroundColor: item.accent }]} />
          <View style={[styles.timelineLine, { backgroundColor: t.border }]} />
        </View>

        <TouchableOpacity
          activeOpacity={0.96}
          delayLongPress={360}
          onLongPress={() => handleLongPressItem(item)}
          style={[styles.cardContainer, styles.cardTimeline]}
        >
          <View
            style={[
              styles.editorialCard,
              styles.editorialCardColumn,
              {
                backgroundColor: t.surface,
                borderColor: t.borderGlass,
                padding: 0,
              },
              !isDark && styles.lightShadow,
            ]}
          >
            <View style={styles.cardInner}>
              <View style={styles.cardTopRow}>
                <View style={styles.cardEyebrowRow}>
                  <Icon name={item.icon} size={14} color={item.accent} />
                  <Text
                    style={[styles.cardEyebrow, { color: t.primary }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.78}
                  >
                    {item.eyebrow}
                  </Text>
                </View>

                <Text style={styles.dateLabel} numberOfLines={1}>
                  {item.dateLabel}
                </Text>
              </View>

              <Text style={styles.cardTitle}>
                {item.title}
              </Text>

              {isSnapshot ? (
                renderSnapshotGrid(item)
              ) : item.media?.uri ? (
                <TouchableOpacity
                  activeOpacity={0.88}
                  delayLongPress={360}
                  onPress={() => openLightbox(item)}
                  onLongPress={() => handleLongPressItem(item)}
                  style={styles.mediaButton}
                >
                  {isVideo ? (
                    <View
                      style={[
                        styles.videoPreview,
                        {
                          backgroundColor: withAlpha(item.accent, 0.1),
                          borderColor: withAlpha(item.accent, 0.18),
                        },
                      ]}
                    >
                      <Icon name="play-circle-outline" size={34} color={item.accent} />
                      <Text style={[styles.videoPreviewText, { color: item.accent }]}>
                        Video
                      </Text>
                    </View>
                  ) : (
                    <Image
                      source={{ uri: item.media.uri }}
                      style={styles.storyImage}
                      resizeMode="contain"
                    />
                  )}
                </TouchableOpacity>
              ) : null}

              {item.answers && item.answers.length > 0 ? (
                <View style={[styles.answersContainer, isSnapshot && styles.snapshotBody]}>
                  {item.answers.map((answer, idx) => (
                    <View key={`${item.id}:answer:${idx}`} style={idx > 0 ? styles.answerSpacing : undefined}>
                      <Text style={styles.cardBody}>
                        <Text style={styles.answerName}>{answer.name}: </Text>
                        {answer.text}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : item.body ? (
                <Text style={[styles.cardBody, isSnapshot && styles.snapshotBody]}>
                  {item.body}
                </Text>
              ) : null}

              <View style={styles.cardFooter}>
                {isSnapshot ? (
                  <Text style={[styles.cardMetaText, { color: t.subtext }]} numberOfLines={1}>
                    {item.meta}
                  </Text>
                ) : (
                  <View style={styles.cardMetaSpacer} />
                )}

                <View style={styles.cardFooterRight}>
                  <TouchableOpacity
                    onPress={() => handleHeartToggle(item.id)}
                    hitSlop={12}
                    style={styles.heartButton}
                  >
                    <Icon
                      name="heart-outline"
                      size={18}
                      color={heartState.hearted ? item.accent : t.subtext}
                    />

                    {heartState.count > 0 && (
                      <Text
                        style={[
                          styles.heartCount,
                          { color: heartState.hearted ? item.accent : t.subtext },
                        ]}
                      >
                        {heartState.count}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </ReAnimated.View>
    );
  };

  const currentLightboxItem = lightbox?.items?.[lightbox.index] || null;
  const lightboxTotal = lightbox?.items?.length || 0;
  const lightboxPosition = lightbox ? lightbox.index + 1 : 0;

  const ListHeader = (
    <ReAnimated.View entering={FadeIn.duration(500)}>
      <View style={styles.headerIntroContainer}>
        <Text style={styles.headerIntro}>
          {isPremium
            ? (entries.length ? `Lifetime archive • ${entries.length} keepsakes` : 'Lifetime archive')
            : (entries.length
              ? `Free tier • Last 30 days • ${entries.length} keepsakes`
              : 'Free tier • Last 30 days')}
        </Text>
      </View>
    </ReAnimated.View>
  );

  const EmptyState = (
    <ReAnimated.View entering={FadeIn.duration(450)} style={styles.emptyState}>
      <View style={[styles.emptyIconCircle, { borderColor: t.border, backgroundColor: t.surface }]}>
        <Icon name="archive-outline" size={42} color={t.neutralAccent} />
      </View>

      <Text style={[styles.emptyTitle, { color: t.text }]}>
        Your story begins here
      </Text>

      <Text style={styles.emptyBody}>
        {isPremium
          ? 'Prompt, memory, date, and sex position keepsakes will collect here for your lifetime archive. You can turn off any category you do not want in Settings.'
          : 'On the free tier, prompt, memory, date, and sex position keepsakes from the last 30 days will collect here. You can turn off any category you do not want in Settings.'}
      </Text>
    </ReAnimated.View>
  );

  const LoadingState = (
    <View style={styles.loadingState}>
      <ActivityIndicator size="small" color={t.neutralAccent} />
      <Text style={styles.loadingText}>
        Gathering your story...
      </Text>
    </View>
  );

  const NativeDateTimePicker = occurrenceEditor
    ? require('@react-native-community/datetimepicker').default
    : null;
  const occurrenceAccent = occurrenceEditor?.item?.accent || t.neutralAccent;

  return (
    <EditorialScreenScaffold
      navigation={navigation}
      headerTitle="Keepsake"
      headerSubtitle="OUR STORY"
      scroll={false}
      onBack={handleBack}
      screenAccentColor={t.neutralAccent}
      headerSubtitleColor={t.primary}
    >
      <RNAnimated.FlatList
        data={groupedEntries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={loading ? LoadingState : EmptyState}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onScroll={RNAnimated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.neutralAccent}
          />
        )}
      />

      <TouchableOpacity
        style={styles.fabContainer}
        onPress={() => navigation.navigate('AddMemory')}
        activeOpacity={0.85}
      >
        <BlurView
          intensity={70}
          tint={isDark ? 'dark' : 'light'}
          style={[
            styles.fabBlur,
            { backgroundColor: t.solidSurfaceSecondary, borderColor: t.border },
          ]}
        >
          <Icon name="add-outline" size={28} color={t.text} />
        </BlurView>
      </TouchableOpacity>

      <Modal
        visible={!!occurrenceEditor}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeOccurrenceEditor}
      >
        <View style={styles.occurrenceBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeOccurrenceEditor}
          />
          <View style={[styles.occurrenceSheet, { backgroundColor: t.solidSurface, borderColor: t.border }]}>
            <View style={styles.occurrenceHeaderRow}>
              <View>
                <Text style={[styles.occurrenceEyebrow, { color: t.primary }]}>OCCURRED</Text>
                <Text style={[styles.occurrenceTitle, { color: t.text }]}>Edit date and time</Text>
              </View>
              <TouchableOpacity
                onPress={closeOccurrenceEditor}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.occurrenceCloseButton}
              >
                <Icon name="close-outline" size={22} color={t.subtext} />
              </TouchableOpacity>
            </View>

            {occurrenceEditor ? (
              <View style={styles.occurrencePickerStack}>
                <View style={[styles.occurrencePickerCard, { backgroundColor: t.solidSurfaceSecondary }]}>
                  <NativeDateTimePicker
                    value={occurrenceEditor.value}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    maximumDate={new Date()}
                    onChange={(event, selectedDate) => {
                      if (event?.type === 'dismissed') return;
                      const current = occurrenceEditor.value;
                      const picked = selectedDate || current;
                      const next = new Date(current);
                      next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
                      updateOccurrenceEditorValue(next);
                    }}
                  />
                </View>
                <View style={[styles.occurrencePickerCard, { backgroundColor: t.solidSurfaceSecondary }]}>
                  <NativeDateTimePicker
                    value={occurrenceEditor.value}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      if (event?.type === 'dismissed') return;
                      const current = occurrenceEditor.value;
                      const picked = selectedDate || current;
                      const next = new Date(current);
                      next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
                      updateOccurrenceEditorValue(next);
                    }}
                  />
                </View>
              </View>
            ) : null}

            <View style={styles.occurrenceActions}>
              <TouchableOpacity
                style={[styles.occurrenceSecondaryButton, { borderColor: t.border }]}
                onPress={closeOccurrenceEditor}
                disabled={occurrenceEditor?.saving}
              >
                <Text style={[styles.occurrenceSecondaryText, { color: t.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.occurrencePrimaryButton, { backgroundColor: occurrenceAccent }]}
                onPress={saveOccurrenceEditor}
                disabled={occurrenceEditor?.saving}
              >
                <Text style={styles.occurrencePrimaryText}>
                  {occurrenceEditor?.saving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!currentLightboxItem}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeLightbox}
      >
        <View style={styles.lightboxShell}>
          <MediaLightbox
            item={currentLightboxItem}
            onClose={closeLightbox}
            showCloseButton
          />

          {lightboxTotal > 1 ? (
            <>
              <View pointerEvents="none" style={styles.lightboxCounter}>
                <BlurView intensity={55} tint="dark" style={styles.lightboxCounterPill}>
                  <Text style={styles.lightboxCounterText}>
                    {lightboxPosition} of {lightboxTotal}
                  </Text>
                </BlurView>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={goToPreviousLightboxItem}
                style={[styles.lightboxNavButton, styles.lightboxNavLeft]}
              >
                <BlurView intensity={55} tint="dark" style={styles.lightboxNavBlur}>
                  <Icon name="chevron-back-outline" size={28} color="#FFF" />
                </BlurView>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={goToNextLightboxItem}
                style={[styles.lightboxNavButton, styles.lightboxNavRight]}
              >
                <BlurView intensity={55} tint="dark" style={styles.lightboxNavBlur}>
                  <Icon name="chevron-forward-outline" size={28} color="#FFF" />
                </BlurView>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </Modal>
    </EditorialScreenScaffold>
  );
}

const createStyles = (t, isDark) => StyleSheet.create({
  editorialCard: {
    borderRadius: 28,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  editorialCardColumn: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  lightShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },
  listContent: {
    paddingHorizontal: 0,
    paddingBottom: 160,
  },

  fabContainer: {
    position: 'absolute',
    right: SPACING.screen,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: isDark ? 0.35 : 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },
  fabBlur: {
    flex: 1,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  headerIntroContainer: {
    paddingHorizontal: SPACING.screen,
    paddingBottom: SPACING.md,
  },
  headerIntro: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: t.subtext,
  },
  dateHeaderRow: {
    paddingHorizontal: SPACING.screen,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  dateHeaderText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  cardContainer: {
    borderRadius: 24,
    marginBottom: SPACING.lg,
  },
  cardInner: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
    paddingTop: SPACING.xl,
    width: '100%',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: SPACING.md,
  },
  cardEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  cardEyebrow: {
    flexShrink: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  dateLabel: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '600',
    color: t.subtext,
    flexShrink: 0,
  },
  cardTitle: {
    fontFamily: SERIF_FONT,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: t.text,
    marginBottom: SPACING.sm,
  },
  cardBody: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    lineHeight: 24,
    color: t.subtext,
  },
  answersContainer: {
    gap: 0,
  },
  answerSpacing: {
    marginTop: SPACING.md,
  },
  answerName: {
    fontFamily: SYSTEM_FONT,
    fontWeight: '800',
    color: t.text,
  },
  snapshotBody: {
    marginTop: SPACING.lg,
    color: t.text,
  },

  snapshotMediaBlock: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    width: '100%',
  },

  facebookGrid: {
    width: '100%',
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  facebookGridSingle: {
    height: 320,
  },
  facebookGridTwo: {
    height: 292,
    flexDirection: 'row',
    gap: 3,
  },
  facebookGridThree: {
    height: 292,
    flexDirection: 'row',
    gap: 3,
  },
  facebookGridFour: {
    height: 292,
    gap: 3,
  },
  facebookGridRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
  },
  snapshotGridTile: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  singleTile: {
    width: '100%',
    height: '100%',
  },
  twoTile: {
    flex: 1,
    height: '100%',
  },
  threeLargeTile: {
    flex: 1.15,
    height: '100%',
  },
  threeSideStack: {
    flex: 0.85,
    height: '100%',
    gap: 3,
  },
  threeSmallTile: {
    flex: 1,
    width: '100%',
  },
  fourTile: {
    flex: 1,
    height: '100%',
  },
  snapshotImage: {
    width: '100%',
    height: '100%',
  },
  snapshotVideoTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.54)',
    gap: 8,
  },
  snapshotVideoText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#FFF',
  },
  remainingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  remainingText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 30,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.8,
  },

  mediaButton: {
    width: '100%',
    marginBottom: SPACING.lg,
    borderRadius: 18,
    overflow: 'hidden',
  },
  storyImage: {
    width: '100%',
    height: 220,
    borderRadius: 18,
    backgroundColor: withAlpha(t.text, 0.06),
  },
  videoPreview: {
    height: 180,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoPreviewText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
    gap: 12,
  },
  cardMetaText: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: SPACING.xl,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontFamily: SERIF_FONT,
    fontSize: 30,
    marginBottom: SPACING.sm,
  },
  emptyBody: {
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    lineHeight: 24,
    color: t.subtext,
    textAlign: 'center',
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 72,
    gap: 14,
  },
  loadingText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: '600',
    color: t.subtext,
  },

  timelineRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  timelineSpine: {
    width: 20,
    alignItems: 'center',
    paddingTop: SPACING.xl + 4,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 4,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    borderRadius: 1,
  },
  cardTimeline: {
    flex: 1,
  },

  cardFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  heartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  heartCount: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '700',
  },

  occurrenceBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  occurrenceSheet: {
    margin: 16,
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 18,
    opacity: 1,
  },
  occurrenceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  occurrenceEyebrow: {
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  occurrenceTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
  },
  occurrenceCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  occurrencePickerStack: {
    gap: 8,
  },
  occurrencePickerCard: {
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: Platform.OS === 'ios' ? 4 : 0,
  },
  occurrenceActions: {
    flexDirection: 'row',
    gap: 10,
  },
  occurrenceSecondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  occurrencePrimaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  occurrenceSecondaryText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: '800',
  },
  occurrencePrimaryText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  lightboxShell: {
    flex: 1,
    backgroundColor: '#000',
  },
  lightboxCounter: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 58 : 32,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  lightboxCounterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  lightboxCounterText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  lightboxNavButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  lightboxNavLeft: {
    left: 16,
  },
  lightboxNavRight: {
    right: 16,
  },
  lightboxNavBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});

// utils/contentLoader.js
// ✅ ULTRA SAFE VERSION - Cannot crash during module loading
// ✅ Guarantees prompt-returning functions always return an object with .text (never undefined)

if (__DEV__) console.log("🔵 ContentLoader: Module loading started");

// Initialize with empty safe defaults
let promptsData = { items: [], meta: {} };
let datesData = { items: [], meta: {} };

// Try to load data, but never crash
try {
  const loadedPrompts = require("../content/prompts.json");
  if (loadedPrompts && Array.isArray(loadedPrompts.items)) {
    promptsData = loadedPrompts;
    if (__DEV__) console.log("✅ ContentLoader: Loaded", promptsData.items.length, "prompts");
  } else {
    console.warn("⚠️ ContentLoader: prompts.json loaded but missing items[]");
  }
} catch (e) {
  console.error("❌ ContentLoader: Failed to load prompts", e?.message || e);
}

try {
  const loadedDates = require("../content/dates.json");
  if (loadedDates && Array.isArray(loadedDates.items)) {
    datesData = loadedDates;
    if (__DEV__) console.log("✅ ContentLoader: Loaded", datesData.items.length, "dates");
  } else {
    console.warn("⚠️ ContentLoader: dates.json loaded but missing items[]");
  }
} catch (e) {
  console.error("❌ ContentLoader: Failed to load dates", e?.message || e);
}

if (__DEV__) console.log("🔵 ContentLoader: Module loading complete");

// =======================
// SAFETY HELPERS
// =======================

// Safe hash function
const getStableHash = (str) => {
  const s = typeof str === "string" ? str : String(str ?? "");
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

// Safe date key generator (local)
const getLocalDateKey = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Fallback prompt (guaranteed safe)
const FALLBACK_PROMPT = {
  id: "fallback_prompt",
  text: "What’s one small thing we can do today to feel closer?",
  category: "romance",
  heat: 1,
};

// Normalize any prompt into a safe prompt with .text
const normalizePrompt = (p, extra = {}) => {
  if (!p || typeof p !== "object") return { ...FALLBACK_PROMPT, ...extra };

  const text = typeof p.text === "string" ? p.text : "";
  if (!text.trim()) return { ...FALLBACK_PROMPT, ...p, ...extra };

  // Ensure heat + category exist in some form
  const heat = typeof p.heat === "number" ? p.heat : FALLBACK_PROMPT.heat;
  const category = typeof p.category === "string" ? p.category : FALLBACK_PROMPT.category;

  return { ...p, heat, category, ...extra };
};

// Safe array guard
const safeArray = (value) => (Array.isArray(value) ? value : []);

// =======================
// EXPORTS
// =======================

export function loadContent() {
  // Return the whole promptsData object, but never null
  return promptsData || { items: [], meta: {} };
}

export function getFilteredPrompts(filters = {}) {
  const items = safeArray(promptsData?.items);

  const {
    maxHeatLevel = 5,
    minHeatLevel = 1,
    categories = [],
    excludeCategories = [],
  } = filters || {};

  const cats = safeArray(categories);
  const excludeCats = safeArray(excludeCategories);

  return items.filter((prompt) => {
    if (!prompt || typeof prompt !== "object") return false;

    // ✅ Key: require valid text so UI never gets a "prompt" with missing text
    if (typeof prompt.text !== "string" || !prompt.text.trim()) return false;

    const heat = typeof prompt.heat === "number" ? prompt.heat : 1;
    if (heat < minHeatLevel || heat > maxHeatLevel) return false;

    const category = typeof prompt.category === "string" ? prompt.category : "";
    if (cats.length > 0 && !cats.includes(category)) return false;
    if (excludeCats.length > 0 && excludeCats.includes(category)) return false;

    return true;
  });
}

export function getPromptByHeatLevel(heatLevel) {
  try {
    const level = typeof heatLevel === "number" ? heatLevel : Number(heatLevel) || 5;
    const items = safeArray(promptsData?.items);

    const levelPrompts = items.filter(
      (p) =>
        p &&
        typeof p === "object" &&
        typeof p.text === "string" &&
        p.text.trim() &&
        (typeof p.heat === "number" ? p.heat : 1) === level
    );

    if (levelPrompts.length === 0) {
      return normalizePrompt(null, {
        heatLevel: level,
        isCustomSelected: true,
        isFallback: true,
      });
    }

    const seed = Date.now().toString();
    const index = getStableHash(seed) % levelPrompts.length;

    return normalizePrompt(levelPrompts[index], {
      heatLevel: level,
      isCustomSelected: true,
    });
  } catch (error) {
    console.error("getPromptByHeatLevel error:", error);
    return normalizePrompt(null, {
      heatLevel: typeof heatLevel === "number" ? heatLevel : 1,
      isCustomSelected: true,
      isFallback: true,
    });
  }
}

export function getPromptOfTheDay(sharedKey = "", userFilters = {}) {
  const dateKey = getLocalDateKey();

  try {
    const key = typeof sharedKey === "string" ? sharedKey : String(sharedKey ?? "");
    const seed = `${dateKey}:${key || "default"}`;

    const filteredPrompts = getFilteredPrompts(userFilters);

    if (filteredPrompts.length === 0) {
      // fallback to heat <= 1
      const fallbackPrompts = getFilteredPrompts({ maxHeatLevel: 1 });
      if (fallbackPrompts.length === 0) {
        return normalizePrompt(null, { dateKey, isDaily: true, isFallback: true });
      }

      const index = getStableHash(seed) % fallbackPrompts.length;
      return normalizePrompt(fallbackPrompts[index], {
        dateKey,
        isDaily: true,
        isFallback: true,
      });
    }

    const index = getStableHash(seed) % filteredPrompts.length;
    return normalizePrompt(filteredPrompts[index], { dateKey, isDaily: true });
  } catch (error) {
    console.error("getPromptOfTheDay error:", error);
    return normalizePrompt(null, { dateKey, isDaily: true, isFallback: true });
  }
}

export function getRandomPrompt(userFilters = {}) {
  try {
    const filteredPrompts = getFilteredPrompts(userFilters);
    if (filteredPrompts.length === 0) return normalizePrompt(null, { isRandom: true, isFallback: true });

    const index = Math.floor(Math.random() * filteredPrompts.length);
    return normalizePrompt(filteredPrompts[index], { isRandom: true });
  } catch (error) {
    console.error("getRandomPrompt error:", error);
    return normalizePrompt(null, { isRandom: true, isFallback: true });
  }
}

export function getAllPrompts() {
  // Returns raw prompts; UI should still guard, but we keep it safe-ish
  return safeArray(promptsData?.items).filter(Boolean);
}

export function getPromptsByHeatLevel(heatLevel) {
  const level = typeof heatLevel === "number" ? heatLevel : Number(heatLevel) || 5;
  const items = safeArray(promptsData?.items);

  return items.filter(
    (p) =>
      p &&
      typeof p === "object" &&
      typeof p.text === "string" &&
      p.text.trim() &&
      (typeof p.heat === "number" ? p.heat : 1) === level
  );
}

export function getPromptsByCategory(category) {
  const cat = typeof category === "string" ? category : String(category ?? "");
  const items = safeArray(promptsData?.items);

  return items.filter(
    (p) => p && typeof p === "object" && typeof p.text === "string" && p.text.trim() && p.category === cat
  );
}

// =======================
// DATES
// =======================

const VALID_STYLES = ["talking", "doing", "mixed"];

const normalizeDate = (date) => {
  if (!date || typeof date !== "object") return null;

  const heat = typeof date.heat === "number" ? Math.max(1, Math.min(3, date.heat)) : 1;
  const load = typeof date.load === "number" ? Math.max(1, Math.min(3, date.load)) : 2;
  const style = VALID_STYLES.includes(date.style) ? date.style : "mixed";

  return {
    ...date,
    heat,
    load,
    style,
  };
};

export function filterDates(sourceData = null, filters = {}) {
  const dataToFilter = Array.isArray(sourceData) ? sourceData : safeArray(datesData?.items);
  const normalized = dataToFilter.map(normalizeDate).filter(Boolean);

  const {
    location = "either",
    heat = null,          // exact mood level 1-3, or null (any)
    minHeat = 1,          // 1-3, floor mood level
    maxHeat = 3,          // 1-3, caps mood level
    load = null,          // exact load level 1-3, or null (any)
    style = null,         // "talking" | "doing" | "mixed" | null (any)
    minMinutes = 0,
    maxMinutes = Infinity,
  } = filters || {};

  const filtered = normalized.filter((date) => {
    if (!date || typeof date !== "object") return false;

    const mins = typeof date.minutes === "number" ? date.minutes : 0;
    if (mins < minMinutes || mins > maxMinutes) return false;

    const loc = typeof date.location === "string" ? date.location : "either";
    if (location !== "either" && loc !== "either" && loc !== location) return false;

    // Dimension filters
    if (typeof date.heat === "number") {
      if (heat !== null && date.heat !== heat) return false;
      if (date.heat > maxHeat || date.heat < minHeat) return false;
    }
    if (load !== null && date.load !== load) return false;
    if (style && date.style !== style) return false;

    return true;
  });

  return filtered.sort((a, b) => {
    const aCustom = !!a?.__custom;
    const bCustom = !!b?.__custom;
    if (aCustom !== bCustom) return aCustom ? -1 : 1;

    const at = (a?.title || "").toLowerCase();
    const bt = (b?.title || "").toLowerCase();
    return at.localeCompare(bt);
  });
}

export function surpriseMeDate(sourceData = null, filters = {}, topN = 5) {
  const matches = filterDates(sourceData, filters);
  const pool = matches.length > 0
    ? matches
    : Array.isArray(sourceData)
      ? sourceData.map(normalizeDate).filter(Boolean)
      : safeArray(datesData?.items).map(normalizeDate).filter(Boolean);

  if (!Array.isArray(pool) || pool.length === 0) return null;

  // ─── Context-aware scoring ──────────────────────────────────────
  const {
    recentIds = [],
    preferredLoad = null,
    preferredStyle = null,
    timeBucket,
  } = filters._context || {};

  const scored = pool.map((date) => {
    let score = Math.random() * 0.3; // Small random factor for variety

    // Penalize recently shown dates heavily
    if (recentIds.includes(date.id)) {
      score -= 2;
    }

    // Boost dates matching preferred dimensions
    if (preferredLoad !== null && date.load === preferredLoad) score += 0.5;
    if (preferredStyle && date.style === preferredStyle) score += 0.5;

    // Time-of-day awareness: boost calm dates at night, energizing in morning/afternoon
    if (timeBucket === 'night' || timeBucket === 'evening') {
      if (date.load === 1) score += 0.4;
      if (date.location === 'home') score += 0.2;
    } else if (timeBucket === 'morning' || timeBucket === 'afternoon') {
      if (date.load === 3) score += 0.4;
      if (date.location === 'out') score += 0.2;
    }

    return { date, score };
  });

  // Sort by score descending, then pick from top N
  scored.sort((a, b) => b.score - a.score);
  const n = Math.min(typeof topN === 'number' ? topN : 5, scored.length);
  const topCandidates = scored.slice(0, n);

  // Weighted random from top candidates (higher scores more likely)
  const minScore = Math.min(...topCandidates.map(c => c.score));
  const shifted = topCandidates.map(c => ({ ...c, w: c.score - minScore + 0.1 }));
  const totalW = shifted.reduce((s, c) => s + c.w, 0);
  let r = Math.random() * totalW;
  for (const c of shifted) {
    r -= c.w;
    if (r <= 0) return c.date;
  }

  return topCandidates[0]?.date || null;
}

export function getAvailableEnergy() {
  return {
    chill: "Low-key and relaxed",
    moderate: "Some effort, but easygoing",
    active: "Get up and go",
  };
}

export function getAvailableDepth() {
  return {
    light: "Fun and lighthearted",
    meaningful: "Thoughtful connection",
    deep: "Vulnerable and intimate",
  };
}

export function getAvailableCategories() {
  return (
    promptsData?.meta?.categories || {
      romance: "Sweet romantic connection",
      emotional: "Deep emotional intimacy",
      playful: "Light-hearted and fun",
      physical: "Touch and physical connection",
      fantasy: "Desires and imagination",
      memory: "Shared experiences and nostalgia",
      future: "Dreams and plans together",
      sensory: "Touch, taste, smell, sound, sight",
      visual: "Appearance and attraction",
      kinky: "BDSM and power dynamics",
      location: "Place-specific scenarios",
      seasonal: "Time and season-based",
    }
  );
}

export function getHeatLevels() {
  return (
    promptsData?.meta?.heatLevels || {
      1: { name: "Emotional Connection", description: "Emotional intimacy, non-sexual" },
      2: { name: "Flirty & Romantic", description: "Flirty attraction, romantic tension" },
      3: { name: "Sensual", description: "Sensual, relationship-focused intimacy" },
      4: { name: "Steamy", description: "Suggestive, adventurous, and heated" },
      5: { name: "Explicit", description: "Intensely passionate, graphic, explicit" },
    }
  );
}

export function getDimensionMeta() {
  return {
    // � Mood — What kind of date? (1-3)
    heat: [
      { level: 1, label: "Heart",  icon: "💜",  color: "#B07EFF", darkColor: "#1C1030" },
      { level: 2, label: "Play",   icon: "🎉",  color: "#FF7EB8", darkColor: "#2C1020" },
      { level: 3, label: "Heat",   icon: "🔥",  color: "#FF5A5A", darkColor: "#2C0808" },
    ],
    // ⚡ Energy — How much effort? (1-3)
    load: [
      { level: 1, label: "Chill",    icon: "🌙", color: "#4D7A50", darkColor: "#121E14" },
      { level: 2, label: "Moderate", icon: "☀️", color: "#B8863A", darkColor: "#1E160A" },
      { level: 3, label: "Active",   icon: "⚡", color: "#C05228", darkColor: "#1E0E06" },
    ],
    // 🤝 Style — How do you want to connect? (talking/doing/mixed)
    style: [
      { id: "talking", label: "Talking", icon: "💬", color: "#4A82B0", darkColor: "#0E1A24" },
      { id: "doing",   label: "Doing",   icon: "🎯", color: "#6B4E96", darkColor: "#14101E" },
      { id: "mixed",   label: "Mixed",   icon: "✨", color: "#A84468", darkColor: "#1E0C16" },
    ],
  };
}

// Legacy alias — some callers may still reference getMoodMeta
export function getMoodMeta() {
  const dims = getDimensionMeta();
  return [
    ...dims.load.map(l => ({ id: `load-${l.level}`, label: l.label, color: l.color })),
    ...dims.style.map(s => ({ id: `style-${s.id}`, label: s.label, color: s.color })),
  ];
}

export function getAllDates() {
  return safeArray(datesData?.items).map(normalizeDate).filter(Boolean);
}

export function getDateById(id) {
  const items = safeArray(datesData?.items).map(normalizeDate).filter(Boolean);
  return items.find((d) => d && d.id === id) || null;
}

export function getContentStats() {
  const promptsByHeat = {};
  const items = safeArray(promptsData?.items);

  items.forEach((prompt) => {
    if (prompt && typeof prompt === "object") {
      const heat = typeof prompt.heat === "number" ? prompt.heat : 1;
      promptsByHeat[heat] = (promptsByHeat[heat] || 0) + 1;
    }
  });

  return {
    totalPrompts: items.length,
    promptsByHeat,
    totalDates: safeArray(datesData?.items).length,
    lastUpdated: new Date().toLocaleDateString(),
    version: "5.0.0-emotional",
  };
}

/**
 * Get filtered prompts respecting a PreferenceEngine content profile.
 * This is the preference-aware replacement for getFilteredPrompts.
 */
export function getFilteredPromptsWithProfile(profile = null) {
  if (!profile) return getFilteredPrompts();

  const items = safeArray(promptsData?.items);

  // Apply hard filters from profile
  return items.filter((prompt) => {
    if (!prompt || typeof prompt !== "object") return false;
    if (typeof prompt.text !== "string" || !prompt.text.trim()) return false;

    const heat = typeof prompt.heat === "number" ? prompt.heat : 1;
    if (heat > (profile.maxHeat || 5)) return false;

    const category = typeof prompt.category === "string" ? prompt.category : "";
    if (profile.boundaries?.hiddenCategories?.includes(category)) return false;
    if (profile.boundaries?.pausedEntries?.includes(prompt.id)) return false;

    return true;
  });
}

/**
 * Dates filtered by profile preferences (season duration cap, paused dates)
 */
export function getFilteredDatesWithProfile(profile = null) {
  if (!profile) return getAllDates();

  const items = safeArray(datesData?.items).map(normalizeDate).filter(Boolean);

  return items.filter((date) => {
    if (profile.boundaries?.pausedDates?.includes(date.id)) return false;
    if (profile.season?.maxDuration && date.minutes > profile.season.maxDuration) return false;
    if (typeof profile.maxHeat === "number" && date.heat > profile.maxHeat) return false;
    return true;
  });
}

if (__DEV__) console.log("🔵 ContentLoader: All exports defined");

if (__DEV__) {
  console.log("🔍 ContentLoader: Development mode - monitoring ready");
}

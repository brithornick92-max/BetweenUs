// utils/contentLoader.js
// ✅ ULTRA SAFE VERSION - Cannot crash during module loading
// ✅ Guarantees prompt-returning functions always return an object with .text (never undefined)

console.log("🔵 ContentLoader: Module loading started");

// Initialize with empty safe defaults
let promptsData = { items: [], meta: {} };
let datesData = { items: [], meta: {} };

// Try to load data, but never crash
try {
  const loadedPrompts = require("../content/prompts.json");
  if (loadedPrompts && Array.isArray(loadedPrompts.items)) {
    promptsData = loadedPrompts;
    console.log("✅ ContentLoader: Loaded", promptsData.items.length, "prompts");
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
    console.log("✅ ContentLoader: Loaded", datesData.items.length, "dates");
  } else {
    console.warn("⚠️ ContentLoader: dates.json loaded but missing items[]");
  }
} catch (e) {
  console.error("❌ ContentLoader: Failed to load dates", e?.message || e);
}

console.log("🔵 ContentLoader: Module loading complete");

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
    const level = typeof heatLevel === "number" ? heatLevel : Number(heatLevel) || 1;
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
  const level = typeof heatLevel === "number" ? heatLevel : Number(heatLevel) || 1;
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

export function filterDates(sourceData = null, filters = {}) {
  const dataToFilter = Array.isArray(sourceData) ? sourceData : safeArray(datesData?.items);

  const {
    location = "either",
    moods = [],
    minMinutes = 0,
    maxMinutes = Infinity,
    excludeMoods = [],
  } = filters || {};

  const moodList = safeArray(moods);
  const excludeMoodList = safeArray(excludeMoods);

  const filtered = dataToFilter.filter((date) => {
    if (!date || typeof date !== "object") return false;

    const mins = typeof date.minutes === "number" ? date.minutes : 0;
    if (mins < minMinutes || mins > maxMinutes) return false;

    const loc = typeof date.location === "string" ? date.location : "either";
    if (location !== "either" && loc !== "either" && loc !== location) return false;

    if (moodList.length > 0) {
      const dateMoods = safeArray(date.moods);
      const hasMatch = moodList.some((mood) => dateMoods.includes(mood));
      if (!hasMatch) return false;
    }

    if (excludeMoodList.length > 0) {
      const dateMoods = safeArray(date.moods);
      const hasExcluded = excludeMoodList.some((mood) => dateMoods.includes(mood));
      if (hasExcluded) return false;
    }

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
  const pool =
    matches.length > 0 ? matches : Array.isArray(sourceData) ? sourceData : safeArray(datesData?.items);

  if (!Array.isArray(pool) || pool.length === 0) return null;

  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  const n = Math.min(typeof topN === "number" ? topN : 5, shuffled.length);

  return shuffled[Math.floor(Math.random() * n)] || null;
}

export function getAvailableMoods() {
  return (
    datesData?.meta?.moods || {
      romantic: "Sweet and loving connection",
      playful: "Fun and lighthearted activities",
      emotional: "Deep bonding and vulnerability",
      intimate: "Close physical and emotional connection",
      spicy: "Flirty and sensual experiences",
      adventurous: "Exciting and new experiences",
      calm: "Peaceful and relaxing activities",
    }
  );
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
      1: { name: "Heart Connection", description: "Pure emotional intimacy, non-sexual" },
      2: { name: "Spark & Attraction", description: "Flirty attraction, romantic tension" },
      3: { name: "Intimate Connection", description: "Moderately sexual, relationship-focused" },
      4: { name: "Adventurous Exploration", description: "Mostly sexual, kinky, adventurous" },
      5: { name: "Unrestrained Passion", description: "Highly sexual, graphic, intense" },
    }
  );
}

export function getMoodMeta() {
  return [
    { id: "romantic", label: "Romantic", color: "#D38CA3" },
    { id: "playful", label: "Playful", color: "#C9A86A" },
    { id: "emotional", label: "Emotional", color: "#9575CD" },
    { id: "intimate", label: "Intimate", color: "#B39DDB" },
    { id: "spicy", label: "Spicy", color: "#800020" },
    { id: "adventurous", label: "Adventurous", color: "#FF6B35" },
    { id: "calm", label: "Calm", color: "#81C784" },
  ];
}

export function getAllDates() {
  return safeArray(datesData?.items).filter(Boolean);
}

export function getDateById(id) {
  const items = safeArray(datesData?.items);
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
    version: "3.1.0-ultra-safe",
  };
}

console.log("🔵 ContentLoader: All exports defined");

if (__DEV__) {
  console.log("🔍 ContentLoader: Development mode - monitoring ready");
}

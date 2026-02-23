const dates = require("../content/dates.json");
const prompts = require("../content/prompts.json");

let totalIssues = 0;

// ===== DATES VALIDATION =====
console.log("=== DATES VALIDATION ===\n");

const dateItems = dates.items;
const validLocations = new Set(Object.keys(dates.meta.locations)); // home, out, either
const validStyles = new Set(["talking", "doing", "mixed"]);
const validHeat = [1, 2, 3, 4, 5];
const validLoad = [1, 2, 3];

const dateIssues = [];

dateItems.forEach((d, i) => {
  const ctx = `[${i}] id=${d.id} "${d.title}"`;

  // Missing required fields
  if (!d.id) dateIssues.push(`${ctx}: missing id`);
  if (!d.title) dateIssues.push(`${ctx}: missing title`);
  if (!d.minutes) dateIssues.push(`${ctx}: missing minutes`);
  if (!d.steps || d.steps.length === 0) dateIssues.push(`${ctx}: missing/empty steps`);

  // Location
  if (!d.location) {
    dateIssues.push(`${ctx}: missing location`);
  } else if (!validLocations.has(d.location)) {
    dateIssues.push(`${ctx}: invalid location "${d.location}" (valid: ${[...validLocations]})`);
  }

  // Style
  if (!d.style) {
    dateIssues.push(`${ctx}: missing style`);
  } else if (!validStyles.has(d.style)) {
    dateIssues.push(`${ctx}: invalid style "${d.style}" (valid: ${[...validStyles]})`);
  }

  // Heat
  if (d.heat === undefined || d.heat === null) {
    dateIssues.push(`${ctx}: missing heat`);
  } else if (!validHeat.includes(d.heat)) {
    dateIssues.push(`${ctx}: invalid heat ${d.heat} (valid: 1-5)`);
  }

  // Load
  if (d.load === undefined || d.load === null) {
    dateIssues.push(`${ctx}: missing load`);
  } else if (!validLoad.includes(d.load)) {
    dateIssues.push(`${ctx}: invalid load ${d.load} (valid: 1-3)`);
  }

  // Minutes sanity
  if (d.minutes && d.minutes < 10) {
    dateIssues.push(`${ctx}: suspiciously low minutes: ${d.minutes}`);
  }
  if (d.minutes && d.minutes > 480) {
    dateIssues.push(`${ctx}: suspiciously high minutes: ${d.minutes}`);
  }

  // Steps quality - check for placeholder/generic steps
  if (d.steps) {
    d.steps.forEach((step, si) => {
      if (!step || step.trim().length === 0) {
        dateIssues.push(`${ctx}: empty step at index ${si}`);
      }
      if (step && step.trim().length < 5) {
        dateIssues.push(`${ctx}: very short step "${step}" at index ${si}`);
      }
      const lower = (step || "").toLowerCase();
      if (lower.includes("lorem") || lower.includes("placeholder") || lower.includes("todo") || lower.includes("tbd") || lower.includes("xxx")) {
        dateIssues.push(`${ctx}: placeholder step "${step}" at index ${si}`);
      }
    });
  }

  // Title quality
  const titleLower = (d.title || "").toLowerCase();
  if (titleLower.includes("placeholder") || titleLower.includes("test") || titleLower.includes("todo") || titleLower.includes("tbd") || titleLower.includes("xxx") || titleLower.includes("lorem")) {
    dateIssues.push(`${ctx}: placeholder/test title`);
  }

  // Check for extra/unexpected fields
  const validDateFields = new Set(["id", "title", "minutes", "location", "steps", "heat", "load", "style"]);
  Object.keys(d).forEach(k => {
    if (!validDateFields.has(k)) {
      dateIssues.push(`${ctx}: unexpected field "${k}" = ${JSON.stringify(d[k])}`);
    }
  });
});

// Distribution report
const locDist = {};
const styleDist = {};
const heatDist = {};
const loadDist = {};
dateItems.forEach(d => {
  locDist[d.location] = (locDist[d.location] || 0) + 1;
  styleDist[d.style] = (styleDist[d.style] || 0) + 1;
  heatDist[d.heat] = (heatDist[d.heat] || 0) + 1;
  loadDist[d.load] = (loadDist[d.load] || 0) + 1;
});

console.log("Total dates:", dateItems.length);
console.log("Location distribution:", JSON.stringify(locDist));
console.log("Style distribution:", JSON.stringify(styleDist));
console.log("Heat distribution:", JSON.stringify(heatDist));
console.log("Load distribution:", JSON.stringify(loadDist));
console.log("\nDate issues:", dateIssues.length);
dateIssues.forEach(i => console.log("  -", i));
totalIssues += dateIssues.length;


// ===== PROMPTS VALIDATION =====
console.log("\n\n=== PROMPTS VALIDATION ===\n");

const promptItems = prompts.items;
const validCategories = new Set(Object.keys(prompts.meta.categories));
const validDurations = new Set(Object.keys(prompts.meta.relationshipDurations));
const validPromptHeat = [1, 2, 3, 4, 5];

const promptIssues = [];

promptItems.forEach((p, i) => {
  const ctx = `[${i}] id=${p.id} "${(p.text || "").substring(0, 60)}..."`;

  // Missing required fields
  if (!p.id) promptIssues.push(`${ctx}: missing id`);
  if (!p.text) promptIssues.push(`${ctx}: missing text`);

  // Category
  if (!p.category) {
    promptIssues.push(`${ctx}: missing category`);
  } else if (!validCategories.has(p.category)) {
    promptIssues.push(`${ctx}: invalid category "${p.category}" (valid: ${[...validCategories]})`);
  }

  // Heat
  if (p.heat === undefined || p.heat === null) {
    promptIssues.push(`${ctx}: missing heat`);
  } else if (!validPromptHeat.includes(p.heat)) {
    promptIssues.push(`${ctx}: invalid heat ${p.heat} (valid: 1-5)`);
  }

  // Relationship duration
  if (!p.relationshipDuration) {
    promptIssues.push(`${ctx}: missing relationshipDuration`);
  } else if (!Array.isArray(p.relationshipDuration)) {
    promptIssues.push(`${ctx}: relationshipDuration is not an array`);
  } else {
    p.relationshipDuration.forEach(rd => {
      if (!validDurations.has(rd)) {
        promptIssues.push(`${ctx}: invalid relationshipDuration "${rd}" (valid: ${[...validDurations]})`);
      }
    });
    if (p.relationshipDuration.length === 0) {
      promptIssues.push(`${ctx}: empty relationshipDuration array`);
    }
  }

  // Text quality
  const textLower = (p.text || "").toLowerCase();
  if (textLower.includes("placeholder") || textLower.includes("lorem") || textLower.includes("todo") || textLower.includes("tbd")) {
    promptIssues.push(`${ctx}: placeholder text`);
  }
  if (p.text && p.text.trim().length < 10) {
    promptIssues.push(`${ctx}: very short text (${p.text.trim().length} chars)`);
  }

  // Check for extra/unexpected fields
  const validPromptFields = new Set(["id", "text", "category", "heat", "relationshipDuration"]);
  Object.keys(p).forEach(k => {
    if (!validPromptFields.has(k)) {
      promptIssues.push(`${ctx}: unexpected field "${k}" = ${JSON.stringify(p[k])}`);
    }
  });
});

// Distribution report
const catDist = {};
const pHeatDist = {};
const durDist = {};
promptItems.forEach(p => {
  catDist[p.category] = (catDist[p.category] || 0) + 1;
  pHeatDist[p.heat] = (pHeatDist[p.heat] || 0) + 1;
  if (Array.isArray(p.relationshipDuration)) {
    p.relationshipDuration.forEach(rd => {
      durDist[rd] = (durDist[rd] || 0) + 1;
    });
  }
});

console.log("Total prompts:", promptItems.length);
console.log("Category distribution:", JSON.stringify(catDist, null, 2));
console.log("Heat distribution:", JSON.stringify(pHeatDist));
console.log("RelationshipDuration distribution:", JSON.stringify(durDist, null, 2));
console.log("\nPrompt issues:", promptIssues.length);
promptIssues.forEach(i => console.log("  -", i));
totalIssues += promptIssues.length;

console.log("\n\n=== TOTAL ISSUES:", totalIssues, "===");

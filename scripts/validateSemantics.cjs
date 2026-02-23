const dates = require("../content/dates.json");
const prompts = require("../content/prompts.json");

const dateItems = dates.items;
const promptItems = prompts.items;
const issues = [];

// ===== DATES: semantic checks =====
console.log("=== DATE SEMANTIC CHECKS ===\n");

const sexualKeywords = ["naked", "undress", "strip", "nude", "erotic", "sensual", "lingerie", "massage oil", "body paint", "skinny dip", "blindfold", "handcuff", "bondage", "orgasm", "climax", "foreplay", "seduc", "provocat", "explicit", "arousal", "intimate touch", "bare body", "bare skin", "oil each other", "oil on", "warm oil", "body massage"];
const romanticKeywords = ["candle", "love letter", "hand-hold", "hand hold", "cuddl", "slow dance", "sunset", "stargaz", "moonlight"];
const outdoorKeywords = ["hike", "trail", "park", "beach", "lake", "river", "mountain", "camping", "picnic outside", "rooftop", "garden", "outdoor", "farmer", "market", "museum", "restaurant", "cafe", "bar ", "concert", "theater", "zoo", "aquarium", "festival"];
const homeKeywords = ["living room", "bedroom", "kitchen", "couch", "sofa", "bathtub", "shower", "bed ", "pillow"];
const talkingKeywords = ["discuss", "share", "conversation", "talk about", "tell each other", "write letter", "read aloud", "reminisce"];
const doingKeywords = ["cook", "build", "create", "paint", "draw", "dance", "exercise", "play", "race", "climb", "swim"];

dateItems.forEach((d, i) => {
  const allText = [d.title, ...(d.steps || [])].join(" ").toLowerCase();
  const ctx = `DATE [${i}] id=${d.id} "${d.title}"`;

  // Heat too low for sexual content
  if (d.heat <= 2) {
    const foundSexual = sexualKeywords.filter(k => allText.includes(k));
    if (foundSexual.length > 0) {
      issues.push(`${ctx}: heat=${d.heat} but has sexual keywords: ${foundSexual.join(", ")}`);
    }
  }

  // Heat 1 (sweet) with romantic keywords might be fine, but check
  // Heat 4-5 without any sexual/sensual keywords might be wrong
  if (d.heat >= 4) {
    const foundSexual = sexualKeywords.filter(k => allText.includes(k));
    const foundRomantic = romanticKeywords.filter(k => allText.includes(k));
    if (foundSexual.length === 0 && foundRomantic.length === 0) {
      issues.push(`${ctx}: heat=${d.heat} but no sexual/romantic keywords found in content`);
    }
  }

  // Location: "home" but steps mention outdoor places
  if (d.location === "home") {
    const foundOutdoor = outdoorKeywords.filter(k => allText.includes(k));
    // Filter out false positives
    const realOutdoor = foundOutdoor.filter(k => {
      if (k === "park" && allText.includes("spark")) return false;
      if (k === "garden" && allText.includes("indoor garden")) return false;
      return true;
    });
    if (realOutdoor.length >= 2) {
      issues.push(`${ctx}: location=home but mentions outdoor places: ${realOutdoor.join(", ")}`);
    }
  }

  // Location: "out" but steps only mention home activities
  if (d.location === "out") {
    const foundHome = homeKeywords.filter(k => allText.includes(k));
    if (foundHome.length >= 2) {
      issues.push(`${ctx}: location=out but mentions home settings: ${foundHome.join(", ")}`);
    }
  }

  // Minutes: check for unreasonable values
  if (d.minutes < 45) {
    issues.push(`${ctx}: minutes=${d.minutes} is below meta minimum of 45`);
  }
});

console.log("Date semantic issues found:", issues.filter(i => i.startsWith("DATE")).length);
issues.filter(i => i.startsWith("DATE")).forEach(i => console.log("  -", i));


// ===== PROMPTS: semantic checks =====
console.log("\n\n=== PROMPT SEMANTIC CHECKS ===\n");

const sexualPromptWords = ["sex ", "sexual", "orgasm", "climax", "naked", "nude", "undress", "strip", "masturbat", "erotic", "foreplay", "moan", "arousal", "aroused", "turn you on", "turns you on", "turned on", "vibrator", "toy ", "toys", "bondage", "handcuff", "blindfold", "spank", "domina", "submissiv", "oral", "thrust", "penetrat", "ride you", "ride me", "make love", "body part", "genitals", "private part", "skinny dip", "intimate with", "intimacy"];
const flirtyWords = ["flirt", "kiss", "make out", "attract", "crush", "butterfl", "tease", "seduc", "lingerie", "date night", "romantic"];
const emotionalWords = ["feel ", "feeling", "emotion", "vulnerable", "afraid", "fear ", "trust", "safe", "hurt", "pain", "cry ", "crying", "anger", "forgiv", "sorry", "grateful", "appreciat", "insecur", "jealous", "anxious", "depress"];
const memoryWords = ["remember", "first time", "childhood", "when we", "our first", "favorite moment", "memory", "memories", "nostalg", "used to"];
const futureWords = ["future", "dream", "goal", "plan", "hope ", "hoping", "someday", "years from now", "imagine us", "envision", "retirement", "old together", "grow old"];
const playfulWords = ["game", "dare", "challenge", "silly", "funny", "laugh", "joke", "prank", "goofy", "would you rather", "truth or"];

promptItems.forEach((p, i) => {
  const text = (p.text || "").toLowerCase();
  const ctx = `PROMPT [${i}] id=${p.id} cat=${p.category} heat=${p.heat} "${(p.text || "").substring(0, 70)}..."`;

  // Heat 1 (heart connection / non-sexual) with sexual content
  if (p.heat <= 1) {
    const found = sexualPromptWords.filter(k => text.includes(k));
    if (found.length > 0) {
      issues.push(`${ctx}: heat=1 (non-sexual) but contains: ${found.join(", ")}`);
    }
  }

  // Heat 2 with explicit sexual content
  if (p.heat <= 2) {
    const explicitWords = ["orgasm", "climax", "masturbat", "vibrator", "oral", "thrust", "penetrat", "moan", "bondage", "handcuff", "spank", "domina", "submissiv", "make love", "ride you", "ride me"];
    const found = explicitWords.filter(k => text.includes(k));
    if (found.length > 0) {
      issues.push(`${ctx}: heat<=2 but has explicit content: ${found.join(", ")}`);
    }
  }

  // Category "emotional" but clearly about physical/sexual topics
  if (p.category === "emotional") {
    const found = sexualPromptWords.filter(k => text.includes(k));
    if (found.length >= 2) {
      issues.push(`${ctx}: category=emotional but has multiple sexual keywords: ${found.join(", ")}`);
    }
  }

  // Category "physical" for clearly emotional-only prompts
  if (p.category === "physical" && p.heat <= 2) {
    const foundEmotional = emotionalWords.filter(k => text.includes(k));
    const foundSexual = sexualPromptWords.filter(k => text.includes(k));
    if (foundEmotional.length >= 2 && foundSexual.length === 0) {
      issues.push(`${ctx}: category=physical heat<=2 but seems purely emotional: ${foundEmotional.join(", ")}`);
    }
  }

  // Category "memory" without any memory-related keywords
  if (p.category === "memory") {
    const found = memoryWords.filter(k => text.includes(k));
    if (found.length === 0) {
      issues.push(`${ctx}: category=memory but no memory keywords found`);
    }
  }

  // Category "future" without future keywords
  if (p.category === "future") {
    const found = futureWords.filter(k => text.includes(k));
    if (found.length === 0) {
      issues.push(`${ctx}: category=future but no future keywords found`);
    }
  }

  // Category "kinky" with low heat
  if (p.category === "kinky" && p.heat < 4) {
    issues.push(`${ctx}: category=kinky but heat=${p.heat} (expected 4-5)`);
  }

  // Heat 5 (unrestrained passion) in non-sexual categories
  if (p.heat === 5 && ["memory", "future", "seasonal"].includes(p.category)) {
    issues.push(`${ctx}: heat=5 in non-sexual category "${p.category}"`);
  }
});

const promptIssues = issues.filter(i => i.startsWith("PROMPT"));
console.log("Prompt semantic issues found:", promptIssues.length);
promptIssues.forEach(i => console.log("  -", i));

console.log("\n\n=== TOTAL SEMANTIC ISSUES:", issues.length, "===");

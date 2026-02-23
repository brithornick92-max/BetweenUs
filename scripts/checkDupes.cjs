const dates = require("../content/dates.json");
const prompts = require("../content/prompts.json");

function checkDupes(label, items, keyFns) {
  console.log(`\n=== ${label} ===`);
  console.log(`Total items: ${items.length}`);

  for (const { name, fn } of keyFns) {
    const map = {};
    const dupes = [];
    items.forEach((item, i) => {
      const key = fn(item);
      if (!key) return;
      if (map[key] !== undefined) {
        dupes.push({ key: key.substring(0, 100), indices: [map[key], i] });
      } else {
        map[key] = i;
      }
    });
    console.log(`\n${name} duplicates: ${dupes.length}`);
    dupes.forEach(d => console.log(`  - [${d.indices}] "${d.key}"`));
  }
}

// Dates
const dateItems = dates.items || dates.dates || (Array.isArray(dates) ? dates : []);
checkDupes("DATES.JSON", dateItems, [
  { name: "Title", fn: d => (d.title || "").trim().toLowerCase() },
  { name: "ID", fn: d => d.id ? String(d.id) : null },
  { name: "Description", fn: d => (d.description || "").trim().toLowerCase() },
]);

// Prompts
const promptItems = prompts.items || prompts.prompts || (Array.isArray(prompts) ? prompts : []);
checkDupes("PROMPTS.JSON", promptItems, [
  { name: "Text", fn: p => (p.text || p.prompt || p.question || "").trim().toLowerCase() },
  { name: "ID", fn: p => p.id ? String(p.id) : null },
]);

// Also check for near-dupes in dates (similar titles)
console.log("\n=== NEAR-DUPLICATE DATE TITLES (fuzzy) ===");
const titles = dateItems.map((d, i) => ({ title: (d.title || "").trim().toLowerCase(), i }));
const nearDupes = [];
for (let a = 0; a < titles.length; a++) {
  for (let b = a + 1; b < titles.length; b++) {
    const ta = titles[a].title;
    const tb = titles[b].title;
    if (!ta || !tb) continue;
    // Check if one contains the other or they share >80% of words
    const wordsA = new Set(ta.split(/\s+/));
    const wordsB = new Set(tb.split(/\s+/));
    const intersection = [...wordsA].filter(w => wordsB.has(w));
    const similarity = intersection.length / Math.min(wordsA.size, wordsB.size);
    if (similarity >= 0.8 && ta !== tb) {
      nearDupes.push({ a: titles[a], b: titles[b], similarity: similarity.toFixed(2) });
    }
  }
}
console.log(`Found: ${nearDupes.length}`);
nearDupes.forEach(d => console.log(`  - [${d.a.i}] "${d.a.title}" ~ [${d.b.i}] "${d.b.title}" (${d.similarity})`));

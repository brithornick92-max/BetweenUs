#!/usr/bin/env node

/**
 * Enriches Between Us date ideas with richer guided-experience fields.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS="$HOME/Downloads/brittany-apps-85f4245d2e76.json" \
 *   node scripts/enrichDatesWithGemini.js content/dates.json
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'brittany-apps';
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const INPUT_FILE = process.argv[2];

if (!INPUT_FILE) {
  console.error('Usage: node scripts/enrichDatesWithGemini.js <path-to-date-json>');
  process.exit(1);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Missing GOOGLE_APPLICATION_CREDENTIALS.');
  console.error('Run: export GOOGLE_APPLICATION_CREDENTIALS="$HOME/Downloads/brittany-apps-85f4245d2e76.json"');
  process.exit(1);
}

const absoluteInputPath = path.resolve(INPUT_FILE);
const outputPath = absoluteInputPath.replace(/\.json$/, `.enriched.json`);
const progressPath = absoluteInputPath.replace(/\.json$/, `.enrichment-progress.json`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function getItemsShape(data) {
  if (Array.isArray(data)) {
    return {
      items: data,
      setItems: (newItems) => newItems,
    };
  }

  if (data && Array.isArray(data.items)) {
    return {
      items: data.items,
      setItems: (newItems) => ({
        ...data,
        items: newItems,
      }),
    };
  }

  throw new Error('Expected JSON to be either an array or an object with an items array.');
}

function alreadyEnriched(item) {
  return Boolean(
    item &&
      item.vibe &&
      item.setup &&
      typeof item.description === 'string' &&
      item.description.trim().length > 0 &&
      Array.isArray(item.supplies) &&
      Array.isArray(item.guidedSteps) &&
      Array.isArray(item.conversationPrompts) &&
      item.connectionTwist &&
      item.ending
  );
}

function buildPrompt(batch) {
  return `
You are improving date-card content for "Between Us", a private couples app for thriving couples.

Rewrite each date into a richer guided experience.

Keep the original id exactly.
Do not change title, minutes, location, heat, load, style, releaseWeek, or original steps.
Return JSON only. No markdown.

For each item, add:
- vibe: one short sentence, romantic/playful/sensual depending on heat.
- setup: 2-4 sentences that make the date feel specific, doable, and emotionally inviting.
- description: 1 warm, polished App Store-quality sentence, 90-150 characters. Make it specific to the date, not generic.
- supplies: 3-6 practical items, no expensive requirements unless the original date requires it.
- guidedSteps: 5-7 specific steps that tell the couple exactly how to make the date feel good.
- conversationPrompts: exactly 3 prompts tailored to the date.
- connectionTwist: one small memorable ritual or twist.
- ending: one specific way to close the date.

Tone rules:
- Warm, tasteful, emotionally intimate.
- Grounded and specific, not overly poetic.
- Do not use phrases like "lasting memories of your love", "quiet promise", "cherish", "magical", "journey", "special moment", "your connection", "feeling connected", "beautiful fleeting light", or "genuine moments".
- Avoid repeating abstract relationship words. Prefer concrete actions, sensory details, and small choices.
- Write like a premium couples app with calm, specific guidance. The copy should feel useful, not decorative.
- Not therapy language.
- Not generic.
- Not cheesy.
- Keep it practical for real couples.
- If heat is 3, make it sensual but still consent-centered and App Store-safe.
- Avoid alcohol as a requirement. If the original has wine/champagne/cocktails, offer "or your favorite drink."
- Avoid unsafe or illegal suggestions.
- Avoid saying "post on social media" as a requirement. Make sharing optional or private.
- Do not introduce third-party apps unless needed.
- Do not mention premium, app UI, subscription, or unlock.

Return this exact shape:
{
  "items": [
    {
      "id": "same id",
      "vibe": "...",
      "setup": "...",
      "description": "...",
      "supplies": ["...", "..."],
      "guidedSteps": ["...", "..."],
      "conversationPrompts": ["...", "...", "..."],
      "connectionTwist": "...",
      "ending": "..."
    }
  ]
}

Input items:
${JSON.stringify(batch, null, 2)}
`.trim();
}

function getAccessToken() {
  return execFileSync('gcloud', ['auth', 'print-access-token'], {
    encoding: 'utf8',
  }).trim();
}

async function callGemini(batch) {
  const token = getAccessToken();

  const endpoint =
    `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/` +
    `${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: buildPrompt(batch) }],
      },
    ],
    generationConfig: {
      temperature: 0.72,
      topP: 0.95,
      maxOutputTokens: 16000,
      responseMimeType: 'application/json',
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Gemini request failed: ${response.status}\n${responseText}`);
  }

  const parsed = JSON.parse(responseText);
  const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error(`Gemini returned no text:\n${responseText}`);
  }

  const json = JSON.parse(text);

  if (Array.isArray(json)) {
    return json;
  }

  if (!json || !Array.isArray(json.items)) {
    throw new Error(`Gemini returned unexpected JSON:\n${text}`);
  }

  return json.items;
}

function validateEnrichment(originalBatch, enrichedBatch) {
  const originalIds = originalBatch.map((item) => item.id);
  const enrichedIds = enrichedBatch.map((item) => item.id);

  for (const id of originalIds) {
    if (!enrichedIds.includes(id)) {
      throw new Error(`Missing enriched item for id: ${id}`);
    }
  }

  for (const item of enrichedBatch) {
    if (!item.id) throw new Error('Enriched item missing id.');
    if (!item.vibe) throw new Error(`${item.id} missing vibe.`);
    if (!item.setup) throw new Error(`${item.id} missing setup.`);

    if (typeof item.description !== 'string' || item.description.trim().length < 40) {
      throw new Error(`${item.id} needs a description of at least 40 characters.`);
    }

    if (!Array.isArray(item.supplies) || item.supplies.length < 3) {
      throw new Error(`${item.id} needs at least 3 supplies.`);
    }

    if (!Array.isArray(item.guidedSteps) || item.guidedSteps.length < 5) {
      throw new Error(`${item.id} needs at least 5 guidedSteps.`);
    }

    if (!Array.isArray(item.conversationPrompts) || item.conversationPrompts.length !== 3) {
      throw new Error(`${item.id} needs exactly 3 conversationPrompts.`);
    }

    if (!item.connectionTwist) throw new Error(`${item.id} missing connectionTwist.`);
    if (!item.ending) throw new Error(`${item.id} missing ending.`);
  }
}

async function main() {
  const originalData = readJson(absoluteInputPath);
  const { items, setItems } = getItemsShape(originalData);

  let workingData = originalData;

  if (fs.existsSync(outputPath)) {
    console.log(`Continuing from existing output: ${outputPath}`);
    workingData = readJson(outputPath);
  }

  const { items: workingItems, setItems: setWorkingItems } = getItemsShape(workingData);
  const nextItems = [...workingItems];

  const batchSize = Number(process.env.BATCH_SIZE || 8);
  const maxItems = process.env.MAX_ITEMS ? Number(process.env.MAX_ITEMS) : nextItems.length;

  console.log(`Loaded ${items.length} original date items.`);
  console.log(`Working with ${nextItems.length} output date items.`);
  console.log(`Output path: ${outputPath}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Max items this run: ${maxItems}`);

  let processed = 0;

  for (let start = 0; start < nextItems.length && processed < maxItems; start += batchSize) {
    const batchIndexes = [];

    for (let i = start; i < Math.min(start + batchSize, nextItems.length); i += 1) {
      if (!alreadyEnriched(nextItems[i]) && processed + batchIndexes.length < maxItems) {
        batchIndexes.push(i);
      }
    }

    if (batchIndexes.length === 0) {
      continue;
    }

    const batch = batchIndexes.map((index) => nextItems[index]);

    console.log(`Enriching: ${batch.map((item) => item.id).join(', ')}`);

    let enrichedBatch;
    let attempt = 0;

    while (attempt < 3) {
      try {
        attempt += 1;
        enrichedBatch = await callGemini(batch);
        validateEnrichment(batch, enrichedBatch);
        break;
      } catch (error) {
        console.error(`Attempt ${attempt} failed for batch ${batch.map((item) => item.id).join(', ')}.`);
        console.error(error.message);

        if (attempt >= 3) {
          throw error;
        }

        await sleep(2500);
      }
    }

    const enrichedById = new Map(enrichedBatch.map((item) => [item.id, item]));

    for (const index of batchIndexes) {
      const originalItem = nextItems[index];
      const enrichment = enrichedById.get(originalItem.id);

      nextItems[index] = {
        ...originalItem,
        vibe: enrichment.vibe,
        setup: enrichment.setup,
        description: enrichment.description,
        supplies: enrichment.supplies,
        guidedSteps: enrichment.guidedSteps,
        conversationPrompts: enrichment.conversationPrompts,
        connectionTwist: enrichment.connectionTwist,
        ending: enrichment.ending,
      };
    }

    processed += batchIndexes.length;

    const nextData = setWorkingItems(nextItems);
    writeJson(outputPath, nextData);
    writeJson(progressPath, {
      outputPath,
      processedThisRun: processed,
      enrichedTotal: nextItems.filter(alreadyEnriched).length,
      total: nextItems.length,
      updatedAt: new Date().toISOString(),
    });

    console.log(`Saved progress. Enriched this run: ${processed}. Total enriched: ${nextItems.filter(alreadyEnriched).length}/${nextItems.length}`);

    await sleep(900);
  }

  console.log('Done.');
  console.log(`Review output: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

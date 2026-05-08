const promptsCatalog = require('../../content/prompts.json');
const todayPromptsCatalog = require('../../content/today-between-us-prompts.json');
const quizCatalog = require('../../content/quizQuestions.json');

const TOO_SIMILAR_THRESHOLD = 0.36;

const STOP_WORDS = new Set(
  'what is the a an and or of to in on for with by from about how does do did would could should if when where which who whose your you they them their theirs it its into most more less very one two three through while after before at as be being been has have had partner partners our us we me my mine i this that these those there here why because than then also each other together just really right now lately recently today s'
    .split(' ')
);

function normalizedWords(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\{partner\}/g, 'partner')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word));
}

function ngrams(words, size) {
  const grams = [];

  for (let index = 0; index <= words.length - size; index += 1) {
    grams.push(words.slice(index, index + size).join(' '));
  }

  return grams;
}

function jaccardSimilarity(leftSet, rightSet) {
  if (!leftSet.size && !rightSet.size) return 0;

  const [smallerSet, largerSet] = leftSet.size <= rightSet.size
    ? [leftSet, rightSet]
    : [rightSet, leftSet];
  let intersectionSize = 0;

  smallerSet.forEach((item) => {
    if (largerSet.has(item)) intersectionSize += 1;
  });

  const unionSize = leftSet.size + rightSet.size - intersectionSize;

  return unionSize ? intersectionSize / unionSize : 0;
}

function smallerSetOverlap(leftSet, rightSet) {
  const smallerSize = Math.min(leftSet.size, rightSet.size);
  if (!smallerSize) return 0;

  const [smallerSet, largerSet] = leftSet.size <= rightSet.size
    ? [leftSet, rightSet]
    : [rightSet, leftSet];
  let intersectionSize = 0;

  smallerSet.forEach((item) => {
    if (largerSet.has(item)) intersectionSize += 1;
  });

  return intersectionSize / smallerSize;
}

function withSimilarityFeatures(question) {
  const words = normalizedWords(question.text);

  return {
    ...question,
    wordSet: new Set(words),
    bigramSet: new Set(ngrams(words, 2)),
    trigramSet: new Set(ngrams(words, 3)),
  };
}

function similarityScore(left, right) {
  const wordScore = jaccardSimilarity(left.wordSet, right.wordSet);
  const wordOverlap = smallerSetOverlap(left.wordSet, right.wordSet);
  const bigramScore = jaccardSimilarity(left.bigramSet, right.bigramSet);
  const trigramScore = jaccardSimilarity(left.trigramSet, right.trigramSet);
  const sharedWordCount = [...left.wordSet].filter((word) => right.wordSet.has(word)).length;

  return Math.max(
    bigramScore,
    trigramScore,
    wordScore * 0.65,
    bigramScore > 0 ? wordOverlap * 0.45 : 0,
    sharedWordCount >= 3 && wordOverlap >= 0.6 ? wordOverlap * 0.42 : 0
  );
}

function questionItems() {
  return [
    ...(promptsCatalog.items || []).map((item) => ({
      catalog: 'prompts',
      id: item.id,
      text: item.text,
    })),
    ...(todayPromptsCatalog.items || []).map((item) => ({
      catalog: 'today-between-us',
      id: item.id,
      text: item.text,
    })),
    ...(quizCatalog.questions || []).map((item) => ({
      catalog: 'daily-quiz',
      id: item.id,
      text: item.text,
    })),
  ];
}

describe('question catalog similarity', () => {
  it('does not contain near-duplicate questions across prompt surfaces', () => {
    const questions = questionItems().map(withSimilarityFeatures);
    const tooSimilarPairs = [];

    for (let left = 0; left < questions.length; left += 1) {
      for (let right = left + 1; right < questions.length; right += 1) {
        const score = similarityScore(questions[left], questions[right]);

        if (score >= TOO_SIMILAR_THRESHOLD) {
          tooSimilarPairs.push([
            `${questions[left].catalog}:${questions[left].id}`,
            `${questions[right].catalog}:${questions[right].id}`,
            Number(score.toFixed(3)),
          ]);
        }
      }
    }

    expect(tooSimilarPairs).toEqual([]);
  });
});

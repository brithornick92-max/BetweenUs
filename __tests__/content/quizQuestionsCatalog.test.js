const quizCatalog = require('../../content/quizQuestions.json');
const { MINIMUM_QUESTION_REPEAT_DAYS } = require('../../utils/noRepeatContentRotation');

const STOP_WORDS = new Set(
  'what is the a an and or of to in on for with by from about how does do did would could should if when where which who whose your you they them their theirs it its into most more less very one two three through while after before at as be being been has have had partner partners'
    .split(' ')
);

function normalizedWords(text) {
  return String(text)
    .toLowerCase()
    .replace(/\{partner\}/g, 'partner')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word));
}

function normalizedBigrams(text) {
  const words = normalizedWords(text);
  const bigrams = [];

  for (let index = 0; index < words.length - 1; index += 1) {
    bigrams.push(`${words[index]} ${words[index + 1]}`);
  }

  return bigrams.length ? bigrams : words;
}

function jaccardSimilarity(left, right, normalizer) {
  const leftSet = new Set(normalizer(left));
  const rightSet = new Set(normalizer(right));
  const intersectionSize = [...leftSet].filter((item) => rightSet.has(item)).length;
  const unionSize = new Set([...leftSet, ...rightSet]).size;

  return unionSize ? intersectionSize / unionSize : 0;
}

describe('Daily Quiz question catalog', () => {
  const questions = quizCatalog.questions || [];

  it('contains one unique question for every day in the rotation', () => {
    const ids = new Set();
    const texts = new Set();

    expect(questions).toHaveLength(365);
    expect(questions.length).toBeGreaterThanOrEqual(MINIMUM_QUESTION_REPEAT_DAYS);

    questions.forEach((question, index) => {
      expect(question.id).toBe(`q${String(index + 1).padStart(3, '0')}`);
      expect(ids.has(question.id)).toBe(false);
      expect(texts.has(question.text)).toBe(false);

      ids.add(question.id);
      texts.add(question.text);
    });
  });

  it('is phrased for guessing about the partner', () => {
    questions.forEach((question) => {
      expect(question.text).toContain('{partner}');
      expect(question.text).not.toMatch(/\b(I|my|me)\b/i);
      expect(question.text.trim()).toBe(question.text);
    });
  });

  it('does not contain close duplicate prompts', () => {
    const nearDuplicates = [];

    for (let left = 0; left < questions.length; left += 1) {
      for (let right = left + 1; right < questions.length; right += 1) {
        const wordScore = jaccardSimilarity(
          questions[left].text,
          questions[right].text,
          normalizedWords
        );
        const bigramScore = jaccardSimilarity(
          questions[left].text,
          questions[right].text,
          normalizedBigrams
        );
        const score = Math.max(wordScore * 0.65, bigramScore);

        if (score >= 0.34) {
          nearDuplicates.push([
            questions[left].id,
            questions[right].id,
            Number(score.toFixed(2)),
          ]);
        }
      }
    }

    expect(nearDuplicates).toEqual([]);
  });
});

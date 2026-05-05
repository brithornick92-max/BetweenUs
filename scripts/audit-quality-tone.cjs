const promptsCatalog = require('../content/prompts.json');
const datesCatalog = require('../content/dates.json');
const positionsCatalog = require('../content/intimacy-positions.json');

const report = {
  prompts: { issues: [], review: [], stats: {} },
  dates: { issues: [], review: [], stats: {} },
  positions: { issues: [], review: [], stats: {} },
};

function textOf(item, fields) {
  return fields
    .flatMap((field) => {
      const value = item[field];
      if (Array.isArray(value)) return value;
      return value ? [value] : [];
    })
    .join('. ');
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] ?? 'missing';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function pushHits(bucket, severity, name, items, fields, regex, options = {}) {
  const hits = items.filter((item) => regex.test(textOf(item, fields)));
  if (hits.length) {
    bucket[severity].push({
      name,
      count: hits.length,
      sample: hits.slice(0, options.limit || 8).map((item) => ({
        id: item.id,
        title: item.title,
        text: item.text,
      })),
    });
  }
  return hits;
}

function findDuplicateValues(items, valueFn) {
  const seen = new Map();
  const dupes = [];
  items.forEach((item) => {
    const value = valueFn(item);
    if (!value) return;
    if (seen.has(value)) dupes.push([seen.get(value), item.id]);
    else seen.set(value, item.id);
  });
  return dupes;
}

function auditPrompts() {
  const items = promptsCatalog.items || [];
  report.prompts.stats = {
    total: items.length,
    heat: countBy(items, 'heat'),
    category: countBy(items, 'category'),
  };

  const ids = findDuplicateValues(items, (item) => item.id);
  const texts = findDuplicateValues(items, (item) => item.text?.trim().toLowerCase());
  if (ids.length) report.prompts.issues.push({ name: 'duplicate ids', count: ids.length, sample: ids });
  if (texts.length) report.prompts.issues.push({ name: 'duplicate prompt text', count: texts.length, sample: texts });

  pushHits(report.prompts, 'issues', 'low-heat explicit language', items.filter((p) => p.heat <= 2), ['text'], /\b(orgasm|climax|masturbat|vibrator|dildo|oral|penetrat|genitals?|porn|naked|nude)\b/i);
  pushHits(report.prompts, 'issues', 'gendered or anatomy-specific wording', items, ['text'], /\b(husband|wife|boyfriend|girlfriend|vagina|penis|clit|pussy|cock|dick|balls?|breasts?|boobs?)\b/i);
  pushHits(report.prompts, 'issues', 'coercive or non-consent wording', items, ['text'], /\b(nonconsensual|without consent|no consent|ignore (their|your) (no|boundary)|pressure (them|me)|force (them|me|you))\b/i);
  pushHits(report.prompts, 'issues', 'unfinished ellipsis endings', items, ['text'], /\.\.\.$/);
  pushHits(report.prompts, 'issues', 'missing final punctuation', items, ['text'], /[^.?!]$/);
  pushHits(report.prompts, 'issues', 'imperative prompts ending as questions', items, ['text'], /^(Tell me|Describe|Share|Walk me through)\b[^.?!]*\?$/i);
  pushHits(report.prompts, 'issues', 'slash or shorthand wording', items, ['text'], /\/|\bIRL\b/i);
  pushHits(report.prompts, 'issues', 'placeholder bracket prompts', items, ['text'], /\[[A-Z_]+\]/);
  pushHits(report.prompts, 'issues', 'cheesy or lightweight prompt wording', items, ['text'], /\b(melts?|adorable|cute|cringe|soulmate|destiny|magical|fairy tale|happily ever after|swoon|butterflies|sparkle|dreamy)\b/i);
  pushHits(report.prompts, 'issues', 'repetitive tell-me-more suffix', items, ['text'], /\??\s*Tell me more\.?$/i);
  pushHits(report.prompts, 'issues', 'closed ranking prompts', items, ['text'], /\b(rank our|which one was the best|best physical feature|three best qualities)\b/i);
  pushHits(report.prompts, 'issues', 'sexual euphemisms that should be direct', items, ['text'], /\b(make intimacy|physical intimacy|sexual intimacy|intimacy session|intimacy act|being intimate|intimate moments?|intimacy positions?|oral intimacy|intimate accessory|intimate accessories|intimate position|intensely passionate intimacy|morning with intimacy|being physical)\b/i);
  pushHits(report.prompts, 'review', 'stiff or clinical wording', items, ['text'], /\b(crucial|component|fulfilling|palpable|authentic self|unconsciously|absorbed|penetrative|initiate|passionately)\b/i);
  pushHits(report.prompts, 'review', 'yes/no openings', items, ['text'], /^(do|does|did|is|are|was|were|can|could|would|will|should|have|has|had)\b/i);
  pushHits(report.prompts, 'review', 'trivia-like relationship drift', items, ['text'], /\b(favorite president|actor and actress|public figure|basically good or basically bad|favorite teacher|favorite TV show|favorite toy growing up|imaginary friend)\b/i);
  pushHits(report.prompts, 'review', 'low-heat kink category', items.filter((p) => p.category === 'kinky' && p.heat < 4), ['text'], /./);
  pushHits(report.prompts, 'review', 'explicit heat in memory/future/seasonal category', items.filter((p) => p.heat === 5 && ['memory', 'future', 'seasonal'].includes(p.category)), ['text'], /./);
}

function auditDates() {
  const items = datesCatalog.items || [];
  report.dates.stats = {
    total: items.length,
    heat: countBy(items, 'heat'),
    load: countBy(items, 'load'),
    style: countBy(items, 'style'),
    category: countBy(items, 'category'),
  };

  const ids = findDuplicateValues(items, (item) => item.id);
  const titles = findDuplicateValues(items, (item) => item.title?.trim().toLowerCase());
  const steps = findDuplicateValues(items, (item) => JSON.stringify((item.steps || []).map((step) => step.trim().toLowerCase())));
  if (ids.length) report.dates.issues.push({ name: 'duplicate ids', count: ids.length, sample: ids });
  if (titles.length) report.dates.issues.push({ name: 'duplicate titles', count: titles.length, sample: titles });
  if (steps.length) report.dates.issues.push({ name: 'duplicate step sequences', count: steps.length, sample: steps });

  const dateFields = ['title', 'description', 'vibe', 'setup', 'connectionTwist', 'ending', 'steps', 'guidedSteps', 'conversationPrompts'];
  pushHits(report.dates, 'issues', 'placeholder copy', items, dateFields, /\b(lorem|placeholder|todo|tbd|xxx)\b/i);
  pushHits(report.dates, 'issues', 'gendered partner labels', items, dateFields, /\b(husband|wife|boyfriend|girlfriend|bride|groom)\b/i);
  pushHits(report.dates, 'issues', 'low-heat explicit sexual language', items.filter((d) => d.heat <= 2), dateFields, /\b(naked|undress|nude|erotic|lingerie|orgasm|climax|foreplay|arousal|bare body|bare skin|intimate touch|bondage|handcuff)\b/i);
  pushHits(report.dates, 'issues', 'awkward naturalness phrases', items, dateFields, /\b(soft, soft|personal perspective|personal beauty|personal setting|personal combinations|personal shells|personal catharsis|personal, personalized|favorite keepsake|real memory|real reminder|personal tale)\b/i);
  pushHits(report.dates, 'issues', 'duplicate adjacent words', items, dateFields, /\b(\w+)\s+\1\b/i);
  pushHits(report.dates, 'review', 'stiff editorial verbs', items, dateFields, /\b(utilize|facilitate|engage in|embark on|immerse yourselves|articulate|thereby|amidst|whilst)\b/i);
  pushHits(report.dates, 'review', 'generated setup framing', items, ['setup'], /\b(This date is about|This date invites|This date offers|The goal is|It's an opportunity|Prepare to|Step into|Transform your)\b/i);
  pushHits(report.dates, 'review', 'trust/sensory blindfold dates', items.filter((d) => d.heat <= 2), dateFields, /\bblindfold/i);
}

function auditPositions() {
  const items = positionsCatalog.items || [];
  report.positions.stats = {
    total: items.length,
    heat: countBy(items, 'heat'),
    category: countBy(items, 'category'),
    accessibility: countBy(items, 'accessibility'),
  };

  const ids = findDuplicateValues(items, (item) => item.id);
  const titles = findDuplicateValues(items, (item) => item.title?.trim().toLowerCase());
  if (ids.length) report.positions.issues.push({ name: 'duplicate ids', count: ids.length, sample: ids });
  if (titles.length) report.positions.issues.push({ name: 'duplicate titles', count: titles.length, sample: titles });

  const positionFields = ['title', 'commonName', 'focus', 'howTo', 'benefits', 'makeItHotter', 'comfort', 'whyPeopleLikeIt', 'shortSummary'];
  pushHits(report.positions, 'issues', 'old generated template phrases', items, positionFields, /\b(position adds variety|guided intimacy position|generic position card|people may like this because|comfort, connection, and shared rhythm)\b/i);
  pushHits(report.positions, 'issues', 'gendered or anatomy-specific wording', items, positionFields, /\b(husband|wife|boyfriend|girlfriend|vagina|penis|clit|pussy|cock|dick|balls?|breasts?|boobs?)\b/i);
  pushHits(report.positions, 'issues', 'coercive or non-consent wording', items, positionFields, /\b(nonconsensual|without consent|no consent|ignore (their|your) (no|boundary)|pressure (them|me)|force (them|me|you))\b/i);
  pushHits(report.positions, 'issues', 'high-risk impact or breath wording', items, positionFields, /\b(choke|strangle|breath play|blood|knife|hit|slap|spank)\b/i);
  pushHits(report.positions, 'issues', 'awkward position phrasing', items, positionFields, /\b(easy to stay inside|washed-in quality|ceremonial in its intimacy|body feels held by the setup)\b/i);
  pushHits(report.positions, 'issues', 'mechanical rewrite artifact', items, positionFields, /\b(The draw is it|The draw is the|What works is it|What works is the|This can feel good when it|when once|and because|very easy to adjust to small adjustments)\b/i);
  pushHits(report.positions, 'review', 'absolute comfort language', items, positionFields, /\b(always|never|guaranteed|everyone|anyone can)\b/i);
  pushHits(report.positions, 'review', 'repeated why-people-like template', items, ['whyPeopleLikeIt'], /\bMany people like it because\b/i);
}

auditPrompts();
auditDates();
auditPositions();

console.log(JSON.stringify(report, null, 2));

const totalIssues = Object.values(report).reduce((sum, section) => sum + section.issues.reduce((n, item) => n + item.count, 0), 0);
if (totalIssues > 0) process.exitCode = 1;

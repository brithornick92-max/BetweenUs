// utils/contentCurator.js
const groupByCategory = (items) =>
  items.reduce((acc, item) => {
    const key = item?.category || 'unknown';
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});

export function curateContent(content = []) {
  return Array.isArray(content) ? content : [];
}

export async function generateContentSequence(_userId, content = [], options = {}) {
  const list = Array.isArray(content) ? content : [];
  const length = Math.max(1, Math.min(options.length || list.length, list.length));
  if (!list.length) return [];

  const groups = groupByCategory(list);
  const categories = Object.keys(groups);
  const result = [];

  let idx = 0;
  while (result.length < length) {
    const cat = categories[idx % categories.length];
    const bucket = groups[cat];
    if (bucket && bucket.length) {
      result.push(bucket.shift());
    } else {
      const fallback = list.find((item) => !result.includes(item));
      if (fallback) result.push(fallback);
      else break;
    }
    idx += 1;
  }

  return result.slice(0, length);
}

export default { curateContent, generateContentSequence };

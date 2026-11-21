const KEY = 'ishara.translations.v1';
const DIRECT_KEYS = { 'bn-IN': 'bn', 'hi-IN': 'hi', 'en-IN': 'en' };

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
  } catch (error) {
    console.warn('Could not read saved translations:', error.message);
    return {};
  }
}

let cache = load();
const inFlight = new Map();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('Could not save translations:', error.message);
  }
}

export function reloadTranslations() {
  cache = load();
}

export function sourceOf(phrase) {
  if (phrase?.en) return { text: phrase.en, code: 'en-IN' };
  if (phrase?.bn) return { text: phrase.bn, code: 'bn-IN' };
  if (phrase?.hi) return { text: phrase.hi, code: 'hi-IN' };
  return null;
}

export function translatedText(phrase, code) {
  const direct = DIRECT_KEYS[code];
  if (direct && phrase?.[direct]) return phrase[direct];
  const source = sourceOf(phrase);
  if (!source) return '';
  return cache[`${code}|${source.text}`] ?? '';
}

async function translateOne(text, source, target) {
  const cacheKey = `${target}|${text}`;
  if (cache[cacheKey]) return cache[cacheKey];
  if (inFlight.has(cacheKey)) return inFlight.get(cacheKey);
  const request = fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, source, target }),
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Translation failed with ${response.status}`);
      const data = await response.json();
      cache[cacheKey] = data.text;
      persist();
      return data.text;
    })
    .finally(() => inFlight.delete(cacheKey));
  inFlight.set(cacheKey, request);
  return request;
}

export async function ensureTranslations(phrases, codes) {
  const jobs = [];
  for (const code of new Set(codes)) {
    for (const phrase of phrases) {
      if (translatedText(phrase, code)) continue;
      const source = sourceOf(phrase);
      if (source && source.code !== code) jobs.push([source.text, source.code, code]);
    }
  }
  let failed = 0;
  for (let i = 0; i < jobs.length; i += 4) {
    const results = await Promise.allSettled(jobs.slice(i, i + 4).map((job) => translateOne(...job)));
    failed += results.filter((r) => r.status === 'rejected').length;
  }
  if (failed) console.warn(`${failed} phrase translations failed; English is shown for those.`);
  return { total: jobs.length, failed };
}

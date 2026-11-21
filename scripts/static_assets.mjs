import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PHRASES } from '../src/lib/phrases.js';
import { LANGUAGES } from '../src/lib/languages.js';
import { DEFAULT_LISTENERS } from '../src/lib/settings.js';

const key = process.env.SARVAM_API_KEY;
if (!key) {
  console.error('Set SARVAM_API_KEY (for example with node --env-file=.env.local).');
  process.exit(1);
}

const headers = { 'api-subscription-key': key, 'Content-Type': 'application/json' };
const DIRECT = { 'bn-IN': 'bn', 'hi-IN': 'hi', 'en-IN': 'en' };
const packPhrases = ['public/packs/asl.json']
  .filter((file) => existsSync(file))
  .flatMap((file) => JSON.parse(readFileSync(file, 'utf8')).signs)
  .map(({ en, bn, hi }) => ({ en, bn, hi }));
const seen = new Set();
const phrases = [...Object.values(PHRASES), ...packPhrases].filter((p) => p.en && !seen.has(p.en) && seen.add(p.en));

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function translate(text, target) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await fetch('https://api.sarvam.ai/translate', {
      method: 'POST',
      headers,
      body: JSON.stringify({ input: text, source_language_code: 'en-IN', target_language_code: target, model: 'sarvam-translate:v1' }),
    });
    if (response.status === 429) {
      await wait(attempt * 3000);
      continue;
    }
    if (!response.ok) throw new Error(`translate ${target} failed with ${response.status}`);
    return (await response.json()).translated_text.trim();
  }
  throw new Error(`translate ${target} kept hitting the rate limit`);
}

async function speak(text, language, speaker) {
  const response = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers,
    body: JSON.stringify({ text, language_code: language, speaker, model: 'bulbul:v3', pace: 0.95, speech_sample_rate: 24000, output_audio_codec: 'mp3' }),
  });
  if (!response.ok) throw new Error(`voice ${language} failed with ${response.status}`);
  return Buffer.from((await response.json()).audios[0], 'base64');
}

const translations = {};
const targets = LANGUAGES.map((l) => l.code).filter((code) => !DIRECT[code]);
for (const target of targets) {
  const results = [];
  for (const p of phrases) {
    results.push([p.en, await translate(p.en, target)]);
    await wait(1100);
  }
  for (const [en, text] of results) translations[`${target}|${en}`] = text;
  console.log(`translated ${results.length} phrases to ${target}`);
}
writeFileSync('public/translations.json', JSON.stringify(translations, null, 1));

mkdirSync('public/voices', { recursive: true });
const manifest = {};
for (const listener of DEFAULT_LISTENERS) {
  const field = DIRECT[listener.lang];
  for (const phrase of phrases) {
    const text = phrase[field];
    const name = `${createHash('sha1').update(`${listener.lang}|${listener.speaker}|${text}`).digest('hex').slice(0, 16)}.mp3`;
    if (!existsSync(`public/voices/${name}`)) {
      writeFileSync(`public/voices/${name}`, await speak(text, listener.lang, listener.speaker));
    }
    manifest[`${listener.lang}|${listener.speaker}|${text}`] = name;
  }
  console.log(`voiced ${phrases.length} phrases in ${listener.lang} with ${listener.speaker}`);
}
writeFileSync('public/voices/manifest.json', JSON.stringify(manifest, null, 1));
console.log(`wrote ${Object.keys(translations).length} translations and ${Object.keys(manifest).length} voice files`);

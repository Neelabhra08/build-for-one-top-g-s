import { asset } from './paths.js';
import { directVoiceUrl, hasDirectKey } from './sarvamDirect.js';

const TTS_LANGUAGES = new Set([
  'bn-IN', 'en-IN', 'gu-IN', 'hi-IN', 'kn-IN', 'ml-IN', 'mr-IN', 'od-IN', 'pa-IN', 'ta-IN', 'te-IN',
]);

const audioCache = new Map();
let currentAudio = null;
let staticVoices = null;

function cacheKey(text, lang, speaker) {
  return `${lang}|${speaker ?? ''}|${text}`;
}

function loadStaticVoices() {
  if (!staticVoices) {
    staticVoices = fetch(asset('voices/manifest.json'))
      .then((response) => (response.ok ? response.json() : {}))
      .catch(() => ({}));
  }
  return staticVoices;
}

async function fetchVoice(text, lang, speaker) {
  const key = cacheKey(text, lang, speaker);
  if (audioCache.has(key)) return audioCache.get(key);
  const manifest = await loadStaticVoices();
  if (manifest[key]) {
    const url = asset(`voices/${manifest[key]}`);
    audioCache.set(key, url);
    return url;
  }
  if (hasDirectKey) {
    const url = await directVoiceUrl(text, lang, speaker);
    audioCache.set(key, url);
    return url;
  }
  const response = await fetch(asset('api/tts'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language: lang, speaker }),
  });
  if (!response.ok) {
    throw new Error(`Voice request failed with ${response.status}`);
  }
  const url = URL.createObjectURL(await response.blob());
  audioCache.set(key, url);
  return url;
}

function speakOnDevice(text, lang) {
  if (!('speechSynthesis' in window)) return false;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang?.replace('_', '-').startsWith(lang.slice(0, 2)));
  if (!voice && !TTS_LANGUAGES.has(lang)) return false;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  if (voice) utterance.voice = voice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

export function canSpeak(lang) {
  return TTS_LANGUAGES.has(lang);
}

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

export async function speak(text, lang, speaker) {
  stopSpeaking();
  if (!TTS_LANGUAGES.has(lang)) {
    return speakOnDevice(text, lang) ? 'device' : 'none';
  }
  try {
    const url = await fetchVoice(text, lang, speaker);
    currentAudio = new Audio(url);
    await currentAudio.play();
    return 'sarvam';
  } catch (error) {
    console.warn('Sarvam voice unavailable, using the device voice:', error.message);
    return speakOnDevice(text, lang) ? 'device' : 'none';
  }
}

export function prefetchVoices(texts, lang, speaker) {
  if (!TTS_LANGUAGES.has(lang)) return Promise.resolve([]);
  return Promise.allSettled(texts.map((text) => fetchVoice(text, lang, speaker)));
}

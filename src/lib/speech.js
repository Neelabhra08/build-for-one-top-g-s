const audioCache = new Map();
let currentAudio = null;

function cacheKey(text, lang) {
  return `${lang}|${text}`;
}

async function fetchVoice(text, lang) {
  const key = cacheKey(text, lang);
  if (audioCache.has(key)) return audioCache.get(key);
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language: lang }),
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
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang?.replace('_', '-').startsWith(lang.slice(0, 2)));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

export async function speak(text, lang) {
  stopSpeaking();
  try {
    const url = await fetchVoice(text, lang);
    currentAudio = new Audio(url);
    await currentAudio.play();
    return 'sarvam';
  } catch (error) {
    console.warn('Sarvam voice unavailable, using the device voice:', error.message);
    return speakOnDevice(text, lang) ? 'device' : 'none';
  }
}

export function prefetchVoices(texts, lang) {
  return Promise.allSettled(texts.map((text) => fetchVoice(text, lang)));
}

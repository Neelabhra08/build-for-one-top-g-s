const KEY = import.meta.env?.VITE_SARVAM_BROWSER_KEY ?? '';
const MAX_TEXT = 300;

export const hasDirectKey = KEY.length > 0;

async function post(path, body) {
  const response = await fetch(`https://api.sarvam.ai/${path}`, {
    method: 'POST',
    headers: { 'api-subscription-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Sarvam ${path} failed with ${response.status}`);
  return response.json();
}

export async function directVoiceUrl(text, language, speaker) {
  if (!text || text.length > MAX_TEXT) throw new Error('Text too long for voice');
  const data = await post('text-to-speech', {
    text,
    language_code: language,
    speaker: speaker || 'rupali',
    model: 'bulbul:v3',
    pace: 0.95,
    speech_sample_rate: 24000,
    output_audio_codec: 'mp3',
  });
  const audio = data.audios?.[0];
  if (!audio) throw new Error('Sarvam returned no audio');
  const bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
}

export async function directTranslate(text, source, target) {
  if (!text || text.length > MAX_TEXT) throw new Error('Text too long to translate');
  const data = await post('translate', {
    input: text,
    source_language_code: source,
    target_language_code: target,
    model: 'sarvam-translate:v1',
  });
  return String(data.translated_text ?? '').trim();
}

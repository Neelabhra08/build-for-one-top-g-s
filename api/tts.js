const SARVAM_URL = 'https://api.sarvam.ai/text-to-speech';
const MAX_TEXT = 300;

const LANGUAGES = new Set([
  'bn-IN', 'en-IN', 'gu-IN', 'hi-IN', 'kn-IN', 'ml-IN',
  'mr-IN', 'od-IN', 'pa-IN', 'ta-IN', 'te-IN',
]);

const SPEAKERS = new Set([
  'shubh', 'aditya', 'ritu', 'priya', 'neha', 'rahul', 'pooja', 'rohan',
  'simran', 'kavya', 'amit', 'dev', 'ishita', 'shreya', 'ratan', 'varun',
  'manan', 'sumit', 'roopa', 'kabir', 'aayan', 'ashutosh', 'advait', 'anand',
  'tanya', 'tarun', 'sunny', 'mani', 'gokul', 'vijay', 'shruti', 'suhani',
  'mohit', 'kavitha', 'rehan', 'soham', 'rupali',
]);

const DEFAULT_SPEAKER = 'rupali';

function send(res, status, body, headers = {}) {
  res.statusCode = status;
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload), { 'Content-Type': 'application/json' });
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function callSarvam(key, payload) {
  return fetch(SARVAM_URL, {
    method: 'POST',
    headers: { 'api-subscription-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Use POST' });
  }

  const key = process.env.SARVAM_API_KEY;
  if (!key) {
    return sendJson(res, 503, { error: 'Voice is not configured on this server' });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return sendJson(res, 400, { error: 'Body must be JSON' });
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const language = body.language;
  const speaker = SPEAKERS.has(body.speaker) ? body.speaker : DEFAULT_SPEAKER;

  if (!text || text.length > MAX_TEXT) {
    return sendJson(res, 400, { error: `Text must be 1 to ${MAX_TEXT} characters` });
  }
  if (!LANGUAGES.has(language)) {
    return sendJson(res, 400, { error: 'Unsupported language' });
  }

  const base = {
    text,
    speaker,
    model: 'bulbul:v3',
    pace: 0.95,
    speech_sample_rate: 24000,
    output_audio_codec: 'mp3',
  };

  let upstream = await callSarvam(key, { ...base, language_code: language });
  if (upstream.status === 422) {
    upstream = await callSarvam(key, { ...base, target_language_code: language });
  }

  if (!upstream.ok) {
    const detail = await upstream.text();
    console.error(`Sarvam TTS failed with ${upstream.status}: ${detail.slice(0, 300)}`);
    return sendJson(res, 502, { error: 'Voice service failed', status: upstream.status });
  }

  const data = await upstream.json();
  const audio = Array.isArray(data.audios) ? data.audios[0] : null;
  if (!audio) {
    console.error('Sarvam TTS returned no audio', data.request_id ?? '');
    return sendJson(res, 502, { error: 'Voice service returned no audio' });
  }

  return send(res, 200, Buffer.from(audio, 'base64'), {
    'Content-Type': 'audio/mpeg',
    'Cache-Control': 'public, max-age=86400',
  });
}

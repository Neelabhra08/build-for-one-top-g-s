const SARVAM_URL = 'https://api.sarvam.ai/translate';
const MAX_TEXT = 300;

const LANGUAGES = new Set([
  'bn-IN', 'en-IN', 'gu-IN', 'hi-IN', 'kn-IN', 'ml-IN', 'mr-IN',
  'od-IN', 'pa-IN', 'ta-IN', 'te-IN', 'ur-IN',
]);

function sendJson(res, status, payload, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Use POST' });

  const key = process.env.SARVAM_API_KEY;
  if (!key) return sendJson(res, 503, { error: 'Translation is not configured on this server' });

  let body;
  try {
    body = await readBody(req);
  } catch {
    return sendJson(res, 400, { error: 'Body must be JSON' });
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const { source, target } = body;
  if (!text || text.length > MAX_TEXT) return sendJson(res, 400, { error: `Text must be 1 to ${MAX_TEXT} characters` });
  if (!LANGUAGES.has(source) || !LANGUAGES.has(target)) return sendJson(res, 400, { error: 'Unsupported language' });
  if (source === target) return sendJson(res, 200, { text });

  const upstream = await fetch(SARVAM_URL, {
    method: 'POST',
    headers: { 'api-subscription-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: text,
      source_language_code: source,
      target_language_code: target,
      model: 'sarvam-translate:v1',
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text();
    console.error(`Sarvam translate failed with ${upstream.status}: ${detail.slice(0, 300)}`);
    return sendJson(res, 502, { error: 'Translation service failed', status: upstream.status });
  }

  const data = await upstream.json();
  if (typeof data.translated_text !== 'string' || !data.translated_text.trim()) {
    return sendJson(res, 502, { error: 'Translation service returned no text' });
  }
  return sendJson(res, 200, { text: data.translated_text.trim() }, { 'Cache-Control': 'public, max-age=86400' });
}

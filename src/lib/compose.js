const SENTENCE_END = { 'ur-IN': '۔', 'hi-IN': '।', 'bn-IN': '।', 'mr-IN': '।', 'pa-IN': '।', 'od-IN': '।' };

export function joinSentence(previous, text, lang) {
  const before = previous.trimEnd();
  if (!before) return text;
  const end = SENTENCE_END[lang] ?? '.';
  const closed = /[.?!।۔؟]$/.test(before) ? before : `${before}${end}`;
  return `${closed} ${text}`;
}

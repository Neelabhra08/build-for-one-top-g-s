import { translatedText } from './translations.js';

export const LISTENERS = [
  { id: 'family', label: 'Family', lang: 'bn-IN', key: 'bn', langLabel: 'বাংলা' },
  { id: 'attendant', label: 'Attendant', lang: 'hi-IN', key: 'hi', langLabel: 'हिन्दी' },
  { id: 'doctor', label: 'Doctor', lang: 'en-IN', key: 'en', langLabel: 'English' },
];

export const PHRASES = {
  water: { icon: 'drop', bn: 'আমার জল চাই', hi: 'मुझे पानी चाहिए', en: 'I need water' },
  washroom: { icon: 'door', bn: 'আমি বাথরুমে যাব', hi: 'मुझे बाथरूम जाना है', en: 'I need the washroom' },
  pain: { icon: 'bolt', bn: 'আমার ব্যথা করছে', hi: 'मुझे दर्द हो रहा है', en: 'I am in pain' },
  help: { icon: 'alert', bn: 'আমার এখনই সাহায্য চাই', hi: 'मुझे अभी मदद चाहिए', en: 'I need help now' },
  yes: { icon: 'check', bn: 'হ্যাঁ', hi: 'हाँ', en: 'Yes' },
  no: { icon: 'cross', bn: 'না', hi: 'नहीं', en: 'No' },
  wait: { icon: 'hand', bn: 'একটু অপেক্ষা করো', hi: 'थोड़ा रुकिए', en: 'Please wait' },
  thanks: { icon: 'heart', bn: 'ধন্যবাদ', hi: 'धन्यवाद', en: 'Thank you' },
};

export const GESTURE_PHRASES = {
  Pointing_Up: 'water',
  Victory: 'washroom',
  Closed_Fist: 'pain',
  Thumb_Up: 'yes',
  Thumb_Down: 'no',
  Open_Palm: 'wait',
  ILoveYou: 'thanks',
};

export const GESTURE_LABELS = {
  Pointing_Up: 'Point up',
  Victory: 'Two fingers (V)',
  Closed_Fist: 'Closed fist',
  Thumb_Up: 'Thumb up',
  Thumb_Down: 'Thumb down',
  Open_Palm: 'Open palm',
  ILoveYou: 'Thumb, index and little finger',
};

export const QUICK_TILES = ['water', 'washroom', 'pain', 'help'];

export const SIGN_ICONS = ['drop', 'door', 'bolt', 'alert', 'phone', 'pill', 'bed', 'heart', 'check', 'cross', 'hand'];

export function textFor(phrase, listener) {
  if (!phrase) return '';
  return translatedText(phrase, listener.lang) || phrase.en || phrase.bn || phrase.hi || '';
}

export function phraseText(phraseId, listener) {
  return textFor(PHRASES[phraseId], listener);
}

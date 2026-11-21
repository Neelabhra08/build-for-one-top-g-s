export const LANGUAGES = [
  { code: 'bn-IN', key: 'bn', label: 'বাংলা', name: 'Bengali', voice: true },
  { code: 'hi-IN', key: 'hi', label: 'हिन्दी', name: 'Hindi', voice: true },
  { code: 'en-IN', key: 'en', label: 'English', name: 'English', voice: true },
  { code: 'mr-IN', key: 'mr', label: 'मराठी', name: 'Marathi', voice: true },
  { code: 'te-IN', key: 'te', label: 'తెలుగు', name: 'Telugu', voice: true },
  { code: 'ta-IN', key: 'ta', label: 'தமிழ்', name: 'Tamil', voice: true },
  { code: 'gu-IN', key: 'gu', label: 'ગુજરાતી', name: 'Gujarati', voice: true },
  { code: 'kn-IN', key: 'kn', label: 'ಕನ್ನಡ', name: 'Kannada', voice: true },
  { code: 'od-IN', key: 'od', label: 'ଓଡ଼ିଆ', name: 'Odia', voice: true },
  { code: 'ml-IN', key: 'ml', label: 'മലയാളം', name: 'Malayalam', voice: true },
  { code: 'pa-IN', key: 'pa', label: 'ਪੰਜਾਬੀ', name: 'Punjabi', voice: true },
  { code: 'ur-IN', key: 'ur', label: 'اردو', name: 'Urdu', voice: false },
];

export const VOICES = [
  'rupali', 'shubh', 'aditya', 'ritu', 'priya', 'neha', 'rahul', 'pooja', 'rohan',
  'simran', 'kavya', 'amit', 'dev', 'ishita', 'shreya', 'ratan', 'varun', 'manan',
  'sumit', 'roopa', 'kabir', 'aayan', 'ashutosh', 'advait', 'anand', 'tanya', 'tarun',
  'sunny', 'mani', 'gokul', 'vijay', 'shruti', 'suhani', 'mohit', 'kavitha', 'rehan', 'soham',
];

export function languageOf(code) {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

export function voiceLabel(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

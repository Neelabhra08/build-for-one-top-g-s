# Ishara: sign it, it speaks

Ishara turns **one person's own hand signs** into speech and text, in the listener's language.
Built for the "Built for One" statement at Vibe Coders Hackathon Edition 3, Kolkata, 21 November 2026, by team Top G's.

There are more than 300 sign languages, regional variants of Indian Sign Language, and countless
home signs that only one family understands. General sign-to-text models know a fixed word list,
output English, and lose accuracy on a new signer. Ishara learns the signs of the person who uses it.

## What it does

| Feature | How |
|---|---|
| **Works from minute one** | 7 everyday gestures (thumb up, open palm, fist and more) from MediaPipe's gesture model |
| **Teach your own signs** | Record a sign for 3 seconds, type what it means; one or two hands; home signs, ISL or ASL |
| **Sign language switch** | Home signs, ISL and ASL sets, each with its own signs; export and import sign files |
| **Stays silent when unsure** | A sign must be held about a second; a "resting hands" class and per-sign thresholds stop false alarms |
| **Speaks in the listener's language** | 12 languages per listener (Bengali, Hindi, English, Marathi, Telugu, Tamil, Gujarati, Kannada, Odia, Malayalam, Punjabi; Urdu as text), 37 Sarvam Bulbul voices |
| **Auto-translation** | Phrases are translated once by Sarvam and cached on the device |
| **Desktop widget** | A floating bubble that types the signed phrase into whatever app has the cursor (Windows) |
| **Private by design** | The camera and hand matching stay on the device; only short phrase text goes to Sarvam |

## Run it

Requirements: Node 24, npm 11, a webcam, and a Sarvam API key (dashboard.sarvam.ai).

```bash
npm install
```

Put the key in `.env.local` (git-ignored):

```bash
SARVAM_API_KEY=your-key-here
```

Start the web app at http://localhost:5173:

```bash
npm run dev
```

Start the desktop widget (Windows, while the web app is running). Press Ctrl + Shift + Space after a sign to type it into the focused app:

```bash
npm run desktop
```

Run the tests:

```bash
npm test
```

## How it works

```
Camera → MediaPipe hand points (on device) → normalized features (position, size and camera shape removed)
       → your signs (nearest match) → resting hands? stay silent → built-in gestures
       → held 1 second → phrase in the listener's language → Sarvam Bulbul voice, or typed into the app
```

- `src/lib/handFeatures.js`: turns 21 points per hand into features that ignore where the hand is, how big it looks and the camera's shape.
- `src/lib/personalClassifier.js`: nearest-match classifier with per-sign thresholds, a resting class and lookalike warnings.
- `src/lib/holdDetector.js`: speaks only when a sign is held, with a cooldown.
- `api/tts.js`, `api/translate.js`: server routes that keep the Sarvam key off the device.
- `desktop/`: the Electron widget (always on top, never takes focus, pastes into the focused app and restores the clipboard).
- `scripts/asl_pack.py`: builds an ASL starter pack from Google's Kaggle ASL landmark data with the same feature maths (checked for an exact match).

## Limits, honestly

- Signs are matched on hand shape. Signs that differ only by movement or by where they are made can be confused.
- Starter packs recorded by other signers work less well than signs taught by the person who uses Ishara.
- Not a medical device, and not a replacement for interpreters or emergency services. For a medical emergency, call 112.

## Credits

- Hand tracking: MediaPipe Gesture Recognizer (Google, Apache 2.0).
- Voices and translation: Sarvam AI (Bulbul v3, sarvam-translate).
- ASL starter data (when included): Google Isolated Sign Language Recognition on Kaggle, built on PopSign by Georgia Tech, NTID at RIT and Deaf Professional Arts Network.

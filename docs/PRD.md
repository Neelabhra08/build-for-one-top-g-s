# Ishara: Product Requirements Document

**Tagline:** Sign it. It speaks.

| Field | Value |
|---|---|
| Product | Ishara (ইশারা / इशारा, "a gesture" in Bengali and Hindi) |
| Team | Top G's |
| Event | Vibe Coders Hackathon Edition 3, Kolkata, 21 November 2026 |
| Problem statement | Built for One |
| Status | Draft 1, written at the start of the build |
| Last updated | 2026-11-21 |

---

## 1. Summary

Dictation widgets changed how people write: hold a key, speak, and polished text appears in whatever app is open. Ishara does the same for people who cannot speak. They hold up a sign, and Ishara **speaks it aloud** or **types it into a chat**, in the **listener's language**.

It starts with **one person** and the signs they already use. Those can be their own home gestures, or formal Indian Sign Language (ISL) or American Sign Language (ASL) words added later as plug-in "sign packs". Their family teaches Ishara those signs in a few minutes. After that the person uses it alone, on the phone they already own, even without internet.

---

## 2. The problem

### 2.1 The one person we build for

> Filled in by the team (shown in the demo video, not stored in this repository):
>
> - **Who:** [relationship, age]
> - **Why they cannot speak:** [for example stroke, throat surgery, born Deaf]
> - **Can they hear?** [yes or no]
> - **What signs they use:** [home gestures, formal ISL, pointing]
> - **Hands:** [one or both]
> - **Phone:** [model and rough price]
> - **Languages around them:** [for example Bengali with family, Hindi with the attendant, English with the doctor]
> - **What they struggle to say every week:** [for example "I am in pain", "I need the washroom", "Call my son"]

### 2.2 Why existing tools fail this person

| Existing option | Why it fails them |
|---|---|
| Picture boards you tap to speak (augmentative and alternative communication, or AAC, apps such as Jellow or Avaz) | You have to unlock the phone, open the app and find the right picture. That is slow when you are in pain, and hard with a shaky hand. |
| Facial gesture apps (Google Project Activate) | Face gestures only. It launched in four countries, and its voices are the phone's default English voices. |
| ISL and ASL recognition models | They know a fixed list of words (263 ISL words, 250 ASL signs), they **output English**, and their accuracy drops sharply on a new signer or camera. They know nothing about home signs. |
| A human interpreter | The gold standard, but not available at 2 am when the attendant does not understand. |
| Family members guessing | It works only while someone patient who knows the person is in the room. |

**The core insight:** there are more than 300 sign languages in the world, ISL varies by region, and many people who cannot speak use **home signs** that only their family understands. A universal sign translator cannot serve them. **A translator that learns one person can.**

---

## 3. Product principles

1. **Built for one first.** Every decision is tested against the one person. Scale comes from that person's family teaching the app, not from a bigger model.
2. **Works alone.** Once set up, the person uses Ishara without anyone standing next to them.
3. **Private by default.** Camera frames never leave the phone. Only short phrase text goes to the cloud, during setup.
4. **Offline when it matters.** Every saved phrase plays from the phone with no internet.
5. **Honest about confidence.** When Ishara is not sure, it asks ("Water or Washroom?") instead of guessing aloud.
6. **Indian languages first.** Bengali, Hindi and nine more Indian languages for voice; the person's family language is the default, not English.

---

## 4. Users

| User | Role | What they need |
|---|---|---|
| **The signer** (primary) | Makes signs, hears the result | Big feedback, no reading needed, no tapping in an emergency, a way to cancel a mistake |
| **The family teacher** | Sets up signs and phrases once, updates them later | Teach a sign in under 30 seconds, type phrases in their own language, test it |
| **The listener** (attendant, nurse, shopkeeper, doctor) | Hears or reads the message | The message in *their* language, loud and clear, and a way to reply |
| **Future: Deaf ISL signers** | Use formal ISL in shops, banks, clinics | ISL word packs, sentences in Indian languages |

### User stories

- As the signer, I hold up my "water" sign for one second and the phone says "আমার জল চাই" loudly, so the attendant brings water.
- As the signer, when Ishara picks the wrong phrase, I wave it away (or tap a big "No") and it does not repeat.
- As the signer, I sign "pain" and then "head", and Ishara says "আমার মাথায় ব্যথা করছে" (my head hurts) as one sentence.
- As the family teacher, I tap "Teach a sign", the signer repeats the gesture 10 times, I type "I need the washroom", and it is ready.
- As the family teacher, I type a phrase in Bengali and Ishara fills in Hindi and English, which I check before saving.
- As the attendant who speaks Hindi, I tap "Hindi" once and every sign is spoken to me in Hindi.
- As a deaf signer, when the attendant replies out loud, I see their words as big captions.
- As the signer, I sign my message and Ishara types it into WhatsApp to my son.

---

## 5. The product

### 5.1 The Ishara bubble

The heart of Ishara is a small floating **bubble** with a live camera view, modelled on dictation widgets:

```
 Hold to sign  →  sign recognized  →  sentence polished  →  spoken and/or typed
 (or always on)    (on the phone)       (listener's language)  (instant, offline)
```

Three output modes, switched with one tap:

| Mode | What happens | Example |
|---|---|---|
| **Speak** | The phone speaks the phrase out loud | At home, in a hospital bed |
| **Type** | The phrase goes into a chat app through the share menu | Message to family on WhatsApp |
| **Show** | Big text on screen, turned toward the listener | Noisy shop, or a deaf listener |

Two trigger modes:

- **Always on:** the camera watches; a sign held steady for about one second triggers. Best for someone who cannot tap.
- **Hold to sign:** press and hold the bubble, sign, release. Best on the move, avoids false triggers.

### 5.2 Sign packs (the recognition engine)

Recognition is split into packs, so the same product serves one person today and many signers tomorrow.

| Pack | What it recognizes | Where it runs | Priority |
|---|---|---|---|
| **Everyday Gestures** | 7 built-in gestures: thumb up, thumb down, open palm, closed fist, pointing up, victory, "I love you" | Phone (MediaPipe Gesture Recognizer) | P0, works from minute one |
| **My Signs** | The signer's own gestures, taught by the family, 10 examples each | Phone (nearest match on hand points) | P0, the core |
| **ISL Words** | Up to 263 common ISL words | Server (AI4Bharat OpenHands, Apache 2.0); the phone sends **only hand and body points, never video** | P2 |
| **ASL Words** | Up to 250 common ASL signs | Phone or server (models from Google's isolated sign recognition competition) | P2 |

A **pack router** asks every active pack for its best match and confidence:

- **High confidence:** speak at once.
- **Two close matches:** show both as giant tiles ("Water / Washroom") and let the signer pick with a tap or a thumb up.
- **No match:** do nothing. Silence is better than a wrong sentence.

### 5.3 The language engine

| Step | What it does | How |
|---|---|---|
| **Smart Polish** | Turns a sequence of signs into a natural sentence. ISL and home signs are not word-for-word English: "PAIN HEAD" becomes "My head hurts". | Sarvam 105B with a short prompt and the phrase list, only when two or more signs are joined |
| **Listener languages** | One sign, spoken in the listener's language. Chips: "Family (Bengali)", "Attendant (Hindi)", "Doctor (English)". | Phrases stored per language; Sarvam translate fills gaps; the family approves each translation |
| **Voice** | Natural Indian voices in 11 languages, matched to the signer's age and gender | Sarvam Bulbul v3, generated once at setup and cached on the phone |
| **Reply captions** | The listener's spoken reply becomes big text for a deaf signer | Sarvam Saaras v4 speech to text, 22 Indian languages plus English |
| **Own voice** (P2) | Speak in the signer's own voice from old recordings, only with their consent | Sarvam Instant Voice Cloning (beta) |

---

## 6. Innovative features

| # | Feature | Why it matters | Priority |
|---|---|---|---|
| 1 | **Teach by showing:** 10 repeats and a typed phrase make a new sign | Home signs become first-class language | P0 |
| 2 | **Listener chips:** one sign, three languages | Kolkata homes mix Bengali, Hindi and English | P1 |
| 3 | **"Did you mean?" tiles** instead of wrong guesses | Trust: one wrong "I am fine" can be dangerous | P1 |
| 4 | **Smart Polish:** signs joined into one sentence | Sign grammar to spoken grammar, the job a dictation tool does for speech | P1 |
| 5 | **Learns from corrections:** every "No, I meant X" becomes a new training example | Gets better every day for this one person | P1 |
| 6 | **Rest pose class:** the family records scratching, resting and waving as "nothing" | Stops false alarms at night | P0 |
| 7 | **Help sign:** one sign held for 3 seconds speaks loudly and repeats, and offers to share a message and location with family | Fast help at 2 am. Not a replacement for emergency services. | P1 |
| 8 | **Setup from a WhatsApp video:** family records the signer at home and uploads the clip; Ishara extracts the examples | The person does not need to come to the setup | P2 |
| 9 | **Predictive tiles:** likely phrases by time of day ("Medicine" at 8 pm) | Fewer signs needed | P2 |
| 10 | **Own voice banking** from old recordings | Dignity: "it sounds like me" | P2 |
| 11 | **Android keyboard and overlay:** sign straight into any text box in any app | The true dictation widget experience | P2, needs a native app |
| 12 | **Motion signs:** signs with movement, compared as short sequences | Many real signs move | P2 |

---

## 7. Screens

| Screen | Purpose | Design rules |
|---|---|---|
| **Use** | Camera bubble, the recognized phrase in huge text with an icon, listener chips, a big "No" | No reading needed to use; icons plus text; high contrast; one-hand reach; screen stays awake |
| **Teach a sign** | Record 10 examples, type the phrase, pick an icon, preview the voice | A countdown and a progress ring; tells the teacher if the hand is out of frame |
| **My signs** | List of signs with their phrases and accuracy | Re-record, delete, test each sign |
| **Listen** | Reply captions | Text as large as the screen allows |
| **Settings** | Languages, voice, trigger mode, sensitivity | Family only, behind a long press |

Text uses Noto Sans Bengali and Noto Sans Devanagari so Indian scripts render on low-cost phones.

---

## 8. Technical design

### 8.1 Today (web app)

| Part | Choice | Notes |
|---|---|---|
| App | Vite and React, installable to the home screen | Static site; works on a low-cost Android phone in Chrome |
| Hosting | Vercel, public link with no sign-in | Secrets only in Vercel environment variables |
| Hand tracking | MediaPipe Gesture Recognizer (`gesture_recognizer.task`, float16 version 1, 8.4 MB) with `@mediapipe/tasks-vision` pinned to 1.2.2 | The model file is served from our own site so it caches on the phone |
| My Signs classifier | k-nearest neighbours on normalized hand points (relative to the wrist, scaled by hand size, left hand mirrored), plus a distance threshold and the rest class | Instant training on the phone, no server |
| Smoothing | Speak only when about 12 of the last 15 frames agree, then a 2 second pause | Stops flicker and double speech |
| Storage | IndexedDB on the phone: examples, phrases, cached audio | Nothing personal on a server |
| Server functions | `/api/tts` (Bulbul v3), later `/api/polish` (Sarvam 105B), `/api/translate`, `/api/stt` (Saaras v4) | Each keeps the Sarvam key on the server |
| Output | Web Speech fallback if offline and not cached; Web Share to send text into WhatsApp | |

### 8.2 Data flow and privacy

```
Camera → hand points (on phone) → sign pack match (on phone) → phrase id
  → cached audio plays (on phone)                      [no network]
  → optional: phrase text → Smart Polish / translate   [text only, to Sarvam]
```

- Video frames are never uploaded.
- The ISL Words pack (later) sends only about 75 points per frame, never images.
- Phrases are stored on the phone. A family can export them to move phones.

### 8.3 Performance targets

| Metric | Target |
|---|---|
| Hand tracking speed on a low-cost Android phone | 15 frames a second or more (lower camera resolution if needed) |
| Sign to sound, cached phrase | Under 1.5 seconds, including the 1 second hold |
| Sign to sound, polished sentence | Under 3 seconds |
| App load on 4G after first visit | Under 3 seconds (model cached) |

### 8.4 Running cost

Bulbul v3 costs Rs 3 per 1,000 characters. Twenty phrases of 30 characters in two languages is 1,200 characters: about **Rs 4 for a whole setup**. Daily use from cached audio costs nothing. Smart Polish and captions cost paise per use.

---

## 9. Success metrics and acceptance tests

| Test | Pass mark |
|---|---|
| Each My Signs gesture, 10 tries by the signer | 9 of 10 or better |
| Idle for 5 minutes with normal hand movement | No false phrase spoken |
| Teach a new sign | Under 60 seconds from tap to working |
| Works with phone in airplane mode | All cached phrases still speak |
| Listener chip switch | Same sign spoken in Bengali, then Hindi |
| The signer uses it alone | Completes three real requests with no help (filmed for the demo) |

We publish our own test table in the README, including failures.

---

## 10. Safety, privacy and ethics

- **Not a medical device.** Ishara helps communication; it does not diagnose and does not replace emergency services.
- **Sign languages are languages.** Ishara does not claim to translate ISL or ASL in general, and it does not replace human interpreters. The ISL and ASL packs are labelled with their word lists and limits.
- **Consent.** The signer agrees to be filmed for setup. Voice cloning only with explicit consent and the signer's own recordings.
- **Wrong messages are harmful.** That is why we have the rest class, "Did you mean?" tiles, the cancel button and a confidence threshold.
- **No personal data in this repository.** The person's name appears only in the demo video, with their permission.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Low-cost phone too slow | Lower resolution, run tracking on every second frame, GPU delegate |
| Poor light at night | Teach signs in the real room and light; show a "move into light" hint |
| Similar signs confused | Teaching screen warns when two signs are too close; "Did you mean?" tiles |
| Signer's movement changes (for example during stroke recovery) | Re-record in one tap; learn from corrections |
| Venue Wi-Fi fails during the demo | Cached audio, model cached on the phone, backup video |
| ISL and ASL packs take too long to build | They are P2; the product is complete without them |

---

## 12. Scope for today

| Time | Deliverable |
|---|---|
| By 12:15 | Camera bubble, hand points, Everyday Gestures shown as big text |
| By 12:45 | Phrase spoken in Bengali through `/api/tts` |
| **By 1:00 pm** | **Live public link**, opened on a real Android phone |
| 1:30 to 2:45 | My Signs: teach screen, nearest match, rest class, smoothing |
| 2:45 to 3:45 | Listener chips, "Did you mean?" tiles, cached audio offline, reply captions if the signer is deaf |
| **3:45 pm** | **Feature freeze** |
| 4:00 to 4:30 | 280-character summary, demo video on the signer's kind of phone |
| **4:45 pm** | Last push |

Out of scope today: ISL Words pack, ASL Words pack, Android keyboard and overlay, voice cloning, motion signs, setup from video.

---

## 13. Roadmap after the hackathon

1. **ISL Words pack** on a small server with AI4Bharat OpenHands, receiving points only.
2. **Android app** with a sign keyboard and a floating bubble that types into any app.
3. **Motion signs** with short sequence matching.
4. **Clinic mode:** a shared tablet at a hospital ward with a nurse's language preset.
5. **ASL Words pack** for travellers and international Deaf users.

---

## 14. Open questions

1. Who exactly is the signer, and which signs do they already use?
2. Can they hear the phone speak (are captions needed)?
3. One hand or two?
4. Which phone, and how good is its front camera in their room at night?
5. Which listeners and languages matter most every week?

"""Build an Ishara ASL starter pack from Google's Kaggle "asl-signs" landmark data.

Reads Kaggle credentials from ~/.kaggle/kaggle.json (never printed), downloads the
index and a small number of recordings per chosen sign, converts hand landmarks
with the same maths as src/lib/handFeatures.js, and writes an ishara-pack JSON.

Usage:
  python scripts/asl_pack.py --out packs-local/asl.json --per-sign 25
  python scripts/asl_pack.py --features-only fixture.json   (parity check helper)
"""

import argparse
import base64
import io
import json
import math
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

COMPETITION = "asl-signs"
API = "https://www.kaggle.com/api/v1/competitions/data/download"
POINTS = 21
HAND_SIZE = 1 + POINTS * 3
PAIR_OFFSET = HAND_SIZE * 2
FEATURE_LENGTH = PAIR_OFFSET + 2
DEPTH_WEIGHT = 0.5
PORTRAIT_ASPECT = 3 / 4

SIGNS = {
    "water": {"en": "I need water", "bn": "আমার জল চাই", "hi": "मुझे पानी चाहिए", "icon": "drop"},
    "hungry": {"en": "I am hungry", "bn": "আমার খিদে পেয়েছে", "hi": "मुझे भूख लगी है", "icon": "heart"},
    "potty": {"en": "I need the washroom", "bn": "আমি বাথরুমে যাব", "hi": "मुझे बाथरूम जाना है", "icon": "door"},
    "owie": {"en": "I am in pain", "bn": "আমার ব্যথা করছে", "hi": "मुझे दर्द हो रहा है", "icon": "bolt"},
    "sick": {"en": "I feel sick", "bn": "আমার শরীর খারাপ লাগছে", "hi": "मेरी तबीयत ठीक नहीं है", "icon": "pill"},
    "sleepy": {"en": "I want to sleep", "bn": "আমি ঘুমোতে চাই", "hi": "मुझे सोना है", "icon": "bed"},
    "thankyou": {"en": "Thank you", "bn": "ধন্যবাদ", "hi": "धन्यवाद", "icon": "heart"},
    "callonphone": {"en": "Please call my family", "bn": "আমার পরিবারকে ফোন করো", "hi": "मेरे परिवार को फ़ोन करो", "icon": "phone"},
    "wait": {"en": "Please wait", "bn": "একটু অপেক্ষা করো", "hi": "थोड़ा रुकिए", "icon": "hand"},
}

EXTRA_SIGNS = {
    "drink": {"en": "I want something to drink", "bn": "আমি কিছু পান করতে চাই", "hi": "मुझे कुछ पीना है", "icon": "drop"},
    "thirsty": {"en": "I am thirsty", "bn": "আমার তেষ্টা পেয়েছে", "hi": "मुझे प्यास लगी है", "icon": "drop"},
    "hot": {"en": "I feel hot", "bn": "আমার গরম লাগছে", "hi": "मुझे गर्मी लग रही है", "icon": "alert"},
    "mom": {"en": "Call my mother", "bn": "মাকে ডাকো", "hi": "माँ को बुलाओ", "icon": "phone"},
    "dad": {"en": "Call my father", "bn": "বাবাকে ডাকো", "hi": "पापा को बुलाओ", "icon": "phone"},
    "bed": {"en": "I want to lie down", "bn": "আমি শুতে চাই", "hi": "मुझे लेटना है", "icon": "bed"},
    "bath": {"en": "I want to bathe", "bn": "আমি স্নান করতে চাই", "hi": "मुझे नहाना है", "icon": "drop"},
    "food": {"en": "I want food", "bn": "আমাকে খাবার দাও", "hi": "मुझे खाना चाहिए", "icon": "heart"},
    "milk": {"en": "I want milk", "bn": "আমি দুধ খেতে চাই", "hi": "मुझे दूध चाहिए", "icon": "drop"},
    "TV": {"en": "Please turn on the TV", "bn": "টিভি চালাও", "hi": "टीवी चालू करो", "icon": "check"},
    "outside": {"en": "I want to go outside", "bn": "আমি বাইরে যেতে চাই", "hi": "मुझे बाहर जाना है", "icon": "door"},
    "happy": {"en": "I am happy", "bn": "আমি খুশি", "hi": "मैं खुश हूँ", "icon": "heart"},
    "sad": {"en": "I am sad", "bn": "আমার মন খারাপ", "hi": "मैं उदास हूँ", "icon": "heart"},
    "finish": {"en": "I am finished", "bn": "আমার হয়ে গেছে", "hi": "मेरा हो गया", "icon": "check"},
    "please": {"en": "Please", "bn": "দয়া করে", "hi": "कृपया", "icon": "hand"},
    "hello": {"en": "Hello", "bn": "নমস্কার", "hi": "नमस्ते", "icon": "hand"},
    "bye": {"en": "Goodbye", "bn": "আবার দেখা হবে", "hi": "फिर मिलेंगे", "icon": "hand"},
    "fine": {"en": "I am fine", "bn": "আমি ভালো আছি", "hi": "मैं ठीक हूँ", "icon": "check"},
    "stay": {"en": "Please stay with me", "bn": "আমার কাছে থাকো", "hi": "मेरे पास रहो", "icon": "heart"},
    "time": {"en": "What time is it?", "bn": "কটা বাজে?", "hi": "कितने बजे हैं?", "icon": "check"},
    "shhh": {"en": "Please be quiet", "bn": "একটু চুপ করো", "hi": "कृपया शांत रहिए", "icon": "hand"},
}


def normalize_hand(points, aspect):
    wx, wy, wz = points[0][0] * aspect, points[0][1], points[0][2]
    kx, ky = points[9][0] * aspect, points[9][1]
    scale = math.hypot(kx - wx, ky - wy) or 1e-6
    coords = []
    for x, y, z in points:
        coords.append((x * aspect - wx) / scale)
        coords.append((y - wy) / scale)
        coords.append(((z * aspect - wz * aspect) / scale) * DEPTH_WEIGHT)
    return {"coords": coords, "wrist": (wx, wy), "scale": scale}


def features(hands, aspect=1.0):
    """hands: list of up to two lists of 21 (x, y, z) tuples in normalized image coords."""
    normalized = [normalize_hand(h, aspect) for h in hands[:2]]
    if not normalized:
        return None
    normalized.sort(key=lambda h: h["wrist"][0])
    vector = [0.0] * FEATURE_LENGTH
    for slot, hand in enumerate(normalized):
        offset = slot * HAND_SIZE
        vector[offset] = 1
        for j, value in enumerate(hand["coords"]):
            vector[offset + 1 + j] = round(value, 3)
    if len(normalized) == 2:
        scale = (normalized[0]["scale"] + normalized[1]["scale"]) / 2
        vector[PAIR_OFFSET] = round((normalized[1]["wrist"][0] - normalized[0]["wrist"][0]) / scale, 3)
        vector[PAIR_OFFSET + 1] = round((normalized[1]["wrist"][1] - normalized[0]["wrist"][1]) / scale, 3)
    return [0 if v == 0 else v for v in vector]


def mirror(hands):
    return [[(1 - x, y, z) for x, y, z in hand] for hand in hands]


def kaggle_auth():
    token = os.environ.get("KAGGLE_API_TOKEN", "").strip()
    if token:
        return {"Authorization": f"Bearer {token}"}
    path = Path.home() / ".kaggle" / "kaggle.json"
    if not path.exists():
        sys.exit(f"Set KAGGLE_API_TOKEN or save a token at {path} (Kaggle Settings > API).")
    creds = json.loads(path.read_text(encoding="utf-8"))
    token = base64.b64encode(f"{creds['username']}:{creds['key']}".encode()).decode()
    return {"Authorization": f"Basic {token}"}


def download(file_name, headers, retries=3):
    url = f"{API}/{COMPETITION}/{urllib.parse.quote(file_name, safe='')}"
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as response:
                data = response.read()
            if data[:2] == b"PK":
                with zipfile.ZipFile(io.BytesIO(data)) as archive:
                    data = archive.read(archive.namelist()[0])
            return data
        except urllib.error.HTTPError as error:
            if error.code in (401, 403):
                sys.exit(f"Kaggle refused the download ({error.code}). Accept the asl-signs rules on kaggle.com and check the token.")
            if attempt == retries:
                raise
        except urllib.error.URLError:
            if attempt == retries:
                raise
        time.sleep(attempt)
    raise RuntimeError("unreachable")


def frames_with_hands(parquet_bytes):
    import pandas as pd

    table = pd.read_parquet(io.BytesIO(parquet_bytes))
    hands = table[table["type"].isin(["left_hand", "right_hand"])]
    frames = []
    for _, frame in hands.groupby("frame"):
        present = []
        for kind in ("left_hand", "right_hand"):
            part = frame[frame["type"] == kind].sort_values("landmark_index")
            if len(part) == POINTS and not part[["x", "y"]].isna().any().any():
                present.append(list(zip(part["x"], part["y"], part["z"].fillna(0))))
        if present:
            frames.append(present)
    return frames


def pick_middle(frames, count):
    if not frames:
        return []
    start, end = int(len(frames) * 0.2), max(int(len(frames) * 0.8), int(len(frames) * 0.2) + 1)
    middle = frames[start:end]
    step = max(1, len(middle) // count)
    return middle[::step][:count]


def build_pack(out_path, per_sign, frames_per_recording, chosen, workers):
    import pandas as pd
    from concurrent.futures import ThreadPoolExecutor

    headers = kaggle_auth()
    print("Downloading the index (train.csv)", flush=True)
    index = pd.read_csv(io.BytesIO(download("train.csv", headers)))
    available = set(index["sign"].unique())
    missing = [s for s in chosen if s not in available]
    if missing:
        print(f"Not in this dataset, skipped: {', '.join(missing)}", flush=True)

    def fetch(path):
        try:
            return frames_with_hands(download(path, headers))
        except Exception as error:
            print(f"  skipped {path}: {error}", flush=True)
            return []

    signs = []
    for name, phrase in chosen.items():
        if name not in available:
            continue
        rows = index[index["sign"] == name].drop_duplicates("participant_id").head(per_sign)
        if len(rows) < per_sign:
            extra = index[(index["sign"] == name) & ~index["path"].isin(rows["path"])].head(per_sign - len(rows))
            rows = pd.concat([rows, extra])
        examples = []
        with ThreadPoolExecutor(max_workers=workers) as pool:
            recordings = list(pool.map(fetch, rows["path"]))
        for frames in recordings:
            for hands in pick_middle(frames, frames_per_recording):
                for variant in (hands, mirror(hands)):
                    vector = features(variant, PORTRAIT_ASPECT)
                    if vector:
                        examples.append(vector)
        signers = rows["participant_id"].nunique()
        print(f"{name}: {len(rows)} recordings from {signers} signers -> {len(examples)} examples", flush=True)
        if examples:
            signs.append({"id": f"asl-{name.lower()}", **phrase, "examples": examples, "createdAt": None})

    pack = {
        "format": "ishara-pack",
        "version": 1,
        "signLanguage": "asl",
        "recordedBy": "Kaggle asl-signs (PopSign: Georgia Tech, NTID at RIT, Deaf Professional Arts Network)",
        "signs": signs,
    }
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(pack, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(signs)} signs to {out} ({out.stat().st_size // 1024} KB)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="packs-local/asl.json")
    parser.add_argument("--per-sign", type=int, default=25)
    parser.add_argument("--frames", type=int, default=3)
    parser.add_argument("--features-only")
    parser.add_argument("--set", choices=["core", "extra", "all"], default="core")
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()
    if args.features_only:
        fixture = json.loads(Path(args.features_only).read_text(encoding="utf-8"))
        hands = [[(p["x"], p["y"], p.get("z", 0)) for p in hand] for hand in fixture["landmarks"]]
        print(json.dumps(features(hands, fixture.get("aspect", 1.0))))
        return
    chosen = {"core": SIGNS, "extra": EXTRA_SIGNS, "all": {**SIGNS, **EXTRA_SIGNS}}[args.set]
    build_pack(args.out, args.per_sign, args.frames, chosen, args.workers)


if __name__ == "__main__":
    main()

import { useCallback, useEffect, useRef, useState } from 'react';
import { HoldDetector } from './lib/holdDetector.js';
import { PHRASES, QUICK_TILES, STARTER_GESTURES, textFor } from './lib/phrases.js';
import { prefetchVoices, speak, stopSpeaking } from './lib/speech.js';
import { createGestureRecognizer, drawHands } from './lib/vision.js';
import { extractFeatures } from './lib/handFeatures.js';
import { signThreshold } from './lib/personalClassifier.js';
import { defaultListenerId, resolveLabel as resolveFor, routeFrame } from './lib/router.js';
import {
  activeSigns,
  allSigns,
  capExamples,
  loadStore,
  makePack,
  MAX_REST_EXAMPLES,
  mergeSigns,
  parsePack,
  saveStore,
  SIGN_LANGUAGES,
} from './lib/signStore.js';
import { describeListener, loadSettings, saveSettings } from './lib/settings.js';
import { ensureTranslations, loadStaticTranslations } from './lib/translations.js';
import { asset } from './lib/paths.js';
import Icon from './Icon.jsx';
import TeachView from './views/TeachView.jsx';
import SignsView from './views/SignsView.jsx';

const SOURCE_LABELS = {
  pending: 'Speaking…',
  sarvam: 'Sarvam voice',
  device: 'Phone voice (offline fallback)',
  none: 'Shown only: no voice for this language',
};

const COUNTDOWN_MS = 3000;
const SAMPLE_EVERY_MS = 120;
const UI_EVERY_MS = 100;
const DIRECT_LANGS = new Set(['bn-IN', 'hi-IN', 'en-IN']);

export default function App() {
  const [phase, setPhase] = useState('start');
  const [errorText, setErrorText] = useState('');
  const [view, setView] = useState('use');
  const [settings, setSettings] = useState(loadSettings);
  const [listenerId, setListenerId] = useState(() => defaultListenerId(settings.listeners));
  const [store, setStore] = useState(loadStore);
  const [hold, setHold] = useState({ label: null, progress: 0 });
  const [spoken, setSpoken] = useState(null);
  const [notice, setNotice] = useState('');
  const [capture, setCapture] = useState(null);
  const [, setTranslationsVersion] = useState(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recognizerRef = useRef(null);
  const detectorRef = useRef(new HoldDetector());
  const rafRef = useRef(0);
  const streamRef = useRef(null);
  const listenerRef = useRef(null);
  const storeRef = useRef(store);
  const viewRef = useRef(view);
  const captureRef = useRef(null);
  const lastUiRef = useRef(0);
  const handledCaptures = useRef(new Set());

  const listeners = settings.listeners.map(describeListener);
  const listener = listeners.find((l) => l.id === listenerId) ?? listeners[0];
  listenerRef.current = listener;
  const signLanguage = SIGN_LANGUAGES.find((l) => l.id === store.signLanguage) ?? SIGN_LANGUAGES[0];
  const signs = activeSigns(store);

  const flash = useCallback((text) => {
    setNotice(text);
    setTimeout(() => setNotice(''), 3500);
  }, []);

  useEffect(() => {
    storeRef.current = store;
    if (!saveStore(store)) flash('Could not save on this device. Storage may be full or in private mode.');
  }, [store, flash]);

  useEffect(() => { saveSettings(settings); }, [settings]);

  useEffect(() => {
    viewRef.current = view;
    detectorRef.current.reset();
    setHold({ label: null, progress: 0 });
  }, [view]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(['isl', 'asl'].map(async (id) => {
      try {
        const response = await fetch(asset(`packs/${id}.json`));
        if (!response.ok) return null;
        const pack = parsePack(await response.json());
        return { id, signs: pack.signs };
      } catch (error) {
        console.warn(`Could not load the bundled ${id} pack:`, error.message);
        return null;
      }
    })).then((packs) => {
      if (cancelled) return;
      setStore((prev) => {
        const sets = { ...prev.sets };
        let changed = false;
        for (const pack of packs) {
          if (pack && pack.signs.length && sets[pack.id].length === 0) {
            sets[pack.id] = pack.signs;
            changed = true;
          }
        }
        return changed ? { ...prev, sets } : prev;
      });
    });
    return () => { cancelled = true; };
  }, []);

  const langKey = settings.listeners.map((l) => l.lang).join(',');
  const signKey = allSigns(store).map((s) => s.id).join(',');
  useEffect(() => {
    const codes = settings.listeners.map((l) => l.lang).filter((code) => !DIRECT_LANGS.has(code));
    if (codes.length === 0) return;
    const phrases = [...Object.values(PHRASES), ...allSigns(storeRef.current)];
    loadStaticTranslations().then(() => ensureTranslations(phrases, codes)).then(({ failed }) => {
      setTranslationsVersion((v) => v + 1);
      if (failed) flash('Some phrases could not be translated. English is shown for those.');
    });
  }, [langKey, signKey, flash, settings.listeners]);

  useEffect(() => {
    if (phase !== 'running') return;
    const phrases = [...Object.values(PHRASES), ...signs];
    prefetchVoices(phrases.map((p) => textFor(p, listener)).filter(Boolean), listener.lang, listener.speaker);
  }, [listener.lang, listener.speaker, phase, signs.length]);

  useEffect(() => {
    if (capture?.phase !== 'done' || capture.target !== 'rest' || handledCaptures.current.has(capture.id)) return;
    handledCaptures.current.add(capture.id);
    if (capture.samples.length === 0) {
      flash('No hands were seen. Keep your hands in view while recording.');
      return;
    }
    setStore((prev) => {
      const rest = capExamples([...prev.rest, ...capture.samples], MAX_REST_EXAMPLES);
      return { ...prev, rest, restThreshold: signThreshold(rest) };
    });
    flash(`Saved ${capture.samples.length} resting examples.`);
  }, [capture, flash]);

  const resolveLabel = useCallback((label) => resolveFor(label, storeRef.current), []);

  const say = useCallback((phrase, target) => {
    const current = target ?? listenerRef.current;
    const text = textFor(phrase, current);
    if (!text) return;
    const entry = { phrase, text, listener: current, source: 'pending', at: Date.now() };
    setSpoken(entry);
    speak(text, current.lang, current.speaker).then((source) => {
      setSpoken((prev) => (prev && prev.at === entry.at ? { ...prev, source } : prev));
    });
  }, []);

  const stepCapture = (feature, now) => {
    const cap = captureRef.current;
    if (!cap) return false;
    if (now < cap.startAt) {
      cap.phase = 'countdown';
    } else if (now <= cap.endAt) {
      cap.phase = 'recording';
      if (feature && now - cap.lastAt >= SAMPLE_EVERY_MS) {
        cap.samples.push(feature);
        cap.lastAt = now;
      }
    } else {
      captureRef.current = null;
      setCapture({ id: cap.id, target: cap.target, phase: 'done', samples: cap.samples, count: cap.samples.length });
      return false;
    }
    return true;
  };

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const recognizer = recognizerRef.current;
    if (video && canvas && recognizer && video.readyState >= 2) {
      const now = performance.now();
      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      const result = recognizer.recognizeForVideo(video, now);
      drawHands(canvas, result);
      const feature = extractFeatures(result, video.videoWidth / video.videoHeight);
      const capturing = stepCapture(feature, now);

      const { label, score } = viewRef.current === 'use' && !capturing
        ? routeFrame(result, feature, storeRef.current)
        : { label: null, score: 0 };

      const state = detectorRef.current.update(label, score, now);
      if (state.fired) {
        const phrase = resolveLabel(state.fired);
        if (phrase) say(phrase);
      }

      if (now - lastUiRef.current > UI_EVERY_MS) {
        lastUiRef.current = now;
        setHold({ label: state.label, progress: state.progress });
        const cap = captureRef.current;
        if (cap) {
          const msLeft = cap.phase === 'countdown' ? cap.startAt - now : cap.endAt - now;
          setCapture({
            id: cap.id,
            target: cap.target,
            phase: cap.phase,
            secondsLeft: Math.max(1, Math.ceil(msLeft / 1000)),
            count: cap.samples.length,
          });
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [resolveLabel, say]);

  const start = useCallback(async () => {
    setPhase('loading');
    setErrorText('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      if (!recognizerRef.current) {
        recognizerRef.current = await createGestureRecognizer();
      }
      detectorRef.current.reset();
      setPhase('running');
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    } catch (error) {
      console.error('Could not start Ishara:', error);
      const denied = error?.name === 'NotAllowedError';
      setErrorText(
        denied
          ? 'Camera permission was refused. Allow the camera for this site and try again.'
          : `Could not start the camera or hand model (${error?.message ?? 'unknown error'}).`,
      );
      setPhase('error');
    }
  }, [tick]);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    stopSpeaking();
  }, []);

  const startCapture = (target, seconds) => {
    const now = performance.now();
    const id = `${target}-${Date.now()}`;
    captureRef.current = {
      id,
      target,
      phase: 'countdown',
      startAt: now + COUNTDOWN_MS,
      endAt: now + COUNTDOWN_MS + seconds * 1000,
      lastAt: 0,
      samples: [],
    };
    setCapture({ id, target, phase: 'countdown', secondsLeft: 3, count: 0 });
  };

  const updateActiveSet = (update) => {
    setStore((prev) => ({
      ...prev,
      sets: { ...prev.sets, [prev.signLanguage]: update(prev.sets[prev.signLanguage] ?? []) },
    }));
  };

  const saveSign = (sign) => {
    updateActiveSet((list) => [...list, sign]);
    setView('signs');
    flash(`Saved. Ishara now knows “${sign.en || sign.bn || sign.hi}” in ${signLanguage.label}.`);
  };

  const exportSigns = () => {
    const recordedBy = store.signLanguage === 'home' ? 'family' : "Team Top G's";
    const blob = new Blob([JSON.stringify(makePack(store, recordedBy))], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ishara-${store.signLanguage}-signs.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const importSigns = async (file) => {
    try {
      const pack = parsePack(JSON.parse(await file.text()));
      const target = pack.signLanguage ?? store.signLanguage;
      setStore((prev) => ({
        ...prev,
        signLanguage: target,
        sets: { ...prev.sets, [target]: mergeSigns(prev.sets[target] ?? [], pack.signs) },
      }));
      const label = SIGN_LANGUAGES.find((l) => l.id === target)?.label ?? target;
      flash(`Imported ${pack.signs.length} signs into ${label}.`);
    } catch (error) {
      console.error('Import failed:', error);
      flash(`Could not import: ${error.message}`);
    }
  };

  const changeListener = (index, patch) => {
    setSettings((prev) => ({
      ...prev,
      listeners: prev.listeners.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    }));
  };

  const preview = (index) => {
    const target = describeListener(settings.listeners[index]);
    setListenerId(target.id);
    say(PHRASES.water, target);
  };

  const wrong = () => {
    stopSpeaking();
    setSpoken(null);
    flash('Noted. Try the sign again, or re-record it in My signs.');
  };

  const holdPhrase = resolveLabel(hold.label);
  const cameraReady = phase === 'running';

  return (
    <main className="app">
      <header className="top">
        <div>
          <h1 className="brand">Ishara</h1>
          <p className="tagline">Sign it. It speaks.</p>
        </div>
      </header>

      <section aria-labelledby="listener-title">
        <h2 id="listener-title" className="label">Who is listening?</h2>
        <div className="chips">
          {listeners.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`chip ${l.id === listener.id ? 'chip-on' : ''}`}
              aria-pressed={l.id === listener.id}
              onClick={() => setListenerId(l.id)}
            >
              <span className="chip-who">{l.label}</span>
              <span className="chip-lang">{l.langLabel}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="signlang-title">
        <h2 id="signlang-title" className="label">Sign language</h2>
        <div className="seg" role="group" aria-labelledby="signlang-title">
          {SIGN_LANGUAGES.map((l) => (
            <button
              key={l.id}
              type="button"
              className={store.signLanguage === l.id ? 'seg-on' : ''}
              aria-pressed={store.signLanguage === l.id}
              onClick={() => setStore((prev) => ({ ...prev, signLanguage: l.id }))}
            >
              {l.label}
              <span className="seg-count">{(store.sets[l.id] ?? []).length + (l.id === 'home' ? STARTER_GESTURES.length : 0)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="camera" aria-label="Camera">
        <video ref={videoRef} className="mirror" playsInline muted />
        <canvas ref={canvasRef} className="mirror overlay" aria-hidden="true" />
        {cameraReady && (
          <div className="pill">
            <span className={`dot ${capture && capture.phase === 'recording' ? 'dot-rec' : ''}`} />
            {capture && capture.phase !== 'done' ? 'Recording examples' : view === 'use' ? 'Watching for signs' : 'Camera on'}
          </div>
        )}
        {capture && capture.phase === 'countdown' && <div className="countdown" aria-hidden="true">{capture.secondsLeft}</div>}
        {!cameraReady && (
          <div className="camera-cover">
            {phase === 'start' && (
              <>
                <button type="button" className="btn btn-primary btn-big" onClick={start}>
                  <Icon name="hand" /> Start Ishara
                </button>
                <p className="cover-note">The camera stays on this device. No video is uploaded.</p>
              </>
            )}
            {phase === 'loading' && <p className="cover-note" role="status">Loading the hand model…</p>}
            {phase === 'error' && (
              <>
                <p className="cover-error" role="alert">{errorText}</p>
                <button type="button" className="btn btn-primary" onClick={start}>Try again</button>
              </>
            )}
          </div>
        )}
        {cameraReady && view === 'use' && (
          <div className="meter">
            <div className="meter-row">
              <span>{hold.label ? 'Hold your sign' : 'Show a sign'}</span>
              <span className="meter-phrase">{textFor(holdPhrase, listener)}</span>
            </div>
            <div className="meter-track"><div className="meter-fill" style={{ width: `${Math.round(hold.progress * 100)}%` }} /></div>
          </div>
        )}
      </section>

      {notice && <p className="notice" role="status">{notice}</p>}

      {view === 'use' && (
        <>
          {spoken && (
            <section className="spoken" aria-live="assertive">
              <p className="spoken-to">Spoken to {spoken.listener.label} · {spoken.listener.langLabel}</p>
              <p className="spoken-text">{spoken.text}</p>
              {spoken.listener.key !== 'en' && spoken.phrase.en && <p className="spoken-en">{spoken.phrase.en}</p>}
              <p className="spoken-source">{SOURCE_LABELS[spoken.source]}</p>
              <div className="spoken-actions">
                <button type="button" className="btn btn-light" onClick={() => say(spoken.phrase, spoken.listener)}>
                  <Icon name="repeat" /> Say again
                </button>
                <button type="button" className="btn btn-wrong" onClick={wrong}>
                  <Icon name="cross" /> No, wrong
                </button>
              </div>
            </section>
          )}

          <section aria-labelledby="tiles-title">
            <h2 id="tiles-title" className="label">Or tap a phrase</h2>
            <div className="tiles">
              {QUICK_TILES.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`tile ${id === 'help' ? 'tile-help' : ''}`}
                  onClick={() => say(PHRASES[id])}
                >
                  <span className="tile-icon"><Icon name={PHRASES[id].icon} /></span>
                  <span className="tile-text">
                    <span className="tile-main">{textFor(PHRASES[id], listener)}</span>
                    <span className="tile-sub">{PHRASES[id].en}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section aria-labelledby="guide-title" className="guide">
            <h2 id="guide-title" className="label">Signs Ishara knows now</h2>
            <ul>
              {signs.map((sign) => (
                <li key={sign.id} className={hold.label === `my:${sign.id}` ? 'guide-on' : ''}>
                  <span className="guide-sign">{signLanguage.label}</span>
                  <span className="guide-phrase">{textFor(sign, listener)}</span>
                </li>
              ))}
              {store.signLanguage === 'home' && STARTER_GESTURES.map((starter) => (
                <li key={starter.gesture} className={hold.label === starter.gesture ? 'guide-on' : ''}>
                  <span className="guide-sign">{starter.label}</span>
                  <span className="guide-phrase">{textFor(PHRASES[starter.phraseId], listener)}</span>
                </li>
              ))}
            </ul>
            {signs.length === 0 && store.signLanguage !== 'home' && (
              <p className="empty">
                No {signLanguage.plural} yet. Switch to another sign language above, or teach one in Teach.
              </p>
            )}
          </section>
        </>
      )}

      {view === 'teach' && (
        <TeachView
          cameraReady={cameraReady}
          capture={capture}
          startCapture={startCapture}
          signs={signs}
          onSave={saveSign}
          onCancel={() => setView('signs')}
        />
      )}

      {view === 'signs' && (
        <SignsView
          store={store}
          signs={signs}
          signLanguage={signLanguage}
          listener={listener}
          settings={settings}
          cameraReady={cameraReady}
          capture={capture}
          startCapture={startCapture}
          onDelete={(id) => updateActiveSet((list) => list.filter((s) => s.id !== id))}
          onUpdate={(patch) => setStore((prev) => ({ ...prev, ...patch }))}
          onTeach={() => setView('teach')}
          onListenerChange={changeListener}
          onPreview={preview}
          onExport={exportSigns}
          onImport={importSigns}
        />
      )}

      <footer className="foot">
        Hands are tracked on this device with MediaPipe. Voices and translation by Sarvam. For a medical emergency, call 112.
      </footer>

      <nav className="nav" aria-label="Main">
        {[
          { id: 'use', label: 'Use', icon: 'hand' },
          { id: 'signs', label: 'My signs', icon: 'list' },
          { id: 'teach', label: 'Teach', icon: 'plus' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-item ${view === item.id ? 'nav-on' : ''}`}
            aria-current={view === item.id ? 'page' : undefined}
            onClick={() => setView(item.id)}
          >
            <Icon name={item.icon} />
            {item.label}
          </button>
        ))}
      </nav>
    </main>
  );
}

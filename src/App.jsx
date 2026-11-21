import { useCallback, useEffect, useRef, useState } from 'react';
import { HoldDetector } from './lib/holdDetector.js';
import {
  GESTURE_LABELS,
  GESTURE_PHRASES,
  LISTENERS,
  PHRASES,
  QUICK_TILES,
  textFor,
} from './lib/phrases.js';
import { prefetchVoices, speak, stopSpeaking } from './lib/speech.js';
import { createGestureRecognizer, drawHands } from './lib/vision.js';
import { extractFeatures } from './lib/handFeatures.js';
import { signThreshold } from './lib/personalClassifier.js';
import { resolveLabel as resolveFor, routeFrame } from './lib/router.js';
import { capExamples, loadStore, MAX_REST_EXAMPLES, saveStore } from './lib/signStore.js';
import Icon from './Icon.jsx';
import TeachView from './views/TeachView.jsx';
import SignsView from './views/SignsView.jsx';

const SOURCE_LABELS = {
  pending: 'Speaking…',
  sarvam: 'Sarvam voice',
  device: 'Phone voice (offline fallback)',
  none: 'Shown only: no voice available',
};

const COUNTDOWN_MS = 3000;
const SAMPLE_EVERY_MS = 120;
const UI_EVERY_MS = 100;

export default function App() {
  const [phase, setPhase] = useState('start');
  const [errorText, setErrorText] = useState('');
  const [view, setView] = useState('use');
  const [listenerId, setListenerId] = useState('family');
  const [store, setStore] = useState(loadStore);
  const [hold, setHold] = useState({ label: null, progress: 0 });
  const [spoken, setSpoken] = useState(null);
  const [notice, setNotice] = useState('');
  const [capture, setCapture] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recognizerRef = useRef(null);
  const detectorRef = useRef(new HoldDetector());
  const rafRef = useRef(0);
  const streamRef = useRef(null);
  const listenerRef = useRef(LISTENERS[0]);
  const storeRef = useRef(store);
  const viewRef = useRef(view);
  const captureRef = useRef(null);
  const lastUiRef = useRef(0);
  const handledCaptures = useRef(new Set());

  const listener = LISTENERS.find((l) => l.id === listenerId) ?? LISTENERS[0];

  const flash = useCallback((text) => {
    setNotice(text);
    setTimeout(() => setNotice(''), 3000);
  }, []);

  useEffect(() => {
    storeRef.current = store;
    if (!saveStore(store)) flash('Could not save on this phone. Storage may be full or in private mode.');
  }, [store, flash]);

  useEffect(() => {
    viewRef.current = view;
    detectorRef.current.reset();
    setHold({ label: null, progress: 0 });
  }, [view]);

  useEffect(() => {
    listenerRef.current = listener;
    if (phase !== 'running') return;
    const phrases = [...Object.values(PHRASES), ...store.signs];
    prefetchVoices(phrases.map((p) => textFor(p, listener)).filter(Boolean), listener.lang);
  }, [listener, phase, store.signs]);

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

  const say = useCallback((phrase) => {
    const current = listenerRef.current;
    const text = textFor(phrase, current);
    if (!text) return;
    const entry = { phrase, text, listener: current, source: 'pending', at: Date.now() };
    setSpoken(entry);
    speak(text, current.lang).then((source) => {
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
      const feature = extractFeatures(result);
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

  const saveSign = (sign) => {
    setStore((prev) => ({ ...prev, signs: [...prev.signs, sign] }));
    setView('signs');
    flash(`Saved. Ishara now knows “${sign.en || sign.bn || sign.hi}”.`);
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
          {LISTENERS.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`chip ${l.id === listenerId ? 'chip-on' : ''}`}
              aria-pressed={l.id === listenerId}
              onClick={() => setListenerId(l.id)}
            >
              <span className="chip-who">{l.label}</span>
              <span className="chip-lang">{l.langLabel}</span>
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
                <p className="cover-note">The camera stays on this phone. No video is uploaded.</p>
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
                <button type="button" className="btn btn-light" onClick={() => say(spoken.phrase)}>
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
              {store.signs.map((sign) => (
                <li key={sign.id} className={hold.label === `my:${sign.id}` ? 'guide-on' : ''}>
                  <span className="guide-sign">My sign</span>
                  <span className="guide-phrase">{textFor(sign, listener)}</span>
                </li>
              ))}
              {store.everyday && Object.entries(GESTURE_PHRASES).map(([gesture, id]) => (
                <li key={gesture} className={hold.label === gesture ? 'guide-on' : ''}>
                  <span className="guide-sign">{GESTURE_LABELS[gesture]}</span>
                  <span className="guide-phrase">{textFor(PHRASES[id], listener)}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {view === 'teach' && (
        <TeachView
          cameraReady={cameraReady}
          capture={capture}
          startCapture={startCapture}
          signs={store.signs}
          onSave={saveSign}
          onCancel={() => setView('signs')}
        />
      )}

      {view === 'signs' && (
        <SignsView
          store={store}
          listener={listener}
          cameraReady={cameraReady}
          capture={capture}
          startCapture={startCapture}
          onDelete={(id) => setStore((prev) => ({ ...prev, signs: prev.signs.filter((s) => s.id !== id) }))}
          onUpdate={(patch) => setStore((prev) => ({ ...prev, ...patch }))}
          onTeach={() => setView('teach')}
        />
      )}

      <footer className="foot">
        Hands are tracked on this device with MediaPipe. Voice by Sarvam Bulbul. For a medical emergency, call 112.
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

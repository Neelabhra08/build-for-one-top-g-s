import { useCallback, useEffect, useRef, useState } from 'react';
import { HoldDetector } from './lib/holdDetector.js';
import {
  GESTURE_LABELS,
  GESTURE_PHRASES,
  LISTENERS,
  PHRASES,
  QUICK_TILES,
  phraseText,
} from './lib/phrases.js';
import { prefetchVoices, speak, stopSpeaking } from './lib/speech.js';
import { createGestureRecognizer, drawHands, topGesture } from './lib/vision.js';
import Icon from './Icon.jsx';

const SOURCE_LABELS = {
  pending: 'Speaking…',
  sarvam: 'Sarvam voice',
  device: 'Phone voice (offline fallback)',
  none: 'Shown only: no voice available',
};

export default function App() {
  const [phase, setPhase] = useState('start');
  const [errorText, setErrorText] = useState('');
  const [listenerId, setListenerId] = useState('family');
  const [hold, setHold] = useState({ label: null, progress: 0 });
  const [spoken, setSpoken] = useState(null);
  const [notice, setNotice] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recognizerRef = useRef(null);
  const detectorRef = useRef(new HoldDetector());
  const rafRef = useRef(0);
  const streamRef = useRef(null);
  const listenerRef = useRef(LISTENERS[0]);
  const lastUiUpdateRef = useRef(0);

  const listener = LISTENERS.find((l) => l.id === listenerId) ?? LISTENERS[0];

  useEffect(() => {
    listenerRef.current = listener;
    if (phase === 'running') {
      prefetchVoices(Object.keys(PHRASES).map((id) => phraseText(id, listener)), listener.lang);
    }
  }, [listener, phase]);

  const say = useCallback((phraseId) => {
    const current = listenerRef.current;
    const text = phraseText(phraseId, current);
    if (!text) return;
    const entry = { phraseId, text, listener: current, source: 'pending', at: Date.now() };
    setSpoken(entry);
    speak(text, current.lang).then((source) => {
      setSpoken((prev) => (prev && prev.at === entry.at ? { ...prev, source } : prev));
    });
  }, []);

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
      const { label, score } = topGesture(result);
      const state = detectorRef.current.update(label, score, now);
      if (state.fired) {
        const phraseId = GESTURE_PHRASES[state.fired];
        if (phraseId) say(phraseId);
      }
      if (now - lastUiUpdateRef.current > 100) {
        lastUiUpdateRef.current = now;
        setHold({ label: state.label, progress: state.progress });
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [say]);

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

  const wrong = () => {
    stopSpeaking();
    setSpoken(null);
    setNotice('Noted. Ishara will not repeat that one.');
    setTimeout(() => setNotice(''), 2500);
  };

  const holdPhraseId = hold.label ? GESTURE_PHRASES[hold.label] : null;
  const holdText = holdPhraseId ? phraseText(holdPhraseId, listener) : '';

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
        {phase === 'running' && (
          <div className="pill"><span className="dot" />Watching for signs</div>
        )}
        {phase !== 'running' && (
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
        {phase === 'running' && (
          <div className="meter">
            <div className="meter-row">
              <span>{hold.label ? 'Hold your sign' : 'Show a sign'}</span>
              <span className="meter-phrase">{holdText}</span>
            </div>
            <div className="meter-track"><div className="meter-fill" style={{ width: `${Math.round(hold.progress * 100)}%` }} /></div>
          </div>
        )}
      </section>

      {spoken && (
        <section className="spoken" aria-live="assertive">
          <p className="spoken-to">Spoken to {spoken.listener.label} · {spoken.listener.langLabel}</p>
          <p className="spoken-text">{spoken.text}</p>
          {spoken.listener.key !== 'en' && <p className="spoken-en">{PHRASES[spoken.phraseId].en}</p>}
          <p className="spoken-source">{SOURCE_LABELS[spoken.source]}</p>
          <div className="spoken-actions">
            <button type="button" className="btn btn-light" onClick={() => say(spoken.phraseId)}>
              <Icon name="repeat" /> Say again
            </button>
            <button type="button" className="btn btn-wrong" onClick={wrong}>
              <Icon name="cross" /> No, wrong
            </button>
          </div>
        </section>
      )}
      {notice && <p className="notice" role="status">{notice}</p>}

      <section aria-labelledby="tiles-title">
        <h2 id="tiles-title" className="label">Or tap a phrase</h2>
        <div className="tiles">
          {QUICK_TILES.map((id) => (
            <button
              key={id}
              type="button"
              className={`tile ${id === 'help' ? 'tile-help' : ''}`}
              onClick={() => say(id)}
            >
              <span className="tile-icon"><Icon name={PHRASES[id].icon} /></span>
              <span className="tile-text">
                <span className="tile-main">{phraseText(id, listener)}</span>
                <span className="tile-sub">{PHRASES[id].en}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="guide-title" className="guide">
        <h2 id="guide-title" className="label">Signs Ishara knows now</h2>
        <ul>
          {Object.entries(GESTURE_PHRASES).map(([gesture, id]) => (
            <li key={gesture} className={hold.label === gesture ? 'guide-on' : ''}>
              <span className="guide-sign">{GESTURE_LABELS[gesture]}</span>
              <span className="guide-phrase">{phraseText(id, listener)}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="foot">
        Hands are tracked on this device with MediaPipe. Voice by Sarvam Bulbul. For a medical emergency, call 112.
      </footer>
    </main>
  );
}

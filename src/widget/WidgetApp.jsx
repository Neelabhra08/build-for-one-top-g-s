import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../Icon.jsx';
import { HoldDetector } from '../lib/holdDetector.js';
import { extractFeatures } from '../lib/handFeatures.js';
import { LISTENERS, textFor } from '../lib/phrases.js';
import { resolveLabel, routeFrame } from '../lib/router.js';
import { loadStore } from '../lib/signStore.js';
import { speak } from '../lib/speech.js';
import { createGestureRecognizer, drawHands } from '../lib/vision.js';

const LISTEN_WINDOW_MS = 20000;
const PENDING_MS = 8000;
const UI_EVERY_MS = 100;
const bridge = typeof window !== 'undefined' ? window.ishara : undefined;

export default function WidgetApp() {
  const [phase, setPhase] = useState('loading');
  const [errorText, setErrorText] = useState('');
  const [listening, setListening] = useState(false);
  const [mode, setMode] = useState('type');
  const [listenerId, setListenerId] = useState('family');
  const [hold, setHold] = useState({ label: null, progress: 0 });
  const [last, setLast] = useState(null);
  const [hotkey, setHotkey] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recognizerRef = useRef(null);
  const detectorRef = useRef(new HoldDetector());
  const rafRef = useRef(0);
  const streamRef = useRef(null);
  const storeRef = useRef(loadStore());
  const listeningRef = useRef(false);
  const listenUntilRef = useRef(0);
  const modeRef = useRef(mode);
  const listenerRef = useRef(LISTENERS[0]);
  const lastUiRef = useRef(0);
  const pendingRef = useRef(null);
  const actRef = useRef(null);

  const listener = LISTENERS.find((l) => l.id === listenerId) ?? LISTENERS[0];
  useEffect(() => { listenerRef.current = listener; }, [listener]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const setListen = useCallback((on) => {
    listeningRef.current = on;
    listenUntilRef.current = on ? performance.now() + LISTEN_WINDOW_MS : 0;
    detectorRef.current.reset();
    setListening(on);
  }, []);

  useEffect(() => {
    const reload = (event) => {
      if (!event.key || event.key.startsWith('ishara.')) storeRef.current = loadStore();
    };
    window.addEventListener('storage', reload);
    return () => window.removeEventListener('storage', reload);
  }, []);

  const toggle = useCallback(() => {
    const pending = pendingRef.current;
    const fresh = pending && performance.now() - pending.at <= PENDING_MS;
    console.warn(`[ishara] toggle: listening=${listeningRef.current} pending=${Boolean(fresh)}`);
    if (!listeningRef.current && fresh) {
      pendingRef.current = null;
      setListen(true);
      actRef.current?.(pending.phrase);
      return;
    }
    setListen(!listeningRef.current);
  }, [setListen]);

  useEffect(() => {
    if (!bridge) return undefined;
    bridge.hotkey().then(setHotkey).catch(() => setHotkey(''));
    return bridge.onToggle(toggle);
  }, [toggle]);

  const act = useCallback(async (phrase) => {
    const current = listenerRef.current;
    const text = textFor(phrase, current);
    if (!text) return;
    const entry = { text, en: phrase.en, status: 'working', at: Date.now() };
    setLast(entry);
    let status = 'shown';
    if (modeRef.current === 'type' && bridge) {
      const result = await bridge.typeText(`${text} `);
      status = result?.ok ? 'typed' : 'type-failed';
    } else {
      const source = await speak(text, current.lang);
      status = source === 'none' ? 'shown' : 'spoken';
    }
    listenUntilRef.current = performance.now() + LISTEN_WINDOW_MS;
    setLast((prev) => (prev && prev.at === entry.at ? { ...prev, status } : prev));
  }, []);
  useEffect(() => { actRef.current = act; }, [act]);

  const onFired = useCallback((phrase) => {
    if (modeRef.current === 'speak' || listeningRef.current) {
      act(phrase);
      return;
    }
    pendingRef.current = { phrase, at: performance.now() };
    setLast({ text: textFor(phrase, listenerRef.current), en: phrase.en, status: 'ready', at: Date.now() });
  }, [act]);

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
      if (listeningRef.current && now > listenUntilRef.current) setListen(false);
      const { label, score } = routeFrame(result, extractFeatures(result), storeRef.current);
      const state = detectorRef.current.update(label, score, now);
      if (state.fired) {
        const phrase = resolveLabel(state.fired, storeRef.current);
        if (phrase) onFired(phrase);
      }
      if (now - lastUiRef.current > UI_EVERY_MS) {
        lastUiRef.current = now;
        setHold({ label: state.label, progress: state.progress });
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [onFired, setListen]);

  const start = useCallback(async () => {
    setPhase('loading');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 480 }, height: { ideal: 360 } },
        audio: false,
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      if (!recognizerRef.current) recognizerRef.current = await createGestureRecognizer();
      setPhase('running');
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    } catch (error) {
      console.error('Widget could not start:', error);
      setErrorText(error?.name === 'NotAllowedError' ? 'Camera was refused.' : `Could not start (${error?.message ?? 'unknown'}).`);
      setPhase('error');
    }
  }, [tick]);

  useEffect(() => {
    start();
    return () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [start]);

  const holdPhrase = resolveLabel(hold.label, storeRef.current);
  const typing = mode === 'type';
  const statusText = !typing
    ? 'Speaking every sign aloud'
    : listening
      ? 'Listening: sign now, it types where your cursor is'
      : `Sign, then press ${hotkey || 'Listen'} to type it`;

  const lastStatus = {
    ready: `Press ${hotkey || 'Listen'} to type it`,
    working: '…',
    typed: 'Typed into your app',
    'type-failed': 'Could not type. Is a text box focused?',
    spoken: 'Spoken aloud',
    shown: 'Shown only',
  };

  return (
    <main className={`widget ${listening && typing ? 'widget-live' : ''}`}>
      <header className="w-head">
        <span className="w-brand"><span className={`w-dot ${listening || !typing ? 'w-dot-on' : ''}`} />Ishara</span>
        {bridge && (
          <span className="w-head-actions">
            <button type="button" className="w-icon" aria-label="Open the full app to teach signs" onClick={() => bridge.openMain()}>
              <Icon name="list" size={16} />
            </button>
            <button type="button" className="w-icon" aria-label="Quit Ishara" onClick={() => bridge.quit()}>
              <Icon name="cross" size={16} />
            </button>
          </span>
        )}
      </header>

      <section className="w-cam" aria-label="Camera">
        <video ref={videoRef} className="mirror" playsInline muted />
        <canvas ref={canvasRef} className="mirror" aria-hidden="true" />
        {phase !== 'running' && (
          <div className="w-cover">
            {phase === 'loading' && <span role="status">Starting camera…</span>}
            {phase === 'error' && (
              <>
                <span role="alert">{errorText}</span>
                <button type="button" className="w-btn" onClick={start}>Try again</button>
              </>
            )}
          </div>
        )}
      </section>

      <p className="w-status" role="status">{statusText}</p>
      <div className="w-track" aria-hidden="true"><div className="w-fill" style={{ width: `${Math.round(hold.progress * 100)}%` }} /></div>
      {hold.label && <p className="w-hold">{textFor(holdPhrase, listener)}</p>}

      {last && (
        <section className="w-last" aria-live="polite">
          <p className="w-last-text">{last.text}</p>
          {listener.key !== 'en' && last.en && <p className="w-last-en">{last.en}</p>}
          <p className="w-last-status">{lastStatus[last.status]}</p>
        </section>
      )}

      <div className="w-row" role="group" aria-label="Listener language">
        {LISTENERS.map((l) => (
          <button
            key={l.id}
            type="button"
            className={`w-chip ${l.id === listenerId ? 'w-chip-on' : ''}`}
            aria-pressed={l.id === listenerId}
            onClick={() => setListenerId(l.id)}
          >
            {l.langLabel}
          </button>
        ))}
      </div>

      <div className="w-row">
        <div className="w-seg" role="group" aria-label="Output">
          <button type="button" className={typing ? 'w-seg-on' : ''} aria-pressed={typing} onClick={() => setMode('type')}>Type</button>
          <button type="button" className={!typing ? 'w-seg-on' : ''} aria-pressed={!typing} onClick={() => setMode('speak')}>Speak</button>
        </div>
        {typing && (
          <button type="button" className={`w-btn ${listening ? 'w-btn-stop' : ''}`} onClick={toggle}>
            {listening ? 'Stop' : 'Listen'}
          </button>
        )}
      </div>
      {!bridge && <p className="w-note">Typing into other apps needs the Ishara desktop app. In a browser, Speak works.</p>}
    </main>
  );
}

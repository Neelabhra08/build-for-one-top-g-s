import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../Icon.jsx';
import { SIGN_ICONS, textFor } from '../lib/phrases.js';
import { closestOtherSign, signThreshold } from '../lib/personalClassifier.js';
import { capExamples, MAX_SIGN_EXAMPLES, newSignId } from '../lib/signStore.js';
import { handCount } from '../lib/handFeatures.js';

const MIN_EXAMPLES = 8;
const ENGLISH = { key: 'en', lang: 'en-IN' };

export default function TeachView({ cameraReady, capture, startCapture, signs, onSave, onCancel }) {
  const [step, setStep] = useState('phrase');
  const [texts, setTexts] = useState({ bn: '', hi: '', en: '' });
  const [icon, setIcon] = useState('hand');
  const [examples, setExamples] = useState([]);
  const handled = useRef(new Set());

  useEffect(() => {
    if (capture?.phase === 'done' && capture.target === 'sign' && !handled.current.has(capture.id)) {
      handled.current.add(capture.id);
      setExamples((prev) => [...prev, ...capture.samples]);
    }
  }, [capture]);

  const lookalike = useMemo(() => {
    if (examples.length < MIN_EXAMPLES || signs.length === 0) return null;
    const close = closestOtherSign(examples, signs);
    if (!close) return null;
    const other = signs.find((s) => s.id === close.id);
    const limit = 1.5 * Math.max(signThreshold(examples), other?.threshold ?? 0);
    return close.distance <= limit ? other : null;
  }, [examples, signs]);

  const hands = examples.length ? handCount(examples[examples.length - 1]) : 0;
  const hasText = Object.values(texts).some((t) => t.trim());
  const recording = capture && capture.target === 'sign' && capture.phase !== 'done';

  const save = () => {
    const kept = capExamples(examples, MAX_SIGN_EXAMPLES);
    onSave({
      id: newSignId(),
      bn: texts.bn.trim(),
      hi: texts.hi.trim(),
      en: texts.en.trim(),
      icon,
      examples: kept,
      threshold: signThreshold(kept),
      createdAt: new Date().toISOString(),
    });
  };

  if (step === 'phrase') {
    return (
      <section className="panel" aria-labelledby="teach-title">
        <h2 id="teach-title" className="panel-title">Teach a sign</h2>
        <p className="panel-sub">Step 1 of 2: what should this sign say? Fill in at least one language.</p>
        <label className="field">
          <span>Family · বাংলা</span>
          <input value={texts.bn} maxLength={120} onChange={(e) => setTexts({ ...texts, bn: e.target.value })} placeholder="আমার জল চাই" />
        </label>
        <label className="field">
          <span>Attendant · हिन्दी</span>
          <input value={texts.hi} maxLength={120} onChange={(e) => setTexts({ ...texts, hi: e.target.value })} placeholder="मुझे पानी चाहिए" />
        </label>
        <label className="field">
          <span>Doctor · English</span>
          <input value={texts.en} maxLength={120} onChange={(e) => setTexts({ ...texts, en: e.target.value })} placeholder="I need water" />
        </label>
        <div className="field">
          <span>Picture</span>
          <div className="icon-grid" role="group" aria-label="Choose a picture">
            {SIGN_ICONS.map((name) => (
              <button
                key={name}
                type="button"
                className={`icon-pick ${icon === name ? 'icon-pick-on' : ''}`}
                aria-pressed={icon === name}
                aria-label={name}
                onClick={() => setIcon(name)}
              >
                <Icon name={name} size={22} />
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-indigo" disabled={!hasText} onClick={() => setStep('record')}>
            Next: show the sign
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel" aria-labelledby="record-title">
      <h2 id="record-title" className="panel-title">Show the sign</h2>
      <p className="panel-sub">
        Step 2 of 2 · {textFor(texts, ENGLISH) || texts.bn || texts.hi}. Hold the sign in front of the camera.
        Move it a little between takes, as it looks on a normal day.
      </p>
      {!cameraReady && <p className="warn">Start the camera above first.</p>}
      <div className="record-status" role="status">
        {recording && capture.phase === 'countdown' && <span className="big-count">Get ready… {capture.secondsLeft}</span>}
        {recording && capture.phase === 'recording' && <span className="big-count">Recording · {capture.count}</span>}
        {!recording && (
          <span>
            {examples.length} examples saved{examples.length ? ` · ${hands === 2 ? 'two hands' : 'one hand'}` : ''}
            {examples.length < MIN_EXAMPLES ? ` · need at least ${MIN_EXAMPLES}` : ''}
          </span>
        )}
      </div>
      {lookalike && (
        <p className="warn">
          This looks a lot like the sign for “{textFor(lookalike, ENGLISH)}”. Try a more different hand shape, or save it and test both.
        </p>
      )}
      <div className="row">
        <button
          type="button"
          className="btn btn-indigo"
          disabled={!cameraReady || recording}
          onClick={() => startCapture('sign', 3)}
        >
          {examples.length ? 'Record again (3 s)' : 'Record (3 s)'}
        </button>
        <button type="button" className="btn btn-primary" disabled={examples.length < MIN_EXAMPLES || recording} onClick={save}>
          Save sign
        </button>
      </div>
      <div className="row">
        <button type="button" className="btn btn-ghost" onClick={() => setStep('phrase')}>Back</button>
        {examples.length > 0 && (
          <button type="button" className="btn btn-ghost" disabled={recording} onClick={() => setExamples([])}>
            Clear examples
          </button>
        )}
      </div>
    </section>
  );
}

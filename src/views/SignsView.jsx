import { useRef, useState } from 'react';
import Icon from '../Icon.jsx';
import { textFor } from '../lib/phrases.js';
import { LANGUAGES, VOICES, voiceLabel } from '../lib/languages.js';

export default function SignsView({
  store,
  signs,
  signLanguage,
  listener,
  settings,
  cameraReady,
  capture,
  startCapture,
  onDelete,
  onUpdate,
  onTeach,
  onListenerChange,
  onPreview,
  onExport,
  onImport,
}) {
  const [confirmId, setConfirmId] = useState(null);
  const fileRef = useRef(null);
  const recordingRest = capture && capture.target === 'rest' && capture.phase !== 'done';

  return (
    <>
      <section className="panel" aria-labelledby="signs-title">
        <h2 id="signs-title" className="panel-title">My signs · {signLanguage.label}</h2>
        <p className="panel-sub">{signLanguage.note}. Taught by family, saved only on this device.</p>

        {signs.length === 0 && (
          <p className="empty">No {signLanguage.plural} yet. Teach one, or import a sign file.</p>
        )}
        <ul className="sign-list">
          {signs.map((sign) => (
            <li key={sign.id} className="sign-row">
              <span className="tile-icon"><Icon name={sign.icon} /></span>
              <span className="sign-text">
                <span className="tile-main">{textFor(sign, listener)}</span>
                <span className="tile-sub">
                  {sign.en || sign.bn || sign.hi} · {sign.examples.length} examples{sign.source ? ` · by ${sign.source}` : ''}
                </span>
              </span>
              {confirmId === sign.id ? (
                <button type="button" className="btn-small btn-danger" onClick={() => { onDelete(sign.id); setConfirmId(null); }}>
                  Tap to delete
                </button>
              ) : (
                <button type="button" className="btn-small" aria-label={`Delete ${sign.en || sign.bn || 'sign'}`} onClick={() => setConfirmId(sign.id)}>
                  <Icon name="trash" size={18} />
                </button>
              )}
            </li>
          ))}
        </ul>

        <button type="button" className="btn btn-indigo btn-wide" onClick={onTeach}>
          <Icon name="plus" /> Teach a new {signLanguage.singular}
        </button>

        <div className="row">
          <button type="button" className="btn btn-ghost" disabled={signs.length === 0} onClick={onExport}>Export signs</button>
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>Import signs</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImport(file);
              e.target.value = '';
            }}
          />
        </div>
      </section>

      <section className="panel" aria-labelledby="voices-title">
        <h2 id="voices-title" className="panel-title">Voices and languages</h2>
        <p className="panel-sub">Each listener hears the sign in their own language. Voices by Sarvam Bulbul. Urdu is shown and typed, not spoken.</p>
        {settings.listeners.map((l, index) => (
          <div key={l.id} className="voice-row">
            <div className="voice-head">
              <span className="voice-who">{l.label}</span>
              <button type="button" className="voice-preview" onClick={() => onPreview(index)} aria-label={`Preview the ${l.label} voice`}>
                <Icon name="speaker" size={16} /> Preview
              </button>
            </div>
            <div className="voice-fields">
              <label className="voice-field">
                <span>Language</span>
                <select value={l.lang} onChange={(e) => onListenerChange(index, { lang: e.target.value })}>
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label === lang.name ? lang.name : `${lang.label} · ${lang.name}`}{lang.voice ? '' : ' (text only)'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="voice-field">
                <span>Voice</span>
                <select value={l.speaker} onChange={(e) => onListenerChange(index, { speaker: e.target.value })}>
                  {VOICES.map((name) => <option key={name} value={name}>{voiceLabel(name)}</option>)}
                </select>
              </label>
            </div>
          </div>
        ))}
      </section>

      <section className="panel" aria-labelledby="tuning-title">
        <h2 id="tuning-title" className="panel-title">Tuning</h2>
        <div className="setting">
          <div>
            <p className="setting-title">Resting hands</p>
            <p className="setting-sub">
              {store.rest.length
                ? `${store.rest.length} examples. Ishara stays silent for these.`
                : 'Not recorded. Record 5 seconds of normal, relaxed hand movement so it stays silent.'}
            </p>
            {recordingRest && (
              <p className="setting-sub" role="status">
                {capture.phase === 'countdown' ? `Get ready… ${capture.secondsLeft}` : `Recording · ${capture.count}`}
              </p>
            )}
          </div>
          <div className="setting-actions">
            <button type="button" className="btn-small" disabled={!cameraReady || recordingRest} onClick={() => startCapture('rest', 5)}>
              Record 5 s
            </button>
            {store.rest.length > 0 && (
              <button type="button" className="btn-small" onClick={() => onUpdate({ rest: [], restThreshold: 0.12 })}>Clear</button>
            )}
          </div>
        </div>

        <label className="setting">
          <span>
            <span className="setting-title">How strict</span>
            <span className="setting-sub">Stricter means fewer mistakes, but signs must be clearer.</span>
          </span>
          <select value={store.sensitivity} onChange={(e) => onUpdate({ sensitivity: e.target.value })}>
            <option value="strict">Strict</option>
            <option value="normal">Normal</option>
            <option value="loose">Loose</option>
          </select>
        </label>
        {!cameraReady && <p className="warn">Start the camera above to record.</p>}
      </section>
    </>
  );
}

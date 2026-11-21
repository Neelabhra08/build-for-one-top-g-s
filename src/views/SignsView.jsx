import { useState } from 'react';
import Icon from '../Icon.jsx';
import { textFor } from '../lib/phrases.js';

export default function SignsView({ store, listener, cameraReady, capture, startCapture, onDelete, onUpdate, onTeach }) {
  const [confirmId, setConfirmId] = useState(null);
  const recordingRest = capture && capture.target === 'rest' && capture.phase !== 'done';

  return (
    <section className="panel" aria-labelledby="signs-title">
      <h2 id="signs-title" className="panel-title">My signs</h2>
      <p className="panel-sub">Taught by family. Saved only on this phone.</p>

      {store.signs.length === 0 && <p className="empty">No signs yet. Teach the first one: it takes about a minute.</p>}
      <ul className="sign-list">
        {store.signs.map((sign) => (
          <li key={sign.id} className="sign-row">
            <span className="tile-icon"><Icon name={sign.icon} /></span>
            <span className="sign-text">
              <span className="tile-main">{textFor(sign, listener)}</span>
              <span className="tile-sub">{sign.en || sign.bn || sign.hi} · {sign.examples.length} examples</span>
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
        <Icon name="plus" /> Teach a new sign
      </button>

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
          <span className="setting-title">Everyday gestures</span>
          <span className="setting-sub">Thumbs up, open palm and 5 more, built in.</span>
        </span>
        <input type="checkbox" checked={store.everyday} onChange={(e) => onUpdate({ everyday: e.target.checked })} />
      </label>

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
  );
}

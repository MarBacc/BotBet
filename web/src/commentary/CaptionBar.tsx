import type { Commentary } from './useCommentary'
import './commentary.css'

/** Large live caption, always visible in Present mode; sound toggle when TTS is available. */
export function CaptionBar({ c }: { c: Commentary }) {
  return (
    <div className="cap-bar" role="region" aria-label="Live commentary">
      <p className="cap-text" aria-live="polite">{c.caption || ' '}</p>
      {c.enabled && (
        <button className="cap-sound" onClick={c.toggleSound} aria-pressed={c.soundOn} aria-label={c.soundOn ? 'Mute commentary (M)' : 'Unmute commentary (M)'}>
          <span aria-hidden="true">{c.soundOn ? '🔊' : '🔇'}</span>
          {c.ready < c.total && <small> {c.ready}/{c.total}</small>}
        </button>
      )}
    </div>
  )
}

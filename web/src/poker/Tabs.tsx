import './poker.css'

export type Mode = 'chess' | 'poker'

/** Rendered only when poker-result.json exists; chess stays the default. */
export function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <nav className="mode-tabs" role="tablist" aria-label="Game">
      <button role="tab" aria-selected={mode === 'chess'} className={mode === 'chess' ? 'on' : ''} onClick={() => onChange('chess')}>Chess</button>
      <button role="tab" aria-selected={mode === 'poker'} className={mode === 'poker' ? 'on' : ''} onClick={() => onChange('poker')}>Poker <small>(beta)</small></button>
    </nav>
  )
}

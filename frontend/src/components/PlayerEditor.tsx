import { RotateCcw, X } from 'lucide-react'
import type { Player, PlayerStats } from '../players'

interface PlayerEditorProps {
  player: Player
  onChange: (stats: PlayerStats) => void
  onClose: () => void
  onReset: () => void
}

const labels: Record<keyof PlayerStats, string> = {
  pace: 'Running / pace',
  shooting: 'Kicking / shooting',
  passing: 'Passing',
  dribbling: 'Ball control',
  defending: 'Defending',
  stamina: 'Stamina',
}

export function PlayerEditor({ player, onChange, onClose, onReset }: PlayerEditorProps) {
  function setStat(key: keyof PlayerStats, value: number) {
    onChange({ ...player.stats, [key]: value })
  }

  return (
    <div className="editor-backdrop" role="presentation">
      <section className="player-editor" role="dialog" aria-modal="true" aria-labelledby="editor-title">
        <header><div><span>SIMULATION PROFILE</span><h2 id="editor-title">Customize {player.shortName}</h2></div><button onClick={onClose} aria-label="Close player editor"><X /></button></header>
        <div className="editor-note"><b>Official stats stay unchanged.</b> These sliders create a custom training profile used by your team prediction and published snapshot.</div>
        <div className="editor-player"><div style={{ background: player.accent }}>{player.shortName.slice(0, 2)}</div><span><strong>{player.name}</strong><small>{player.club} · {player.position}</small></span><b>{player.overall}</b></div>
        <div className="editor-sliders">
          {(Object.keys(labels) as Array<keyof PlayerStats>).map((key) => (
            <label key={key}><span>{labels[key]} <b>{player.stats[key]}</b></span><input type="range" min="20" max="99" value={player.stats[key]} onInput={(event) => setStat(key, Number(event.currentTarget.value))} /></label>
          ))}
        </div>
        <footer><button className="secondary" onClick={onReset}><RotateCcw size={15} /> Reset official</button><button onClick={onClose}>Apply profile</button></footer>
      </section>
    </div>
  )
}

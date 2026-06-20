import { Check, Heart, Settings2 } from 'lucide-react'
import type { Player } from '../players'

interface PlayerCardProps {
  player: Player
  selected: boolean
  onEdit: (player: Player) => void
  onToggle: (player: Player) => void
}

export function PlayerCard({ player, selected, onEdit, onToggle }: PlayerCardProps) {
  return (
    <article className={`collectible ${selected ? 'selected' : ''}`}>
      <div className="collectible-visual" style={{ '--accent': player.accent } as React.CSSProperties}>
        <span className="serial">FY-{String(player.id + 1).padStart(4, '0')}</span>
        <button className="heart" aria-label={`Favourite ${player.name}`}><Heart size={19} /></button>
        <div className="card-rating"><strong>{player.overall}</strong><span>{player.position}</span></div>
        <div className="player-monogram">{player.shortName.slice(0, 2)}</div>
        <div className="card-country">{player.country}</div>
      </div>
      <div className="collectible-copy">
        <span className="verified">● LIVE STATS</span>
        <h3>{player.name}</h3>
        <p>{player.club} · {player.position}</p>
        <div className="card-stats"><span>PAC <b>{player.stats.pace}</b></span><span>SHO <b>{player.stats.shooting}</b></span><span>STA <b>{player.stats.stamina}</b></span></div>
        <div className="card-footer"><span>Floor <b>{player.floor.toFixed(1)} SOL</b></span><button onClick={() => onEdit(player)}><Settings2 size={14} /> Customize</button></div>
        <button className="team-toggle" onClick={() => onToggle(player)}>{selected ? <><Check size={15} /> In starting XI</> : 'Add to starting XI'}</button>
      </div>
    </article>
  )
}


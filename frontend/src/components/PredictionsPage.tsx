import { ExternalLink, ShieldAlert, Shield, Swords } from 'lucide-react'
import { useEffect, useState } from 'react'
import { opponents, predictMatch, type Formation } from '../lib/prediction'
import { players, type Player } from '../players'

export type PublishedTeam = {
  id: string
  name: string
  formation: Formation
  playerIds: number[]
  squadRating: number
  opponent: string
  winRate: number
  publishedAt: number
  txUrl: string | null
}

interface PredictionsPageProps {
  publishedTeams: PublishedTeam[]
}

type Opponent = { readonly country: string; readonly code: string; readonly rating: number }

function buildExplanation(team: PublishedTeam, opp: Opponent, winPct: number): string {
  const teamPlayers = team.playerIds
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p))

  const fwds = teamPlayers.filter(p => p.position === 'FWD').length
  const mids = teamPlayers.filter(p => p.position === 'MID').length
  const defs = teamPlayers.filter(p => p.position === 'DEF').length
  const avgRating = teamPlayers.length
    ? Math.round(teamPlayers.reduce((s, p) => s + p.overall, 0) / teamPlayers.length)
    : 0

  const ratingDiff = avgRating - opp.rating
  const parts: string[] = []

  if (ratingDiff >= 5) parts.push(`Squad OVR ${avgRating} significantly exceeds opponent's ${opp.rating}`)
  else if (ratingDiff >= 0) parts.push(`Squad OVR ${avgRating} edges opponent's ${opp.rating}`)
  else parts.push(`Opponent OVR ${opp.rating} outrates squad's ${avgRating}`)

  if (fwds >= 3) parts.push(`${fwds} forwards generate high attacking threat`)
  else if (fwds === 1) parts.push(`lone striker limits offensive output`)

  if (mids >= 5) parts.push(`${mids}-man midfield dominates possession`)
  else if (mids >= 4) parts.push(`${mids} midfielders provide solid balance`)

  if (defs >= 4) parts.push(`${defs}-man backline is defensively solid`)
  else if (defs === 3) parts.push(`3-man defence trades solidity for width`)

  if (winPct >= 50) parts.push(`overall outlook is favourable`)
  else if (winPct >= 35) parts.push(`match is evenly contested`)
  else parts.push(`opponent strength makes this a tough fixture`)

  return parts.join('. ') + '.'
}

function MatchupCard({ team, opp, teamPlayers }: {
  team: PublishedTeam
  opp: Opponent
  teamPlayers: Player[]
}) {
  const result = predictMatch(teamPlayers, opp.rating, true)
  const explanation = buildExplanation(team, opp, result.win)
  const verdict = result.win >= 50 ? 'win' : result.win >= 35 ? 'draw' : 'loss'
  const verdictLabel = result.win >= 50 ? 'Favoured' : result.win >= 35 ? 'Evenly Matched' : 'Underdog'

  return (
    <div className={`mc-card mc-${verdict}`}>
      {/* vs header */}
      <div className="mc-header">
        <div className="mc-side mc-your-side">
          <Shield size={13} />
          <span className="mc-side-label">YOUR TEAM</span>
          <span className="mc-side-name">{team.name}</span>
          <span className="mc-side-rating">OVR {team.squadRating}</span>
        </div>

        <div className="mc-center">
          <div className="mc-win-big">{result.win}%</div>
          <div className="mc-win-label">WIN CHANCE</div>
          <div className={`mc-verdict-badge mc-verdict-${verdict}`}>{verdictLabel}</div>
        </div>

        <div className="mc-side mc-opp-side">
          <Swords size={13} />
          <span className="mc-side-label">OPPONENT</span>
          <span className="mc-side-name">{opp.country}</span>
          <span className="mc-side-rating">OVR {opp.rating}</span>
        </div>
      </div>

      {/* probability bars */}
      <div className="mc-bars">
        <div className="mc-bar-row">
          <span className="mc-bar-label">Win</span>
          <div className="mc-bar-track">
            <div className="mc-bar-fill mc-bar-win" style={{ width: `${result.win}%` }} />
          </div>
          <span className="mc-bar-pct">{result.win}%</span>
        </div>
        <div className="mc-bar-row">
          <span className="mc-bar-label">Draw</span>
          <div className="mc-bar-track">
            <div className="mc-bar-fill mc-bar-draw" style={{ width: `${result.draw}%` }} />
          </div>
          <span className="mc-bar-pct">{result.draw}%</span>
        </div>
        <div className="mc-bar-row">
          <span className="mc-bar-label">Loss</span>
          <div className="mc-bar-track">
            <div className="mc-bar-fill mc-bar-loss" style={{ width: `${result.loss}%` }} />
          </div>
          <span className="mc-bar-pct">{result.loss}%</span>
        </div>
      </div>

      {/* explanation */}
      <p className="mc-explanation">{explanation}</p>
    </div>
  )
}

function TeamCard({ team, opponentsToShow }: { team: PublishedTeam; opponentsToShow: readonly Opponent[] }) {
  const teamPlayers = team.playerIds
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p))

  const byPos: Record<string, Player[]> = { GK: [], DEF: [], MID: [], FWD: [] }
  teamPlayers.forEach(p => byPos[p.position]?.push(p))

  return (
    <div className="tc-wrapper">
      {/* team identity bar */}
      <div className="tc-identity">
        <div className="tc-identity-left">
          <span className="tc-label">PUBLISHED TEAM</span>
          <h3 className="tc-name">{team.name}</h3>
          <p className="tc-meta">{team.formation} · Rating {team.squadRating} · {new Date(team.publishedAt).toLocaleDateString()}</p>
        </div>
        {team.txUrl && (
          <a className="tc-tx-link" href={team.txUrl} target="_blank" rel="noreferrer">
            Solscan <ExternalLink size={11} />
          </a>
        )}
      </div>

      {/* player roster by position */}
      <div className="tc-roster">
        {(['GK', 'DEF', 'MID', 'FWD'] as const).map(pos => (
          byPos[pos].length > 0 && (
            <div className="tc-pos-group" key={pos}>
              <span className="tc-pos-label">{pos}</span>
              <div className="tc-pos-players">
                {byPos[pos].map(p => (
                  <span className="tc-player-chip" key={p.id}>
                    <strong>{p.shortName}</strong>
                    <small>{p.overall}</small>
                  </span>
                ))}
              </div>
            </div>
          )
        ))}
      </div>

      {/* matchup cards grid */}
      <div className="tc-matchups">
        {opponentsToShow.map(opp => (
          <MatchupCard key={opp.code} team={team} opp={opp} teamPlayers={teamPlayers} />
        ))}
      </div>
    </div>
  )
}

export function PredictionsPage({ publishedTeams }: PredictionsPageProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [selectedOpps, setSelectedOpps] = useState<string[]>([])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('fifyard-compare-opponents')
      if (saved) setSelectedOpps(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    localStorage.setItem('fifyard-compare-opponents', JSON.stringify(selectedOpps))
  }, [selectedOpps])

  const opponentsToShow: readonly Opponent[] = selectedOpps.length === 0
    ? opponents
    : opponents.filter(o => selectedOpps.includes(o.code))

  const selectedTeam = publishedTeams.find(t => t.id === selectedTeamId) ?? null
  const teamsToShow = selectedTeam ? [selectedTeam] : [...publishedTeams].reverse()

  if (publishedTeams.length === 0) {
    return (
      <section className="predictions-page">
        <div className="section-heading">
          <div>
            <span>03 / PREDICTIONS</span>
            <h2>Match predictions</h2>
          </div>
        </div>
        <div className="pred-empty">
          <ShieldAlert size={40} strokeWidth={1.5} />
          <h3>No published teams yet</h3>
          <p>Build a valid XI on the Squad Builder and hit <strong>Submit XI</strong> to publish your team. Predictions will appear here.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="predictions-page">
      <div className="section-heading">
        <div>
          <span>03 / PREDICTIONS</span>
          <h2>Match predictions</h2>
        </div>
        <div className="pred-count">
          <strong>{publishedTeams.length}</strong>
          <span>TEAM{publishedTeams.length !== 1 ? 'S' : ''} PUBLISHED</span>
        </div>
      </div>

      {/* controls row */}
      <div className="pred-controls-row">
        <div className="pred-ctrl-group">
          <label className="pred-ctrl-label">YOUR TEAM</label>
          <select
            className="pred-ctrl-select"
            value={selectedTeamId ?? ''}
            onChange={(e) => setSelectedTeamId(e.target.value || null)}
          >
            <option value="">All teams</option>
            {publishedTeams.map(t => (
              <option key={t.id} value={t.id}>{t.name} · {t.formation}</option>
            ))}
          </select>
        </div>

        <div className="pred-ctrl-divider">VS</div>

        <div className="pred-ctrl-group">
          <label className="pred-ctrl-label">OPPONENT{selectedOpps.length > 0 ? ` (${selectedOpps.length} selected)` : ' (all)'}</label>
          <div className="pred-opp-chips">
            {opponents.map(o => (
              <button
                key={o.code}
                className={`pred-opp-chip ${selectedOpps.includes(o.code) ? 'active' : ''}`}
                onClick={() => setSelectedOpps(prev =>
                  prev.includes(o.code) ? prev.filter(c => c !== o.code) : [...prev, o.code]
                )}
              >
                {o.code} <small>{o.rating}</small>
              </button>
            ))}
            {selectedOpps.length > 0 && (
              <button className="pred-opp-chip pred-opp-clear" onClick={() => setSelectedOpps([])}>
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="pred-note">Win probability is a heuristic based on squad rating, opponent strength, and formation. Not betting advice.</p>

      <div className="pred-teams-list">
        {teamsToShow.map(team => (
          <TeamCard key={team.id} team={team} opponentsToShow={opponentsToShow} />
        ))}
      </div>
    </section>
  )
}

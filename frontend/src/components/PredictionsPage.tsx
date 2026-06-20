import { ExternalLink, ShieldAlert, BarChart3 } from 'lucide-react'
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

function getFormationStyle(formation: Formation): string {
  const styles: Record<Formation, string> = {
    '4-3-3': 'Attack-minded with emphasis on forwards',
    '4-4-2': 'Balanced formation with strong midfield presence',
    '3-5-2': 'Midfield-heavy control setup',
    '4-2-3-1': 'Modern flexible system with lone striker',
  }
  return styles[formation]
}

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

  if (ratingDiff >= 5) parts.push(`squad rating (${avgRating}) significantly exceeds opponent (${opp.rating})`)
  else if (ratingDiff >= 0) parts.push(`squad rating (${avgRating}) is slightly above opponent (${opp.rating})`)
  else parts.push(`opponent (${opp.rating}) outrates squad (${avgRating})`)

  if (fwds >= 3) parts.push(`${fwds} forwards create high attacking threat`)
  else if (fwds === 1) parts.push(`lone striker limits offensive output`)

  if (mids >= 5) parts.push(`${mids} midfielders dominate possession and transition`)
  else if (mids >= 4) parts.push(`strong midfield of ${mids} provides balance`)

  if (defs >= 4) parts.push(`${defs}-man backline offers defensive solidity`)
  else if (defs === 3) parts.push(`3-man defence trades solidity for width`)

  if (winPct >= 50) parts.push(`overall outlook is favourable`)
  else if (winPct >= 35) parts.push(`match is evenly contested`)
  else parts.push(`opponent strength makes this a tough fixture`)

  return parts.join('; ') + '.'
}

function analyzeTeam(team: PublishedTeam): { fwdFocus: number; midControl: number; defSolid: number } {
  const teamPlayers = team.playerIds.map((id) => players.find((p) => p.id === id)).filter((p): p is Player => Boolean(p))
  const avg = teamPlayers.length ? teamPlayers.reduce((s, p) => s + p.overall, 0) / teamPlayers.length : 0
  const fwdAvg = teamPlayers.filter(p => p.position === 'FWD').reduce((s, p) => s + p.overall, 0) / Math.max(1, teamPlayers.filter(p => p.position === 'FWD').length)
  const midAvg = teamPlayers.filter(p => p.position === 'MID').reduce((s, p) => s + p.overall, 0) / Math.max(1, teamPlayers.filter(p => p.position === 'MID').length)
  const defAvg = teamPlayers.filter(p => p.position === 'DEF').reduce((s, p) => s + p.overall, 0) / Math.max(1, teamPlayers.filter(p => p.position === 'DEF').length)
  return {
    fwdFocus: fwdAvg > avg ? Math.round(((fwdAvg - avg) / avg) * 100) : 0,
    midControl: midAvg > avg ? Math.round(((midAvg - avg) / avg) * 100) : 0,
    defSolid: defAvg > avg ? Math.round(((defAvg - avg) / avg) * 100) : 0,
  }
}

function TeamPredictions({ team, opponentsToShow }: { team: PublishedTeam; opponentsToShow: readonly Opponent[] }) {
  const teamPlayers = team.playerIds
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p))

  const analysis = analyzeTeam(team)

  return (
    <article className="pred-team-card">
      <div className="pred-team-header">
        <div>
          <span className="pred-team-label">PUBLISHED TEAM</span>
          <h3>{team.name}</h3>
          <p className="pred-team-meta">
            {team.formation} · {teamPlayers.length} players · Rating {team.squadRating}
            {' · '}{new Date(team.publishedAt).toLocaleDateString()}
          </p>
        </div>
        {team.txUrl && (
          <a className="pred-tx-link" href={team.txUrl} target="_blank" rel="noreferrer">
            Solscan <ExternalLink size={12} />
          </a>
        )}
      </div>

      <div className="pred-analysis">
        <span className="pred-analysis-label">Team Style:</span>
        <span className="pred-analysis-text">{getFormationStyle(team.formation)}</span>
        {analysis.fwdFocus > 10 && <span className="pred-style-tag attack">Attacking Forwards (+{analysis.fwdFocus}%)</span>}
        {analysis.midControl > 10 && <span className="pred-style-tag control">Strong Midfield (+{analysis.midControl}%)</span>}
        {analysis.defSolid > 10 && <span className="pred-style-tag defense">Solid Defense (+{analysis.defSolid}%)</span>}
      </div>

      <div className="pred-players">
        <span className="pred-players-label">Squad:</span>
        <div className="pred-player-list">
          {teamPlayers.map(p => (
            <span className="pred-player-chip" key={p.id}>
              <strong>{p.shortName}</strong> <small>({p.position})</small>
            </span>
          ))}
        </div>
      </div>

      <div className="pred-matchups">
        {opponentsToShow.map((opp) => {
          const result = predictMatch(teamPlayers, opp.rating, true)
          const explanation = buildExplanation(team, opp, result.win)
          return (
            <div className="pred-matchup" key={opp.code}>
              <div className="pred-opp">
                <span className="pred-opp-code">{opp.code}</span>
                <span className="pred-opp-name">{opp.country}</span>
                <span className="pred-opp-rating">OVR {opp.rating}</span>
              </div>
              <div className="pred-bars">
                <div className="pred-bar-row">
                  <span>Win</span>
                  <div className="pred-bar"><div className="pred-bar-fill win" style={{ width: `${result.win}%` }} /></div>
                  <strong>{result.win}%</strong>
                </div>
                <div className="pred-bar-row">
                  <span>Draw</span>
                  <div className="pred-bar"><div className="pred-bar-fill draw" style={{ width: `${result.draw}%` }} /></div>
                  <strong>{result.draw}%</strong>
                </div>
                <div className="pred-bar-row">
                  <span>Loss</span>
                  <div className="pred-bar"><div className="pred-bar-fill loss" style={{ width: `${result.loss}%` }} /></div>
                  <strong>{result.loss}%</strong>
                </div>
              </div>
              <div className={`pred-verdict ${result.win >= 50 ? 'win' : result.win >= 35 ? 'draw' : 'loss'}`}>
                {result.win >= 50 ? 'Favoured' : result.win >= 35 ? 'Even' : 'Underdog'}
              </div>
              <p className="pred-explanation">{explanation}</p>
            </div>
          )
        })}
      </div>
    </article>
  )
}

export function PredictionsPage({ publishedTeams }: PredictionsPageProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [compareOpponents, setCompareOpponents] = useState<string[]>([])

  const selectedTeam = publishedTeams.find(t => t.id === selectedTeamId) ?? null

  useEffect(() => {
    const savedCompare = localStorage.getItem('fifyard-compare-opponents')
    if (savedCompare) {
      try { setCompareOpponents(JSON.parse(savedCompare)) } catch { /* ignore */ }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('fifyard-compare-opponents', JSON.stringify(compareOpponents))
  }, [compareOpponents])

  const opponentsToShow: readonly Opponent[] = compareOpponents.length === 0
    ? opponents
    : opponents.filter(o => compareOpponents.includes(o.code))

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

  const teamsToShow = selectedTeam ? [selectedTeam] : [...publishedTeams].reverse()

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

      <div className="pred-controls">
        <div className="pred-team-selector">
          <label><BarChart3 size={14} /> Select Team</label>
          <select value={selectedTeamId ?? ''} onChange={(e) => setSelectedTeamId(e.target.value || null)}>
            <option value="">All teams</option>
            {publishedTeams.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.formation})</option>
            ))}
          </select>
        </div>
        <div className="pred-filter-multi">
          <label>Compare vs (Ctrl+click to multi-select):</label>
          <select
            multiple
            value={compareOpponents}
            onChange={(e) => setCompareOpponents(Array.from(e.target.selectedOptions).map(o => o.value))}
            size={Math.min(opponents.length, 5)}
          >
            {opponents.map(o => (
              <option key={o.code} value={o.code}>{o.country} (OVR {o.rating})</option>
            ))}
          </select>
          {compareOpponents.length > 0 && (
            <button className="pred-clear-btn" onClick={() => setCompareOpponents([])}>Clear filter</button>
          )}
        </div>
      </div>

      <p className="pred-note">Win probability is a heuristic estimate based on squad rating, opponent strength, and formation. Not betting advice.</p>

      <div className="pred-teams">
        {teamsToShow.map((team) => (
          <TeamPredictions team={team} opponentsToShow={opponentsToShow} key={team.id} />
        ))}
      </div>
    </section>
  )
}

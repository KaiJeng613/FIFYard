import { ExternalLink, ShieldAlert } from 'lucide-react'
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

function TeamPredictions({ team }: { team: PublishedTeam }) {
  const teamPlayers = team.playerIds
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p))

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

      <div className="pred-matchups">
        {opponents.map((opp) => {
          const result = predictMatch(teamPlayers, opp.rating, true)
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
            </div>
          )
        })}
      </div>
    </article>
  )
}

export function PredictionsPage({ publishedTeams }: PredictionsPageProps) {
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
      <p className="pred-note">Win probability is a heuristic estimate based on squad rating, opponent strength, and formation. Not betting advice.</p>
      <div className="pred-teams">
        {[...publishedTeams].reverse().map((team) => (
          <TeamPredictions team={team} key={team.id} />
        ))}
      </div>
    </section>
  )
}
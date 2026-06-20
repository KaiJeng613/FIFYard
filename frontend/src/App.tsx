import { useMemo, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { WalletButton } from './components/WalletButton'
import { formations, formationCounts, isValidLineup, predictMatch, opponents, type Formation } from './lib/prediction'
import { players, type Player, type Position } from './players'

const filters: Array<'ALL' | Position> = ['ALL', 'GK', 'DEF', 'MID', 'FWD']

function App() {
  const [formation, setFormation] = useState<Formation>('4-3-3')
  const [filter, setFilter] = useState<(typeof filters)[number]>('ALL')
  const [selected, setSelected] = useState<number[]>([13, 8, 9, 10, 11, 4, 5, 6, 0, 1, 2])
  const [focused, setFocused] = useState<Player>(players[0])
  const [wallet, setWallet] = useState<string | null>(null)
  const [opponentCode, setOpponentCode] = useState('ARG')

  const selectedPlayers = useMemo(
    () => selected.map((id) => players.find((player) => player.id === id)).filter((player): player is Player => Boolean(player)),
    [selected],
  )

  const opponent = opponents.find((item) => item.code === opponentCode) ?? opponents[0]
  const lineupValid = isValidLineup(selectedPlayers, formation)
  const prediction = predictMatch(selectedPlayers, opponent.rating, lineupValid)

  const average = selectedPlayers.length
    ? Math.round(selectedPlayers.reduce((sum, player) => sum + player.overall, 0) / selectedPlayers.length)
    : 0
  const filteredPlayers = filter === 'ALL' ? players : players.filter((player) => player.position === filter)
  const positionCounts = selectedPlayers.reduce<Record<Position, number>>(
    (counts, player) => ({ ...counts, [player.position]: counts[player.position] + 1 }),
    { GK: 0, DEF: 0, MID: 0, FWD: 0 },
  )
  const expected = formationCounts[formation]
  const fullLineupValid = selected.length === 11 && filters.slice(1).every(
    (position) => positionCounts[position as Position] === expected[position as Position],
  )

  function togglePlayer(player: Player) {
    setFocused(player)
    setSelected((current) => {
      if (current.includes(player.id)) return current.filter((id) => id !== player.id)
      if (current.length >= 11) return current
      return [...current, player.id]
    })
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <header className="topbar">
          <div><span className="live-dot" /> LIVE PLAYER ORACLE <b>·</b> EPOCH 491</div>
          <WalletButton wallet={wallet} onConnected={setWallet} />
        </header>

        <main id="top">
          <section className="workspace" id="squad">
            <div className="section-heading">
              <div>
                <span>01 / SQUAD BUILDER</span>
                <h2>Assemble your starting XI</h2>
              </div>
              <div className="selection-count">
                <strong>{selected.length}</strong>
                <span>/ 11 SELECTED</span>
              </div>
            </div>

            <div className="builder-grid">
              <aside className="player-panel">
                <div className="filters">
                  {filters.map((item) => (
                    <button className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)} key={item}>
                      {item}
                    </button>
                  ))}
                </div>
                <div className="player-list">
                  {filteredPlayers.map((player) => (
                    <button
                      className={`player-row ${selected.includes(player.id) ? 'picked' : ''}`}
                      onClick={() => togglePlayer(player)}
                      key={player.id}
                    >
                      <span className="rating">{player.overall}</span>
                      <span className="player-identity">
                        <strong>{player.name}</strong>
                        <small>{player.club} · {player.country}</small>
                      </span>
                      <span className={`position ${player.position.toLowerCase()}`}>{player.position}</span>
                      <span className="pick-icon">{selected.includes(player.id) ? '✓' : '+'}</span>
                    </button>
                  ))}
                </div>
              </aside>

              <div className="pitch-panel">
                <div className="formation-toolbar">
                  <span>FORMATION</span>
                  <div>
                    {formations.map((item) => (
                      <button className={formation === item ? 'selected' : ''} onClick={() => setFormation(item)} key={item}>
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pitch">
                  <div className="center-circle" />
                  <div className="penalty top" />
                  <div className="penalty bottom" />
                  <div className="lineup">
                    {selectedPlayers.map((player, index) => (
                      <button className={`mini-card slot-${index}`} onClick={() => setFocused(player)} key={player.id}>
                        <span>{player.overall}</span>
                        <strong>{player.shortName}</strong>
                        <small>{player.position}</small>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="squad-summary">
                  <div><span>SQUAD RATING</span><strong>{average}</strong></div>
                  <div><span>FORMATION</span><strong>{formation}</strong></div>
                  <div><span>WIN RATE</span><strong>{lineupValid ? `${prediction.win}%` : '—'}</strong></div>
                  <div className="opponent-select">
                    <span>VS OPPONENT</span>
                    <select value={opponentCode} onChange={(e) => setOpponentCode(e.target.value)}>
                      {opponents.map((item) => (
                        <option value={item.code} key={item.code}>{item.country} ({item.rating})</option>
                      ))}
                    </select>
                  </div>
                  <button disabled={!wallet || !fullLineupValid}>
                    {wallet ? (fullLineupValid ? 'Submit XI' : 'Complete a valid XI') : 'Connect wallet to continue'}
                  </button>
                </div>
              </div>

              <aside className="stat-panel">
                <div className="card-kicker">PLAYER INTELLIGENCE</div>
                <div className="featured-rating"><strong>{focused.overall}</strong><span>OVR</span></div>
                <h3>{focused.name}</h3>
                <p>{focused.position} · {focused.club} · {focused.country}</p>
                <div className="stat-bars">
                  {Object.entries(focused.stats).map(([label, value]) => (
                    <div className="stat" key={label}>
                      <span>{label}</span>
                      <div><i style={{ width: `${value}%` }} /></div>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <div className="oracle-stamp">
                  <i>✓</i>
                  <span><strong>VERIFIED ON-CHAIN</strong>Stats oracle · Epoch 491</span>
                </div>
                <code>PLAYER PDA · 7xK2…mP9q</code>
              </aside>
            </div>
          </section>

          <section className="protocol" id="protocol">
            <span>02 / THE PROTOCOL</span>
            <h2>Football data you can verify.</h2>
            <div className="protocol-grid">
              <article><b>01</b><h3>Collect</h3><p>Each player card is a unique Solana NFT tied to a canonical player account.</p></article>
              <article><b>02</b><h3>Verify</h3><p>Versioned ratings are signed by the FIFYard statistics authority and timestamped on-chain.</p></article>
              <article><b>03</b><h3>Compete</h3><p>Your eleven-player formation becomes a composable squad PDA for games and prediction leagues.</p></article>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default App

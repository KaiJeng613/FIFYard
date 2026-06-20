import { useEffect, useMemo, useRef, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { WalletButton } from './components/WalletButton'
import { PredictionsPage, type PublishedTeam } from './components/PredictionsPage'
import { formations, formationCounts, isValidLineup, predictMatch, opponents, type Formation } from './lib/prediction'
import { fetchEpoch, fetchPublishedTeams, publishTeamSnapshot, solscanTransactionUrl } from './lib/solana'
import { players, type Player, type Position } from './players'

type Page = 'squad' | 'predictions'

const filters: Array<'ALL' | Position> = ['ALL', 'GK', 'DEF', 'MID', 'FWD']

type SlotPos = { row: number; col: number; colSpan?: number }

const formationSlots: Record<Formation, SlotPos[]> = {
  '4-3-3': [
    { row: 5, col: 2, colSpan: 2 },
    { row: 4, col: 1 }, { row: 4, col: 2 }, { row: 4, col: 3 }, { row: 4, col: 4 },
    { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 4 },
    { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 4 },
  ],
  '4-4-2': [
    { row: 5, col: 2, colSpan: 2 },
    { row: 4, col: 1 }, { row: 4, col: 2 }, { row: 4, col: 3 }, { row: 4, col: 4 },
    { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 }, { row: 3, col: 4 },
    { row: 2, col: 2 }, { row: 2, col: 3 },
  ],
  '3-5-2': [
    { row: 5, col: 2, colSpan: 2 },
    { row: 4, col: 1 }, { row: 4, col: 2 }, { row: 4, col: 4 },
    { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 }, { row: 3, col: 4 }, { row: 3, col: 5 },
    { row: 2, col: 2 }, { row: 2, col: 3 },
  ],
  '4-2-3-1': [
    { row: 5, col: 2, colSpan: 2 },
    { row: 4, col: 1 }, { row: 4, col: 2 }, { row: 4, col: 3 }, { row: 4, col: 4 },
    { row: 3, col: 2 }, { row: 3, col: 3 },
    { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 4 },
    { row: 1, col: 2, colSpan: 2 },
  ],
}

export function App() {
  const [page, setPage] = useState<Page>('squad')

  const [formation, setFormation] = useState<Formation>('4-3-3')
  const [filter, setFilter] = useState<(typeof filters)[number]>('ALL')
  const [selected, setSelected] = useState<number[]>([13, 8, 9, 10, 11, 4, 5, 6, 0, 1, 2])
  const [focused, setFocused] = useState<Player>(players[0])
  const [opponentCode, setOpponentCode] = useState('ARG')

  const [wallet, setWallet] = useState<string | null>(null)

  const [epoch, setEpoch] = useState<number | null>(null)

  const [publishedTeams, setPublishedTeams] = useState<PublishedTeam[]>([])

  const [teamName, setTeamName] = useState('My Team')
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [lastTxUrl, setLastTxUrl] = useState<string | null>(null)

  // ── Formation auto-adjustment ───────────────────────────────────────────────────
  const prevFormation = useRef<Formation | null>(null)
  useEffect(() => {
    if (prevFormation.current && prevFormation.current !== formation && selected.length === 11) {
      const oldCounts = formationCounts[prevFormation.current]
      const newCounts = formationCounts[formation]
      const changes: Array<{ pos: Position; need: number }> = []

      ;(Object.keys(oldCounts) as Position[]).forEach((pos) => {
        const need = oldCounts[pos] - newCounts[pos]
        if (need !== 0) changes.push({ pos, need })
      })

      setSelected((cur) => {
        let next = [...cur]
        changes.forEach(({ pos, need }) => {
          if (need > 0) {
            const toRemove = next
              .map((id) => players.find((p) => p.id === id))
              .filter((p): p is Player => p?.position === pos)
              .sort((a, b) => a.overall - b.overall)
              .slice(0, need)
            next = next.filter((id) => !toRemove.some(p => p.id === id))
          } else if (need < 0) {
            const toAdd = Math.abs(need)
            const best = players
              .filter((p) => p.position === pos && !next.includes(p.id))
              .sort((a, b) => b.overall - a.overall)
              .slice(0, toAdd)
            next = [...next, ...best.map(p => p.id)]
          }
        })
        return next
      })
      setLastTxUrl(null)
    }
    prevFormation.current = formation
  }, [formation])

  // Load from localStorage and auto-connect wallet on mount
  useEffect(() => {
    fetchEpoch().then(setEpoch)

    try {
      const saved = localStorage.getItem('fifyard-teams')
      if (saved) {
        const parsed = JSON.parse(saved) as PublishedTeam[]
        setPublishedTeams(parsed)
      }
    } catch { /* ignore */ }

    const provider = window.phantom?.solana
    if (provider?.isPhantom && provider.publicKey) {
      setWallet(provider.publicKey.toString())
    }
  }, [])

  // Fetch teams from blockchain when wallet connects
  useEffect(() => {
    if (wallet) {
      fetchPublishedTeams(wallet).then((onChainTeams) => {
        setPublishedTeams(() => {
          try { localStorage.setItem('fifyard-teams', JSON.stringify(onChainTeams)) } catch { /* ignore */ }
          return onChainTeams
        })
      }).catch(console.error)
    }
  }, [wallet])

  // ── Derived squad values ──────────────────────────────────────────────────
  const selectedPlayers = useMemo(
    () => selected.map((id) => players.find((p) => p.id === id)).filter((p): p is Player => Boolean(p)),
    [selected],
  )
  const filteredPlayers = filter === 'ALL' ? players : players.filter((p) => p.position === filter)
  const opponent = opponents.find((o) => o.code === opponentCode) ?? opponents[0]
  const lineupValid = isValidLineup(selectedPlayers, formation)
  const prediction = predictMatch(selectedPlayers, opponent.rating, lineupValid)
  const average = selectedPlayers.length
    ? Math.round(selectedPlayers.reduce((s, p) => s + p.overall, 0) / selectedPlayers.length)
    : 0
  const positionCounts = selectedPlayers.reduce<Record<Position, number>>(
    (c, p) => ({ ...c, [p.position]: c[p.position] + 1 }),
    { GK: 0, DEF: 0, MID: 0, FWD: 0 },
  )
  const expected = formationCounts[formation]
  const fullLineupValid = selected.length === 11 &&
    filters.slice(1).every((pos) => positionCounts[pos as Position] === expected[pos as Position])

  // ── Player actions ────────────────────────────────────────────────────────
  function togglePlayer(player: Player) {
    setFocused(player)
    setSelected((cur) => {
      if (cur.includes(player.id)) return cur.filter((id) => id !== player.id)
      if (cur.length >= 11) return cur
      return [...cur, player.id]
    })
    setLastTxUrl(null)
  }

  // ── Publish action ────────────────────────────────────────────────────────
  async function submitXI() {
    if (!wallet || !fullLineupValid) return
    setPublishing(true)
    setPublishError('')
    setLastTxUrl(null)
    try {
      const signature = await publishTeamSnapshot(wallet, {
        name: teamName,
        formation,
        playerIds: selected,
        opponent: opponent.code,
        winRate: prediction.win,
        squadRating: average,
      })
      const txUrl = solscanTransactionUrl(signature)
      setLastTxUrl(txUrl)
      const newTeam: PublishedTeam = {
        id: signature,
        name: teamName,
        formation,
        playerIds: [...selected],
        squadRating: average,
        opponent: opponent.code,
        winRate: prediction.win,
        publishedAt: Date.now(),
        txUrl,
      }
      setPublishedTeams((prev) => {
        const updated = [...prev, newTeam]
        try { localStorage.setItem('fifyard-teams', JSON.stringify(updated)) } catch { /* ignore */ }
        return updated
      })
    } catch (err: unknown) {
      console.error('Publish error:', err)
      setPublishError(String(err))
    } finally {
      setPublishing(false)
    }
  }

  // ── Pitch slot renderer ───────────────────────────────────────────────────
  const slots = formationSlots[formation]
  const maxCol = Math.max(...slots.map((s) => (s.col ?? 1) + (s.colSpan ?? 1) - 1))
  const pitchCols = Math.max(4, maxCol)

  const historyOpenRef = useRef(false)

  function handleShowHistory() {
    historyOpenRef.current = true
    setPage('predictions')
  }

  return (
    <div className="app-shell">
      <Sidebar activePage={page} onNavigate={setPage} />
      <div className="app-main">
        <header className="topbar">
          <div>
            <span className="live-dot" /> LIVE PLAYER ORACLE{' '}
            <b>·</b> EPOCH {epoch !== null ? epoch : '…'}
          </div>
          <WalletButton
            wallet={wallet}
            onConnected={setWallet}
            onDisconnected={() => setWallet(null)}
            onShowHistory={handleShowHistory}
          />
        </header>

        <main>
          {page === 'squad' && (
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
                      <button
                        className={filter === item ? 'selected' : ''}
                        onClick={() => setFilter(item)}
                        key={item}
                      >
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
                        <button
                          className={formation === item ? 'selected' : ''}
                          onClick={() => setFormation(item)}
                          key={item}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pitch">
                    <div className="center-circle" />
                    <div className="penalty top" />
                    <div className="penalty bottom" />
                    <div
                      className="lineup"
                      style={{
                        gridTemplateColumns: `repeat(${pitchCols}, 1fr)`,
                        gridTemplateRows: 'repeat(5, 1fr)',
                      }}
                    >
                      {selectedPlayers.map((player, index) => {
                        const slot = slots[index]
                        if (!slot) return null
                        return (
                          <button
                            className="mini-card"
                            style={{
                              gridColumn: slot.colSpan
                                ? `${slot.col} / span ${slot.colSpan}`
                                : slot.col,
                              gridRow: slot.row,
                            }}
                            onClick={() => setFocused(player)}
                            key={player.id}
                          >
                            <span>{player.overall}</span>
                            <strong>{player.shortName}</strong>
                            <small>{player.position}</small>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="squad-summary">
                    <div><span>SQUAD RATING</span><strong>{average || '—'}</strong></div>
                    <div><span>FORMATION</span><strong>{formation}</strong></div>
                    <div>
                      <span>WIN RATE</span>
                      <strong>{fullLineupValid ? `${prediction.win}%` : '—'}</strong>
                    </div>
                    <div className="opponent-select">
                      <span>VS OPPONENT</span>
                      <select value={opponentCode} onChange={(e) => setOpponentCode(e.target.value)}>
                        {opponents.map((o) => (
                          <option value={o.code} key={o.code}>{o.country} ({o.rating})</option>
                        ))}
                      </select>
                    </div>
                    <div className="team-name-input">
                      <span>TEAM NAME</span>
                      <input
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        maxLength={32}
                        placeholder="My Team"
                      />
                    </div>
                    {!fullLineupValid && selected.length > 0 && (
                      <div className="lineup-validation">
                        Need: GK {expected.GK}, DEF {expected.DEF}, MID {expected.MID}, FWD {expected.FWD}
                        <br />
                        Have: GK {positionCounts.GK}, DEF {positionCounts.DEF}, MID {positionCounts.MID}, FWD {positionCounts.FWD}
                      </div>
                    )}
                    <button
                      className="submit-xi-btn"
                      disabled={!wallet || !fullLineupValid || publishing}
                      onClick={submitXI}
                    >
                      {publishing
                        ? 'Publishing…'
                        : !wallet
                        ? 'Connect wallet'
                        : !fullLineupValid
                        ? 'Complete a valid XI'
                        : 'Submit XI'}
                    </button>
                  </div>

                  {publishError && (
                    <p className="wallet-error" role="alert">{publishError}</p>
                  )}
                  {lastTxUrl && (
                    <p className="publish-success">
                      Published! <a href={lastTxUrl} target="_blank" rel="noreferrer">View on Solscan ↗</a>
                    </p>
                  )}
                </div>

                <aside className="stat-panel">
                  <div className="card-kicker">PLAYER INTELLIGENCE</div>
                  <div className="featured-rating">
                    <strong>{focused.overall}</strong><span>OVR</span>
                  </div>
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
                    <span>
                      <strong>VERIFIED ON-CHAIN</strong>
                      Stats oracle · Epoch {epoch !== null ? epoch : '…'}
                    </span>
                  </div>
                  <code>PLAYER PDA · 7xK2…mP9q</code>
                </aside>
              </div>
            </section>
          )}

          {page === 'predictions' && (
            <div className="workspace">
              <PredictionsPage publishedTeams={publishedTeams} />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
import { useMemo, useState } from 'react'
import { ChevronDown, Grid2X2, List, Search, SlidersHorizontal, UsersRound } from 'lucide-react'
import { PlayerCard } from './components/PlayerCard'
import { PlayerEditor } from './components/PlayerEditor'
import { PredictionPanel } from './components/PredictionPanel'
import { Sidebar } from './components/Sidebar'
import { WalletButton } from './components/WalletButton'
import { calculateOverall, formations, isValidLineup, opponents, predictMatch, type Formation } from './lib/prediction'
import { publishTeamSnapshot, solscanTransactionUrl } from './lib/solana'
import { players as officialPlayers, type Player, type PlayerStats, type Position } from './players'

const positions: Array<'ALL' | Position> = ['ALL', 'GK', 'DEF', 'MID', 'FWD']
const defaultSelection = [13, 8, 9, 10, 11, 4, 5, 6, 0, 1, 2]

export function App() {
  const [workingPlayers, setWorkingPlayers] = useState(officialPlayers)
  const [selectedIds, setSelectedIds] = useState<number[]>(defaultSelection)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [wallet, setWallet] = useState<string | null>(null)
  const [formation, setFormation] = useState<Formation>('4-3-3')
  const [teamCountry, setTeamCountry] = useState('MAS')
  const [opponentCode, setOpponentCode] = useState('ARG')
  const [position, setPosition] = useState<(typeof positions)[number]>('ALL')
  const [query, setQuery] = useState('')
  const [compact, setCompact] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [transactionUrl, setTransactionUrl] = useState<string | null>(null)

  const selectedPlayers = useMemo(
    () => selectedIds.map((id) => workingPlayers.find((player) => player.id === id)).filter((player): player is Player => Boolean(player)),
    [selectedIds, workingPlayers],
  )
  const filteredPlayers = useMemo(() => workingPlayers.filter((player) => {
    const matchesPosition = position === 'ALL' || player.position === position
    const matchesQuery = `${player.name} ${player.club} ${player.country}`.toLowerCase().includes(query.toLowerCase())
    return matchesPosition && matchesQuery
  }), [position, query, workingPlayers])
  const editingPlayer = editingId === null ? null : workingPlayers.find((player) => player.id === editingId) ?? null
  const opponent = opponents.find((item) => item.code === opponentCode) ?? opponents[0]
  const lineupValid = isValidLineup(selectedPlayers, formation)
  const prediction = predictMatch(selectedPlayers, opponent.rating, lineupValid)

  function togglePlayer(player: Player) {
    setSelectedIds((current) => {
      if (current.includes(player.id)) return current.filter((id) => id !== player.id)
      return current.length < 11 ? [...current, player.id] : current
    })
    setTransactionUrl(null)
  }

  function updatePlayerStats(playerId: number, stats: PlayerStats) {
    setWorkingPlayers((current) => current.map((player) => player.id === playerId
      ? { ...player, stats, overall: calculateOverall(player.position, stats) }
      : player))
    setTransactionUrl(null)
  }

  function resetPlayer(playerId: number) {
    const official = officialPlayers.find((player) => player.id === playerId)
    if (!official) return
    setWorkingPlayers((current) => current.map((player) => player.id === playerId ? official : player))
  }

  async function publishFormation() {
    if (!wallet || !lineupValid) return
    setPublishing(true)
    setPublishError('')
    setTransactionUrl(null)
    try {
      const signature = await publishTeamSnapshot(wallet, {
        country: teamCountry,
        formation,
        playerIds: selectedIds,
        opponent: opponent.code,
        winRate: prediction.win,
      })
      setTransactionUrl(solscanTransactionUrl(signature))
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : 'The devnet transaction failed.')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <header className="topbar">
          <div><span className="live-dot" /> LIVE PLAYER ORACLE <b>·</b> EPOCH 491</div>
          <WalletButton wallet={wallet} onConnected={setWallet} />
        </header>

        <main>
          <section className="vault" id="vault">
            <div className="page-heading">
              <div><span>COLLECT · CUSTOMIZE · COMPETE</span><h1>Player Vault</h1><p>Collect unique player cards, model your own lineups, and publish predictions on Solana.</p></div>
              <div className="vault-value"><span>COLLECTION VALUE</span><strong>31.7 <small>SOL</small></strong><em>+6.4% this month</em></div>
            </div>

            <div className="vault-metrics">
              <article><span>OWNED PLAYERS</span><strong>15</strong><small>11 in starting XI</small></article>
              <article><span>AVG. RATING</span><strong>{prediction.squadRating}</strong><small>Active formation</small></article>
              <article><span>PREDICTED WIN</span><strong>{prediction.win}%</strong><small>vs. {opponent.country}</small></article>
              <article><span>TEAM COUNTRY</span><strong>{teamCountry}</strong><small>On-chain identity</small></article>
            </div>

            <div className="collection-toolbar">
              <div className="period-tabs"><button className="active">7D</button><button>1M</button><button>ALL</button></div>
              <label className="search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search players" /></label>
              <div className="position-filter">{positions.map((item) => <button className={position === item ? 'active' : ''} onClick={() => setPosition(item)} key={item}>{item}</button>)}</div>
              <button className="sort-button">Rating: high <ChevronDown size={15} /></button>
              <button className="filter-button"><SlidersHorizontal size={16} /> Filters</button>
              <div className="view-toggle"><button className={!compact ? 'active' : ''} onClick={() => setCompact(false)} aria-label="Card view"><Grid2X2 size={17} /></button><button className={compact ? 'active' : ''} onClick={() => setCompact(true)} aria-label="Compact view"><List size={18} /></button></div>
            </div>

            <div className={`collection-grid ${compact ? 'compact' : ''}`}>
              {filteredPlayers.map((player) => <PlayerCard player={player} selected={selectedIds.includes(player.id)} onEdit={(item) => setEditingId(item.id)} onToggle={togglePlayer} key={player.id} />)}
            </div>
          </section>

          <section className="team-studio" id="studio">
            <div className="studio-heading"><div><span>TEAM STUDIO</span><h2>Build a country squad</h2><p>Choose exactly eleven collectible players that match your formation.</p></div><div className={`lineup-status ${lineupValid ? 'valid' : ''}`}><UsersRound size={18} /><strong>{selectedPlayers.length}/11</strong><span>{lineupValid ? 'LINEUP VALID' : 'ADJUST POSITIONS'}</span></div></div>
            <div className="studio-grid">
              <section className="team-config">
                <div className="config-row"><label>Representing<select value={teamCountry} onChange={(event) => { setTeamCountry(event.target.value); setTransactionUrl(null) }}>{opponents.map((item) => <option value={item.code} key={item.code}>{item.country} ({item.code})</option>)}</select></label><label>Formation<select value={formation} onChange={(event) => { setFormation(event.target.value as Formation); setTransactionUrl(null) }}>{formations.map((item) => <option value={item} key={item}>{item}</option>)}</select></label><label>Opponent<select value={opponentCode} onChange={(event) => { setOpponentCode(event.target.value); setTransactionUrl(null) }}>{opponents.filter((item) => item.code !== teamCountry).map((item) => <option value={item.code} key={item.code}>{item.country} · {item.rating}</option>)}</select></label></div>
                <div className="selected-lineup">
                  {selectedPlayers.map((player) => <button onClick={() => setEditingId(player.id)} key={player.id}><span style={{ background: player.accent }}>{player.shortName.slice(0, 2)}</span><strong>{player.shortName}</strong><small>{player.position}</small><b>{player.overall}</b></button>)}
                  {Array.from({ length: Math.max(0, 11 - selectedPlayers.length) }, (_, index) => <div className="empty-slot" key={`empty-${index}`}>+</div>)}
                </div>
                <div className="integrity-note"><b>Stats integrity:</b> Official ratings are oracle-controlled. Your custom training profiles affect simulations and are included in the signed team snapshot without changing the collectible's canonical record.</div>
              </section>
              <PredictionPanel {...prediction} lineupValid={lineupValid} walletConnected={Boolean(wallet)} publishing={publishing} transactionUrl={transactionUrl} onPublish={publishFormation} />
            </div>
            {publishError && <p className="publish-error" role="alert">{publishError}</p>}
          </section>

          <section className="wallet-purpose" id="contract">
            <div><span>WHY PHANTOM?</span><h2>Your wallet is your FIFYard account.</h2></div>
            <div className="purpose-grid"><article><b>01</b><h3>Prove ownership</h3><p>Read which player NFTs belong to you and determine who can enter your starting XI.</p></article><article><b>02</b><h3>Approve actions</h3><p>Sign team publications, player purchases, transfers, and future prediction entries. FIFYard cannot sign for you.</p></article><article><b>03</b><h3>Verify everything</h3><p>Every successful write returns a Solscan devnet link for the transaction, accounts, and program interaction.</p></article></div>
          </section>
        </main>
      </div>
      {editingPlayer && <PlayerEditor player={editingPlayer} onChange={(stats) => updatePlayerStats(editingPlayer.id, stats)} onClose={() => setEditingId(null)} onReset={() => resetPlayer(editingPlayer.id)} />}
    </div>
  )
}

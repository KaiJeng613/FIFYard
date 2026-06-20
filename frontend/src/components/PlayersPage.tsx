import { useState } from 'react'
import { Star, StarOff, ShoppingCart, X, ChevronUp, ChevronDown, Search, ExternalLink, Loader } from 'lucide-react'
import { players, type Player, type Position } from '../players'
import { purchasePlayer } from '../lib/solana'

type SortKey = 'overall' | 'pace' | 'shooting' | 'passing' | 'dribbling' | 'defending' | 'stamina' | 'floor'
type FilterPos = 'ALL' | Position

interface PlayersPageProps {
  wallet: string | null
  shortlist: number[]
  onShortlistChange: (ids: number[]) => void
  onSaveShortlist: (ids: number[]) => void
  saving: boolean
}

type PurchaseState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'success'; txUrl: string }
  | { status: 'error'; message: string }

const statLabels: { key: SortKey; label: string }[] = [
  { key: 'overall',   label: 'OVR'   },
  { key: 'pace',      label: 'PAC'   },
  { key: 'shooting',  label: 'SHO'   },
  { key: 'passing',   label: 'PAS'   },
  { key: 'dribbling', label: 'DRI'   },
  { key: 'defending', label: 'DEF'   },
  { key: 'stamina',   label: 'STA'   },
  { key: 'floor',     label: 'PRICE' },
]

const posFilters: FilterPos[] = ['ALL', 'GK', 'DEF', 'MID', 'FWD']

function statValue(p: Player, key: SortKey): number {
  if (key === 'overall') return p.overall
  if (key === 'floor') return p.floor
  return p.stats[key as keyof typeof p.stats]
}

function StatBar({ value, max = 100 }: { value: number; max?: number }) {
  return (
    <div className="pp-stat-track">
      <div className="pp-stat-fill" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  )
}

function PlayerDetailPanel({ player, shortlisted, purchaseState, onToggleShortlist, onPurchase, wallet }: {
  player: Player
  shortlisted: boolean
  purchaseState: PurchaseState
  onToggleShortlist: () => void
  onPurchase: () => void
  wallet: string | null
}) {
  const isPending  = purchaseState.status === 'pending'
  const isSuccess  = purchaseState.status === 'success'
  const isError    = purchaseState.status === 'error'

  return (
    <div className="pp-detail">
      <div className="pp-detail-accent" style={{ background: `linear-gradient(135deg, ${player.accent}22 0%, transparent 60%)` }} />
      <div className="pp-detail-kicker">PLAYER PROFILE</div>
      <div className="pp-detail-rating" style={{ color: player.accent }}>{player.overall}</div>
      <h2 className="pp-detail-name">{player.name}</h2>
      <p className="pp-detail-meta">{player.position} · {player.club} · {player.country}</p>

      <div className="pp-detail-stats">
        {Object.entries(player.stats).map(([key, val]) => (
          <div className="pp-detail-stat-row" key={key}>
            <span className="pp-detail-stat-label">{key.toUpperCase().slice(0, 3)}</span>
            <StatBar value={val} />
            <span className="pp-detail-stat-val">{val}</span>
          </div>
        ))}
      </div>

      <div className="pp-detail-floor">
        <span>MARKET VALUE</span>
        <strong>{player.floor} SOL</strong>
      </div>

      <div className="pp-detail-actions">
        <button
          className={`pp-shortlist-btn ${shortlisted ? 'active' : ''}`}
          onClick={onToggleShortlist}
          disabled={isPending}
          title={shortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
        >
          {shortlisted ? <StarOff size={14} /> : <Star size={14} />}
          {shortlisted ? 'Remove' : 'Shortlist'}
        </button>

        <button
          className={`pp-buy-btn ${isSuccess ? 'owned' : ''}`}
          disabled={!wallet || isPending || isSuccess}
          onClick={onPurchase}
          title={!wallet ? 'Connect wallet to purchase' : isSuccess ? 'Already purchased' : `Buy for ${player.floor} SOL`}
        >
          {isPending
            ? <><Loader size={14} className="pp-spin" /> Confirming…</>
            : isSuccess
            ? <>✓ Purchased</>
            : <><ShoppingCart size={14} /> {wallet ? `Buy · ${player.floor} SOL` : 'Connect wallet'}</>
          }
        </button>
      </div>

      {isSuccess && purchaseState.status === 'success' && (
        <a className="pp-tx-success" href={purchaseState.txUrl} target="_blank" rel="noreferrer">
          View purchase on Solscan <ExternalLink size={11} />
        </a>
      )}
      {isError && purchaseState.status === 'error' && (
        <p className="pp-tx-error">{purchaseState.message}</p>
      )}
      {!wallet && (
        <p className="pp-detail-note">Connect your wallet to purchase players and sync your shortlist on-chain.</p>
      )}
    </div>
  )
}

export function PlayersPage({ wallet, shortlist, onShortlistChange, onSaveShortlist, saving }: PlayersPageProps) {
  const [posFilter, setPosFilter]   = useState<FilterPos>('ALL')
  const [search, setSearch]         = useState('')
  const [sortKey, setSortKey]       = useState<SortKey>('overall')
  const [sortAsc, setSortAsc]       = useState(false)
  const [selectedId, setSelectedId] = useState<number>(players[0].id)
  const [tab, setTab]               = useState<'all' | 'shortlist'>('all')

  // per-player purchase states keyed by player id
  const [purchaseStates, setPurchaseStates] = useState<Record<number, PurchaseState>>({})

  const selectedPlayer  = players.find(p => p.id === selectedId) ?? players[0]
  const shortlisted     = shortlist.includes(selectedId)
  const currentPurchase = purchaseStates[selectedId] ?? { status: 'idle' }

  function setPurchase(id: number, state: PurchaseState) {
    setPurchaseStates(prev => ({ ...prev, [id]: state }))
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  function toggleShortlist(id: number) {
    const next = shortlist.includes(id)
      ? shortlist.filter(x => x !== id)
      : [...shortlist, id]
    onShortlistChange(next)
  }

  async function handlePurchase() {
    if (!wallet) return
    const p = selectedPlayer
    if (purchaseStates[p.id]?.status === 'success') return

    setPurchase(p.id, { status: 'pending' })
    try {
      const result = await purchasePlayer(wallet, p.id, p.name, p.floor)
      setPurchase(p.id, { status: 'success', txUrl: result.txUrl })
      // Auto-shortlist on purchase
      if (!shortlist.includes(p.id)) onShortlistChange([...shortlist, p.id])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setPurchase(p.id, { status: 'error', message: msg })
    }
  }

  const baseList = tab === 'shortlist'
    ? players.filter(p => shortlist.includes(p.id))
    : players

  const filtered = baseList
    .filter(p => posFilter === 'ALL' || p.position === posFilter)
    .filter(p =>
      search === '' ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.shortName.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const diff = statValue(a, sortKey) - statValue(b, sortKey)
      return sortAsc ? diff : -diff
    })

  return (
    <section className="players-page">
      <div className="section-heading">
        <div>
          <span>02 / PLAYERS</span>
          <h2>Player Market</h2>
        </div>
        <div className="pp-shortlist-count">
          <strong>{shortlist.length}</strong>
          <span>SHORTLISTED</span>
          {shortlist.length > 0 && (
            <button
              className="pp-save-btn"
              onClick={() => onSaveShortlist(shortlist)}
              disabled={!wallet || saving}
            >
              {saving ? 'Saving…' : 'Save on-chain'}
            </button>
          )}
        </div>
      </div>

      <div className="pp-layout">
        {/* ── Left: player list ── */}
        <div className="pp-list-panel">
          <div className="pp-tabs">
            <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>All Players</button>
            <button className={tab === 'shortlist' ? 'active' : ''} onClick={() => setTab('shortlist')}>
              Shortlist {shortlist.length > 0 && <span className="pp-tab-badge">{shortlist.length}</span>}
            </button>
          </div>

          <div className="pp-list-controls">
            <div className="pp-search-wrap">
              <Search size={13} />
              <input
                className="pp-search"
                placeholder="Search players…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button className="pp-search-clear" onClick={() => setSearch('')}>
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="pp-pos-filters">
              {posFilters.map(pos => (
                <button
                  key={pos}
                  className={posFilter === pos ? 'active' : ''}
                  onClick={() => setPosFilter(pos)}
                >{pos}</button>
              ))}
            </div>
          </div>

          <div className="pp-table-header">
            <span className="pp-col-player">Player</span>
            {statLabels.map(({ key, label }) => (
              <button
                key={key}
                className={`pp-col-stat ${sortKey === key ? 'sort-active' : ''}`}
                onClick={() => handleSort(key)}
              >
                {label}
                {sortKey === key ? (sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />) : null}
              </button>
            ))}
            <span className="pp-col-action" />
          </div>

          <div className="pp-table-body">
            {filtered.length === 0 && (
              <div className="pp-empty">No players match your filter.</div>
            )}
            {filtered.map(p => {
              const isShortlisted = shortlist.includes(p.id)
              const ps = purchaseStates[p.id]
              const isOwned = ps?.status === 'success'
              const isBuying = ps?.status === 'pending'
              return (
                <button
                  key={p.id}
                  className={`pp-row ${selectedId === p.id ? 'selected' : ''} ${isShortlisted ? 'shortlisted' : ''} ${isOwned ? 'owned' : ''}`}
                  onClick={() => setSelectedId(p.id)}
                >
                  <span className="pp-col-player">
                    <span className="pp-row-ovr" style={{ color: p.accent }}>{p.overall}</span>
                    <span className="pp-row-info">
                      <strong>{p.name}</strong>
                      <small>{p.club} · {p.country}</small>
                    </span>
                    <span className={`pp-row-pos pp-pos-${p.position.toLowerCase()}`}>{p.position}</span>
                    {isOwned  && <span className="pp-owned-badge">OWNED</span>}
                    {isBuying && <span className="pp-owned-badge pp-buying-badge">BUYING…</span>}
                  </span>
                  {statLabels.map(({ key }) => (
                    <span key={key} className="pp-col-stat">
                      {key === 'floor' ? `${statValue(p, key)}◎` : statValue(p, key)}
                    </span>
                  ))}
                  <span className="pp-col-action">
                    <button
                      className={`pp-mini-star ${isShortlisted ? 'active' : ''}`}
                      onClick={e => { e.stopPropagation(); toggleShortlist(p.id) }}
                      title={isShortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
                    >
                      <Star size={12} />
                    </button>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Right: detail panel ── */}
        <PlayerDetailPanel
          player={selectedPlayer}
          shortlisted={shortlisted}
          purchaseState={currentPurchase}
          onToggleShortlist={() => toggleShortlist(selectedId)}
          onPurchase={handlePurchase}
          wallet={wallet}
        />
      </div>
    </section>
  )
}

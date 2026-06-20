import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ChevronDown, History, LogOut, WalletCards } from 'lucide-react'
import { phantomProvider } from '../lib/solana'

interface WalletButtonProps {
  wallet: string | null
  onConnected: (address: string) => void
  onDisconnected: () => void
  onShowHistory: () => void
}

function timeout<T>(ms: number): Promise<T> {
  return new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
}

async function fetchBalanceDirect(address: string): Promise<number | null> {
  // ── Strategy 1: ask Phantom directly via its own JSON-RPC request ──────────
  // Phantom already holds an open, authenticated devnet connection — no rate
  // limit applies, no CORS issue, fastest path.
  try {
    const provider = phantomProvider()
    if (provider) {
      const resp = await Promise.race([
        provider.request({ method: 'getBalance', params: [address, { commitment: 'confirmed' }] }),
        timeout<never>(4000),
      ]) as { value: number } | number
      const lamports = typeof resp === 'number' ? resp : (resp as { value: number }).value
      if (typeof lamports === 'number') {
        console.log(`Balance via Phantom RPC: ${lamports} lamports`)
        return lamports
      }
    }
  } catch (e) {
    console.warn('Phantom RPC balance failed:', e)
  }

  // ── Strategy 2: raw fetch() to public devnet nodes ─────────────────────────
  // Using fetch() directly bypasses the Solana.js retry logic that can cause
  // silent 429 returns of 0. We parse the JSON-RPC response ourselves.
  const RPC_ENDPOINTS = [
    'https://api.devnet.solana.com',
    'https://rpc.ankr.com/solana_devnet',
  ]
  const body = JSON.stringify({
    jsonrpc: '2.0', id: 1,
    method: 'getBalance',
    params: [address, { commitment: 'confirmed' }],
  })
  for (const url of RPC_ENDPOINTS) {
    try {
      const res = await Promise.race([
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }),
        timeout<never>(5000),
      ]) as Response
      if (!res.ok) { console.warn(`${url} returned ${res.status}`); continue }
      const json = await res.json() as { result?: { value?: number }; error?: unknown }
      if (json.error) { console.warn(`${url} RPC error:`, json.error); continue }
      const lamports = json.result?.value
      if (typeof lamports === 'number') {
        console.log(`Balance via ${url}: ${lamports} lamports`)
        return lamports
      }
    } catch (e) {
      console.warn(`Balance fetch failed on ${url}:`, e)
    }
  }

  return null // all strategies failed
}

function shortAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

function formatSOL(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(3)
}

export function WalletButton({ wallet, onConnected, onDisconnected, onShowHistory }: WalletButtonProps) {
  const [error, setError]     = useState('')
  const [open, setOpen]       = useState(false)
  const [balance, setBalance] = useState<number | null | undefined>(undefined)
  const [network, setNetwork] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!wallet) {
      setBalance(null)
      setNetwork(null)
      return
    }

    setBalance(undefined) // undefined = still loading, null = failed
    fetchBalanceDirect(wallet).then(setBalance)

    const p = phantomProvider()
    setNetwork(p?.network ?? null)
  }, [wallet])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function connect() {
    setError('')
    const provider = phantomProvider()
    if (!provider) {
      window.open('https://phantom.com/download', '_blank', 'noopener,noreferrer')
      setError('Phantom not found — install page opened.')
      return
    }
    if (provider.publicKey) {
      onConnected(provider.publicKey.toString())
      return
    }
    try {
      const result = await provider.connect({ onlyTrusted: false })
      onConnected(result.publicKey.toString())
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg && !msg.includes('rejected')) setError(msg)
    }
  }

  async function disconnect() {
    setOpen(false)
    const provider = phantomProvider()
    // Only call disconnect — never delete window.phantom.solana, that breaks the
    // provider object for the rest of the page session.
    try { await provider?.disconnect() } catch { /* ignore */ }
    onDisconnected()
  }

  if (!wallet) {
    return (
      <div className="wallet-control" ref={ref}>
        <button className="phantom-button" onClick={connect}>
          <WalletCards size={16} /> Connect
        </button>
        {error && <span className="wallet-tooltip" role="alert">{error}</span>}
      </div>
    )
  }

  return (
    <div className="wallet-control" ref={ref}>
      <button className="phantom-button connected" onClick={() => setOpen(v => !v)}>
        <WalletCards size={16} />
        {shortAddress(wallet)}
        {balance !== undefined && balance !== null && (
          <span className="phantom-balance">{formatSOL(balance)} SOL</span>
        )}
        {balance === undefined && (
          <span className="phantom-balance phantom-balance-loading">···</span>
        )}
        <ChevronDown size={13} className={open ? 'chevron-up' : ''} />
      </button>

      {open && (
        <div className="wallet-dropdown">
          <div className="wallet-dropdown-address">{wallet}</div>
          <div className="wallet-balance">
            {balance === undefined && 'Fetching balance…'}
            {balance === null && 'Balance unavailable — RPC error'}
            {balance !== undefined && balance !== null && `${formatSOL(balance)} SOL`}
          </div>
          {network && network !== 'devnet' && (
            <span className="wallet-network-warning">
              <AlertTriangle size={12} /> Wrong network: {network}. Switch to Devnet in Phantom.
            </span>
          )}
          <button onClick={() => { setOpen(false); onShowHistory() }}>
            <History size={14} /> Published teams
          </button>
          <div className="wallet-dropdown-divider" />
          <button className="wallet-disconnect" onClick={disconnect}>
            <LogOut size={14} /> Disconnect
          </button>
        </div>
      )}
    </div>
  )
}

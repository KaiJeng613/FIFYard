import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ChevronDown, History, LogOut, WalletCards } from 'lucide-react'
import { Connection, PublicKey } from '@solana/web3.js'
import { phantomProvider } from '../lib/solana'

interface WalletButtonProps {
  wallet: string | null
  onConnected: (address: string) => void
  onDisconnected: () => void
  onShowHistory: () => void
}

// Dedicated fast endpoints just for balance — independent of the shared RPC connection
const BALANCE_RPCS = [
  'https://api.devnet.solana.com',
  'https://rpc.devnet.sonic.game',
]

async function fetchBalanceDirect(address: string): Promise<number> {
  const pubkey = new PublicKey(address)
  for (const endpoint of BALANCE_RPCS) {
    try {
      const conn = new Connection(endpoint, 'confirmed')
      const lamports = await Promise.race([
        conn.getBalance(pubkey),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000)),
      ])
      return lamports
    } catch {
      // try next endpoint
    }
  }
  return 0
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
  const [balance, setBalance] = useState<number | null>(null)
  const [network, setNetwork] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!wallet) {
      setBalance(null)
      setNetwork(null)
      return
    }

    setBalance(null) // reset to show fresh load
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
    try { await provider?.disconnect() } catch { /* ignore */ }
    if (window.phantom?.solana) delete window.phantom.solana
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
        {balance !== null && (
          <span className="phantom-balance">{formatSOL(balance)} SOL</span>
        )}
        <ChevronDown size={13} className={open ? 'chevron-up' : ''} />
      </button>

      {open && (
        <div className="wallet-dropdown">
          <div className="wallet-dropdown-address">{wallet}</div>
          <div className="wallet-balance">
            {balance !== null ? `${formatSOL(balance)} SOL` : 'Fetching balance…'}
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

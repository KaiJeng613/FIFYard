import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ExternalLink, History, LogOut, Settings, WalletCards } from 'lucide-react'
import { fetchBalance, phantomProvider, solscanProgramUrl } from '../lib/solana'

interface WalletButtonProps {
  wallet: string | null
  onConnected: (address: string) => void
  onDisconnected: () => void
  onShowHistory: () => void
}

function shortAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

function formatSOL(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(3)
}

export function WalletButton({ wallet, onConnected, onDisconnected, onShowHistory }: WalletButtonProps) {
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Fetch balance when wallet is connected
  useEffect(() => {
    if (!wallet) {
      setBalance(null)
      return
    }
    fetchBalance(wallet).then(setBalance)
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
    try {
      if (provider.publicKey) {
        await provider.disconnect()
        delete window.phantom?.solana
      }
      const result = await provider.connect({ onlyTrusted: false })
      onConnected(result.publicKey.toString())
    } catch {
      setError('Connection cancelled.')
    }
  }

  async function disconnect() {
    setOpen(false)
    const provider = phantomProvider()
    try { await provider?.disconnect() } catch { /* ignore */ }
    if (window.phantom?.solana) {
      delete window.phantom.solana
    }
    onDisconnected()
  }

  if (!wallet) {
    return (
      <div className="wallet-control" ref={ref}>
        <a className="program-link" href={solscanProgramUrl()} target="_blank" rel="noreferrer">
          Contract <ExternalLink size={13} />
        </a>
        <button className="phantom-button" onClick={connect}>
          <WalletCards size={16} /> Connect
        </button>
        {error && <span className="wallet-tooltip" role="alert">{error}</span>}
      </div>
    )
  }

  return (
    <div className="wallet-control" ref={ref}>
      <a className="program-link" href={solscanProgramUrl()} target="_blank" rel="noreferrer">
        Contract <ExternalLink size={13} />
      </a>
      <button className="phantom-button connected" onClick={() => setOpen((v) => !v)}>
        <WalletCards size={16} />
        {shortAddress(wallet)}
        <ChevronDown size={13} className={open ? 'chevron-up' : ''} />
      </button>
      {open && (
        <div className="wallet-dropdown">
          <div className="wallet-dropdown-address">{wallet}</div>
          <div className="wallet-balance">Balance: {balance !== null ? `${formatSOL(balance)} SOL` : 'Loading…'}</div>
          <button onClick={() => setOpen(false)}>
            <Settings size={14} /> Settings
          </button>
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

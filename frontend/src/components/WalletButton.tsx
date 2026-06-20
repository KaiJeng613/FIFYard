import { useState } from 'react'
import { ExternalLink, WalletCards } from 'lucide-react'
import { phantomProvider, solscanProgramUrl } from '../lib/solana'

interface WalletButtonProps {
  wallet: string | null
  onConnected: (address: string) => void
}

function shortAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

export function WalletButton({ wallet, onConnected }: WalletButtonProps) {
  const [error, setError] = useState('')

  async function connect() {
    setError('')
    const provider = phantomProvider()
    if (!provider) {
      window.open('https://phantom.com/download', '_blank', 'noopener,noreferrer')
      setError('Phantom is required. The install page opened in a new tab.')
      return
    }
    try {
      const result = await provider.connect()
      onConnected(result.publicKey.toString())
    } catch {
      setError('Phantom connection was cancelled.')
    }
  }

  return (
    <div className="wallet-control" id="wallet">
      <a className="program-link" href={solscanProgramUrl()} target="_blank" rel="noreferrer">Contract <ExternalLink size={13} /></a>
      <button className="phantom-button" onClick={connect}><WalletCards size={16} />{wallet ? shortAddress(wallet) : 'Connect Phantom'}</button>
      {error && <span className="wallet-tooltip" role="alert">{error}</span>}
    </div>
  )
}

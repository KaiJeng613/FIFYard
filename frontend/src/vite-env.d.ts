/// <reference types="vite/client" />

interface SolanaProvider {
  isPhantom?: boolean
  publicKey?: { toString(): string }
  connect(): Promise<{ publicKey: { toString(): string } }>
  disconnect(): Promise<void>
  signAndSendTransaction(transaction: import('@solana/web3.js').Transaction): Promise<string | { signature: string }>
}

interface Window {
  solana?: SolanaProvider
  phantom?: { solana?: SolanaProvider }
}

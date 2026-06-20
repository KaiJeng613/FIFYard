/// <reference types="vite/client" />

interface SolanaProvider {
  isPhantom?: boolean
  publicKey?: { toString(): string }
  connect(): Promise<{ publicKey: { toString(): string } }>
  disconnect(): Promise<void>
}

interface Window {
  solana?: SolanaProvider
}


/// <reference types="vite/client" />

interface ConnectOptions {
  onlyTrusted?: boolean
}

// Supported networks by Phantom
type PhantomNetwork = 'mainnet-beta' | 'testnet' | 'devnet'

interface SolanaProvider {
  isPhantom?: boolean
  publicKey?: { toString(): string }
  connect(options?: ConnectOptions): Promise<{ publicKey: { toString(): string } }>
  disconnect(): Promise<void>
  signAndSendTransaction(transaction: import('@solana/web3.js').Transaction): Promise<string | { signature: string }>
  request(args: { method: string; params?: unknown[] | unknown }): Promise<unknown>
  // Phantom exposes network when connected (may be undefined for older versions)
  network?: PhantomNetwork
}

interface Window {
  solana?: SolanaProvider
  phantom?: { solana?: SolanaProvider }
}
import { clusterApiUrl, Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js'
import type { Formation } from './prediction'

// Use a public RPC with better rate limits, or allow custom endpoint via env
const RPC_ENDPOINT = import.meta.env.VITE_SOLANA_RPC || clusterApiUrl('devnet')
export const connection = new Connection(RPC_ENDPOINT, 'confirmed')
export const programId = new PublicKey('6Ew7FSCCyS5EG5gkJ8TTq7Hbjy7tpB5tBVhRPmKnfujB')
const memoProgramId = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

export type TeamSnapshot = {
  name: string
  formation: Formation
  playerIds: number[]
  opponent: string
  winRate: number
  squadRating: number
}

export function phantomProvider() {
  const provider = window.phantom?.solana
  return provider?.isPhantom ? provider : undefined
}

export function solscanTransactionUrl(signature: string) {
  return `https://solscan.io/tx/${signature}?cluster=devnet`
}

export function solscanProgramUrl() {
  return `https://solscan.io/account/${programId.toBase58()}?cluster=devnet`
}

/** Fetch the current Solana devnet epoch number. Returns null on failure. */
export async function fetchEpoch(): Promise<number | null> {
  try {
    const info = await connection.getEpochInfo()
    return info.epoch
  } catch {
    return null
  }
}

/** Fetch SOL balance for an address. Returns lamports. */
export async function fetchBalance(address: string): Promise<number> {
  try {
    const lamports = await connection.getBalance(new PublicKey(address))
    return lamports
  } catch {
    return 0
  }
}

/** Check if Phantom is on devnet network */
export function isPhantomOnDevnet(): boolean {
  const provider = phantomProvider()
  return provider?.network === 'devnet' || !provider?.network
}

/** Retry with exponential backoff for rate-limited RPC calls */
async function retryRpc<T>(fn: () => Promise<T>, maxRetries = 3, delay = 500): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('429') && i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, delay * Math.pow(2, i)))
        continue
      }
      throw err
    }
  }
  throw new Error('Max retries exceeded')
}

export async function publishTeamSnapshot(ownerAddress: string, snapshot: TeamSnapshot): Promise<string> {
  const provider = phantomProvider()
  if (!provider) throw new Error('Phantom is not installed')

  // Check Phantom's network — must be devnet
  if (provider.network && provider.network !== 'devnet') {
    throw new Error(`Wrong network: ${provider.network}. Switch Phantom to Devnet.`)
  }

  const owner = new PublicKey(ownerAddress)

  const message = JSON.stringify({ app: 'FIFYard', v: 1, ...snapshot })
  const transaction = new Transaction().add(new TransactionInstruction({
    programId: memoProgramId,
    keys: [{ pubkey: owner, isSigner: true, isWritable: false }],
    data: Buffer.from(message, 'utf8'),
  }))

  // Retry RPC calls for rate limiting
  const { blockhash, lastValidBlockHeight } = await retryRpc(() => connection.getLatestBlockhash('confirmed'))
  transaction.feePayer = owner
  transaction.recentBlockhash = blockhash

  console.log('Publishing to devnet, fee payer:', owner.toBase58())
  const result = await provider.signAndSendTransaction(transaction)
  const signature = typeof result === 'string' ? result : result.signature
  console.log('Transaction sent:', signature)

  await retryRpc(() => connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed'))
  console.log('Transaction confirmed')
  return signature
}
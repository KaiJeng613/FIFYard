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

/** Type for published team data returned from on-chain */
export type OnChainTeam = {
  id: string
  name: string
  formation: Formation
  playerIds: number[]
  squadRating: number
  opponent: string
  winRate: number
  publishedAt: number
  txUrl: string | null
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

/** Fetch all FIFYard team snapshots from a wallet's Memo transactions */
export async function fetchPublishedTeams(walletAddress: string): Promise<OnChainTeam[]> {
  const pubKey = new PublicKey(walletAddress)

  // Get all transaction signatures for this wallet
  const sigs = await retryRpc(() => connection.getConfirmedSignaturesForAddress2(pubKey, { limit: 100 }))

  const teams: OnChainTeam[] = []

  for (const sigInfo of sigs) {
    const sig = sigInfo.signature
    try {
      const tx = await retryRpc(() => connection.getTransaction(sig))
      if (!tx || !tx.transaction) continue

      // Parse transaction message for memo instructions
      const msg = tx.transaction.message
      // Handle both legacy and versioned transactions
      const isLegacy = !('version' in msg) || msg.version === undefined

      if (!isLegacy) continue // Skip versioned transactions for simplicity

      const accountKeys = (msg as { accountKeys: PublicKey[] }).accountKeys
      const compiledIx = (msg as { instructions: { programIdIndex: number; data: string }[] }).instructions

      const memoIx = compiledIx.find((ix) => accountKeys[ix.programIdIndex]?.equals(memoProgramId))
      if (!memoIx?.data) continue

      // Decode base64 memo data - it's a string in CompiledInstruction
      const decoded = Buffer.from(memoIx.data, 'base64').toString('utf8')
      const json = JSON.parse(decoded)

      if (json.app === 'FIFYard' && json.v === 1) {
        teams.push({
          id: sig,
          name: json.name || 'My Team',
          formation: json.formation as Formation,
          playerIds: json.playerIds,
          squadRating: json.squadRating,
          opponent: json.opponent,
          winRate: json.winRate,
          publishedAt: sigInfo.blockTime ? sigInfo.blockTime * 1000 : Date.now(),
          txUrl: solscanTransactionUrl(sig),
        })
      }
    } catch {
      // Skip failed transactions
    }
  }

  return teams
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
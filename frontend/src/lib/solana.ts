import { clusterApiUrl, Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js'
import type { Formation } from './prediction'

// All devnet RPC endpoints - NO testnet/mainnet
const RPC_ENDPOINTS = [
  'https://api.devnet.solana.com',
  'https://devnet.helius-rpc.com',
  'https://rpc-devnet.solana.com',
  clusterApiUrl('devnet'),
]

let connection = new Connection(RPC_ENDPOINTS[0], 'confirmed')
let currentRpcIndex = 0

export function getConnection(): Connection {
  return connection
}

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

export async function fetchEpoch(): Promise<number | null> {
  try {
    const info = await connection.getEpochInfo()
    return info.epoch
  } catch (err) {
    console.error('Epoch fetch error:', err)
    if (currentRpcIndex < RPC_ENDPOINTS.length - 1) {
      currentRpcIndex++
      connection = new Connection(RPC_ENDPOINTS[currentRpcIndex], 'confirmed')
      return fetchEpoch()
    }
    return null
  }
}

export async function fetchBalance(address: string): Promise<number> {
  try {
    const lamports = await connection.getBalance(new PublicKey(address))
    return lamports
  } catch (err) {
    console.error('Balance fetch error:', err)
    if (currentRpcIndex < RPC_ENDPOINTS.length - 1) {
      currentRpcIndex++
      connection = new Connection(RPC_ENDPOINTS[currentRpcIndex], 'confirmed')
      return fetchBalance(address)
    }
    return 0
  }
}

export function isPhantomOnDevnet(): boolean {
  const provider = phantomProvider()
  return provider?.network === 'devnet' || !provider?.network
}

async function retryRpc<T>(fn: () => Promise<T>, maxRetries = 3, delay = 500): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`RPC error (attempt ${i + 1}):`, msg)
      if (msg.includes('429') || msg.includes('rate limit')) {
        if (currentRpcIndex < RPC_ENDPOINTS.length - 1) {
          currentRpcIndex++
          connection = new Connection(RPC_ENDPOINTS[currentRpcIndex], 'confirmed')
        }
        await new Promise((r) => setTimeout(r, delay * Math.pow(2, i)))
        continue
      }
      throw err
    }
  }
  throw new Error('Max retries exceeded')
}

export async function fetchPublishedTeams(walletAddress: string): Promise<OnChainTeam[]> {
  const pubKey = new PublicKey(walletAddress)
  console.log('Fetching teams for:', pubKey.toBase58())

  const sigs = await retryRpc(() => connection.getConfirmedSignaturesForAddress2(pubKey, { limit: 100 }))
  console.log('Found signatures:', sigs.length)

  const teams: OnChainTeam[] = []

  for (const sigInfo of sigs) {
    const sig = sigInfo.signature
    try {
      const tx = await retryRpc(() => connection.getTransaction(sig))
      if (!tx || !tx.transaction) continue

      const msg = tx.transaction.message
      const isLegacy = !('version' in msg) || msg.version === undefined

      if (!isLegacy) {
        console.log('Skipping versioned transaction:', sig)
        continue
      }

      const accountKeys = (msg as { accountKeys: PublicKey[] }).accountKeys
      const compiledIx = (msg as { instructions: { programIdIndex: number; data: string }[] }).instructions

      console.log(`Transaction ${sig}: ${compiledIx.length} instructions`)

      // Find Memo instruction
      const memoIx = compiledIx.find((ix) => accountKeys[ix.programIdIndex]?.equals(memoProgramId))
      if (!memoIx?.data) continue

      // Decode base64 memo data
      const decoded = Buffer.from(memoIx.data, 'base64').toString('utf8')
      console.log('Memo data:', decoded)

      const json = JSON.parse(decoded)

      if (json.app === 'FIFYard' && json.v === 1) {
        console.log('Found FIFYard team:', json)
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
    } catch (err) {
      console.error(`Failed to parse tx ${sig}:`, err)
    }
  }

  console.log('Total teams found:', teams.length)
  return teams
}

export async function publishTeamSnapshot(ownerAddress: string, snapshot: TeamSnapshot): Promise<string> {
  const provider = phantomProvider()
  if (!provider) throw new Error('Phantom is not installed')

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
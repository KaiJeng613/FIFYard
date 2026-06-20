import {
  clusterApiUrl,
  Connection,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import type { Formation } from './prediction'

// ── RPC endpoints ─────────────────────────────────────────────────────────────
// Only devnet endpoints that are actually reachable. clusterApiUrl('devnet')
// resolves to api.devnet.solana.com — keep as last-resort fallback only.
const RPC_ENDPOINTS = [
  'https://api.devnet.solana.com',
  clusterApiUrl('devnet'),  // same host, different codepath — fallback
]

let currentRpcIndex = 0
let connection = new Connection(RPC_ENDPOINTS[0], {
  commitment: 'confirmed',
  disableRetryOnRateLimit: true,   // we handle retries ourselves
})

// ── In-memory cache ───────────────────────────────────────────────────────────
// Avoids re-fetching the same on-chain data on every wallet reconnect.
const teamsCache = new Map<string, OnChainTeam[]>()
const shortlistCache = new Map<string, number[]>()

export function getConnection(): Connection {
  return connection
}

export const programId = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
const memoProgramId   = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

// ── Types ─────────────────────────────────────────────────────────────────────

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

export type PurchaseResult = { signature: string; txUrl: string }

// ── Phantom helpers ───────────────────────────────────────────────────────────

export function phantomProvider() {
  const provider = window.phantom?.solana ?? window.solana
  return provider?.isPhantom ? provider : undefined
}

function assertPhantom() {
  const provider = phantomProvider()
  if (!provider) throw new Error('Phantom wallet not found. Make sure it is installed and unlocked.')
  if (provider.network === 'mainnet-beta') {
    throw new Error('Phantom is on Mainnet. Switch to Devnet in Phantom → Settings → Developer Settings.')
  }
  return provider
}

// ── URL helpers ───────────────────────────────────────────────────────────────

export function solscanTransactionUrl(signature: string) {
  return `https://solscan.io/tx/${signature}?cluster=devnet`
}

export function solscanProgramUrl() {
  return `https://solscan.io/account/${programId.toBase58()}?cluster=devnet`
}

// ── Low-level RPC helpers ─────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`RPC timeout after ${ms}ms`)), ms)),
  ])
}

/** Wait ms milliseconds. */
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Rotate to the next RPC endpoint. Returns false when all endpoints are
 * exhausted (so callers know to stop retrying).
 */
function nextRpc(): boolean {
  if (currentRpcIndex >= RPC_ENDPOINTS.length - 1) return false
  currentRpcIndex++
  connection = new Connection(RPC_ENDPOINTS[currentRpcIndex], {
    commitment: 'confirmed',
    disableRetryOnRateLimit: true,
  })
  console.log(`RPC switched to #${currentRpcIndex}: ${RPC_ENDPOINTS[currentRpcIndex]}`)
  return true
}

/**
 * Execute an RPC call with:
 *  - a per-call timeout
 *  - exponential backoff on 429
 *  - automatic RPC rotation after repeated failure
 */
async function rpc<T>(fn: () => Promise<T>, timeoutMs = 8000, label = 'rpc'): Promise<T> {
  const MAX_ATTEMPTS = 4
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      return await withTimeout(fn(), timeoutMs)
    } catch (err) {
      const msg = String(err)
      const is429 = msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('rate limit')
      const isTimeout = msg.includes('timeout')
      console.warn(`${label} attempt ${i + 1} failed (${is429 ? '429' : isTimeout ? 'timeout' : 'error'}):`, msg)

      if (i < MAX_ATTEMPTS - 1) {
        // Exponential backoff: 500ms, 1s, 2s — then try next RPC
        const backoff = 500 * Math.pow(2, i)
        await sleep(backoff)
        if (is429 || i >= 1) nextRpc()
      }
    }
  }
  throw new Error(`${label}: all ${MAX_ATTEMPTS} attempts failed`)
}

// ── Epoch & balance ───────────────────────────────────────────────────────────

export async function fetchEpoch(): Promise<number | null> {
  try {
    const info = await rpc(() => connection.getEpochInfo(), 6000, 'fetchEpoch')
    return info.epoch
  } catch {
    return null
  }
}

// fetchBalance is kept for any remaining callers but WalletButton uses its own direct fetch
export async function fetchBalance(address: string): Promise<number> {
  try {
    return await rpc(() => connection.getBalance(new PublicKey(address)), 6000, 'fetchBalance')
  } catch {
    return 0
  }
}

export function isPhantomOnDevnet(): boolean {
  const provider = phantomProvider()
  return provider?.network === 'devnet' || !provider?.network
}

// ── Parse a legacy Memo transaction ─────────────────────────────────────────

type LegacyTx = {
  transaction: {
    message: {
      accountKeys: PublicKey[]
      instructions: Array<{ programIdIndex: number; data: string }>
    }
  }
  blockTime?: number | null
}

function parseMemoFromTx(tx: LegacyTx | null): string | null {
  if (!tx?.transaction) return null
  const msg = tx.transaction.message as {
    accountKeys: PublicKey[]
    instructions: Array<{ programIdIndex: number; data: string }>
  }
  const memoIx = msg.instructions.find(ix => msg.accountKeys[ix.programIdIndex]?.equals(memoProgramId))
  if (!memoIx?.data) return null
  try { return Buffer.from(memoIx.data, 'base64').toString('utf8') } catch { return null }
}

// ── Fetch published teams ─────────────────────────────────────────────────────

export async function fetchPublishedTeams(walletAddress: string): Promise<OnChainTeam[]> {
  // Return cached result if available
  if (teamsCache.has(walletAddress)) {
    return teamsCache.get(walletAddress)!
  }

  const pubKey = new PublicKey(walletAddress)

  // 1. Fetch signatures (one RPC call)
  let sigs: Array<{ signature: string; blockTime?: number | null }>
  try {
    sigs = await rpc(
      () => connection.getConfirmedSignaturesForAddress2(pubKey, { limit: 50 }),
      8000,
      'fetchSignatures',
    )
  } catch (err) {
    console.error('Could not fetch signatures:', err)
    return []
  }
  console.log(`Fetched ${sigs.length} signatures for ${walletAddress}`)

  // 2. Batch fetch all transactions in one call instead of N individual calls
  const sigStrings = sigs.map(s => s.signature)
  let txs: (LegacyTx | null)[] = []
  try {
    txs = await rpc(
      // getTransactions is the batch equivalent of getTransaction
      () => (connection as unknown as {
        getTransactions(sigs: string[], opts: object): Promise<(LegacyTx | null)[]>
      }).getTransactions(sigStrings, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 }),
      15000,
      'getTransactions-batch',
    )
  } catch {
    // Fallback: fetch individually but with a delay between each to avoid 429
    console.warn('Batch fetch failed, falling back to sequential with delay')
    txs = []
    for (const sig of sigStrings) {
      try {
        const tx = await rpc(() => connection.getTransaction(sig, { maxSupportedTransactionVersion: 0 }), 5000, 'getTransaction') as LegacyTx | null
        txs.push(tx)
        await sleep(120) // 120ms between requests ≈ ~8 req/s, well under 429 threshold
      } catch {
        txs.push(null)
      }
    }
  }

  const teams: OnChainTeam[] = []
  txs.forEach((tx, i) => {
    try {
      const memo = parseMemoFromTx(tx)
      if (!memo) return
      const json = JSON.parse(memo)
      if (json.app === 'FIFYard' && json.v === 1 && !json.type) {
        teams.push({
          id: sigs[i].signature,
          name: json.name || 'My Team',
          formation: json.formation as Formation,
          playerIds: json.playerIds,
          squadRating: json.squadRating,
          opponent: json.opponent,
          winRate: json.winRate,
          publishedAt: sigs[i].blockTime ? sigs[i].blockTime! * 1000 : Date.now(),
          txUrl: solscanTransactionUrl(sigs[i].signature),
        })
      }
    } catch { /* skip malformed */ }
  })

  console.log(`Found ${teams.length} FIFYard team(s)`)
  teamsCache.set(walletAddress, teams)
  return teams
}

/** Invalidate the teams cache for an address (call after publishing a new team). */
export function invalidateTeamsCache(walletAddress: string) {
  teamsCache.delete(walletAddress)
}

// ── Blockhash helper ──────────────────────────────────────────────────────────

async function getBlockhash() {
  return rpc(() => connection.getLatestBlockhash('confirmed'), 8000, 'getLatestBlockhash')
}

// ── Sign + send (no aggressive polling) ──────────────────────────────────────

async function signAndSend(
  provider: ReturnType<typeof assertPhantom>,
  transaction: Transaction,
): Promise<string> {
  // skipPreflight avoids an extra simulation RPC call that can 429
  const result = await provider.signAndSendTransaction(transaction)
  const signature = typeof result === 'string' ? result : result.signature
  console.log('Tx sent:', signature)
  // Don't poll confirmTransaction — just return the signature immediately.
  // The tx will confirm in ~400–800ms on devnet. Callers can link to Solscan.
  return signature
}

// ── Team publish ──────────────────────────────────────────────────────────────

export async function publishTeamSnapshot(ownerAddress: string, snapshot: TeamSnapshot): Promise<string> {
  const provider = assertPhantom()
  const owner = new PublicKey(ownerAddress)

  const transaction = new Transaction().add(new TransactionInstruction({
    programId: memoProgramId,
    keys: [{ pubkey: owner, isSigner: true, isWritable: false }],
    data: Buffer.from(JSON.stringify({ app: 'FIFYard', v: 1, ...snapshot }), 'utf8'),
  }))

  const { blockhash, lastValidBlockHeight } = await getBlockhash()
  transaction.feePayer = owner
  transaction.recentBlockhash = blockhash
  void lastValidBlockHeight // used implicitly by the network

  console.log('Publishing team via Memo, fee payer:', owner.toBase58())
  const signature = await signAndSend(provider, transaction)
  invalidateTeamsCache(ownerAddress) // so next fetch sees the new team
  return signature
}

// ── Shortlist ─────────────────────────────────────────────────────────────────

export async function publishShortlist(ownerAddress: string, playerIds: number[]): Promise<string> {
  const provider = assertPhantom()
  const owner = new PublicKey(ownerAddress)

  const transaction = new Transaction().add(new TransactionInstruction({
    programId: memoProgramId,
    keys: [{ pubkey: owner, isSigner: true, isWritable: false }],
    data: Buffer.from(JSON.stringify({ app: 'FIFYard', v: 1, type: 'shortlist', playerIds }), 'utf8'),
  }))

  const { blockhash, lastValidBlockHeight } = await getBlockhash()
  transaction.feePayer = owner
  transaction.recentBlockhash = blockhash
  void lastValidBlockHeight

  shortlistCache.set(ownerAddress, playerIds) // optimistic cache update
  return signAndSend(provider, transaction)
}

export async function fetchShortlist(walletAddress: string): Promise<number[]> {
  if (shortlistCache.has(walletAddress)) {
    return shortlistCache.get(walletAddress)!
  }

  const pubKey = new PublicKey(walletAddress)
  let sigs: Array<{ signature: string }>
  try {
    sigs = await rpc(
      () => connection.getConfirmedSignaturesForAddress2(pubKey, { limit: 30 }),
      8000,
      'fetchShortlistSigs',
    )
  } catch {
    return []
  }

  // Walk newest → oldest; stop at the first shortlist tx found
  for (const sigInfo of sigs) {
    try {
      const tx = await rpc(
        () => connection.getTransaction(sigInfo.signature, { maxSupportedTransactionVersion: 0 }),
        5000,
        'getShortlistTx',
      ) as LegacyTx | null
      const memo = parseMemoFromTx(tx)
      if (!memo) continue
      const json = JSON.parse(memo)
      if (json.app === 'FIFYard' && json.v === 1 && json.type === 'shortlist') {
        shortlistCache.set(walletAddress, json.playerIds)
        return json.playerIds as number[]
      }
    } catch { continue }
    await sleep(80) // gentle pacing
  }
  return []
}

// ── Player purchase ───────────────────────────────────────────────────────────

const TREASURY = new PublicKey('A1czGAnFQZX3zpRjXWCSmyrb9FZMqeutoMRnpnPjBe7N')

export async function purchasePlayer(
  buyerAddress: string,
  playerId: number,
  playerName: string,
  priceSOL: number,
): Promise<PurchaseResult> {
  const provider = assertPhantom()
  const buyer = new PublicKey(buyerAddress)
  const lamports = Math.round(priceSOL * LAMPORTS_PER_SOL)

  const transaction = new Transaction()
    .add(SystemProgram.transfer({ fromPubkey: buyer, toPubkey: TREASURY, lamports }))
    .add(new TransactionInstruction({
      programId: memoProgramId,
      keys: [{ pubkey: buyer, isSigner: true, isWritable: false }],
      data: Buffer.from(
        JSON.stringify({ app: 'FIFYard', v: 1, type: 'purchase', playerId, playerName, priceSOL, buyer: buyerAddress, ts: Date.now() }),
        'utf8',
      ),
    }))

  const { blockhash, lastValidBlockHeight } = await getBlockhash()
  transaction.feePayer = buyer
  transaction.recentBlockhash = blockhash
  void lastValidBlockHeight

  console.log(`Purchasing ${playerName} (id=${playerId}) for ${priceSOL} SOL`)
  const signature = await signAndSend(provider, transaction)
  return { signature, txUrl: solscanTransactionUrl(signature) }
}

import {
  Connection,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import type { Formation } from './prediction'

// ── RPC endpoints ─────────────────────────────────────────────────────────────
// Three genuinely different devnet endpoints. We rotate through them on any
// failure so a 429 on one doesn't block the whole flow.
const RPC_ENDPOINTS = [
  'https://api.devnet.solana.com',
  'https://rpc.ankr.com/solana_devnet',
  'https://solana-devnet.rpc.extrnode.com',
]

function makeConnection(url: string) {
  return new Connection(url, {
    commitment: 'confirmed',
    disableRetryOnRateLimit: true, // we manage retries ourselves
  })
}

let currentRpcIndex = 0
let connection = makeConnection(RPC_ENDPOINTS[0])

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
 * Rotate to the next RPC endpoint, cycling round-robin.
 */
function nextRpc(): void {
  currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length
  connection = makeConnection(RPC_ENDPOINTS[currentRpcIndex])
  console.log(`RPC rotated to #${currentRpcIndex}: ${RPC_ENDPOINTS[currentRpcIndex]}`)
}

/**
 * Execute an RPC call with:
 *  - a per-call timeout
 *  - immediate RPC rotation on 429 or timeout
 *  - short delay before retry to avoid thundering herd
 *  - one attempt per endpoint, then one extra retry on the first endpoint
 */
async function rpc<T>(fn: () => Promise<T>, timeoutMs = 7000, label = 'rpc'): Promise<T> {
  // Try each endpoint once, plus one final retry on whichever is current
  const MAX_ATTEMPTS = RPC_ENDPOINTS.length + 1
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      // Re-bind fn each attempt so it uses the current `connection`
      return await withTimeout(fn(), timeoutMs)
    } catch (err) {
      const msg = String(err)
      const is429 = msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('rate limit')
      const isTimeout = msg.includes('timeout')
      console.warn(`${label} attempt ${i + 1}/${MAX_ATTEMPTS} on endpoint #${currentRpcIndex} failed (${is429 ? '429' : isTimeout ? 'timeout' : 'error'})`)

      if (i < MAX_ATTEMPTS - 1) {
        nextRpc()
        // Brief pause: 300ms between rotations — enough to avoid immediate re-429
        await sleep(300)
      }
    }
  }
  throw new Error(`${label}: all ${MAX_ATTEMPTS} attempts across ${RPC_ENDPOINTS.length} endpoints failed. Devnet may be congested — try again in a moment.`)
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

// ── Blockhash — use Phantom's own RPC first, fall back to public endpoints ────
//
// Phantom routes all its wallet-method calls through its own private RPC node.
// That node is NOT subject to the same 429 rate limits our public endpoint
// calls generate. By calling getLatestBlockhash via provider.request() we
// completely bypass the congestion we caused on api.devnet.solana.com.

async function getBlockhashViaPhantom(provider: ReturnType<typeof assertPhantom>): Promise<{ blockhash: string; lastValidBlockHeight: number } | null> {
  try {
    const resp = await Promise.race([
      provider.request({ method: 'getLatestBlockhash', params: [{ commitment: 'confirmed' }] }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
    ]) as { value?: { blockhash: string; lastValidBlockHeight: number } } | null
    const val = resp?.value
    if (val?.blockhash && typeof val.lastValidBlockHeight === 'number') {
      console.log('Blockhash via Phantom RPC:', val.blockhash.slice(0, 8) + '…')
      return val
    }
  } catch (e) {
    console.warn('Phantom blockhash failed:', e)
  }
  return null
}

async function getBlockhash(provider?: ReturnType<typeof assertPhantom>) {
  // 1. Try Phantom's own RPC (no rate-limit risk)
  if (provider) {
    const result = await getBlockhashViaPhantom(provider)
    if (result) return result
  }

  // 2. Fall back to public endpoints via our rpc() helper
  console.warn('Falling back to public RPC for blockhash…')
  return rpc(() => connection.getLatestBlockhash('confirmed'), 8000, 'getLatestBlockhash')
}

// ── Sign + send ───────────────────────────────────────────────────────────────

async function signAndSend(
  provider: ReturnType<typeof assertPhantom>,
  transaction: Transaction,
): Promise<string> {
  const result = await provider.signAndSendTransaction(transaction)
  const signature = typeof result === 'string' ? result : result.signature
  console.log('Tx sent:', signature)
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

  const { blockhash, lastValidBlockHeight } = await getBlockhash(provider)
  transaction.feePayer = owner
  transaction.recentBlockhash = blockhash
  void lastValidBlockHeight

  console.log('Publishing team via Memo, fee payer:', owner.toBase58())
  const signature = await signAndSend(provider, transaction)
  invalidateTeamsCache(ownerAddress)
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

  const { blockhash, lastValidBlockHeight } = await getBlockhash(provider)
  transaction.feePayer = owner
  transaction.recentBlockhash = blockhash
  void lastValidBlockHeight

  shortlistCache.set(ownerAddress, playerIds)
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

  const { blockhash, lastValidBlockHeight } = await getBlockhash(provider)
  transaction.feePayer = buyer
  transaction.recentBlockhash = blockhash
  void lastValidBlockHeight

  console.log(`Purchasing ${playerName} (id=${playerId}) for ${priceSOL} SOL`)
  const signature = await signAndSend(provider, transaction)
  return { signature, txUrl: solscanTransactionUrl(signature) }
}

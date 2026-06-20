import { clusterApiUrl, Connection, PublicKey, SystemProgram, LAMPORTS_PER_SOL, Transaction, TransactionInstruction } from '@solana/web3.js'
import type { Formation } from './prediction'

// All devnet RPC endpoints
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

export const programId = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
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

async function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms)
    ),
  ])
}

async function switchRpc(): Promise<void> {
  if (currentRpcIndex < RPC_ENDPOINTS.length - 1) {
    currentRpcIndex++
    connection = new Connection(RPC_ENDPOINTS[currentRpcIndex], 'confirmed')
    console.log(`Switched to RPC endpoint #${currentRpcIndex}: ${RPC_ENDPOINTS[currentRpcIndex]}`)
  }
}

export async function fetchEpoch(): Promise<number | null> {
  try {
    const info = await withTimeout(connection.getEpochInfo(), 5000, 'fetchEpoch')
    return info.epoch
  } catch (err) {
    console.error('Epoch fetch error:', err)
    await switchRpc()
    return fetchEpoch()
  }
}

export async function fetchBalance(address: string): Promise<number> {
  try {
    const lamports = await withTimeout(connection.getBalance(new PublicKey(address)), 5000, 'fetchBalance')
    return lamports
  } catch (err) {
    console.error('Balance fetch error:', err)
    await switchRpc()
    return fetchBalance(address)
  }
}

export function isPhantomOnDevnet(): boolean {
  const provider = phantomProvider()
  return provider?.network === 'devnet' || !provider?.network
}

export async function fetchPublishedTeams(walletAddress: string): Promise<OnChainTeam[]> {
  const pubKey = new PublicKey(walletAddress)
  console.log('Fetching teams for:', pubKey.toBase58())

  let sigs: Array<{ signature: string; blockTime?: number | null }>
  try {
    sigs = await withTimeout(
      connection.getConfirmedSignaturesForAddress2(pubKey, { limit: 100 }),
      5000,
      'fetchSignatures',
    )
  } catch (err) {
    console.error('Signature fetch error:', err)
    await switchRpc()
    return fetchPublishedTeams(walletAddress)
  }
  console.log('Found signatures:', sigs.length)

  const teams: OnChainTeam[] = []

  for (const sigInfo of sigs) {
    const sig = sigInfo.signature
    try {
      const tx = await withTimeout(connection.getTransaction(sig), 3000, `getTransaction(${sig})`)
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

      const memoIx = compiledIx.find((ix) => accountKeys[ix.programIdIndex]?.equals(memoProgramId))
      if (!memoIx?.data) continue

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

  let blockhashResult
  try {
    blockhashResult = await withTimeout(connection.getLatestBlockhash('confirmed'), 5000, 'getLatestBlockhash')
  } catch (err) {
    console.error('Blockhash fetch error:', err)
    await switchRpc()
    return publishTeamSnapshot(ownerAddress, snapshot)
  }
  const { blockhash, lastValidBlockHeight } = blockhashResult

  transaction.feePayer = owner
  transaction.recentBlockhash = blockhash

  console.log('Publishing to devnet via Memo program, fee payer:', owner.toBase58())
  const result = await provider.signAndSendTransaction(transaction)
  const signature = typeof result === 'string' ? result : result.signature
  console.log('Transaction sent:', signature)

  try {
    await withTimeout(
      connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed'),
      30000,
      'confirmTransaction',
    )
  } catch (err) {
    console.error('Confirm timeout (tx may still succeed):', err)
  }

  console.log('Transaction confirmed:', signature)
  return signature
}

// ── Shortlist (on-chain via Memo) ────────────────────────────────────────────

/** Write the current shortlist player IDs to chain as a Memo transaction. */
export async function publishShortlist(ownerAddress: string, playerIds: number[]): Promise<string> {
  const provider = phantomProvider()
  if (!provider) throw new Error('Phantom is not installed')
  if (provider.network && provider.network !== 'devnet') {
    throw new Error(`Wrong network: ${provider.network}. Switch Phantom to Devnet.`)
  }

  const owner = new PublicKey(ownerAddress)
  const message = JSON.stringify({ app: 'FIFYard', v: 1, type: 'shortlist', playerIds })
  const transaction = new Transaction().add(new TransactionInstruction({
    programId: memoProgramId,
    keys: [{ pubkey: owner, isSigner: true, isWritable: false }],
    data: Buffer.from(message, 'utf8'),
  }))

  let blockhashResult
  try {
    blockhashResult = await withTimeout(connection.getLatestBlockhash('confirmed'), 5000, 'getLatestBlockhash')
  } catch (err) {
    await switchRpc()
    return publishShortlist(ownerAddress, playerIds)
  }
  const { blockhash, lastValidBlockHeight } = blockhashResult
  transaction.feePayer = owner
  transaction.recentBlockhash = blockhash

  const result = await provider.signAndSendTransaction(transaction)
  const signature = typeof result === 'string' ? result : result.signature

  try {
    await withTimeout(
      connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed'),
      30000,
      'confirmTransaction',
    )
  } catch { /* timeout — tx may still land */ }

  return signature
}

// ── Player purchase (SOL transfer + Memo receipt) ────────────────────────────

/** Treasury wallet that receives purchase payments on devnet. */
const TREASURY = new PublicKey('A1czGAnFQZX3zpRjXWCSmyrb9FZMqeutoMRnpnPjBe7N')

export type PurchaseResult = {
  signature: string
  txUrl: string
}

/**
 * Purchase a player by sending `priceSOL` to the treasury and writing a Memo
 * receipt — both in a single atomic transaction signed by Phantom.
 */
export async function purchasePlayer(
  buyerAddress: string,
  playerId: number,
  playerName: string,
  priceSOL: number,
): Promise<PurchaseResult> {
  const provider = phantomProvider()
  if (!provider) throw new Error('Phantom is not installed')
  if (provider.network && provider.network !== 'devnet') {
    throw new Error(`Wrong network: ${provider.network}. Switch Phantom to Devnet.`)
  }

  const buyer = new PublicKey(buyerAddress)
  const lamports = Math.round(priceSOL * LAMPORTS_PER_SOL)

  const memo = JSON.stringify({
    app: 'FIFYard',
    v: 1,
    type: 'purchase',
    playerId,
    playerName,
    priceSOL,
    buyer: buyerAddress,
    ts: Date.now(),
  })

  const transaction = new Transaction()
    .add(
      // Real SOL transfer to treasury
      SystemProgram.transfer({
        fromPubkey: buyer,
        toPubkey: TREASURY,
        lamports,
      }),
    )
    .add(
      // On-chain purchase receipt via Memo
      new TransactionInstruction({
        programId: memoProgramId,
        keys: [{ pubkey: buyer, isSigner: true, isWritable: false }],
        data: Buffer.from(memo, 'utf8'),
      }),
    )

  let blockhashResult
  try {
    blockhashResult = await withTimeout(connection.getLatestBlockhash('confirmed'), 5000, 'getLatestBlockhash')
  } catch {
    await switchRpc()
    return purchasePlayer(buyerAddress, playerId, playerName, priceSOL)
  }

  const { blockhash, lastValidBlockHeight } = blockhashResult
  transaction.feePayer = buyer
  transaction.recentBlockhash = blockhash

  console.log(`Purchasing player ${playerName} (id=${playerId}) for ${priceSOL} SOL`)
  const result = await provider.signAndSendTransaction(transaction)
  const signature = typeof result === 'string' ? result : result.signature
  console.log('Purchase tx sent:', signature)

  try {
    await withTimeout(
      connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed'),
      30000,
      'confirmPurchase',
    )
  } catch {
    console.warn('Confirm timeout — purchase may still land')
  }

  return { signature, txUrl: solscanTransactionUrl(signature) }
}

/** Fetch the most recent shortlist for a wallet from on-chain Memo transactions. */
export async function fetchShortlist(walletAddress: string): Promise<number[]> {
  const pubKey = new PublicKey(walletAddress)
  let sigs: Array<{ signature: string; blockTime?: number | null }>
  try {
    sigs = await withTimeout(
      connection.getConfirmedSignaturesForAddress2(pubKey, { limit: 50 }),
      5000,
      'fetchShortlistSigs',
    )
  } catch (err) {
    await switchRpc()
    return fetchShortlist(walletAddress)
  }

  // Walk newest → oldest, return first shortlist found
  for (const sigInfo of sigs) {
    try {
      const tx = await withTimeout(connection.getTransaction(sigInfo.signature), 3000, 'getShortlistTx')
      if (!tx?.transaction) continue
      const msg = tx.transaction.message
      if ('version' in msg && msg.version !== undefined) continue
      const accountKeys = (msg as { accountKeys: PublicKey[] }).accountKeys
      const compiledIx = (msg as { instructions: { programIdIndex: number; data: string }[] }).instructions
      const memoIx = compiledIx.find(ix => accountKeys[ix.programIdIndex]?.equals(memoProgramId))
      if (!memoIx?.data) continue
      const json = JSON.parse(Buffer.from(memoIx.data, 'base64').toString('utf8'))
      if (json.app === 'FIFYard' && json.v === 1 && json.type === 'shortlist') {
        return json.playerIds as number[]
      }
    } catch { continue }
  }
  return []
}

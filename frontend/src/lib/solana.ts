import { clusterApiUrl, Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js'
import type { Formation } from './prediction'

export const connection = new Connection(clusterApiUrl('devnet'), 'confirmed')
export const programId = new PublicKey('6Ew7FSCCyS5EG5gkJ8TTq7Hbjy7tpB5tBVhRPmKnfujB')
const memoProgramId = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

export type TeamSnapshot = {
  country: string
  formation: Formation
  playerIds: number[]
  opponent: string
  winRate: number
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

export async function publishTeamSnapshot(ownerAddress: string, snapshot: TeamSnapshot) {
  const provider = phantomProvider()
  if (!provider) throw new Error('Phantom is not installed')
  const owner = new PublicKey(ownerAddress)

  const message = JSON.stringify({ app: 'FIFYard', v: 1, ...snapshot })
  const transaction = new Transaction().add(new TransactionInstruction({
    programId: memoProgramId,
    keys: [{ pubkey: owner, isSigner: true, isWritable: false }],
    data: Buffer.from(message, 'utf8'),
  }))
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  transaction.feePayer = owner
  transaction.recentBlockhash = blockhash

  const result = await provider.signAndSendTransaction(transaction)
  const signature = typeof result === 'string' ? result : result.signature
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
  return signature
}

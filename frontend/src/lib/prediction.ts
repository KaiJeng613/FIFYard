import type { Player, PlayerStats, Position } from '../players'

export const formations = ['4-3-3', '4-4-2', '3-5-2', '4-2-3-1'] as const
export type Formation = (typeof formations)[number]

export const formationCounts: Record<Formation, Record<Position, number>> = {
  '4-3-3': { GK: 1, DEF: 4, MID: 3, FWD: 3 },
  '4-4-2': { GK: 1, DEF: 4, MID: 4, FWD: 2 },
  '3-5-2': { GK: 1, DEF: 3, MID: 5, FWD: 2 },
  '4-2-3-1': { GK: 1, DEF: 4, MID: 5, FWD: 1 },
}

export const opponents = [
  { country: 'Argentina', code: 'ARG', rating: 91 },
  { country: 'Brazil', code: 'BRA', rating: 89 },
  { country: 'France', code: 'FRA', rating: 90 },
  { country: 'England', code: 'ENG', rating: 88 },
  { country: 'Spain', code: 'ESP', rating: 87 },
  { country: 'Portugal', code: 'POR', rating: 86 },
  { country: 'Malaysia', code: 'MAS', rating: 72 },
] as const

export function calculateOverall(position: Position, stats: PlayerStats): number {
  const weights: Record<Position, Partial<Record<keyof PlayerStats, number>>> = {
    GK: { defending: 0.45, passing: 0.2, stamina: 0.2, pace: 0.15 },
    DEF: { defending: 0.4, stamina: 0.2, pace: 0.15, passing: 0.15, dribbling: 0.1 },
    MID: { passing: 0.3, dribbling: 0.25, stamina: 0.2, pace: 0.1, shooting: 0.1, defending: 0.05 },
    FWD: { shooting: 0.35, pace: 0.25, dribbling: 0.2, stamina: 0.1, passing: 0.1 },
  }
  return Math.round(Object.entries(weights[position]).reduce((total, [key, weight]) => total + stats[key as keyof PlayerStats] * weight, 0))
}

export function isValidLineup(players: Player[], formation: Formation): boolean {
  if (players.length !== 11) return false
  const counts = players.reduce<Record<Position, number>>((result, player) => {
    result[player.position] += 1
    return result
  }, { GK: 0, DEF: 0, MID: 0, FWD: 0 })
  return (Object.keys(counts) as Position[]).every((position) => counts[position] === formationCounts[formation][position])
}

export function predictMatch(players: Player[], opponentRating: number, lineupValid: boolean) {
  const squadRating = players.length ? players.reduce((sum, player) => sum + player.overall, 0) / players.length : 0
  const readinessPenalty = lineupValid ? 0 : 7
  const effectiveRating = squadRating - readinessPenalty
  const expected = 1 / (1 + 10 ** ((opponentRating - effectiveRating) / 12))
  const draw = Math.max(0.08, Math.min(0.22, 0.22 - Math.abs(effectiveRating - opponentRating) * 0.008))
  const win = expected * (1 - draw)
  return {
    squadRating: Math.round(squadRating),
    win: Math.round(win * 100),
    draw: Math.round(draw * 100),
    loss: Math.max(0, 100 - Math.round(win * 100) - Math.round(draw * 100)),
  }
}

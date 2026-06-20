export type Position = 'GK' | 'DEF' | 'MID' | 'FWD'

export type Player = {
  id: number
  name: string
  shortName: string
  club: string
  country: string
  position: Position
  overall: number
  stats: {
    pace: number
    shooting: number
    passing: number
    dribbling: number
    defending: number
    stamina: number
  }
}

export const players: Player[] = [
  { id: 0, name: 'Lionel Messi', shortName: 'MESSI', club: 'Miami', country: 'ARG', position: 'FWD', overall: 91, stats: { pace: 82, shooting: 90, passing: 91, dribbling: 94, defending: 34, stamina: 78 } },
  { id: 1, name: 'Kylian Mbappé', shortName: 'MBAPPÉ', club: 'Madrid', country: 'FRA', position: 'FWD', overall: 92, stats: { pace: 97, shooting: 91, passing: 82, dribbling: 93, defending: 36, stamina: 88 } },
  { id: 2, name: 'Erling Haaland', shortName: 'HAALAND', club: 'Manchester', country: 'NOR', position: 'FWD', overall: 91, stats: { pace: 89, shooting: 94, passing: 66, dribbling: 81, defending: 45, stamina: 90 } },
  { id: 3, name: 'Vinícius Júnior', shortName: 'VINI JR.', club: 'Madrid', country: 'BRA', position: 'FWD', overall: 90, stats: { pace: 96, shooting: 86, passing: 83, dribbling: 95, defending: 31, stamina: 84 } },
  { id: 4, name: 'Kevin De Bruyne', shortName: 'DE BRUYNE', club: 'Manchester', country: 'BEL', position: 'MID', overall: 91, stats: { pace: 74, shooting: 88, passing: 94, dribbling: 87, defending: 66, stamina: 86 } },
  { id: 5, name: 'Jude Bellingham', shortName: 'BELLINGHAM', club: 'Madrid', country: 'ENG', position: 'MID', overall: 90, stats: { pace: 82, shooting: 87, passing: 88, dribbling: 91, defending: 78, stamina: 93 } },
  { id: 6, name: 'Rodri', shortName: 'RODRI', club: 'Manchester', country: 'ESP', position: 'MID', overall: 91, stats: { pace: 66, shooting: 74, passing: 90, dribbling: 85, defending: 87, stamina: 92 } },
  { id: 7, name: 'Pedri', shortName: 'PEDRI', club: 'Barcelona', country: 'ESP', position: 'MID', overall: 86, stats: { pace: 78, shooting: 71, passing: 89, dribbling: 91, defending: 70, stamina: 82 } },
  { id: 8, name: 'Virgil van Dijk', shortName: 'VAN DIJK', club: 'Liverpool', country: 'NED', position: 'DEF', overall: 89, stats: { pace: 78, shooting: 60, passing: 76, dribbling: 72, defending: 92, stamina: 86 } },
  { id: 9, name: 'William Saliba', shortName: 'SALIBA', club: 'London', country: 'FRA', position: 'DEF', overall: 87, stats: { pace: 84, shooting: 43, passing: 75, dribbling: 76, defending: 89, stamina: 87 } },
  { id: 10, name: 'Theo Hernández', shortName: 'HERNÁNDEZ', club: 'Milan', country: 'FRA', position: 'DEF', overall: 87, stats: { pace: 94, shooting: 76, passing: 80, dribbling: 84, defending: 81, stamina: 89 } },
  { id: 11, name: 'Trent Alexander-Arnold', shortName: 'ALEXANDER-A.', club: 'Liverpool', country: 'ENG', position: 'DEF', overall: 86, stats: { pace: 78, shooting: 72, passing: 92, dribbling: 82, defending: 80, stamina: 87 } },
  { id: 12, name: 'Rúben Dias', shortName: 'RÚBEN DIAS', club: 'Manchester', country: 'POR', position: 'DEF', overall: 88, stats: { pace: 70, shooting: 47, passing: 77, dribbling: 70, defending: 91, stamina: 88 } },
  { id: 13, name: 'Alisson Becker', shortName: 'ALISSON', club: 'Liverpool', country: 'BRA', position: 'GK', overall: 89, stats: { pace: 60, shooting: 25, passing: 85, dribbling: 60, defending: 94, stamina: 82 } },
  { id: 14, name: 'Thibaut Courtois', shortName: 'COURTOIS', club: 'Madrid', country: 'BEL', position: 'GK', overall: 90, stats: { pace: 46, shooting: 23, passing: 76, dribbling: 51, defending: 96, stamina: 84 } },
]


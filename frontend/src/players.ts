export type Position = 'GK' | 'DEF' | 'MID' | 'FWD'

export type PlayerStats = {
  pace: number
  shooting: number
  passing: number
  dribbling: number
  defending: number
  stamina: number
}

export type Player = {
  id: number
  name: string
  shortName: string
  club: string
  country: string
  position: Position
  overall: number
  stats: PlayerStats
  accent: string
  floor: number   // price in SOL (devnet)
}

export const players: Player[] = [
  // ── Forwards ──────────────────────────────────────────────────────────────
  { id: 0,  name: 'Lionel Messi',           shortName: 'MESSI',        club: 'Miami',       country: 'ARG', position: 'FWD', overall: 91, stats: { pace: 82, shooting: 90, passing: 91, dribbling: 94, defending: 34, stamina: 78 }, accent: '#76b6ff', floor: 0.075 },
  { id: 1,  name: 'Kylian Mbappé',          shortName: 'MBAPPÉ',       club: 'Madrid',      country: 'FRA', position: 'FWD', overall: 92, stats: { pace: 97, shooting: 91, passing: 82, dribbling: 93, defending: 36, stamina: 88 }, accent: '#8f7dff', floor: 0.09  },
  { id: 2,  name: 'Erling Haaland',         shortName: 'HAALAND',      club: 'Manchester',  country: 'NOR', position: 'FWD', overall: 91, stats: { pace: 89, shooting: 94, passing: 66, dribbling: 81, defending: 45, stamina: 90 }, accent: '#7bd4e8', floor: 0.08  },
  { id: 3,  name: 'Vinícius Júnior',        shortName: 'VINI JR.',     club: 'Madrid',      country: 'BRA', position: 'FWD', overall: 90, stats: { pace: 96, shooting: 86, passing: 83, dribbling: 95, defending: 31, stamina: 84 }, accent: '#f2d34f', floor: 0.07  },
  { id: 15, name: 'Lautaro Martínez',       shortName: 'MARTÍNEZ',     club: 'Inter',       country: 'ARG', position: 'FWD', overall: 87, stats: { pace: 84, shooting: 88, passing: 76, dribbling: 82, defending: 38, stamina: 85 }, accent: '#4a9fc9', floor: 0.045 },
  { id: 16, name: 'Julián Álvarez',         shortName: 'ÁLVAREZ',      club: 'Man City',    country: 'ARG', position: 'FWD', overall: 86, stats: { pace: 86, shooting: 85, passing: 74, dribbling: 80, defending: 35, stamina: 88 }, accent: '#3da2d9', floor: 0.04  },
  { id: 17, name: 'Olivier Giroud',         shortName: 'GIROUD',       club: 'Milan',       country: 'FRA', position: 'FWD', overall: 84, stats: { pace: 74, shooting: 82, passing: 78, dribbling: 72, defending: 38, stamina: 80 }, accent: '#1da1d9', floor: 0.03  },

  // ── Midfielders ───────────────────────────────────────────────────────────
  { id: 4,  name: 'Kevin De Bruyne',        shortName: 'DE BRUYNE',    club: 'Manchester',  country: 'BEL', position: 'MID', overall: 91, stats: { pace: 74, shooting: 88, passing: 94, dribbling: 87, defending: 66, stamina: 86 }, accent: '#ef6a62', floor: 0.075 },
  { id: 5,  name: 'Jude Bellingham',        shortName: 'BELLINGHAM',   club: 'Madrid',      country: 'ENG', position: 'MID', overall: 90, stats: { pace: 82, shooting: 87, passing: 88, dribbling: 91, defending: 78, stamina: 93 }, accent: '#d3a5ff', floor: 0.07  },
  { id: 6,  name: 'Rodri',                  shortName: 'RODRI',        club: 'Manchester',  country: 'ESP', position: 'MID', overall: 91, stats: { pace: 66, shooting: 74, passing: 90, dribbling: 85, defending: 87, stamina: 92 }, accent: '#77d1c0', floor: 0.065 },
  { id: 7,  name: 'Pedri',                  shortName: 'PEDRI',        club: 'Barcelona',   country: 'ESP', position: 'MID', overall: 86, stats: { pace: 78, shooting: 71, passing: 89, dribbling: 91, defending: 70, stamina: 82 }, accent: '#e96484', floor: 0.038 },
  { id: 18, name: 'Enzo Fernández',         shortName: 'ENZO',         club: 'Chelsea',     country: 'ARG', position: 'MID', overall: 88, stats: { pace: 78, shooting: 78, passing: 86, dribbling: 85, defending: 72, stamina: 88 }, accent: '#3da2d9', floor: 0.055 },
  { id: 19, name: 'Alexis Mac Allister',    shortName: 'MAC A.',       club: 'Liverpool',   country: 'ARG', position: 'MID', overall: 85, stats: { pace: 76, shooting: 74, passing: 82, dribbling: 84, defending: 75, stamina: 84 }, accent: '#4ab0e2', floor: 0.032 },
  { id: 20, name: 'Antoine Griezmann',      shortName: 'GRIEZM.',      club: 'Atlético',    country: 'FRA', position: 'MID', overall: 86, stats: { pace: 72, shooting: 82, passing: 88, dribbling: 84, defending: 72, stamina: 82 }, accent: '#0078b6', floor: 0.04  },
  { id: 21, name: 'Aurélien Tchouaméni',   shortName: 'TCHOU.',       club: 'Real Madrid', country: 'FRA', position: 'MID', overall: 86, stats: { pace: 78, shooting: 70, passing: 86, dribbling: 80, defending: 82, stamina: 86 }, accent: '#0077b3', floor: 0.042 },

  // ── Defenders ─────────────────────────────────────────────────────────────
  { id: 8,  name: 'Virgil van Dijk',        shortName: 'VAN DIJK',     club: 'Liverpool',   country: 'NED', position: 'DEF', overall: 89, stats: { pace: 78, shooting: 60, passing: 76, dribbling: 72, defending: 92, stamina: 86 }, accent: '#ef6c64', floor: 0.06  },
  { id: 9,  name: 'William Saliba',         shortName: 'SALIBA',       club: 'London',      country: 'FRA', position: 'DEF', overall: 87, stats: { pace: 84, shooting: 43, passing: 75, dribbling: 76, defending: 89, stamina: 87 }, accent: '#ff8566', floor: 0.045 },
  { id: 10, name: 'Theo Hernández',         shortName: 'HERNÁNDEZ',    club: 'Milan',       country: 'FRA', position: 'DEF', overall: 87, stats: { pace: 94, shooting: 76, passing: 80, dribbling: 84, defending: 81, stamina: 89 }, accent: '#ec6c6c', floor: 0.045 },
  { id: 11, name: 'Trent Alexander-Arnold', shortName: 'T. ARNOLD',    club: 'Liverpool',   country: 'ENG', position: 'DEF', overall: 86, stats: { pace: 78, shooting: 72, passing: 92, dribbling: 82, defending: 80, stamina: 87 }, accent: '#e85f5a', floor: 0.04  },
  { id: 12, name: 'Rúben Dias',             shortName: 'RÚBEN DIAS',   club: 'Manchester',  country: 'POR', position: 'DEF', overall: 88, stats: { pace: 70, shooting: 47, passing: 77, dribbling: 70, defending: 91, stamina: 88 }, accent: '#71bde4', floor: 0.055 },
  { id: 22, name: 'Marcos Acuña',           shortName: 'ACUÑA',        club: 'River',       country: 'ARG', position: 'DEF', overall: 82, stats: { pace: 84, shooting: 58, passing: 78, dribbling: 74, defending: 78, stamina: 82 }, accent: '#2a8fc9', floor: 0.02  },
  { id: 23, name: 'Nahuel Molina',          shortName: 'MOLINA',       club: 'Atlético',    country: 'ARG', position: 'DEF', overall: 83, stats: { pace: 86, shooting: 62, passing: 74, dribbling: 76, defending: 78, stamina: 84 }, accent: '#3da2d9', floor: 0.022 },
  { id: 24, name: 'Jules Koundé',           shortName: 'KOUNDÉ',       club: 'Barcelona',   country: 'FRA', position: 'DEF', overall: 85, stats: { pace: 78, shooting: 55, passing: 84, dribbling: 81, defending: 85, stamina: 85 }, accent: '#0077b3', floor: 0.032 },
  { id: 25, name: 'Dayot Upamecano',        shortName: 'UPAM.',        club: 'Bayern',      country: 'FRA', position: 'DEF', overall: 84, stats: { pace: 84, shooting: 52, passing: 76, dribbling: 72, defending: 85, stamina: 84 }, accent: '#0066a6', floor: 0.028 },

  // ── Goalkeepers ───────────────────────────────────────────────────────────
  { id: 13, name: 'Alisson Becker',         shortName: 'ALISSON',      club: 'Liverpool',   country: 'BRA', position: 'GK',  overall: 89, stats: { pace: 60, shooting: 25, passing: 85, dribbling: 60, defending: 94, stamina: 82 }, accent: '#d4a45e', floor: 0.06  },
  { id: 14, name: 'Thibaut Courtois',       shortName: 'COURTOIS',     club: 'Madrid',      country: 'BEL', position: 'GK',  overall: 90, stats: { pace: 46, shooting: 23, passing: 76, dribbling: 51, defending: 96, stamina: 84 }, accent: '#5bb1de', floor: 0.07  },
  { id: 26, name: 'Emiliano Martínez',      shortName: 'EMI MARTÍNEZ', club: 'Aston Villa', country: 'ARG', position: 'GK',  overall: 88, stats: { pace: 58, shooting: 22, passing: 82, dribbling: 58, defending: 92, stamina: 84 }, accent: '#3da2d9', floor: 0.05  },
]

export type Source = {
  kind: 'demo' | 'provider' | 'official'
  label: string
  url?: string
  updatedAt?: string
}

export type LineupPlayer = { name: string; number: number; position: string; id?: string }
export type Team = {
  id: string
  name: string
  shortName: string
  color: string
  formation: string
  players: LineupPlayer[]
  bench?: LineupPlayer[]
}

export type Moment = {
  id: string
  minute: number
  extra?: number
  kind: 'Goal' | 'Shot' | 'Save' | 'Press' | 'Substitution' | 'Card' | 'Set piece'
  title: string
  description: string
  teamId?: string
  playerIn?: LineupPlayer
  playerOut?: string
  dismissal?: string
}
export type Match = {
  id: string
  competition: string
  season: string
  kickoff: string
  status: 'scheduled' | 'live' | 'finished' | 'postponed'
  home: Team
  away: Team
  score?: [number, number]
  venue?: string
  round?: number
  source: Source
  moments: Moment[]
  stats: { label: string; home: number | null; away: number | null; unit?: string }[]
  notes?: string
}
export type Standing = {
  rank: number
  team: Team
  played: number
  wins: number
  draws: number
  losses: number
  goalDifference: number
  points: number
  group?: string
}
export type Competition = { id: string; label: string }
export type LoadTacticsPayload = {
  matchId: string
  title: string
  competition: string
  score?: [number, number]
  home: Team
  away: Team
  moment?: Moment
  classification: 'RECONSTRUCTED' | 'HYPOTHETICAL'
  source: string
}
export type ComparisonSubject = {
  id: string
  name: string
  subtitle: string
  color: string
  club?: string
  position?: string
  stats: Record<string, number>
  source?: Source
}
export type Metric = {
  key: string
  label: string
  unit?: string
  definition: string
  per90?: boolean
}
export type GraphicKind = 'title' | 'lineup' | 'formation' | 'spotlight' | 'players' | 'teams' | 'stat' | 'result' | 'preview' | 'tactics' | 'prediction' | 'leaderboard' | 'substitution' | 'performance' | 'events'
export type GraphicSpec = {
  id: string
  kind: GraphicKind
  title: string
  subtitle: string
  source: string
  teams?: { name: string; shortName: string; color: string; formation?: string }[]
  score?: [number, number]
  lineup?: LineupPlayer[]
  subjects?: { name: string; subtitle: string; color: string }[]
  rows?: { label: string; value?: string; detail?: string; values?: (number | null)[]; unit?: string }[]
  value?: string
  label?: string
  detail?: string
}

export type Prediction = {
  matchId: string
  panelistId: string
  home: number
  away: number
  notes: string
  submittedAt: string
}
export type Panelist = { id: string; name: string }
export type PredictionRules = { exact: number; result: number; cutoffMinutes: number }

export function predictionPoints(pick: Pick<Prediction, 'home' | 'away'>, score: [number, number], rules: PredictionRules) {
  if (pick.home === score[0] && pick.away === score[1]) return rules.exact
  return Math.sign(pick.home - pick.away) === Math.sign(score[0] - score[1]) ? rules.result : 0
}
export function predictionCutoff(kickoff: string, rules: PredictionRules) {
  return new Date(new Date(kickoff).getTime() - rules.cutoffMinutes * 60_000)
}

export function applyMoment(team: Team, moments: Moment[], moment: Moment): Team {
  let players = team.players
  for (const event of moments.slice(0, moments.indexOf(moment) + 1)) {
    if (event.teamId !== team.id) continue
    const incoming = event.playerIn
    if (incoming && event.playerOut) players = players.map(player => player.id === event.playerOut ? incoming : player)
    if (event.dismissal) players = players.filter(player => player.id !== event.dismissal)
  }
  return { ...team, players }
}

export function displayDate(value: string, withTime = false) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', day: 'numeric', month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(value))
}

export function scoreText(score?: [number, number]) {
  return score ? `${score[0]} – ${score[1]}` : 'v'
}

import type { FixtureSnapshot, FixtureStatus, FixtureVerification, Score, Source } from './fixtureSnapshot'
export type { Source } from './fixtureSnapshot'

export type LineupPlayer = {
  name: string
  number?: number
  position: string
  role?: string
  id?: string
  source?: Source
  eligibleFrom?: string
  eligibleUntil?: string
}
export type LineupKind = 'confirmed' | 'squad' | 'repair' | 'demo'
export type Team = {
  id: string
  name: string
  shortName: string
  color: string
  formation: string
  players: LineupPlayer[]
  bench?: LineupPlayer[]
  squad?: LineupPlayer[]
  eligible?: LineupPlayer[]
  lineupSource?: Source
  providerId?: string
  lineupKind?: LineupKind
}

export type Moment = {
  id: string
  minute: number
  extra?: number
  order?: number
  source?: Source
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
  status: FixtureStatus
  competitionId?: string
  providerId?: string
  revision?: string
  home: Team
  away: Team
  score?: Score
  shootout?: Score
  period?: FixtureSnapshot['period']
  clock?: FixtureSnapshot['clock']
  verification?: FixtureVerification
  fixture?: FixtureSnapshot
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
  fixture?: FixtureSnapshot
  lineupKind?: LineupKind
  homeDismissed?: string[]
  awayDismissed?: string[]
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
  period?: string
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
  fixture?: FixtureSnapshot
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

export function fixtureSnapshot(match: Match): FixtureSnapshot {
  if (match.fixture) return match.fixture
  const team = ({ id, name, shortName, color }: Team) => ({ id, name, shortName, color })
  return {
    id: match.id, revision: match.revision || 'legacy', competitionId: match.competitionId || (match.source.kind === 'demo' ? 'DEMO' : 'unknown'),
    competition: match.competition, season: match.season, kickoff: match.kickoff, status: match.status,
    round: match.round, score: match.score, shootout: match.shootout, period: match.period, clock: match.clock,
    home: team(match.home), away: team(match.away), source: match.source, verification: match.verification,
  }
}

export function orderedMoments(moments: Moment[]) {
  return moments.map((moment, index) => ({ moment, index })).sort((a, b) =>
    a.moment.minute - b.moment.minute || (a.moment.extra ?? 0) - (b.moment.extra ?? 0)
    || (a.moment.order ?? a.index) - (b.moment.order ?? b.index)).map(({ moment }) => moment)
}

export function replayMoment(team: Team, moments: Moment[], moment: Moment) {
  const order = orderedMoments(moments)
  const through = order.findIndex(event => event.id === moment.id)
  const dismissed: string[] = []
  let players = [...team.players]
  for (const event of order.slice(0, through + 1)) {
    if (event.teamId !== team.id) continue
    const incoming = event.playerIn
    if (incoming?.id && event.playerOut && !players.some(player => player.id === incoming.id) && !dismissed.includes(incoming.id)) {
      players = players.map(player => player.id === event.playerOut ? incoming : player)
    }
    if (event.dismissal && players.some(player => player.id === event.dismissal)) {
      dismissed.push(event.dismissal)
      players = players.filter(player => player.id !== event.dismissal)
    }
  }
  return { team: { ...team, players }, dismissed }
}

export function applyMoment(team: Team, moments: Moment[], moment: Moment): Team {
  return replayMoment(team, moments, moment).team
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

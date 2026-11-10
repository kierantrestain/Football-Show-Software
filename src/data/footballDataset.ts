import { bundledFootball } from './footballSnapshot.generated.js'
import { isFixtureSnapshot, isIdentifier, isObject, isSource, isText } from './fixtureSnapshot.js'
import type { FixtureSnapshot, Source } from './fixtureSnapshot.js'
import type { ComparisonSubject, LineupPlayer, Match, Moment, Standing, Team } from './model'
import { activeSeason, openCompetitions, openFixtures } from './openFootball.js'
export { activeSeason, openCompetitions } from './openFootball.js'

type Identity = { id: string; name: string; position: string }
type Registration = { playerId: string; teamId: string; competitionId: string; season: string; eligibleFrom: string; eligibleUntil?: string; number?: number }
type Selection = { playerId: string; number?: number; role?: string }
type Matchday = { fixtureId: string; teamId: string; formation: string; starters: Selection[]; bench: Selection[] }
type EventRecord = Moment & { fixtureId: string }
type Metrics = { competitionId: string; season: string; subjectId: string; kind: 'player' | 'team'; periodFrom: string; periodUntil: string; minutes?: number; totals: Record<string, number> }

export type FootballPack = {
  schema: 1
  revision: string
  source: Source & { kind: 'pack'; url: string; permission: string; checkedAt: string; updatedAt: string }
  fixtures: FixtureSnapshot[]
  players: Identity[]
  registrations: Registration[]
  lineups: Matchday[]
  events: EventRecord[]
  metrics: Metrics[]
}

const storageKey = 'bang-on:football-pack:v1'
const studioDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' })
const changeEvent = 'bang-on:football-pack'
const competitionIds = new Set(openCompetitions.map(comp => String(comp.id)))
const baseFixtures = new Map(openCompetitions.flatMap(comp => openFixtures(bundledFootball, comp)).map(fixture => [fixture.id, fixture]))
const day = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
const optional = <T>(value: unknown, validate: (value: unknown) => value is T) => value === undefined || validate(value)
const shirt = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value < 1000
const stringId = (record: Record<string, unknown>, ...keys: string[]) => keys.every(key => isIdentifier(record[key]))
const knownComp = (value: unknown) => typeof value === 'string' && competitionIds.has(value)
const isSeason = (value: unknown) => value === activeSeason.label
const selection = (value: unknown): value is Selection => isObject(value) && isIdentifier(value.playerId)
  && optional(value.number, shirt) && optional(value.role, isText)
const identity = (value: unknown): value is Identity => isObject(value) && isIdentifier(value.id) && isText(value.name) && isText(value.position)
const registration = (value: unknown): value is Registration => isObject(value) && stringId(value, 'playerId', 'teamId')
  && knownComp(value.competitionId) && isSeason(value.season) && day(value.eligibleFrom) && optional(value.eligibleUntil, day)
  && (!value.eligibleUntil || value.eligibleUntil >= value.eligibleFrom) && optional(value.number, shirt)
const matchday = (value: unknown): value is Matchday => isObject(value) && stringId(value, 'fixtureId', 'teamId')
  && typeof value.formation === 'string' && /^\d(?:-\d){2,3}$/.test(value.formation)
  && Array.isArray(value.starters) && value.starters.length === 11 && value.starters.every(selection)
  && Array.isArray(value.bench) && value.bench.length <= 20 && value.bench.every(selection)
  && new Set([...value.starters, ...value.bench].map(row => row.playerId)).size === value.starters.length + value.bench.length
const eventRecord = (value: unknown): value is EventRecord => isObject(value) && stringId(value, 'id', 'fixtureId', 'teamId')
  && typeof value.minute === 'number' && Number.isInteger(value.minute) && value.minute >= 0 && value.minute <= 130
  && typeof value.order === 'number' && Number.isInteger(value.order) && value.order >= 0
  && (value.extra === undefined || (typeof value.extra === 'number' && Number.isInteger(value.extra) && value.extra >= 0))
  && ['Goal', 'Shot', 'Save', 'Press', 'Substitution', 'Card', 'Set piece'].includes(String(value.kind))
  && isText(value.title) && isText(value.description) && optional(value.playerOut, isIdentifier) && optional(value.dismissal, isIdentifier)
  && (value.playerIn === undefined || (identity(value.playerIn) && optional((value.playerIn as Record<string, unknown>).number, shirt)))
  && (value.kind !== 'Substitution' || Boolean(value.playerIn && value.playerOut))
const metric = (value: unknown): value is Metrics => isObject(value) && isIdentifier(value.subjectId)
  && knownComp(value.competitionId) && isSeason(value.season) && ['player', 'team'].includes(String(value.kind))
  && day(value.periodFrom) && day(value.periodUntil) && value.periodFrom <= value.periodUntil
  && (value.minutes === undefined || (typeof value.minutes === 'number' && Number.isFinite(value.minutes) && value.minutes >= 0))
  && isObject(value.totals) && Object.entries(value.totals).length > 0
  && Object.entries(value.totals).every(([key, number]) => isIdentifier(key) && typeof number === 'number' && Number.isFinite(number))
const isPackSource = (value: unknown): value is FootballPack['source'] => isSource(value) && value.kind === 'pack'
  && Boolean(value.url && value.permission && value.checkedAt && value.updatedAt)

function list<T>(value: unknown, check: (value: unknown) => value is T, key: (value: T) => string, label: string): T[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 5000) throw new Error('Invalid ' + label + ' list.')
  const seen = new Set<string>()
  return value.map((item, index) => {
    if (!check(item)) throw new Error(label + ' row ' + (index + 1) + ' contains invalid or missing fields.')
    const id = key(item)
    if (seen.has(id)) throw new Error('Duplicate ' + label + ' key: ' + id + '.')
    seen.add(id)
    return item
  })
}

export function validateFootballPack(input: unknown): FootballPack {
  if (!isObject(input) || input.schema !== 1 || !isIdentifier(input.revision) || !isPackSource(input.source)) {
    throw new Error('Provide a version 1 pack with a revision, source URL, permission basis, verification date and effective date.')
  }
  const source = input.source
  const fixtures = list(input.fixtures, isFixtureSnapshot, row => row.id, 'fixture')
  const players = list(input.players, identity, row => row.id, 'player identity')
  const registrations = list(input.registrations, registration, row => [row.competitionId, row.teamId, row.playerId, row.eligibleFrom].join(':'), 'registration')
  const lineups = list(input.lineups, matchday, row => row.fixtureId + ':' + row.teamId, 'matchday XI')
  const events = list(input.events, eventRecord, row => row.fixtureId + ':' + row.id, 'event')
  const metrics = list(input.metrics, metric, row => [row.kind, row.competitionId, row.subjectId, row.periodFrom, row.periodUntil].join(':'), 'metric')
  if (!(fixtures.length || players.length || registrations.length || lineups.length || events.length || metrics.length)) throw new Error('The pack contains no records.')
  const allFixtures = new Map(baseFixtures)
  for (const row of fixtures) {
    const previous = baseFixtures.get(row.id)
    if (!knownComp(row.competitionId) || row.season !== activeSeason.label || row.source.kind !== 'pack'
      || (previous && [previous.home.id, previous.away.id, previous.competitionId, previous.season].join(':') !== [row.home.id, row.away.id, row.competitionId, row.season].join(':'))
      || (!previous && row.id !== [row.competitionId.toLowerCase(), activeSeason.id, row.home.id, row.away.id].join(':'))) {
      throw new Error('Fixture ' + row.id + ' changes an identity or uses an unsupported competition, season or source.')
    }
    if (row.status === 'finished' && row.verification?.status !== 'verified') throw new Error('Final results in a producer pack must be verified.')
    allFixtures.set(row.id, row)
  }
  const knownPlayers = new Set(players.map(player => player.id))
  const knownTeams = new Set([...allFixtures.values()].flatMap(fixture => [fixture.home.id, fixture.away.id]))
  for (const row of registrations) {
    if (!knownPlayers.has(row.playerId) || !knownTeams.has(row.teamId)) throw new Error('Registration references an unknown club or player.')
    if (registrations.some(other => other !== row && other.playerId === row.playerId && other.competitionId === row.competitionId
      && row.eligibleFrom <= (other.eligibleUntil ?? '9999-12-31') && other.eligibleFrom <= (row.eligibleUntil ?? '9999-12-31'))) {
      throw new Error('Overlapping registrations for ' + row.playerId + '.')
    }
  }
  const knownMatchdays = new Set(lineups.map(row => row.fixtureId + ':' + row.teamId))
  const eventOrders = new Set<string>()
  for (const row of lineups) {
    const fixture = allFixtures.get(row.fixtureId)
    if (!fixture || ![fixture.home.id, fixture.away.id].includes(row.teamId)
      || fixture.status === 'scheduled'
      || [...row.starters, ...row.bench].some(pick => !knownPlayers.has(pick.playerId))) {
      throw new Error('Matchday sheet references an unknown fixture, club or player, or a scheduled fixture.')
    }
    if (!row.starters.some(pick => isGoalkeeper(players.find(player => player.id === pick.playerId)?.position ?? ''))) {
      throw new Error('Matchday XI ' + row.fixtureId + ' must include a sourced goalkeeper.')
    }
  }
  for (const row of events) {
    const sheet = lineups.find(item => item.fixtureId === row.fixtureId && item.teamId === row.teamId)
    const eventKey = row.fixtureId + ':' + row.order
    if (eventOrders.has(eventKey) || !knownMatchdays.has(row.fixtureId + ':' + row.teamId) || !sheet) throw new Error('Event references an unknown matchday sheet or repeats the event order.')
    eventOrders.add(eventKey)
    const teamPlayers = new Set([...sheet.starters, ...sheet.bench].map(pick => pick.playerId))
    if ([row.dismissal, row.playerIn?.id, row.playerOut].some(id => id && !teamPlayers.has(id))) throw new Error('Event player is absent from the matchday sheet.')
  }
  for (const row of metrics) {
    if (!(row.kind === 'player' ? knownPlayers : knownTeams).has(row.subjectId)) throw new Error('Metric subject is missing from the identity registry.')
  }
  return { schema: 1, revision: input.revision, source, fixtures, players, registrations, lineups, events, metrics }
}

export function readFootballPack(): FootballPack | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) return validateFootballPack(JSON.parse(saved))
  } catch {
    try {
      const last = localStorage.getItem(storageKey + ':previous')
      if (last) return validateFootballPack(JSON.parse(last))
    } catch { /* The bundled dataset remains available. */ }
  }
}

export function publishFootballPack(input: unknown): FootballPack {
  const pack = validateFootballPack(input)
  const current = readFootballPack()
  if (current) localStorage.setItem(storageKey + ':previous', JSON.stringify(current))
  localStorage.setItem(storageKey, JSON.stringify(pack))
  window.dispatchEvent(new Event(changeEvent))
  return pack
}

export function previewFootballPack(input: unknown) {
  const pack = validateFootballPack(input)
  const previous = readFootballPack()
  const priorFixtures = new Map([...baseFixtures, ...(previous?.fixtures.map(fixture => [fixture.id, fixture] as const) ?? [])])
  const differences = pack.fixtures.flatMap(item => {
    const old = priorFixtures.get(item.id)
    const oldScore = old?.score?.join('–')
    const newScore = item.score?.join('–')
    return !old ? [{ id: item.id, text: item.home.name + ' v ' + item.away.name + ' · new fixture' }]
      : Date.parse(old.kickoff) !== Date.parse(item.kickoff) || oldScore !== newScore
        ? [{ id: item.id, text: item.home.name + ' v ' + item.away.name + ' · ' + (oldScore ?? 'unscored') + ' → ' + (newScore ?? 'unscored') + ' · ' + old.kickoff + ' → ' + item.kickoff }]
        : []
  })
  return { pack, differences, replaces: previous?.revision, missingShirtNumbers: pack.registrations.filter(row => row.number === undefined).length }
}

export const subscribeToFootballPack = (callback: () => void) => {
  window.addEventListener(changeEvent, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(changeEvent, callback)
    window.removeEventListener('storage', callback)
  }
}

const positionClass = (role: string) => {
  const code = role.toUpperCase().trim().replaceAll(' ', '-')
  if (/^(GK|GOALKEEPER)$/.test(code)) return 'GK'
  if (/^(CB|LB|RB|LWB|RWB|DF|DEF|DEFENCE|DEFENDER|CENTRE-BACK|LEFT-BACK|RIGHT-BACK)$/.test(code)) return 'DF'
  if (/^(CM|DM|AM|LM|RM|MF|MID|MIDFIELD|MIDFIELDER|CENTRAL-MIDFIELD|ATTACKING-MIDFIELD|DEFENSIVE-MIDFIELD)$/.test(code)) return 'MF'
  if (/^(ST|CF|FW|LW|RW|LF|RF|ATT|FORWARD|OFFENCE|WINGER|CENTRE-FORWARD|LEFT-WINGER|RIGHT-WINGER)$/.test(code)) return 'FW'
  return ''
}
export const isGoalkeeper = (role: string) => positionClass(role) === 'GK'
export function proposeSquad(squad: LineupPlayer[]): { players: LineupPlayer[]; formation: string } | undefined {
  const pool = [...new Map(squad.filter(player => player.id).map(player => [player.id, player])).values()]
  const groups = ['GK', 'DF', 'MF', 'FW'].map(role => pool.filter(player => positionClass(player.position) === role))
  const shapes = [[1, 4, 3, 3], [1, 4, 4, 2], [1, 5, 3, 2], [1, 3, 5, 2], [1, 3, 4, 3]]
  const counts = shapes.find(shape => shape.every((count, index) => groups[index].length >= count))
  return counts ? { formation: counts.slice(1).join('-'), players: groups.flatMap((group, index) => group.slice(0, counts[index])) } : undefined
}

function fixtureTeam(fixture: FixtureSnapshot, side: 'home' | 'away', pack?: FootballPack): Team {
  const team = fixture[side]
  if (!pack) return { ...team, formation: '', players: [], lineupKind: 'repair' }
  const currentDay = studioDate.format(new Date(fixture.kickoff))
  const eligible = pack?.registrations.filter(row => row.teamId === team.id && row.competitionId === fixture.competitionId
    && row.season === fixture.season && row.eligibleFrom <= currentDay && (!row.eligibleUntil || row.eligibleUntil >= currentDay)) ?? []
  const identities = new Map(pack?.players.map(player => [player.id, player]))
  const squad = eligible.flatMap(record => {
    const player = identities.get(record.playerId)
    return player ? [{ ...player, number: record.number, eligibleFrom: record.eligibleFrom, eligibleUntil: record.eligibleUntil, source: pack?.source }] : []
  })
  const xi = pack?.lineups.find(item => item.fixtureId === fixture.id && item.teamId === team.id)
  const matchday = (selections: Selection[]) => selections.flatMap(selection => {
    const player = identities.get(selection.playerId)
    if (!player) return []
    const registration = squad.find(item => item.id === player.id)
    return [{
      ...player, role: selection.role, number: selection.number ?? registration?.number,
      eligibleFrom: registration?.eligibleFrom, eligibleUntil: registration?.eligibleUntil, source: pack?.source,
    }]
  })
  if (xi) {
    return { ...team, formation: xi.formation, players: matchday(xi.starters), bench: matchday(xi.bench), squad, lineupKind: 'confirmed', lineupSource: pack?.source }
  }
  const proposal = proposeSquad(squad)
  return { ...team, formation: proposal?.formation ?? '', players: proposal?.players ?? [], squad, lineupKind: proposal ? 'squad' : 'repair', lineupSource: squad.length ? pack?.source : undefined }
}

export function readFootballSnapshot() {
  return { schema: 1, revision: bundledFootball.revision, downloadedAt: bundledFootball.downloadedAt, season: activeSeason, pack: readFootballPack() }
}

export function fixturesFor(competition = 'PL', season = activeSeason.id, pack = readFootballPack(), now = Date.now()): Match[] {
  const config = openCompetitions.find(item => item.id === competition)
  if (!config || ![activeSeason.id, activeSeason.label].includes(season)) return []
  const open = openFixtures(bundledFootball, config, now)
  const merged = new Map(open.map(item => [item.id, item]))
  for (const item of pack?.fixtures ?? []) {
    if (item.competitionId !== competition || item.season !== activeSeason.label) continue
    const prior = merged.get(item.id)
    const scoreConflict = prior?.verification?.status === 'verified' && prior.score && item.score && prior.score.join(':') !== item.score.join(':')
    merged.set(item.id, scoreConflict
      ? { ...item, status: 'awaiting', score: undefined, verification: { status: 'conflict', note: 'The imported final score differs from the independently checked result. Verify the sources before taking a result graphic.' } }
      : { ...item, revision: pack!.revision, source: pack!.source })
  }
  return [...merged.values()].sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.id.localeCompare(b.id)).map(item => {
    const status = item.status === 'scheduled' && Date.parse(item.kickoff) < now ? 'awaiting' : item.status
    const fixture = { ...item, status }
    return {
      ...fixture, fixture, home: fixtureTeam(fixture, 'home', pack), away: fixtureTeam(fixture, 'away', pack),
      moments: (pack?.events ?? []).filter(row => row.fixtureId === item.id).map(event => ({ ...event, source: pack?.source, playerIn: event.playerIn && { ...event.playerIn, source: pack?.source } })),
      stats: [],
    }
  })
}

export function coverageFor(matches: Match[], competition: string) {
  const config = openCompetitions.find(item => item.id === competition)
  const teams = new Set(matches.flatMap(item => [item.home.id, item.away.id]))
  const squadTeams = new Set(matches.flatMap(match => [match.home, match.away].filter(team => proposeSquad(team.squad ?? [])).map(team => team.id)))
  const finished = matches.filter(match => match.status === 'finished' && match.score)
  let throughRound = 0
  while (config && finished.filter(match => match.round === throughRound + 1).length === config.perRound) throughRound++
  const latestRound = Math.max(0, ...matches.filter(match => ['finished', 'awaiting'].includes(match.status)).map(match => match.round ?? 0))
  return {
    fixtures: matches.length, expected: config?.expected, teams: teams.size, squadTeams: squadTeams.size, finished: finished.length, throughRound, latestRound,
    latestScore: finished.at(-1)?.kickoff, missingResults: matches.filter(item => item.status === 'awaiting').length,
    confirmed: matches.filter(match => match.home.lineupKind === 'confirmed' && match.away.lineupKind === 'confirmed').length,
    conflicts: matches.filter(match => match.verification?.status === 'conflict').length,
  }
}

export function resultStandings(matches: Match[]): (Standing & { goals: number; conceded: number })[] {
  const table = new Map<string, Standing & { goals: number; conceded: number }>()
  for (const match of matches) {
    if (match.status !== 'finished' || !match.score || match.verification?.status === 'conflict') continue
    for (const side of ['home', 'away'] as const) {
      const team = match[side]
      const goals = match.score[side === 'home' ? 0 : 1]
      const conceded = match.score[side === 'home' ? 1 : 0]
      const row = table.get(team.id) ?? { rank: 0, team, played: 0, wins: 0, draws: 0, losses: 0, goalDifference: 0, points: 0, goals: 0, conceded: 0 }
      row.played++
      row.goals += goals
      row.conceded += conceded
      row.goalDifference += goals - conceded
      if (goals > conceded) { row.wins++; row.points += 3 } else if (goals === conceded) { row.draws++; row.points++ } else row.losses++
      table.set(team.id, row)
    }
  }
  return [...table.values()].sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goals - a.goals || a.team.name.localeCompare(b.team.name))
    .map((row, index) => ({ ...row, rank: index + 1 }))
}

export function seasonSubjects(matches: Match[], competition: string, kind: 'player' | 'team', pack = readFootballPack()): ComparisonSubject[] {
  const results = resultStandings(matches)
  const label = (openCompetitions.find(item => item.id === competition)?.label ?? 'Competition') + ' · ' + activeSeason.label
  const imported = pack?.metrics.filter(metric => metric.competitionId === competition && metric.kind === kind) ?? []
  const fromPack = imported.flatMap(metric => {
    const team = bundledFootball.teams[metric.subjectId]
    const player = pack?.players.find(item => item.id === metric.subjectId)
    const name = kind === 'team' ? team?.name : player?.name
    return name ? [{
      id: metric.subjectId + ':' + metric.periodFrom + ':' + metric.periodUntil, name, color: team?.color ?? '#8797ae',
      subtitle: label + ' · ' + metric.periodFrom + ' to ' + metric.periodUntil, position: player?.position,
      stats: { ...metric.totals, ...(metric.minutes !== undefined ? { minutes: metric.minutes } : {}) }, source: pack?.source,
      period: metric.periodFrom + ':' + metric.periodUntil,
    }] : []
  })
  if (kind === 'player') return fromPack
  const through = matches.filter(item => item.status === 'finished').at(-1)?.kickoff.slice(0, 10)
  return [...results.map(({ team, played, wins, draws, losses, goalDifference, points, goals, conceded }) => ({
    id: team.id, name: team.name, color: team.color, subtitle: label + ' · available results through ' + (through ?? '—'),
    stats: { played, wins, draws, losses, goalDifference, points, goals, conceded }, source: matches[0]?.source,
    period: 'recorded:' + through,
  })), ...fromPack]
}

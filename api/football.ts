import { activeSeason, fixturesFor, readFootballSnapshot, resultStandings } from '../src/data/footballDataset.js'
import { clubByName } from '../src/data/clubAliases.js'
import { isScore } from '../src/data/fixtureSnapshot.js'
import type { LineupPlayer, Match, Moment, Source, Standing, Team } from '../src/data/model'

type ApiPerson = { id?: number; name?: string; position?: string | null; shirtNumber?: number | null }
type ApiTeam = { id?: number; name?: string; shortName?: string; tla?: string; formation?: string; lineup?: ApiPerson[]; bench?: ApiPerson[]; squad?: ApiPerson[]; statistics?: Record<string, number | null> }
type ApiScore = { home: number | null; away: number | null }
type ApiMatch = {
  id?: number
  utcDate?: string
  lastUpdated?: string
  status?: string
  competition?: { name?: string; code?: string }
  season?: { startDate?: string; endDate?: string }
  score?: { duration?: string; fullTime?: ApiScore; regularTime?: ApiScore; extraTime?: ApiScore; penalties?: ApiScore }
  homeTeam?: ApiTeam
  awayTeam?: ApiTeam
  venue?: string
  matchday?: number
  goals?: { minute: number; injuryTime?: number; team?: ApiTeam; scorer?: ApiPerson; assist?: ApiPerson; type?: string; score?: { home: number; away: number } }[]
  bookings?: { minute: number; injuryTime?: number; team?: ApiTeam; player?: ApiPerson; card?: string }[]
  substitutions?: { minute: number; injuryTime?: number; team?: ApiTeam; playerIn?: ApiPerson; playerOut?: ApiPerson }[]
}
type ApiStanding = {
  position: number; team: ApiTeam; playedGames: number; won: number; draw: number; lost: number; goalDifference: number; points: number
}
type CacheEntry = { value: unknown; fetchedAt: number }
const cache = new Map<string, CacheEntry>()
const pending = new Map<string, Promise<CacheEntry>>()
const competitions = new Set(['PL', 'CL', 'EL', 'PD', 'BL1', 'SA', 'FL1'])
const matchLabels = [
  ['ball_possession', 'Possession', '%'], ['shots', 'Shots'], ['shots_on_goal', 'Shots on target'],
  ['corner_kicks', 'Corners'], ['fouls', 'Fouls'], ['offsides', 'Offsides'], ['saves', 'Saves'],
  ['yellow_cards', 'Yellow cards'], ['red_cards', 'Red cards'],
]

class ProviderError extends Error {
  constructor(readonly status: number) { super(`Football provider returned HTTP ${status}`) }
}
function json(body: object, status = 200, maxAge = 0) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': maxAge ? `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=60` : 'no-store' },
  })
}
async function fetchProvider(path: string, token: string, ttl: number) {
  const previous = cache.get(path)
  if (previous && Date.now() - previous.fetchedAt < ttl) return { entry: previous, stale: false }
  let request = pending.get(path)
  if (!request) {
    request = (async () => {
      const response = await fetch(`https://api.football-data.org/v4${path}`, {
        headers: { 'X-Auth-Token': token }, signal: AbortSignal.timeout(7000),
      })
      if (!response.ok) throw new ProviderError(response.status)
      const entry = { value: await response.json(), fetchedAt: Date.now() }
      cache.delete(path)
      cache.set(path, entry)
      if (cache.size > 80) cache.delete(cache.keys().next().value!)
      return entry
    })().finally(() => pending.delete(path))
    pending.set(path, request)
  }
  try {
    return { entry: await request, stale: false }
  } catch (error) {
    if (previous && Date.now() - previous.fetchedAt < 86400000 && (!(error instanceof ProviderError) || error.status >= 429)) {
      return { entry: previous, stale: true }
    }
    throw error
  }
}
function positionCode(value?: string | null) {
  const positions: Record<string, string> = {
    Goalkeeper: 'GK', 'Centre-Back': 'CB', 'Left-Back': 'LB', 'Right-Back': 'RB', Defence: 'DF',
    'Defensive Midfield': 'DM', 'Central Midfield': 'CM', 'Attacking Midfield': 'AM', Midfield: 'MF',
    'Left Midfield': 'LM', 'Right Midfield': 'RM', 'Left Winger': 'LW', 'Right Winger': 'RW', 'Centre-Forward': 'ST', Offence: 'FW',
  }
  return value ? positions[value] ?? value : ''
}
function normalizePlayer(person: ApiPerson): LineupPlayer {
  return { id: person.id === undefined ? undefined : String(person.id), name: person.name || 'Name unavailable', number: typeof person.shirtNumber === 'number' && person.shirtNumber > 0 ? person.shirtNumber : undefined, position: positionCode(person.position) }
}
function normalizeTeam(team: ApiTeam = {}, away = false, source?: Source): Team {
  const name = team.name || team.shortName || 'Team to be confirmed'
  const mapped = clubByName(name) ?? (team.shortName ? clubByName(team.shortName) : undefined)
  const players = (team.lineup || []).filter(player => player.id && player.name).map(person => ({ ...normalizePlayer(person), source }))
  const bench = (team.bench || []).filter(player => player.id && player.name).map(person => ({ ...normalizePlayer(person), source }))
  const complete = players.length === 11 && new Set(players.map(player => player.id)).size === 11 && players.some(player => player.position === 'GK')
  return {
    ...mapped, id: mapped?.id ?? String(team.id ?? name), providerId: team.id ? String(team.id) : undefined,
    name: mapped?.name ?? name, shortName: mapped?.shortName || team.tla || (team.shortName || name).slice(0, 3).toUpperCase(),
    color: mapped?.color || (away ? '#68a9fc' : '#f36c62'), formation: team.formation || '',
    players, bench, lineupKind: complete ? 'confirmed' : 'repair', lineupSource: players.length ? source : undefined,
  }
}
function normalizeMatch(match: ApiMatch, source: Source, fallbackSeason: string, fallbackCompetition = ''): Match | null {
  if (!match.id || !match.utcDate || !Number.isFinite(Date.parse(match.utcDate))) return null
  const home = normalizeTeam(match.homeTeam, false, source)
  const away = normalizeTeam(match.awayTeam, true, source)
  const eventTeam = (team?: ApiTeam) => team?.id === match.homeTeam?.id ? home.id : team?.id === match.awayTeam?.id ? away.id : undefined
  const goals = (match.goals || []).map<Moment>((item, index) => ({
    id: `goal-${index}`, kind: 'Goal', minute: item.minute, extra: item.injuryTime,
    teamId: eventTeam(item.team), source,
    title: item.scorer?.name ? `Goal · ${item.scorer.name}` : 'Goal',
    description: [
      item.type === 'PENALTY' ? 'Penalty' : item.type === 'OWN' ? 'Own goal' : '',
      item.assist?.name ? `Assist: ${item.assist.name}` : '',
      item.score ? `Score: ${item.score.home}–${item.score.away}` : '',
    ].filter(Boolean).join(' · ') || 'Goal recorded by the match provider.',
  }))
  const cards = (match.bookings || []).map<Moment>((item, index) => ({
    id: `card-${index}`, kind: 'Card', minute: item.minute, extra: item.injuryTime,
    teamId: eventTeam(item.team), source,
    title: `${item.card === 'RED' ? 'Red card' : item.card === 'YELLOW_RED' ? 'Second yellow card' : 'Yellow card'} · ${item.player?.name || 'Player unavailable'}`,
    description: 'Booking recorded by the match provider.',
    dismissal: (item.card === 'RED' || item.card === 'YELLOW_RED') && item.player?.id ? String(item.player.id) : undefined,
  }))
  const substitutions = (match.substitutions || []).map<Moment>((item, index) => {
    const bench = item.team?.id === match.awayTeam?.id ? away.bench : home.bench
    const playerIn = bench?.find(player => player.id === String(item.playerIn?.id)) || (item.playerIn ? normalizePlayer(item.playerIn) : undefined)
    return {
      id: `sub-${index}`, kind: 'Substitution', minute: item.minute, extra: item.injuryTime,
      teamId: eventTeam(item.team), source,
      title: `${item.playerIn?.name || 'Player in'} replaces ${item.playerOut?.name || 'player out'}`,
      description: 'Substitution recorded by the match provider.',
      playerIn, playerOut: item.playerOut?.id ? String(item.playerOut.id) : undefined,
    }
  })
  const pair = (value?: ApiScore) => {
    const score = [value?.home, value?.away]
    return isScore(score) ? score : undefined
  }
  const shootout = pair(match.score?.penalties)
  const fullTime = shootout ? pair(match.score?.extraTime) ?? pair(match.score?.regularTime) : pair(match.score?.fullTime)
  const period = shootout ? 'penalties' as const : match.score?.duration === 'EXTRA_TIME' ? 'extra-time' as const : undefined
  const status = match.status === 'FINISHED' ? 'finished'
    : ['IN_PLAY', 'PAUSED', 'LIVE'].includes(match.status || '') ? 'live'
    : ['POSTPONED', 'SUSPENDED', 'CANCELLED', 'AWARDED'].includes(match.status || '') ? 'postponed' : 'scheduled'
  const seasonStart = match.season?.startDate?.slice(0, 4)
  const seasonEnd = match.season?.endDate?.slice(2, 4)
  const season = seasonStart && seasonEnd ? seasonStart + '/' + seasonEnd : fallbackSeason
  const competitionId = match.competition?.code || fallbackCompetition || 'unknown'
  const canonical = clubByName(home.name) && clubByName(away.name) && ['PL', 'CL', 'EL'].includes(competitionId)
  const id = canonical ? [competitionId.toLowerCase(), season.slice(0, 4), home.id, away.id].join(':') : String(match.id)
  return {
    id, providerId: String(match.id), competitionId, competition: match.competition?.name || 'Football competition',
    season, revision: 'licensed-' + (match.lastUpdated || source.downloadedAt || match.utcDate).replace(/[^0-9]/g, ''),
    kickoff: match.utcDate, status: status === 'finished' && !fullTime || status === 'scheduled' && Date.parse(match.utcDate) < Date.now() ? 'awaiting' : status, home, away,
    score: fullTime, shootout: fullTime ? shootout : undefined, period,
    verification: { status: 'reported' },
    venue: match.venue, round: match.matchday,
    source: { ...source, updatedAt: match.lastUpdated || source.updatedAt },
    moments: [...goals, ...cards, ...substitutions].sort((a, b) => a.minute - b.minute || (a.extra || 0) - (b.extra || 0)),
    stats: matchLabels.flatMap(([key, label, unit]) => {
      const h = match.homeTeam?.statistics?.[key] ?? null
      const a = match.awayTeam?.statistics?.[key] ?? null
      return h === null && a === null ? [] : [{ label, home: h, away: a, unit }]
    }),
  }
}
function providerMessage(error: unknown) {
  if (error instanceof ProviderError) {
    if (error.status === 403) return 'This competition, season or data type is unavailable on the configured provider plan.'
    if (error.status === 429) return 'The provider rate limit has been reached. Try again in a minute.'
    if (error.status === 404) return 'The provider has no record for this selection.'
    if (error.status === 401) return 'The provider rejected its credentials.'
  }
  return 'The football data provider could not be reached.'
}
export async function handleFootball(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405)
  const token = process.env.FOOTBALL_DATA_TOKEN?.trim()
  const query = new URL(request.url).searchParams
  const section = query.get('section') || 'matches'
  const competition = query.get('competition') || 'PL'
  const season = query.get('season') || activeSeason.id
  const id = query.get('id') || ''
  if (!competitions.has(competition) || !/^20\d{2}$/.test(season)) return json({ configured: true, error: 'Unknown competition or season.' }, 400)
  if (!['matches', 'match', 'standings', 'squad'].includes(section) || (['match', 'squad'].includes(section) && !/^[a-z0-9:-]{1,120}$/i.test(id))) {
    return json({ configured: true, error: 'Unknown football data request.' }, 400)
  }
  const pinned = fixturesFor(competition, season)
  const pinnedMatch = section === 'match' && id.includes(':') ? fixturesFor(id.split(':')[0].toUpperCase(), id.split(':')[1]).find(match => match.id === id) : undefined
  const fallback = {
    configured: !!token,
    snapshot: readFootballSnapshot(), source: (pinnedMatch ?? pinned[0])?.source,
    ...(section === 'matches' ? { matches: pinned } : section === 'standings' ? { standings: resultStandings(pinned) } : section === 'match' ? { match: pinnedMatch ?? null } : {}),
  }
  if (pinnedMatch) return json(fallback, 200, 90)
  if (!token) return json({ ...fallback, message: pinned.length ? 'Using the dated keyless snapshot. Line-up and statistics coverage are reported separately.' : 'The keyless snapshot has no coverage for this competition and season.' }, 200, 90)
  if (['match', 'squad'].includes(section) && !/^\d{1,10}$/.test(id)) return json({ ...fallback, error: 'Unknown provider identity.' }, 404)
  let path = `/competitions/${competition}/${section}?season=${season}`
  if (section === 'match') path = `/matches/${id}`
  if (section === 'squad') path = `/teams/${id}`
  const ttl = section === 'match' ? 120000 : section === 'matches' ? 180000 : 600000
  try {
    const { entry, stale } = await fetchProvider(path, token, ttl)
    const source: Source = { kind: 'provider', label: 'football-data.org', url: 'https://www.football-data.org/', downloadedAt: new Date(entry.fetchedAt).toISOString(), permission: 'Configured provider · use subject to the producer’s subscription' }
    const base = { configured: true, source, stale }
    const fallbackSeason = `${season}/${String(Number(season) + 1).slice(-2)}`
    if (section === 'squad') {
      const raw = entry.value as ApiTeam
      return json({ ...base, team: { ...normalizeTeam(raw), players: (raw.squad || []).map(normalizePlayer) } }, 200, stale ? 15 : 120)
    }
    if (section === 'match') return json({ ...base, match: normalizeMatch(entry.value as ApiMatch, source, fallbackSeason, competition) }, 200, stale ? 15 : 60)
    if (section === 'standings') {
      const payload = entry.value as { standings?: { type: string; group?: string; table?: ApiStanding[] }[] }
      const standings = (payload.standings || []).filter(row => row.type === 'TOTAL').flatMap(row =>
        (row.table || []).map<Standing>((team, index) => ({
          rank: team.position, team: normalizeTeam(team.team, index % 2 === 1), played: team.playedGames, wins: team.won, draws: team.draw,
          losses: team.lost, goalDifference: team.goalDifference, points: team.points, group: row.group,
        })),
      )
      return json({ ...base, standings }, 200, stale ? 15 : 180)
    }
    const payload = entry.value as { matches?: ApiMatch[] }
    const matches = (payload.matches || []).map(match => normalizeMatch(match, source, fallbackSeason, competition)).filter(Boolean)
    return json({ ...base, matches }, 200, stale ? 15 : 90)
  } catch (error) {
    if (pinned.length && ['matches', 'standings'].includes(section)) return json({ ...fallback, stale: true, message: providerMessage(error) + ' Using the last bundled snapshot.' }, 200, 15)
    return json({ configured: true, error: providerMessage(error) }, error instanceof ProviderError && error.status === 429 ? 429 : 503)
  }
}
export default { fetch: handleFootball }

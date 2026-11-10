import type { LineupPlayer, Match, Moment, Source, Standing, Team } from '../src/data/model'

type ApiPerson = { id?: number; name?: string; position?: string | null; shirtNumber?: number | null }
type ApiTeam = { id?: number; name?: string; shortName?: string; tla?: string; formation?: string; lineup?: ApiPerson[]; bench?: ApiPerson[]; squad?: ApiPerson[]; statistics?: Record<string, number | null> }
type ApiMatch = {
  id?: number
  utcDate?: string
  lastUpdated?: string
  status?: string
  competition?: { name?: string }
  season?: { startDate?: string; endDate?: string }
  score?: { fullTime?: { home: number | null; away: number | null } }
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
  return { id: person.id === undefined ? undefined : String(person.id), name: person.name || 'Name unavailable', number: person.shirtNumber ?? 0, position: positionCode(person.position) }
}
function normalizeTeam(team: ApiTeam = {}, away = false): Team {
  const name = team.name || team.shortName || 'Team to be confirmed'
  return {
    id: String(team.id ?? name), name, shortName: team.tla || (team.shortName || name).slice(0, 3).toUpperCase(),
    color: away ? '#68a9fc' : '#f36c62', formation: team.formation || '',
    players: (team.lineup || []).map(normalizePlayer), bench: (team.bench || []).map(normalizePlayer),
  }
}
function normalizeMatch(match: ApiMatch, source: Source, fallbackSeason: string): Match | null {
  if (!match.id || !match.utcDate || !Number.isFinite(Date.parse(match.utcDate))) return null
  const home = normalizeTeam(match.homeTeam)
  const away = normalizeTeam(match.awayTeam, true)
  const goals = (match.goals || []).map<Moment>((item, index) => ({
    id: `goal-${index}`, kind: 'Goal', minute: item.minute, extra: item.injuryTime,
    teamId: String(item.team?.id),
    title: item.scorer?.name ? `Goal · ${item.scorer.name}` : 'Goal',
    description: [
      item.type === 'PENALTY' ? 'Penalty' : item.type === 'OWN' ? 'Own goal' : '',
      item.assist?.name ? `Assist: ${item.assist.name}` : '',
      item.score ? `Score: ${item.score.home}–${item.score.away}` : '',
    ].filter(Boolean).join(' · ') || 'Goal recorded by the match provider.',
  }))
  const cards = (match.bookings || []).map<Moment>((item, index) => ({
    id: `card-${index}`, kind: 'Card', minute: item.minute, extra: item.injuryTime,
    teamId: String(item.team?.id),
    title: `${item.card === 'RED' ? 'Red card' : item.card === 'YELLOW_RED' ? 'Second yellow card' : 'Yellow card'} · ${item.player?.name || 'Player unavailable'}`,
    description: 'Booking recorded by the match provider.',
    dismissal: (item.card === 'RED' || item.card === 'YELLOW_RED') && item.player?.id ? String(item.player.id) : undefined,
  }))
  const substitutions = (match.substitutions || []).map<Moment>((item, index) => {
    const bench = item.team?.id === match.awayTeam?.id ? away.bench : home.bench
    const playerIn = bench?.find(player => player.id === String(item.playerIn?.id)) || (item.playerIn ? normalizePlayer(item.playerIn) : undefined)
    return {
      id: `sub-${index}`, kind: 'Substitution', minute: item.minute, extra: item.injuryTime,
      teamId: String(item.team?.id),
      title: `${item.playerIn?.name || 'Player in'} replaces ${item.playerOut?.name || 'player out'}`,
      description: 'Substitution recorded by the match provider.',
      playerIn, playerOut: item.playerOut?.id ? String(item.playerOut.id) : undefined,
    }
  })
  const fullTime = match.score?.fullTime
  const status = match.status === 'FINISHED' ? 'finished'
    : ['IN_PLAY', 'PAUSED', 'LIVE'].includes(match.status || '') ? 'live'
    : ['POSTPONED', 'SUSPENDED', 'CANCELLED', 'AWARDED'].includes(match.status || '') ? 'postponed' : 'scheduled'
  const seasonStart = match.season?.startDate?.slice(0, 4)
  const seasonEnd = match.season?.endDate?.slice(2, 4)
  return {
    id: String(match.id), competition: match.competition?.name || 'Football competition',
    season: seasonStart && seasonEnd ? `${seasonStart}/${seasonEnd}` : fallbackSeason,
    kickoff: match.utcDate, status, home, away,
    score: typeof fullTime?.home === 'number' && typeof fullTime.away === 'number' ? [fullTime.home, fullTime.away] : undefined,
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
  if (!token) return json({ configured: false, message: 'Live fixtures need a server-side football-data.org token. The studio demo and official archive are available.' })
  const query = new URL(request.url).searchParams
  const section = query.get('section') || 'matches'
  const competition = query.get('competition') || 'PL'
  const year = new Date().getUTCFullYear()
  const defaultSeason = new Date().getUTCMonth() >= 6 ? year : year - 1
  const season = query.get('season') || String(defaultSeason)
  const id = query.get('id') || ''
  if (!competitions.has(competition) || !/^20\d{2}$/.test(season)) return json({ configured: true, error: 'Unknown competition or season.' }, 400)
  if (!['matches', 'match', 'standings', 'squad'].includes(section) || (['match', 'squad'].includes(section) && !/^\d{1,10}$/.test(id))) {
    return json({ configured: true, error: 'Unknown football data request.' }, 400)
  }
  let path = `/competitions/${competition}/${section}?season=${season}`
  if (section === 'match') path = `/matches/${id}`
  if (section === 'squad') path = `/teams/${id}`
  const ttl = section === 'match' ? 120000 : section === 'matches' ? 180000 : 600000
  try {
    const { entry, stale } = await fetchProvider(path, token, ttl)
    const source: Source = { kind: 'provider', label: 'football-data.org', url: 'https://www.football-data.org/', updatedAt: new Date(entry.fetchedAt).toISOString() }
    const base = { configured: true, source, stale }
    const fallbackSeason = `${season}/${String(Number(season) + 1).slice(-2)}`
    if (section === 'squad') {
      const raw = entry.value as ApiTeam
      return json({ ...base, team: { ...normalizeTeam(raw), players: (raw.squad || []).map(normalizePlayer) } }, 120)
    }
    if (section === 'match') return json({ ...base, match: normalizeMatch(entry.value as ApiMatch, source, fallbackSeason) }, stale ? 15 : 60)
    if (section === 'standings') {
      const payload = entry.value as { standings?: { type: string; group?: string; table?: ApiStanding[] }[] }
      const standings = (payload.standings || []).filter(row => row.type === 'TOTAL').flatMap(row =>
        (row.table || []).map<Standing>((team, index) => ({
          rank: team.position, team: normalizeTeam(team.team, index % 2 === 1), played: team.playedGames, wins: team.won, draws: team.draw,
          losses: team.lost, goalDifference: team.goalDifference, points: team.points, group: row.group,
        })),
      )
      return json({ ...base, standings }, stale ? 15 : 180)
    }
    const payload = entry.value as { matches?: ApiMatch[] }
    const matches = (payload.matches || []).map(match => normalizeMatch(match, source, fallbackSeason)).filter(Boolean)
    return json({ ...base, matches }, stale ? 15 : 90)
  } catch (error) {
    return json({ configured: true, error: providerMessage(error) }, error instanceof ProviderError && error.status === 429 ? 429 : 503)
  }
}
export default { fetch: handleFootball }

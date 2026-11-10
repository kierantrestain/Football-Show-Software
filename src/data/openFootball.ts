import { openLigaClub } from './clubAliases.js'
import { isObject, isScore, isZonedDate } from './fixtureSnapshot.js'
import type { FixtureSnapshot, FixtureTeam, FixtureVerification, Score, Source } from './fixtureSnapshot.js'

export const activeSeason = { id: '2026', label: '2026/27', startsOn: '2026-08-21', endsOn: '2027-05-30', source: 'https://www.premierleague.com/en/news/4675097' }
export const openCompetitions = [
  { id: 'PL', label: 'Premier League', shortcut: 'pl', expected: 380, rounds: 38, perRound: 10 },
  { id: 'CL', label: 'Champions League', shortcut: 'ucl', expected: 144, rounds: 8, perRound: 18 },
  { id: 'EL', label: 'Europa League', shortcut: 'uel2026', expected: 144, rounds: 8, perRound: 18 },
] as const
export type OpenCompetition = typeof openCompetitions[number]
export type FixtureRow = [
  id: string, round: number, kickoff: string, home: string, away: string, score: Score | null,
  shootout?: Score | null, period?: 'extra-time' | 'penalties' | null,
]
export type OpenBundle = {
  schema: 1
  season: typeof activeSeason
  downloadedAt: string
  revision: string
  teams: Record<string, FixtureTeam>
  competitions: Record<string, FixtureRow[]>
}

export function parseOpenFootballScore(input: unknown): Score | undefined {
  if (isScore(input)) return input
  if (!isObject(input)) return undefined
  if (isScore(input.ft)) return input.ft
  if (isObject(input.ft)) return parseOpenFootballScore(input.ft)
  const pair = [input.home ?? input.team1, input.away ?? input.team2]
  return isScore(pair) ? pair : undefined
}

function sourceClub(value: unknown) {
  if (!isObject(value) || typeof value.teamId !== 'number' || typeof value.teamName !== 'string') throw new Error('Invalid OpenLigaDB team.')
  return openLigaClub(value.teamId, value.teamName)
}

function scoreOf(result: Record<string, unknown>[], kind: string) {
  const score = result.find(item => item.resultTypeKind === kind)
  const pair = [score?.pointsTeam1, score?.pointsTeam2]
  return isScore(pair) ? pair : undefined
}

export function normalizeOpenBundle(feeds: Record<string, unknown>, downloadedAt: string): OpenBundle {
  if (!isZonedDate(downloadedAt)) throw new Error('The snapshot retrieval date must include a timezone.')
  const teams: Record<string, FixtureTeam> = {}
  const competitions: Record<string, FixtureRow[]> = {}
  for (const competition of openCompetitions) {
    const raw = feeds[competition.id]
    if (!Array.isArray(raw) || raw.length !== competition.expected) throw new Error(competition.id + ' returned unexpected fixture coverage.')
    const ids = new Set<string>()
    const rows: FixtureRow[] = []
    for (const item of raw) {
      if (!isObject(item) || !isObject(item.group) || !isZonedDate(item.matchDateTimeUTC) || !Array.isArray(item.matchResults)
        || typeof item.matchIsFinished !== 'boolean' || typeof item.matchID !== 'number' || !Number.isInteger(item.matchID) || item.matchID < 1) {
        throw new Error('Invalid ' + competition.id + ' fixture.')
      }
      const home = sourceClub(item.team1)
      const away = sourceClub(item.team2)
      const round = item.group.groupOrderID
      if (typeof round !== 'number' || !Number.isInteger(round) || round < 1 || round > competition.rounds || home.id === away.id) {
        throw new Error('Invalid teams or round in ' + competition.id + ' fixture ' + item.matchID + '.')
      }
      const id = [competition.id.toLowerCase(), activeSeason.id, home.id, away.id].join(':')
      if (ids.has(id)) throw new Error('Duplicate fixture ' + id + '.')
      ids.add(id)
      teams[home.id] = home
      teams[away.id] = away
      const result = item.matchResults.filter(isObject)
      const extraTime = scoreOf(result, 'AfterExtraTime')
      const shootout = scoreOf(result, 'AfterPenaltyShootout') ?? scoreOf(result, 'PenaltyShootout')
      const score = item.matchIsFinished ? extraTime ?? scoreOf(result, 'After90Minutes') : undefined
      if (item.matchIsFinished && !score) throw new Error('Finished fixture ' + id + ' has no supported final result.')
      const row: FixtureRow = [id, round, item.matchDateTimeUTC, home.id, away.id, score ?? null]
      if (shootout && score) row.push(shootout, 'penalties')
      else if (extraTime) row.push(null, 'extra-time')
      rows.push(row)
    }
    for (let round = 1; round <= competition.rounds; round++) {
      if (rows.filter(row => row[1] === round).length !== competition.perRound) throw new Error('Unexpected ' + competition.id + ' round ' + round + ' coverage.')
    }
    competitions[competition.id] = rows.sort((a, b) => a[2].localeCompare(b[2]) || a[0].localeCompare(b[0]))
  }
  return { schema: 1, season: activeSeason, downloadedAt, revision: 'open-' + downloadedAt.replace(/[^0-9]/g, ''), teams, competitions }
}

const checkedAt = '2026-11-10T01:14:00Z'
const unitedFixture = 'pl:2026:manchester-united:aston-villa'
const leagueFixtures = activeSeason.source
const uefaCl = 'https://www.uefa.com/uefachampionsleague/news/02a8-2174c9e9019d-f909a77bd77a-1000--2026-27-champions-league-all-the-league-phase-fixtures-a/'
const uefaEl = 'https://www.uefa.com/uefaeuropaleague/news/02a8-2174cafa5bb6-82bbc20c9b92-1000--2026-27-europa-league-all-the-league-phase-fixtures-and-results/'
const villaReport = 'https://www.avfc.co.uk/news/2026/november/08/report-manchester-united-4-4-aston-villa/'
const unitedReport = 'https://www.manutd.com/en/matches/mens-team/manchester-united-v-aston-villa-fc-premier-league-20261108?tab=live'
const plReport = 'https://www.premierleague.com/en/news/4757019/what-we-learned-from-sundays-matches/'

const sampledChecks: Record<string, { kickoff: string; score?: Score; sources: string[] }> = {
  [unitedFixture]: { kickoff: '2026-11-08T16:30:00Z', score: [4, 4], sources: [unitedReport, villaReport, plReport] },
  'pl:2026:manchester-city:fulham': { kickoff: '2026-11-21T12:30:00Z', sources: [leagueFixtures] },
  'cl:2026:manchester-united:roma': { kickoff: '2026-11-03T20:00:00Z', score: [3, 2], sources: [uefaCl] },
  'cl:2026:bodo-glimt:lille': { kickoff: '2026-11-03T20:00:00Z', score: [0, 0], sources: [uefaCl] },
  'cl:2026:manchester-city:napoli': { kickoff: '2026-11-24T20:00:00Z', sources: [uefaCl] },
  'el:2026:rennes:olympiacos': { kickoff: '2026-11-04T15:30:00Z', score: [0, 0], sources: [uefaEl] },
  'el:2026:sunderland:dinamo-zagreb': { kickoff: '2026-11-05T20:00:00Z', score: [0, 2], sources: [uefaEl] },
  'el:2026:dinamo-zagreb:bayer-leverkusen': { kickoff: '2026-11-26T17:45:00Z', sources: [uefaEl] },
}

// OpenLigaDB round-four results, checked row by row against the UEFA round reports.
const verifiedRoundResults: Record<string, [date: string, home: number, away: number]> = {
  'cl:2026:galatasaray:vfb-stuttgart': ["2026-11-03", 2, 0],
  'cl:2026:shakhtar-donetsk:sporting-cp': ["2026-11-03", 0, 1],
  'cl:2026:atletico-madrid:bayern-munchen': ["2026-11-03", 0, 2],
  'cl:2026:barcelona:aston-villa': ["2026-11-03", 3, 0],
  'cl:2026:bodo-glimt:lille': ["2026-11-03", 0, 0],
  'cl:2026:feyenoord:inter': ["2026-11-03", 0, 3],
  'cl:2026:lask:slovan-bratislava': ["2026-11-03", 4, 0],
  'cl:2026:manchester-united:roma': ["2026-11-03", 3, 2],
  'cl:2026:villarreal:paris-saint-germain': ["2026-11-03", 0, 6],
  'cl:2026:aek-athens:real-madrid': ["2026-11-04", 2, 3],
  'cl:2026:fenerbahce:liverpool': ["2026-11-04", 3, 2],
  'cl:2026:borussia-dortmund:real-betis': ["2026-11-04", 2, 1],
  'cl:2026:lens:como-1907': ["2026-11-04", 1, 9],
  'cl:2026:porto:napoli': ["2026-11-04", 4, 1],
  'cl:2026:psv-eindhoven:club-brugge': ["2026-11-04", 1, 2],
  'cl:2026:rb-leipzig:manchester-city': ["2026-11-04", 2, 3],
  'cl:2026:slavia-praha:arsenal': ["2026-11-04", 1, 2],
  'cl:2026:viking:sabah': ["2026-11-04", 4, 1],
  'el:2026:rennes:olympiacos': ["2026-11-04", 0, 0],
  'el:2026:anderlecht:salzburg': ["2026-11-05", 2, 0],
  'el:2026:crystal-palace:hoffenheim': ["2026-11-05", 1, 1],
  'el:2026:levski-sofia:jagiellonia-biaystok': ["2026-11-05", 1, 0],
  'el:2026:lillestrom:viktoria-plzen': ["2026-11-05", 0, 1],
  'el:2026:milan:ferencvaros': ["2026-11-05", 0, 2],
  'el:2026:n-e-c-nijmegen:omonia': ["2026-11-05", 3, 1],
  'el:2026:real-sociedad:lyon': ["2026-11-05", 1, 1],
  'el:2026:sparta-praha:afc-bournemouth': ["2026-11-05", 1, 3],
  'el:2026:az-alkmaar:juventus': ["2026-11-05", 1, 2],
  'el:2026:bayer-leverkusen:marseille': ["2026-11-05", 0, 1],
  'el:2026:benfica:lech-poznan': ["2026-11-05", 3, 1],
  'el:2026:celta-vigo:union-saint-gilloise': ["2026-11-05", 1, 2],
  'el:2026:celtic:besiktas': ["2026-11-05", 3, 2],
  'el:2026:hapoel-beer-sheva:ofi-crete': ["2026-11-05", 0, 2],
  'el:2026:sturm-graz:celje': ["2026-11-05", 2, 3],
  'el:2026:sunderland:dinamo-zagreb': ["2026-11-05", 0, 2],
  'el:2026:torreense:ararat-armenia': ["2026-11-05", 3, 2],
}

export function openFixtures(bundle: OpenBundle, competition: OpenCompetition, now = Date.now()): FixtureSnapshot[] {
  return bundle.competitions[competition.id].map(([id, round, kickoff, home, away, reported, shootout, period]) => {
    const audited = verifiedRoundResults[id]
    const check = sampledChecks[id] ?? (audited ? { kickoff: audited[0], score: [audited[1], audited[2]] as Score, sources: [competition.id === 'CL' ? uefaCl : uefaEl] } : undefined)
    const expiredScheduleCheck = Boolean(check && !check.score && (reported || Date.parse(kickoff) < now))
    const scoreDiffers = Boolean(check?.score && reported && (reported[0] !== check.score[0] || reported[1] !== check.score[1]))
    const kickoffDiffers = Boolean(check && (check.kickoff.length === 10 ? kickoff.slice(0, 10) !== check.kickoff : Date.parse(kickoff) !== Date.parse(check.kickoff)))
    const score = scoreDiffers || (kickoffDiffers && !expiredScheduleCheck) ? undefined : reported ?? (id === unitedFixture ? check?.score : undefined)
    const source: Source = {
      kind: 'open', label: 'OpenLigaDB · ODbL 1.0', url: 'https://www.openligadb.de/lizenz',
      downloadedAt: bundle.downloadedAt, permission: 'Open Database License 1.0 with attribution and share alike',
    }
    let verification: FixtureVerification = { status: 'reported' }
    if (check && (!expiredScheduleCheck || check.score)) {
      const differentScore = check.score && (!score || check.score[0] !== score[0] || check.score[1] !== score[1])
      verification = {
        status: differentScore || kickoffDiffers ? 'conflict' : 'verified',
        checkedAt, sources: check.sources,
        note: kickoffDiffers ? 'Reported kickoff ' + kickoff + ' differs from the pinned check ' + check.kickoff + '.'
          : differentScore ? 'Reported score ' + (reported?.join('–') ?? 'missing') + ' differs from the pinned check ' + check.score?.join('–') + '.'
            : id === unitedFixture ? 'Result and moved kickoff checked against both clubs and the league. OpenLigaDB’s earlier result was blank.' : undefined,
      }
    }
    return {
      id, revision: bundle.revision, competitionId: competition.id, competition: competition.label, season: bundle.season.label,
      kickoff, round, home: bundle.teams[home], away: bundle.teams[away], source, verification,
      status: verification.status === 'conflict' ? 'awaiting' : score ? 'finished' : Date.parse(kickoff) < now ? 'awaiting' : 'scheduled',
      score, shootout: score ? shootout ?? undefined : undefined, period: score ? period ?? undefined : undefined,
    }
  })
}

export function retainResultCoverage(next: OpenBundle, prior: OpenBundle): OpenBundle {
  for (const competition of openCompetitions) {
    const incoming = new Map(next.competitions[competition.id].map(row => [row[0], row]))
    for (const previous of prior.competitions[competition.id]) {
      const current = incoming.get(previous[0])
      if (!current || (previous[5] && !current[5])) throw new Error('Refresh would remove a fixture or existing result for ' + previous[0] + '.')
    }
  }
  return next
}

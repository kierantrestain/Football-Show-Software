export type Source = {
  kind: 'demo' | 'provider' | 'official' | 'open' | 'pack'
  label: string
  url?: string
  updatedAt?: string
  downloadedAt?: string
  checkedAt?: string
  permission?: string
}

export type Score = [number, number]
export type FixtureStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'awaiting'
export type FixtureTeam = { id: string; name: string; shortName: string; color: string }
export type FixtureVerification = { status: 'verified' | 'reported' | 'conflict'; checkedAt?: string; sources?: string[]; note?: string }
export type FixtureSnapshot = {
  id: string
  revision: string
  competitionId: string
  competition: string
  season: string
  kickoff: string
  status: FixtureStatus
  round?: number
  score?: Score
  shootout?: Score
  period?: 'extra-time' | 'penalties'
  clock?: { minute: number; extra?: number; period?: string }
  home: FixtureTeam
  away: FixtureTeam
  source: Source
  verification?: FixtureVerification
}

export function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
}

export const isText = (input: unknown): input is string => typeof input === 'string' && input.trim().length > 0 && input.length <= 600
export const isIdentifier = (input: unknown): input is string => typeof input === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/.test(input)
export const isZonedDate = (input: unknown): input is string => typeof input === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)$/.test(input) && Number.isFinite(Date.parse(input))
export const isWebSource = (input: unknown): input is string => typeof input === 'string' && /^https:\/\/[^\s]+$/.test(input) && input.length <= 600
export const isScore = (input: unknown): input is Score => Array.isArray(input) && input.length === 2 && input.every(goal => Number.isSafeInteger(goal) && goal >= 0 && goal <= 999)

export function isSource(input: unknown): input is Source {
  if (!isObject(input) || !['demo', 'provider', 'official', 'open', 'pack'].includes(String(input.kind)) || !isText(input.label)) return false
  return (input.url === undefined || isWebSource(input.url))
    && [input.updatedAt, input.downloadedAt, input.checkedAt].every(date => date === undefined || isZonedDate(date))
    && (input.permission === undefined || isText(input.permission))
}

export function isFixtureTeam(input: unknown): input is FixtureTeam {
  return isObject(input) && isIdentifier(input.id) && isText(input.name) && isText(input.shortName)
    && typeof input.color === 'string' && /^#[a-f0-9]{6}$/i.test(input.color)
}

export function isFixtureSnapshot(input: unknown): input is FixtureSnapshot {
  if (!isObject(input) || ![input.id, input.revision, input.competitionId].every(isIdentifier)
    || !isText(input.competition) || typeof input.season !== 'string' || !/^20\d{2}\/\d{2}$/.test(input.season)
    || !isZonedDate(input.kickoff) || !['scheduled', 'live', 'finished', 'postponed', 'awaiting'].includes(String(input.status))
    || !isFixtureTeam(input.home) || !isFixtureTeam(input.away) || input.home.id === input.away.id || !isSource(input.source)) return false
  return (input.round === undefined || (typeof input.round === 'number' && Number.isSafeInteger(input.round) && input.round > 0))
    && (input.score === undefined || isScore(input.score)) && (input.status !== 'finished' || isScore(input.score))
    && (input.shootout === undefined || (isScore(input.score) && isScore(input.shootout)))
    && (input.period === undefined || input.period === 'extra-time' || input.period === 'penalties')
    && (input.clock === undefined || (isObject(input.clock) && isScore([input.clock.minute, input.clock.extra ?? 0]) && (input.clock.period === undefined || isText(input.clock.period))))
    && (input.verification === undefined || (isObject(input.verification)
      && ['verified', 'reported', 'conflict'].includes(String(input.verification.status))
      && (input.verification.checkedAt === undefined || isZonedDate(input.verification.checkedAt))
      && (input.verification.sources === undefined || (Array.isArray(input.verification.sources) && input.verification.sources.every(isWebSource)))
      && (input.verification.note === undefined || isText(input.verification.note))))
}

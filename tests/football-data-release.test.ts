import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleFootball } from '../api/football'
import { coverageFor, fixturesFor, proposeSquad, validateFootballPack } from '../src/data/footballDataset'
import { bundledFootball } from '../src/data/footballSnapshot.generated'
import { activeSeason, openCompetitions, openFixtures, parseOpenFootballScore, retainResultCoverage } from '../src/data/openFootball'
import { isFixtureSnapshot } from '../src/data/fixtureSnapshot'
import { replayMoment } from '../src/data/model'
import type { Team } from '../src/data/model'

const verifiedAt = Date.parse('2026-11-10T01:30:00Z')
const fixtureId = 'pl:2026:manchester-united:aston-villa'
const packSource = { kind: 'pack' as const, label: 'Synthetic pack regression', permission: 'Author-owned synthetic identities for tests', url: 'https://example.com/test-licence', checkedAt: '2026-11-10T00:00:00Z', updatedAt: '2026-11-08T17:00:00Z' }
const pack = { schema: 1, revision: 'test-pack-1', source: packSource }

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('pinned season data', () => {
  it('loads three current competition schedules, reports gaps and distinguishes last score from complete round', () => {
    expect(activeSeason.label).toBe('2026/27')
    const coverage = ['PL', 'CL', 'EL'].map(competition => coverageFor(fixturesFor(competition, '2026', undefined, verifiedAt), competition))
    expect(coverage.map(item => [item.fixtures, item.finished, item.throughRound, item.latestRound, item.squadTeams, item.confirmed])).toEqual([
      [380, 72, 7, 10, 0, 0], [144, 72, 4, 4, 0, 0], [144, 72, 4, 4, 0, 0],
    ])
    expect(coverage[0].missingResults).toBe(28)
    expect(coverage[0].latestScore).toBe('2026-11-08T16:30:00Z')
  })

  it('pins United–Villa to the corrected Sunday kickoff and checked 4–4 while requiring authorised matchday identities', () => {
    const fixture = fixturesFor('PL', '2026', undefined, verifiedAt).find(match => match.id === fixtureId)!
    expect(fixture).toMatchObject({
      kickoff: '2026-11-08T16:30:00Z', score: [4, 4], round: 10, status: 'finished',
      home: { id: 'manchester-united', players: [] }, away: { id: 'aston-villa', players: [] },
      verification: { status: 'verified' },
    })
    expect(fixture.verification?.sources).toHaveLength(3)
    expect(isFixtureSnapshot(fixture.fixture)).toBe(true)
    expect(fixturesFor('CL', '2026', undefined, verifiedAt).find(match => match.id === 'cl:2026:bodo-glimt:lille')?.score).toEqual([0, 0])
  })

  it('keeps a fixture identity through a moved kickoff and surfaces a conflict with the pinned check', () => {
    const candidate = structuredClone(bundledFootball)
    const row = candidate.competitions.PL.find(item => item[0] === fixtureId)!
    row[2] = '2026-11-07T15:00:00Z'
    row[5] = [3, 4]
    const result = openFixtures(candidate, openCompetitions[0], verifiedAt).find(item => item.id === fixtureId)!
    expect(result.id).toBe(fixtureId)
    expect(result.status).toBe('awaiting')
    expect(result.score).toBeUndefined()
    expect(result.verification?.status).toBe('conflict')
  })

  it('parses OpenFootball score variants and rejects score loss during refresh', () => {
    expect(parseOpenFootballScore([0, 0])).toEqual([0, 0])
    expect(parseOpenFootballScore({ ft: [0, 0] })).toEqual([0, 0])
    expect(parseOpenFootballScore({ ft: { home: 0, away: 0 } })).toEqual([0, 0])
    expect(parseOpenFootballScore({ home: null, away: 0 })).toBeUndefined()
    const incoming = structuredClone(bundledFootball)
    incoming.competitions.PL.find(row => row[5])![5] = null
    expect(() => retainResultCoverage(incoming, bundledFootball)).toThrow(/remove a fixture or existing result/)
  })

  it('returns the same dated fallback when the upstream licensed provider fails', async () => {
    vi.stubEnv('FOOTBALL_DATA_TOKEN', 'fixture-test-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })))
    const response = await handleFootball(new Request('http://studio.local/api/football?competition=PL&season=2026'))
    expect(response.ok).toBe(true)
    const fallback = await response.json()
    expect(fallback).toMatchObject({ stale: true, snapshot: { downloadedAt: bundledFootball.downloadedAt } })
    expect(fallback.matches).toHaveLength(380)
  })
})

describe('authorised squad and matchday pack', () => {
  it('rejects duplicates, missing rights and overlapping registrations', () => {
    const player = { id: 'p-1', name: 'Synthetic keeper', position: 'GK' }
    const registration = { playerId: 'p-1', teamId: 'manchester-united', competitionId: 'PL', season: '2026/27', eligibleFrom: '2026-08-21' }
    expect(() => validateFootballPack({ ...pack, source: { ...packSource, permission: '' }, players: [player] })).toThrow(/permission/)
    expect(() => validateFootballPack({ ...pack, players: [player, player] })).toThrow(/Duplicate player identity/)
    expect(() => validateFootballPack({ ...pack, players: [player], registrations: [registration, { ...registration, teamId: 'aston-villa', eligibleFrom: '2026-09-01' }] })).toThrow(/Overlapping registrations/)
  })

  it('uses eligible dates and a real goalkeeper identity before offering a sourced proposal', () => {
    const roles = ['GK', 'RB', 'CB', 'CB', 'LB', 'CM', 'DM', 'AM', 'LW', 'ST', 'RW']
    const players = roles.map((position, index) => ({ id: 'test-' + index, position, name: 'Synthetic identity ' + index }))
    const registrations = players.map(player => ({
      playerId: player.id, teamId: 'manchester-city', competitionId: 'PL', season: '2026/27', eligibleFrom: '2026-08-21',
    }))
    const authorised = validateFootballPack({ ...pack, players, registrations })
    const fixture = fixturesFor('PL', '2026', authorised, verifiedAt).find(match => match.id === 'pl:2026:manchester-city:fulham')!
    expect(fixture.home).toMatchObject({ lineupKind: 'squad', formation: '4-3-3' })
    expect(fixture.home.players).toHaveLength(11)
    expect(fixture.home.players[0].number).toBeUndefined()
    expect(fixture.away.lineupKind).toBe('repair')
    expect(proposeSquad(players.slice(1))).toBeUndefined()
    const ended = validateFootballPack({ ...pack, players, registrations: registrations.map(row => ({ ...row, eligibleUntil: '2026-11-20' })) })
    expect(fixturesFor('PL', '2026', ended, verifiedAt).find(match => match.id === fixture.id)?.home.lineupKind).toBe('repair')
  })

  it('replays substitutions and dismissals in sourced minute, stoppage and sequence order', () => {
    const team: Team = { id: 'home', name: 'Home', shortName: 'HOM', color: '#ffffff', formation: '4-3-3',
      players: Array.from({ length: 11 }, (_, index) => ({ id: 'p' + index, name: 'Player ' + index, position: index ? 'DF' : 'GK' })),
    }
    const sub = { id: 'sub', kind: 'Substitution' as const, teamId: 'home', minute: 90, extra: 1, order: 1, title: 'Replacement', description: 'Test', playerOut: 'p3', playerIn: { id: 'bench1', name: 'Bench 1', position: 'DF' } }
    const red = { id: 'red', kind: 'Card' as const, teamId: 'home', minute: 90, extra: 1, order: 2, title: 'Red card', description: 'Test', dismissal: 'bench1' }
    const after = replayMoment(team, [red, sub], { ...red })
    expect(after.team.players).toHaveLength(10)
    expect(after.dismissed).toEqual(['bench1'])
    expect(after.team.players.some(player => player.id === 'p3')).toBe(false)
  })
})

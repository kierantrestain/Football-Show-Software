import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleFootball } from '../api/football'
import { demoMatches } from '../src/data/fixtures'
import { applyMoment, predictionCutoff, predictionPoints } from '../src/data/model'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('match intelligence', () => {
  it('applies substitutions while retaining both full teams for a late key moment', () => {
    const feature = demoMatches[0]
    const winner = feature.moments.at(-1)!
    const home = applyMoment(feature.home, feature.moments, winner)
    expect(home.players).toHaveLength(11)
    expect(home.players.some(player => player.name === 'Felix Moss')).toBe(true)
    expect(home.players.some(player => player.name === 'Noah Blake')).toBe(false)
    expect(applyMoment(feature.away, feature.moments, winner).players).toHaveLength(11)
  })

  it('scores exact, outcome and draw predictions with configurable rules', () => {
    const rules = { exact: 4, result: 2, cutoffMinutes: 20 }
    expect(predictionPoints({ home: 2, away: 1 }, [2, 1], rules)).toBe(4)
    expect(predictionPoints({ home: 3, away: 0 }, [2, 1], rules)).toBe(2)
    expect(predictionPoints({ home: 0, away: 1 }, [2, 1], rules)).toBe(0)
    expect(predictionPoints({ home: 0, away: 0 }, [1, 1], rules)).toBe(2)
    expect(predictionCutoff('2026-11-15T19:45:00Z', rules).toISOString()).toBe('2026-11-15T19:25:00.000Z')
  })
})

describe('football-data.org adapter', () => {
  it('serves the dated Premier League snapshot without a provider token', async () => {
    vi.stubEnv('FOOTBALL_DATA_TOKEN', '')
    const response = await handleFootball(new Request('http://studio.local/api/football'))
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toMatchObject({ configured: false, snapshot: { season: { label: '2026/27' } } })
    expect(payload.matches).toHaveLength(380)
  })

  it('caches provider records and preserves unavailable fields without invented values', async () => {
    vi.stubEnv('FOOTBALL_DATA_TOKEN', 'server-only-example')
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 120042,
      utcDate: '2026-11-15T19:45:00Z',
      status: 'FINISHED',
      competition: { name: 'Sample provider competition' },
      homeTeam: { id: 1, name: 'Home sample', lineup: [{ id: 4, name: 'Goalkeeper', position: 'Goalkeeper' }], statistics: { shots: 8 } },
      awayTeam: { id: 2, name: 'Away sample', lineup: [], statistics: {} },
      score: { fullTime: { home: 2, away: 0 } },
      goals: [{ minute: 62, scorer: { name: 'Example scorer' }, team: { id: 1 } }],
    })))
    vi.stubGlobal('fetch', upstream)
    const request = () => new Request('http://studio.local/api/football?section=match&id=120042')
    const first = await handleFootball(request())
    const second = await handleFootball(request())
    expect(first.ok && second.ok).toBe(true)
    expect(upstream).toHaveBeenCalledTimes(1)
    expect(upstream).toHaveBeenCalledWith('https://api.football-data.org/v4/matches/120042', expect.objectContaining({ headers: { 'X-Auth-Token': 'server-only-example' } }))
    const result = await second.json()
    expect(JSON.stringify(result)).not.toContain('server-only-example')
    expect(result.match).toMatchObject({
      score: [2, 0],
      home: { players: [{ name: 'Goalkeeper', position: 'GK' }] },
      away: { players: [] },
      stats: [{ label: 'Shots', home: 8, away: null }],
      moments: [{ title: 'Goal · Example scorer', minute: 62 }],
      source: { kind: 'provider', label: 'football-data.org' },
    })
  })
})

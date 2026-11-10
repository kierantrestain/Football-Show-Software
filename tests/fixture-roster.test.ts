import { describe, expect, it } from 'vitest'
import { applyFormation, applyPhase, makeLineup, newScene, swapSides, validateProject } from '../src/domain'
import type { FixtureSnapshot } from '../src/data/fixtureSnapshot'
import { replayMoment, type LineupPlayer, type LoadTacticsPayload, type Moment, type Team } from '../src/data/model'
import { projectFromFixture } from '../src/matchProject'
import { canTakeProgramme, sceneRosterIssues } from '../src/roster'
import { validStudioSnapshot } from '../server/studio-snapshot'

const evidence = { kind: 'pack', label: 'QA synthetic roster · mechanics only' } as const
const fixture: FixtureSnapshot = {
  id: 'qa-fixture', revision: 'qa-1', competitionId: 'PL', competition: 'Premier League', season: '2026/27',
  kickoff: '2026-11-08T16:30:00+00:00', status: 'finished', round: 10, score: [4, 4],
  home: { id: 'qa-h', name: 'QA Home', shortName: 'QAH', color: '#b84439' },
  away: { id: 'qa-a', name: 'QA Away', shortName: 'QAA', color: '#526bab' },
  source: evidence, verification: { status: 'verified' },
}
function people(teamId: string) {
  return Array.from({ length: 13 }, (_, i): LineupPlayer => ({
    id: `${teamId}-${i + 1}`, name: `Synthetic ${teamId} ${i + 1}`, number: i === 2 ? undefined : i + 1,
    position: i === 0 ? 'GK' : i < 5 ? 'Defender' : i < 8 ? 'Midfielder' : 'Forward', source: evidence,
  }))
}
function team(side: 'home' | 'away'): Team {
  const squad = people(fixture[side].id)
  return { ...fixture[side], formation: '4-3-3', squad, players: squad.slice(0, 11), bench: squad.slice(11), lineupKind: 'confirmed' }
}
function payload(): LoadTacticsPayload {
  return {
    matchId: fixture.id, title: 'QA roster', competition: fixture.competition, score: fixture.score,
    fixture, home: team('home'), away: team('away'), lineupKind: 'confirmed', source: evidence.label, classification: 'RECONSTRUCTED',
  }
}

describe('fixture roster boundary', () => {
  it('keeps empty and shortened formations at their actual count', () => {
    expect(makeLineup('away', '4-3-3', [])).toEqual([])
    const base = newScene()
    const ten = base.players.filter(player => player.id !== 'home-10')
    const updated = applyFormation({ ...base, players: ten }, 'home', '5-4-1')
    expect(updated.players.filter(player => player.side === 'home')).toHaveLength(10)
    expect(new Set(updated.players.map(player => player.id))).toEqual(new Set(ten.map(player => player.id)))
  })

  it('keeps identities through chronological replacement, stoppage dismissal, phases, sides and reload', () => {
    const data = payload()
    const outgoing = data.home.players[6].id!
    const incoming = data.home.bench![0]
    const dismissed = data.home.players[3].id!
    const sub: Moment = { id: 'sub', minute: 90, extra: 2, order: 1, kind: 'Substitution', title: 'Substitution', description: '', teamId: data.home.id, playerOut: outgoing, playerIn: incoming, source: evidence }
    const card: Moment = { id: 'card', minute: 90, extra: 2, order: 2, kind: 'Card', title: 'Dismissal', description: '', teamId: data.home.id, dismissal: dismissed, source: evidence }
    const state = replayMoment(data.home, [card, sub], card)
    const project = projectFromFixture({ ...data, home: state.team, homeDismissed: state.dismissed, moment: card })
    const scene = project.scenes[0]
    expect(scene.players).toHaveLength(21)
    expect(scene.players.some(player => player.sourceId === incoming.id)).toBe(true)
    expect(scene.players.some(player => player.sourceId === outgoing || player.sourceId === dismissed)).toBe(false)
    const reformed = applyPhase(applyFormation(swapSides(scene), 'home', '3-5-2'), 'Low block')
    const restored = validateProject(JSON.parse(JSON.stringify({ ...project, scenes: [reformed] })))
    expect(new Set(restored.scenes[0].players.map(player => player.id))).toEqual(new Set(scene.players.map(player => player.id)))
    expect(restored.scenes[0].players.find(player => player.sourceId === 'qa-h-3')?.number).toBeUndefined()
    expect(restored.scenes[0].roster?.home.dismissals).toEqual([dismissed])
    expect(sceneRosterIssues(restored, restored.scenes[0])).toEqual([])
  })

  it('keeps incomplete and legacy match scenes off air while allowing a result', () => {
    const data = payload()
    const project = projectFromFixture({ ...data, away: { ...data.away, players: data.away.players.slice(0, 10) } })
    const content = { project, sceneId: project.scenes[0].id, cue: 0, time: 0, speed: 1, loop: false, format: '16:9' }
    expect(canTakeProgramme(content)).toMatch(/QA Away needs 1 more/)
    expect(validStudioSnapshot(content)).toBe(false)
    const graphic = { id: 'ft', kind: 'result', title: 'FT', subtitle: 'Premier League', source: evidence.label, fixture }
    expect(validStudioSnapshot({ ...content, graphic })).toBe(true)
    expect(validStudioSnapshot({ ...content, graphic: { ...graphic, fixture: { ...fixture, verification: { status: 'reported' } } } })).toBe(false)
    expect(validStudioSnapshot({ ...content, graphic, pip: true })).toBe(false)
    const legacy = { ...project, match: { ...project.match, fixture: undefined } }
    expect(canTakeProgramme({ ...content, project: legacy })).toMatch(/needs a linked fixture/)
  })

  it('detects edits to real identities without changing editable positions or roles', () => {
    const project = projectFromFixture(payload())
    const scene = project.scenes[0]
    const [first, ...rest] = scene.players
    expect(sceneRosterIssues(project, { ...scene, players: [{ ...first, x: 4, role: 'Cover' }, ...rest] })).toEqual([])
    expect(sceneRosterIssues(project, { ...scene, players: [{ ...first, name: 'Wrong identity' }, ...rest] })).toContain('QA Home has an on-pitch identity that does not match its roster.')
  })
})

import { formations, makeLineup, newScene, uid, type FormationName, type Project, type Scene, type Side } from './domain'
import type { LoadTacticsPayload, LineupPlayer } from './data/model'
import { identityEligible, isKeeper, isSourcedIdentity, type RosterSide, type SceneRoster, type SourcedIdentity } from './roster'

function formation(input: string, fallback: FormationName) {
  return Object.hasOwn(formations, input) ? input as FormationName : fallback
}

type PlayerSource = LineupPlayer & { source?: string | { label?: string }; eligibleFrom?: string; eligibleUntil?: string; role?: string }
function identity(row: PlayerSource, source: string): SourcedIdentity | undefined {
  const candidate = {
    id: row.id, name: row.name, number: row.number && row.number > 0 ? row.number : undefined,
    position: row.position, role: row.role, source: (typeof row.source === 'string' ? row.source : row.source?.label) || source,
    eligibleFrom: row.eligibleFrom, eligibleUntil: row.eligibleUntil,
  }
  return isSourcedIdentity(candidate) ? candidate : undefined
}

function createSide(payload: LoadTacticsPayload, side: Side): RosterSide {
  const team = payload[side] as LoadTacticsPayload[Side] & {
    squad?: LineupPlayer[]; eligible?: LineupPlayer[]; lineupKind?: 'confirmed' | 'squad' | 'repair' | 'demo';
  }
  const source = payload.source
  const kickoff = payload.fixture!.kickoff
  const eligible = (list: LineupPlayer[]) => list.flatMap(player => {
    const row = identity(player, source)
    return row && identityEligible(row, kickoff) ? [row] : []
  })
  const candidates = new Map(eligible([...(team.eligible ?? team.squad ?? []), ...(team.bench ?? []), ...team.players]).map(row => [row.id, row]))
  const active = [...new Map(eligible(team.players).map(row => [row.id, row])).values()].slice(0, 11)
  const dismissals = [...new Set((side === 'home' ? payload.homeDismissed : payload.awayDismissed) ?? [])]
  const kind = team.lineupKind ?? payload.lineupKind
  const complete = active.length === 11 - dismissals.length
  const basis = complete && kind === 'confirmed' ? 'confirmed' : complete && kind === 'squad' && active.some(player => isKeeper(player.position)) ? 'squad' : 'repair'
  return { teamId: team.id, basis, active, candidates: [...candidates.values()].slice(0, 80), dismissals }
}

export function applyRoster(scene: Scene, roster: SceneRoster, fixture?: Project['match']['fixture']): Scene {
  const players = (['home', 'away'] as const).flatMap(side => {
    const shape = side === 'home' ? scene.homeFormation : scene.awayFormation
    return makeLineup(side, shape, roster[side].active).map(player => {
      const prior = scene.players.find(item => item.id === player.id)
      const color = prior?.color ?? fixture?.[side].color
      if (prior) return { ...player, x: prior.x, y: prior.y, role: prior.role, highlight: prior.highlight, color }
      return { ...player, ...(scene.swapped ? { x: 105 - player.x, y: 68 - player.y } : {}), color }
    })
  })
  const ids = new Set(players.map(player => player.id))
  return {
    ...scene, players, roster, classification: 'RECONSTRUCTED',
    ball: ids.has(scene.ball.ownerId ?? '') ? scene.ball : { ...scene.ball, ownerId: undefined },
    paths: scene.paths.filter(path => (path.target === 'ball' || ids.has(path.target)) && (!path.receiverId || ids.has(path.receiverId))),
  }
}

export function projectFromFixture(payload: LoadTacticsPayload): Project {
  const draft = newScene()
  const homeFormation = formation(payload.home.formation, draft.homeFormation)
  const awayFormation = formation(payload.away.formation, draft.awayFormation)
  const fixture = payload.fixture
  const rehearsal = payload.lineupKind === 'demo' || /^Demonstration|^Fictional/i.test(payload.source)
  const base: Scene = {
    ...draft, name: payload.moment?.title ?? 'Starting Shape', homeFormation, awayFormation,
    players: [], marker: rehearsal ? 'number' : 'name',
    notes: payload.moment?.description ?? '', classification: rehearsal ? payload.classification : 'RECONSTRUCTED',
    sourceReference: { label: payload.source, url: fixture?.source.url, estimated: true },
  }
  const scene = fixture && !rehearsal
    ? applyRoster(base, { fixtureId: fixture.id, home: createSide(payload, 'home'), away: createSide(payload, 'away'),
        moment: payload.moment ? `${payload.moment.minute}${payload.moment.extra ? '+' + payload.moment.extra : ''}′ · ${payload.moment.title}` : undefined }, fixture)
    : { ...base, players: [...makeLineup('home', homeFormation, payload.home.players), ...makeLineup('away', awayFormation, payload.away.players)] }
  return {
    version: 1, id: uid(), name: payload.title,
    match: {
      home: payload.home.name, away: payload.away.name, homeShort: payload.home.shortName, awayShort: payload.away.shortName,
      competition: payload.competition, score: payload.score?.join('–') ?? '', source: rehearsal ? 'Demonstration data · fictional' : payload.source,
      fixture: rehearsal ? undefined : fixture,
    },
    scenes: [scene],
  }
}

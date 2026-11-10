import { isFixtureSnapshot } from './data/fixtureSnapshot.js'
import type { Project, Scene, Side } from './domain'

export type RosterBasis = 'confirmed' | 'squad' | 'repair'
export type SourcedIdentity = {
  id: string
  name: string
  number?: number
  position: string
  role?: string
  source: string
  eligibleFrom?: string
  eligibleUntil?: string
}
export type RosterSide = {
  teamId: string
  basis: RosterBasis
  active: SourcedIdentity[]
  candidates: SourcedIdentity[]
  dismissals: string[]
}
export type SceneRoster = {
  fixtureId: string
  home: RosterSide
  away: RosterSide
  moment?: string
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 500
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value))
const plainDate = /^\d{4}-\d{2}-\d{2}$/
const londonDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' })
const shirt = (value: unknown) => value === undefined || (typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 999)

export function isSourcedIdentity(value: unknown): value is SourcedIdentity {
  return object(value) && nonempty(value.id) && nonempty(value.name) && typeof value.position === 'string'
    && nonempty(value.source) && shirt(value.number) && (value.role === undefined || nonempty(value.role))
    && (value.eligibleFrom === undefined || date(value.eligibleFrom))
    && (value.eligibleUntil === undefined || date(value.eligibleUntil))
    && (value.eligibleFrom === undefined || value.eligibleUntil === undefined
      || Date.parse(value.eligibleFrom as string) <= Date.parse(value.eligibleUntil as string))
}

export function identityEligible(identity: SourcedIdentity, kickoff: string) {
  const at = Date.parse(kickoff)
  if (!Number.isFinite(at)) return false
  const day = londonDay.format(at)
  const from = identity.eligibleFrom
  const until = identity.eligibleUntil
  return (!from || (plainDate.test(from) ? from <= day : Date.parse(from) <= at))
    && (!until || (plainDate.test(until) ? day <= until : at < Date.parse(until)))
}

export const isKeeper = (position: string) => /^(gk|g|goalkeeper|keeper)$/i.test(position.trim())
export const expectedPlayers = (roster: RosterSide) => 11 - roster.dismissals.length
export const rosterBasisLabel = (basis: RosterBasis) => basis === 'confirmed' ? 'Confirmed XI' : basis === 'squad' ? 'Sourced squad XI · analyst selection' : 'Roster repair'

function isSide(value: unknown): value is RosterSide {
  return object(value) && nonempty(value.teamId) && ['confirmed', 'squad', 'repair'].includes(String(value.basis))
    && Array.isArray(value.active) && value.active.length <= 11 && value.active.every(isSourcedIdentity)
    && Array.isArray(value.candidates) && value.candidates.length <= 80 && value.candidates.every(isSourcedIdentity)
    && Array.isArray(value.dismissals) && value.dismissals.length <= 4 && value.dismissals.every(nonempty)
}

export function isSceneRoster(value: unknown): value is SceneRoster {
  return object(value) && nonempty(value.fixtureId) && isSide(value.home) && isSide(value.away)
    && (value.moment === undefined || nonempty(value.moment))
}

const knownSandboxSources = new Set(['Fictional demonstration', 'Demonstration data · fictional', 'Manual line-up', 'Untitled production'])
export function isMatchProject(project: Project) {
  return !!project.match.fixture || !knownSandboxSources.has(project.match.source)
}

export function sceneRosterIssues(project: Project, scene: Scene): string[] {
  if (!isMatchProject(project)) return []
  const fixture = project.match.fixture
  const roster = scene.roster
  if (!fixture || !roster || roster.fixtureId !== fixture.id) {
    return ['This match scene needs a linked fixture and sourced roster. Reload it from Match Data or link a fixture in Roster repair.']
  }
  const issues: string[] = []
  const identities = new Set<string>()
  for (const side of ['home', 'away'] as const) {
    const team = fixture[side]
    const evidence = roster[side]
    const active = scene.players.filter(player => player.side === side)
    const total = expectedPlayers(evidence)
    if (evidence.teamId !== team.id) issues.push(`${team.name} is linked to the wrong team record.`)
    if (new Set(evidence.dismissals).size !== evidence.dismissals.length) issues.push(`${team.name} has duplicate dismissal records.`)
    if (evidence.active.length !== total || active.length !== total) {
      const gap = total - active.length
      issues.push(gap > 0 ? `${team.name} needs ${gap} more sourced ${gap === 1 ? 'player' : 'players'} (${active.length}/${total}).`
        : `${team.name} needs ${total} eligible sourced players on the pitch.`)
    } else if (evidence.basis === 'repair') issues.push(`${team.name} needs a confirmed or approved squad selection.`)
    if (evidence.basis === 'squad' && evidence.dismissals.length === 0 && !evidence.active.some(player => isKeeper(player.position))) {
      issues.push(`${team.name} needs a sourced goalkeeper.`)
    }
    const approved = new Map(evidence.active.map(player => [player.id, player]))
    const known = new Map(evidence.candidates.map(player => [player.id, player]))
    if (known.size !== evidence.candidates.length) issues.push(`${team.name} has conflicting candidate identities.`)
    if (evidence.dismissals.length && (!roster.moment || evidence.dismissals.some(id => !known.has(id)))) {
      issues.push(`${team.name} needs sourced dismissal evidence for this moment.`)
    }
    for (const identity of evidence.active) {
      const candidate = known.get(identity.id)
      if (identities.has(identity.id) || evidence.dismissals.includes(identity.id) || !identityEligible(identity, fixture.kickoff)
        || !candidate || candidate.name !== identity.name || candidate.number !== identity.number || candidate.position !== identity.position) {
        issues.push(`${team.name} has an unresolved, dismissed, or ineligible player identity.`)
        break
      }
      identities.add(identity.id)
    }
    if (new Set(active.map(player => player.sourceId)).size !== active.length || active.some(player => {
      const source = player.sourceId ? approved.get(player.sourceId) : undefined
      return !source || player.id !== `${side}-${source.id}` || player.name !== source.name || player.number !== source.number
        || player.position !== source.position
    })) issues.push(`${team.name} has an on-pitch identity that does not match its roster.`)
  }
  if (scene.ball.ownerId && !scene.players.some(player => player.id === scene.ball.ownerId)) issues.push('The ball carrier is no longer on the pitch.')
  return issues
}

export function canTakeProgramme(content: { project: Project; sceneId: string; graphic?: unknown; pip?: boolean }) {
  if (content.graphic && object(content.graphic) && isFixtureSnapshot(content.graphic.fixture) && content.graphic.fixture.verification?.status === 'conflict') {
    return 'Resolve the conflicting fixture records before taking this graphic to air.'
  }
  if (content.graphic && !content.pip) return undefined
  const scene = content.project.scenes.find(item => item.id === content.sceneId)
  return scene ? sceneRosterIssues(content.project, scene)[0] : 'Choose a valid scene before taking it to air.'
}

export function updateRosterSelection(roster: SceneRoster, side: Side, active: SourcedIdentity[]) {
  const previous = roster[side]
  const unchanged = previous.active.length === active.length && previous.active.every((player, index) => player.id === active[index].id)
  const basis = unchanged && previous.basis === 'confirmed' ? 'confirmed'
    : active.length === expectedPlayers(previous) && (previous.dismissals.length > 0 || active.some(player => isKeeper(player.position))) ? 'squad' : 'repair'
  return { ...roster, [side]: { ...previous, active, basis } } as SceneRoster
}

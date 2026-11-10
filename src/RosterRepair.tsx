import { useState } from 'react'
import { CircleAlert, FileUp, UsersRound } from 'lucide-react'
import { makeLineup, type Project, type Scene, type Side } from './domain'
import { applyRoster } from './matchProject'
import { expectedPlayers, identityEligible, isKeeper, isSourcedIdentity, rosterBasisLabel, sceneRosterIssues, updateRosterSelection, type RosterSide, type SourcedIdentity } from './roster'
import { Modal } from './ui'

type RosterPack = { version: 1; fixtureId: string; source: string; permission: string; teams: { teamId: string; players: SourcedIdentity[] }[] }
export function parseRosterPack(input: unknown, fixture: NonNullable<Project['match']['fixture']>): RosterPack {
  const value = input as Partial<RosterPack> | null
  if (!value || value.version !== 1 || value.fixtureId !== fixture.id || typeof value.source !== 'string' || !value.source.trim()
    || typeof value.permission !== 'string' || !value.permission.trim() || !Array.isArray(value.teams) || !value.teams.length || value.teams.length > 2) {
    throw new Error('Use a version 1 roster pack for this fixture with source and permission details.')
  }
  const seenTeams = new Set<string>()
  const seenPlayers = new Set<string>()
  for (const team of value.teams) {
    if (!team || ![fixture.home.id, fixture.away.id].includes(team.teamId) || seenTeams.has(team.teamId)
      || !Array.isArray(team.players) || team.players.length > 80) throw new Error('The pack has an unknown or duplicate team, or too many player records.')
    seenTeams.add(team.teamId)
    for (const player of team.players) {
      if (!isSourcedIdentity(player) || !identityEligible(player, fixture.kickoff) || seenPlayers.has(player.id)) {
        throw new Error('The pack contains an incomplete, duplicate or ineligible player record.')
      }
      seenPlayers.add(player.id)
    }
  }
  return value as RosterPack
}

function TeamSelection({ label, roster, onChange }: { label: string; roster: RosterSide; onChange: (active: SourcedIdentity[]) => void }) {
  const selected = new Set(roster.active.map(player => player.id))
  const available = roster.candidates.filter(player => !roster.dismissals.includes(player.id))
  return <section className="repair-team">
    <h3>{label}</h3>
    <p>{roster.active.length}/{expectedPlayers(roster)} selected · {rosterBasisLabel(roster.basis)}</p>
    {!available.length && <p className="muted">Import eligible identities to prepare this side.</p>}
    <div className="repair-options">{available.map(player => <label key={player.id}>
      <input type="checkbox" checked={selected.has(player.id)} disabled={!selected.has(player.id) && selected.size >= expectedPlayers(roster)} onChange={event => {
        onChange(event.target.checked ? [...roster.active, player] : roster.active.filter(item => item.id !== player.id))
      }} />
      <strong>{player.name}</strong><span>{isKeeper(player.position) ? 'GK' : player.position || 'Role pending'}</span>
      {player.number !== undefined && <span className="technical">{player.number}</span>}
    </label>)}</div>
  </section>
}

export function RosterRepair({ project, scene, onCommit, onClose, onFind }: {
  project: Project; scene: Scene; onCommit: (scene: Scene) => void; onClose: () => void; onFind: () => void
}) {
  const [roster, setRoster] = useState(scene.roster)
  const [pack, setPack] = useState<RosterPack>()
  const [error, setError] = useState('')
  const fixture = project.match.fixture
  const draft = roster ? applyRoster(scene, roster, fixture) : scene
  const issues = sceneRosterIssues(project, draft)
  const importPack = () => {
    if (!roster || !pack) return
    const updated = structuredClone(roster)
    for (const incoming of pack.teams) {
      const side = incoming.teamId === roster.home.teamId ? 'home' : 'away'
      const candidates = new Map(updated[side].candidates.map(player => [player.id, player]))
      for (const item of incoming.players) {
        const previous = candidates.get(item.id)
        if (previous && (previous.name !== item.name || previous.number !== item.number || previous.position !== item.position)) {
          setError(`The imported identity conflicts with the saved record for ${previous.name}.`)
          return
        }
        if (!previous) candidates.set(item.id, { ...item, source: `${item.source} · ${pack.source} · ${pack.permission}`.slice(0, 500) })
      }
      if (candidates.size > 80) { setError('The combined roster exceeds 80 candidate identities.'); return }
      updated[side].candidates = [...candidates.values()]
    }
    setRoster(updated)
    setPack(undefined)
    setError('')
  }
  const candidatesFor = (side: Side) => roster?.[side].candidates.filter(player => !roster[side].dismissals.includes(player.id)) ?? []
  const canPropose = (side: Side) => !!roster && candidatesFor(side).length >= expectedPlayers(roster[side]) && candidatesFor(side).some(player => isKeeper(player.position))
  function propose() {
    if (!roster) return
    const draft = (['home', 'away'] as const).reduce((next, side) => {
      if (!canPropose(side) || next[side].basis === 'confirmed') return next
      const pool = candidatesFor(side)
      const lineup = makeLineup(side, side === 'home' ? scene.homeFormation : scene.awayFormation, pool)
      const selected = lineup.slice(0, expectedPlayers(next[side])).flatMap(player => pool.filter(candidate => candidate.id === player.sourceId))
      return updateRosterSelection(next, side, selected)
    }, roster)
    setRoster(draft)
  }
  return <Modal title="Roster repair" onClose={onClose}>
    <div className="roster-dialog">
      <div className="roster-issues" role="status">{issues.length ? issues.map(issue => <p key={issue}><CircleAlert size={16} />{issue}</p>) : <p><UsersRound size={16} />Both sides are ready. Positions remain an editable reconstruction.</p>}</div>
      {roster && fixture ? <>
        {(canPropose('home') || canPropose('away')) && <button className="button roster-propose" onClick={propose}>Propose sourced XIs</button>}
        <div className="repair-teams">
          <TeamSelection label={fixture.home.name} roster={roster.home} onChange={active => setRoster(updateRosterSelection(roster, 'home', active))} />
          <TeamSelection label={fixture.away.name} roster={roster.away} onChange={active => setRoster(updateRosterSelection(roster, 'away', active))} />
        </div>
        <label className="form-field"><span><FileUp size={14} /> Import authorised roster JSON</span><input type="file" accept=".json,application/json" onChange={event => {
          const file = event.target.files?.[0]
          setPack(undefined); setError('')
          if (file) void file.text().then(text => setPack(parseRosterPack(JSON.parse(text), fixture))).catch(problem => setError(String(problem.message)))
        }} /></label>
        {pack && <div className="roster-pack-preview"><p>{pack.teams.map(team => `${team.players.length} eligible identities for ${team.teamId}`).join(' · ')}</p><p>{pack.source} · {pack.permission}</p>
          <button className="button" onClick={importPack}>Add these candidates</button></div>}
        {error && <p role="alert" className="roster-error">{error}</p>}
        <div className="modal-actions"><button className="button primary" onClick={() => onCommit(draft)}>{issues.length ? 'Save repair draft' : 'Use this XI'}</button></div>
      </> : <div className="modal-actions"><button className="button primary" onClick={onFind}>Find a fixture</button></div>}
    </div>
  </Modal>
}

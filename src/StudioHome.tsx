import { useEffect, useState } from 'react'
import { ArrowUpRight, Clapperboard, Copy, Database, FileUp, Layers3, Plus, RotateCcw } from 'lucide-react'
import { fixturesFor } from './data/footballSnapshot'
import type { Project } from './domain'
import { displayDate } from './data/model'
import { storage, type SavedProject, type Snapshot, type Template } from './storage'

export function StudioHome({ project, sessionId, onRehearsal, onOpen, onNew, onDuplicate, onImport, onTemplate, onRestore, onData, onGraphics, onPresent, onError }: {
  project?: Project; sessionId?: string; onRehearsal: () => void; onOpen: (project: Project) => void; onNew: () => void; onDuplicate: (project: Project) => void;
  onImport: () => void; onTemplate: (template: Template) => void; onRestore: (snapshot: Snapshot) => void; onData: (matchId?: string) => void; onGraphics: () => void;
  onPresent: () => void; onError: (error: unknown) => void
}) {
  const [projects, setProjects] = useState<SavedProject[]>([])
  const [versions, setVersions] = useState<Snapshot[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  useEffect(() => {
    let active = true
    void Promise.all([storage.projects(), storage.versions(), storage.templates()]).then(([productions, snapshots, layouts]) => {
      if (active) { setProjects(productions); setVersions(snapshots); setTemplates(layouts) }
    }).catch(onError)
    return () => { active = false }
  }, [onError])
  const listed = project
    ? [{ project, updatedAt: 0 }, ...projects.filter(item => item.project.id !== project.id)]
    : projects
  const fixtures = fixturesFor()
  const upcoming = fixtures.filter(match => match.status === 'scheduled' && Date.parse(match.kickoff) > Date.now())
    .sort((first, second) => Date.parse(first.kickoff) - Date.parse(second.kickoff)).slice(0, 4)
  const results = fixtures.filter(match => match.status === 'finished' && match.score)
    .sort((first, second) => Date.parse(second.kickoff) - Date.parse(first.kickoff)).slice(0, 4)
  return <main className="studio-home">
    <section className="studio-fixture-intro">
      <div><span className="eyebrow"><Clapperboard size={15} /> Bang On Sports Hub · Studio</span><h1>Matchday desk</h1>
        <p>Premier League · 2026/27 fixture coverage preview</p></div>
      <div className="home-actions"><button className="button primary" onClick={() => onData()}>Find a fixture <ArrowUpRight size={16} /></button>
        <button className="button" onClick={onRehearsal}>Open rehearsal</button></div>
    </section>
    <div className="home-columns home-fixtures">
      {([['Recent results', results], ['Upcoming fixtures', upcoming]] as const).map(([title, matches]) => <section key={title}>
        <header><h2>{title}</h2><span className="eyebrow">Premier League</span></header>
        {matches.length ? matches.map(match => <button className="resource-row fixture-rundown" key={match.id} onClick={() => onData(match.id)}>
          <span><b>{match.home.name} v {match.away.name}</b><small>{displayDate(match.kickoff, true)} UK · {match.verification?.status === 'verified' ? 'Cross-checked' : match.source.label}</small></span>
          <strong>{match.score?.join('–') ?? 'UPCOMING'}</strong><ArrowUpRight size={16} />
        </button>) : <p className="muted">Fixture coverage is unavailable for this view.</p>}
      </section>)}
    </div>
    <div className="home-columns">
      <section><header><h2>Productions</h2><span className="eyebrow">{listed.length} available</span></header>
        <div className="production-actions"><button className="button" onClick={onNew}><Plus size={15} /> New production</button><button className="button quiet" onClick={onImport}><FileUp size={15} /> Import project</button></div>
        {listed.map(({ project: entry }) => <div className="production-row" key={entry.id}><div><b>{entry.name}</b><span>{entry.match.homeShort} × {entry.match.awayShort} · {entry.scenes.length} scenes</span></div>
          <button className="button quiet" aria-label={`Duplicate ${entry.name}`} onClick={() => onDuplicate(entry)}><Copy size={16} /></button>
          <button className="button" onClick={() => onOpen(entry)}>Open <ArrowUpRight size={15} /></button></div>)}
      </section>
      <section><header><h2>Studio resources</h2></header>
        <button className="resource-row" onClick={() => onData()}><Database size={18} /><span><b>Fixtures and results</b><small>Match data and line-ups</small></span><ArrowUpRight size={17} /></button>
        <button className="resource-row" onClick={onGraphics}><Layers3 size={18} /><span><b>Graphics packages</b><small>Television-ready layouts</small></span><ArrowUpRight size={17} /></button>
        <button className="resource-row" onClick={onPresent}><Clapperboard size={18} /><span><b>Presenter desk</b><small>{sessionId ? 'Resume the shared session' : 'Rehearse or create a session'}</small></span><ArrowUpRight size={17} /></button>
      </section>
      <section><header><h2>Scene templates</h2></header>{templates.length ? templates.map(template => <div className="production-row" key={template.id}><b>{template.title}</b><button className="button" onClick={() => onTemplate(template)}>Use template</button></div>) : <p className="muted">Save a reusable layout from Scene settings.</p>}</section>
      <section><header><h2>Saved versions</h2></header>{versions.length ? versions.map(snapshot => <div className="production-row" key={snapshot.id}><div><b>{snapshot.title}</b><span>{new Date(snapshot.savedAt).toLocaleString()}</span></div><button className="button" onClick={() => onRestore(snapshot)}><RotateCcw size={15} /> Restore copy</button></div>) : <p className="muted">Save a version from the production menu.</p>}</section>
    </div>
  </main>
}

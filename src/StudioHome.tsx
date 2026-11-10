import { useEffect, useState } from 'react'
import { ArrowUpRight, Clapperboard, Copy, Database, FileUp, Layers3, Plus, RotateCcw } from 'lucide-react'
import { Pitch } from './Pitch'
import { demoMatches } from './data'
import { sampleProject, type Project } from './domain'
import { storage, type SavedProject, type Snapshot, type Template } from './storage'

export function StudioHome({ project, sessionId, onOpen, onNew, onDuplicate, onImport, onTemplate, onRestore, onData, onGraphics, onPresent, onError }: {
  project: Project; sessionId?: string; onOpen: (project: Project) => void; onNew: () => void; onDuplicate: (project: Project) => void;
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
  const listed = [{ project, updatedAt: 0 }, ...projects.filter(item => item.project.id !== project.id)]
  if (!listed.some(item => item.project.id === sampleProject.id)) listed.push({ project: sampleProject, updatedAt: 0 })
  return <main className="studio-home">
    <section className="home-hero">
      <div><span className="eyebrow"><Clapperboard size={15} /> Production workspace</span><h1>Studio desk<span>.</span></h1><p>Prepare the football. Cue the story. Take it to air.</p>
        <div className="home-actions"><button className="button primary" onClick={onNew}><Plus size={16} /> New production</button><button className="button" onClick={onImport}><FileUp size={16} /> Import project</button></div></div>
      <div className="home-hero-pitch"><Pitch scene={project.scenes[0]} time={0} clean /></div>
    </section>
    <div className="home-columns">
      <section><header><h2>Productions</h2><span className="eyebrow">{listed.length} available</span></header>
        {listed.map(({ project: entry }) => <div className="production-row" key={entry.id}><div><b>{entry.name}</b><span>{entry.match.homeShort} × {entry.match.awayShort} · {entry.scenes.length} scenes</span></div>
          <button className="button quiet" aria-label={`Duplicate ${entry.name}`} onClick={() => onDuplicate(entry)}><Copy size={16} /></button>
          <button className="button" onClick={() => onOpen(entry)}>Open <ArrowUpRight size={15} /></button></div>)}
      </section>
      <section><header><h2>Studio resources</h2></header>
        <button className="resource-row" onClick={() => onData()}><Database size={18} /><span><b>Fixtures and results</b><small>Match data and line-ups</small></span><ArrowUpRight size={17} /></button>
        <button className="resource-row" onClick={onGraphics}><Layers3 size={18} /><span><b>Graphics packages</b><small>Television-ready layouts</small></span><ArrowUpRight size={17} /></button>
        <button className="resource-row" onClick={onPresent}><Clapperboard size={18} /><span><b>Presenter desk</b><small>{sessionId ? 'Resume the shared session' : 'Rehearse or create a session'}</small></span><ArrowUpRight size={17} /></button>
      </section>
      <section><header><h2>Fixture rundown</h2><span className="eyebrow">Fictional demo</span></header>
        {[...demoMatches.filter(match => match.status === 'scheduled').slice(0, 2), ...demoMatches.filter(match => match.status === 'finished').slice(0, 2)].map(match =>
          <button className="resource-row fixture-rundown" key={match.id} onClick={() => onData(match.id)}>
            <span><b>{match.home.name} v {match.away.name}</b><small>{match.score ? 'Recent result' : new Date(match.kickoff).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</small></span>
            <strong>{match.score?.join('–') ?? 'UPCOMING'}</strong><ArrowUpRight size={16} />
          </button>)}
      </section>
      <section><header><h2>Scene templates</h2></header>{templates.length ? templates.map(template => <div className="production-row" key={template.id}><b>{template.title}</b><button className="button" onClick={() => onTemplate(template)}>Use template</button></div>) : <p className="muted">Save a reusable layout from Scene settings.</p>}</section>
      <section><header><h2>Saved versions</h2></header>{versions.length ? versions.map(snapshot => <div className="production-row" key={snapshot.id}><div><b>{snapshot.title}</b><span>{new Date(snapshot.savedAt).toLocaleString()}</span></div><button className="button" onClick={() => onRestore(snapshot)}><RotateCcw size={15} /> Restore copy</button></div>) : <p className="muted">Save a version from the production menu.</p>}</section>
    </div>
  </main>
}

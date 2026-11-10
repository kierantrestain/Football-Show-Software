import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowUpRight, Check, ChevronDown, Clapperboard, Database, Download, Film, Home, Layers3, Monitor, Radio, Redo2, Undo2, WifiOff } from 'lucide-react'
import { DataCenter, GraphicsLibrary, type GraphicSpec, type LoadTacticsPayload } from './data'
import { formations, makeLineup, newScene, sampleProject, uid, validateProject, type FormationName, type Project, type Scene } from './domain'
import { TacticsEditor } from './TacticsEditor'
import { Transport } from './Transport'
import { ExportDialog, SceneSettings } from './ProjectDialogs'
import { StudioHome } from './StudioHome'
import { OutputRoute, PresenterConsole, RemoteRoute } from './Presentation'
import { useEditorMedia } from './MediaPanel'
import { exportProject, importProject, storage } from './storage'
import { exportScene } from './export'
import { sharedFrame } from './mediaDecode'
import { createSession, useSession } from './session'
import type { SessionCredentials } from './session-types'
import { currentScene, initialPlayout, setLocalPreview, switchCue, switchScene, timeAt, togglePlay, usePlayoutTime, type Playout } from './playback'
import { IconButton, Modal } from './ui'

const DEMO = initialPlayout(sampleProject)
const credentialsKey = 'touchline-producer-sessions'
const activeKey = 'touchline-active-project'
const graphicsKey = (id: string) => `touchline-graphics-${id}`
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed
      ? <main className="recovery"><h1>Studio recovery</h1><p>Reload to reopen the latest local save.</p><button className="button primary" onClick={() => location.reload()}>Reload studio</button></main>
      : this.props.children
  }
}

function stored<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') as T ?? fallback }
  catch { return fallback }
}
function remember(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* browser storage may be disabled */ }
}
function pathName() { return location.pathname.replace(/\/$/, '') || '/' }

export function App() {
  const [path, setPath] = useState(pathName)
  useEffect(() => {
    const pop = () => setPath(pathName())
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [])
  const navigate = useCallback((target: string) => {
    if (location.pathname + location.search !== target) history.pushState({}, '', target)
    setPath(pathName())
    window.scrollTo(0, 0)
  }, [])
  const [, surface, id] = path.split('/')
  if (surface === 'output' && id) return <OutputRoute key={path} id={id} fallback={DEMO} />
  if (surface === 'remote' && id) return <Boundary><RemoteRoute key={path} id={id} fallback={DEMO} /></Boundary>
  return <Boundary><Studio path={path} navigate={navigate} /></Boundary>
}

function EditorCanvas({ playout, onChange, onReconstruct, onError }: {
  playout: Playout; onChange: (scene: Scene) => void; onReconstruct: (scene: Scene) => void; onError: (error: unknown) => void
}) {
  const scene = currentScene(playout)
  const time = usePlayoutTime(playout, scene.duration)
  const { media, controls, upload, mediaTime } = useEditorMedia(scene, onChange, onError)
  return <div className="editor-canvas">
    <TacticsEditor key={scene.id} scene={scene} match={playout.project.match} time={time} cueIndex={playout.cue} onChange={onChange} media={media || undefined} mediaTime={mediaTime} mediaControl={upload} onReconstruct={onReconstruct} transparent={!!media} />
    {controls}
  </div>
}

function Studio({ path, navigate }: { path: string; navigate: (path: string) => void }) {
  const [playout, setPlayout] = useState(DEMO)
  const [ready, setReady] = useState(false)
  const [save, setSave] = useState('Opening')
  const [past, setPast] = useState<Project[]>([])
  const [future, setFuture] = useState<Project[]>([])
  const [notice, setNotice] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
  const [dialog, setDialog] = useState<'export' | 'scene' | 'new' | 'rename' | null>(null)
  const [menu, setMenu] = useState(false)
  const [title, setTitle] = useState('')
  const [exporting, setExporting] = useState<number | null>(null)
  const [credentials, setCredentials] = useState(() => stored<Record<string, SessionCredentials>>(credentialsKey, {}))
  const [starting, setStarting] = useState(false)
  const importFile = useRef<HTMLInputElement>(null)
  const pathOnLoad = useRef(path)
  const { project } = playout
  const scene = currentScene(playout)
  const session = credentials[project.id] ?? null
  const desk = useSession<Playout>(path.startsWith('/present/') ? null : session)
  const editor = path === '/' || path.startsWith('/editor/')
  const notify = useCallback((error: unknown) => setNotice(errorText(error)), [])
  useEffect(() => {
    let active = true
    const route = pathOnLoad.current.match(/^\/(?:editor|present)\/([^/]+)$/)
    const id = route?.[1] ?? stored(activeKey, sampleProject.id)
    void storage.project(id).then(entry => {
      if (!active) return
      if (entry) setPlayout({ ...initialPlayout(validateProject(entry.project)), graphics: stored(graphicsKey(id), []) })
      else if (route && id !== sampleProject.id) setNotice('That production is not saved on this device. The demo is open.')
    }).catch(notify).finally(() => { if (active) setReady(true) })
    return () => { active = false }
  }, [notify])
  useEffect(() => {
    if (!ready) return
    let active = true
    remember(activeKey, project.id)
    void storage.save(project).then(() => { if (active) setSave('Saved locally') }).catch(error => { if (active) { setSave('Save failed'); notify(error) } })
    return () => { active = false }
  }, [project, ready, notify])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 6500)
    return () => clearTimeout(timer)
  }, [notice])
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine)
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => { window.removeEventListener('online', sync); window.removeEventListener('offline', sync) }
  }, [])

  function commit(next: Project, sceneId = scene.id) {
    setSave('Saving…')
    setPast(items => [...items.slice(-79), project])
    setFuture([])
    setPlayout(value => {
      const target = next.scenes.find(item => item.id === sceneId) ?? next.scenes[0]
      return { ...value, project: next, sceneId: target.id, cue: Math.max(0, Math.min(value.cue, target.cues.length - 1)) }
    })
  }
  function commitScene(next: Scene) {
    commit({ ...project, scenes: project.scenes.map(item => item.id === next.id ? next : item) })
  }
  function restore(target: Project) {
    setSave('Saving…')
    setPlayout(value => ({ ...value, project: target, startedAt: undefined }))
  }
  function undo() {
    const previous = past.at(-1)
    if (!previous) return
    setPast(past.slice(0, -1))
    setFuture([project, ...future])
    restore(previous)
  }
  function redo() {
    const next = future[0]
    if (!next) return
    setPast([...past, project])
    setFuture(future.slice(1))
    restore(next)
  }
  function open(next: Project) {
    setSave('Saving…')
    setPast([]); setFuture([]); setPlayout({ ...initialPlayout(next), graphics: stored(graphicsKey(next.id), []) })
    navigate(`/editor/${next.id}`)
  }
  function copyProject(entry: Project, label = 'copy') {
    open({ ...structuredClone(entry), id: uid(), name: `${entry.name} · ${label}` })
  }
  function addScene(from?: Scene) {
    const next = from ? newScene(from) : { ...newScene(scene), name: `Scene ${project.scenes.length + 1}`, cues: [], paths: [], tracks: [] }
    commit({ ...project, scenes: [...project.scenes, next] }, next.id)
    setPlayout(value => switchScene(value, next.id))
  }
  function reconstruct(sceneFromFootage: Scene) {
    commit({ ...project, scenes: [...project.scenes, sceneFromFootage] }, sceneFromFootage.id)
    setPlayout(value => switchScene(value, sceneFromFootage.id))
    setNotice('Mapped markings saved in a reconstructed scene.')
  }
  function queue(graphic: GraphicSpec) {
    const graphics = [graphic, ...(playout.graphics ?? []).filter(item => item.id !== graphic.id)].slice(0, 20)
    const next = { ...playout, graphic, graphics }
    remember(graphicsKey(project.id), graphics)
    setPlayout(next)
    setLocalPreview(next)
    if (session) {
      if (desk.connection === 'connected') void stage(next)
      else setNotice('Graphic queued locally. Reconnect the shared session to stage it.')
    } else setNotice('Graphic queued in local presentation.')
  }
  function loadMatch(payload: LoadTacticsPayload) {
    const next = newScene()
    const home = Object.hasOwn(formations, payload.home.formation) ? payload.home.formation as FormationName : next.homeFormation
    const away = Object.hasOwn(formations, payload.away.formation) ? payload.away.formation as FormationName : next.awayFormation
    const lineup = (side: 'home' | 'away', formation: FormationName, roster: LoadTacticsPayload['home']['players']) => {
      const result = makeLineup(side, formation, roster)
      return payload.moment && roster.length > 0 && roster.length < 11 ? result.slice(0, roster.length) : result
    }
    open({
      version: 1, id: uid(), name: payload.title,
      match: { home: payload.home.name, away: payload.away.name, homeShort: payload.home.shortName, awayShort: payload.away.shortName, competition: payload.competition ?? 'Match analysis', score: payload.score?.join('–') ?? '', source: payload.source },
      scenes: [{
        ...next, name: payload.moment?.title ?? 'Starting Shape', homeFormation: home, awayFormation: away,
        players: [...lineup('home', home, payload.home.players), ...lineup('away', away, payload.away.players)],
        notes: payload.moment?.description ?? '', classification: payload.classification,
        sourceReference: { label: payload.source, estimated: true },
      }],
    })
  }
  function named(mode: 'new' | 'rename') { setTitle(mode === 'rename' ? project.name : ''); setDialog(mode); setMenu(false) }
  function saveVersion() {
    setMenu(false)
    void storage.saveVersion({ id: uid(), title: project.name, savedAt: Date.now(), project }).then(() => setNotice('Version saved locally.')).catch(notify)
  }
  function launchLocal() { setLocalPreview(playout); window.open('/output/local', '_blank', 'noopener,noreferrer') }
  async function sharedMedia(content: Playout): Promise<Playout> {
    return { ...content, sharedImage: await sharedFrame(currentScene(content).media) }
  }
  async function stage(content = playout) {
    try {
      const success = await desk.send({ type: 'stage', content: await sharedMedia(content) })
      if (success) setNotice('Preview staged separately from the on-air feed.')
    } catch (error) { notify(error) }
  }
  async function start() {
    if (starting) return
    setStarting(true)
    try {
      const { credentials: next } = await createSession(await sharedMedia(playout))
      setCredentials(current => { const record = { ...current, [project.id]: next }; remember(credentialsKey, record); return record })
      navigate(`/present/${project.id}`)
    } catch (error) { notify(error) }
    finally { setStarting(false) }
  }
  const present = () => { setLocalPreview(playout); navigate(`/present/${project.id}`) }

  useEffect(() => {
    if (editor) setLocalPreview(playout)
  }, [editor, playout])
  useEffect(() => {
    if (!editor || dialog) return
    const key = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || /INPUT|SELECT|TEXTAREA|BUTTON/.test(event.target.tagName))) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return }
      if (event.code === 'Space') { event.preventDefault(); setPlayout(value => togglePlay(value)); return }
      if (event.key === 'PageUp' || event.key === 'PageDown') {
        event.preventDefault()
        const delta = event.key === 'PageUp' ? -1 : 1
        if (event.shiftKey) setPlayout(value => switchCue(value, delta))
        else {
          const target = project.scenes[project.scenes.findIndex(item => item.id === scene.id) + delta]
          if (target) setPlayout(value => switchScene(value, target.id))
        }
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  const sceneIndex = project.scenes.findIndex(item => item.id === scene.id)
  const toast = notice && <button className="toast" role="status" onClick={() => setNotice('')}>{notice}</button>
  if (path.startsWith('/present/')) return <>
    <PresenterConsole fallback={playout} credentials={session} onBack={() => navigate(`/editor/${project.id}`)} onChange={next => { setPlayout(next); setLocalPreview(next) }} onCreate={() => void start()} onOpenLocal={launchLocal} />
    {starting && <div className="toast" role="status">Creating shared session…</div>}{toast}
  </>
  const routes = [
    { label: 'Studio', url: '/studio', icon: Home, current: path === '/studio' },
    { label: 'Tactics', url: `/editor/${project.id}`, icon: Clapperboard, current: editor },
    { label: 'Match data', url: '/data', icon: Database, current: path === '/data' },
    { label: 'Graphics', url: '/graphics', icon: Layers3, current: path === '/graphics' },
  ]
  return <div className={`studio-shell ${editor ? 'editor-shell' : ''}`}>
    <header className="masthead">
      <button className="brand" onClick={() => navigate('/studio')} aria-label="Touchline Studio home"><img src="/touchline.svg" alt="" /><span>TOUCHLINE<small>STUDIO</small></span></button>
      <nav aria-label="Studio environments">{routes.map(({ label, url, icon: Icon, current }) => <button key={url} aria-current={current ? 'page' : undefined} onClick={() => navigate(url)}><Icon size={16} /><span>{label}</span></button>)}</nav>
      <div className="mast-status"><span><i />{online ? 'Studio ready' : 'Offline'}</span><button className="button quiet" onClick={present}><Monitor size={17} /> Presenter desk <ArrowUpRight size={13} /></button></div>
    </header>
    {!online && <div className="offline-banner" role="status"><WifiOff size={15} /> Offline · Local productions are available. Shared output retains its last state.</div>}
    <input ref={importFile} type="file" accept=".json,application/json" hidden aria-label="Import project file" onChange={event => {
      const file = event.target.files?.[0]
      event.currentTarget.value = ''
      if (file) void importProject(file).then(open).catch(notify)
    }} />
    {editor && <>
      <div className="command-bar">
        <div className="project-menu">
          <button className="project-title" aria-expanded={menu} onClick={() => setMenu(value => !value)}><Film size={17} /><b>{project.name}</b><ChevronDown size={14} /></button>
          {menu && <div className="dropdown"><button onClick={() => named('new')}>New production</button><button onClick={() => named('rename')}>Rename production</button><button onClick={() => { copyProject(project); setMenu(false) }}>Duplicate production</button><button onClick={saveVersion}>Save version</button><button onClick={() => { importFile.current?.click(); setMenu(false) }}>Import project</button></div>}
        </div>
        <span className="save-status"><Check size={14} /> {save}</span>
        <div className="command-spacer" />
        <div className="undo-controls"><IconButton label="Undo" disabled={!past.length} onClick={undo}><Undo2 size={17} /></IconButton><IconButton label="Redo" disabled={!future.length} onClick={redo}><Redo2 size={17} /></IconButton></div>
        {session && <button className="button" disabled={desk.connection !== 'connected'} onClick={() => void stage()}>Stage preview</button>}
        <button className="button quiet" onClick={launchLocal}><Monitor size={16} /> <span>Output</span></button>
        <button className="button quiet" onClick={() => setDialog('export')}><Download size={16} /> <span>Export</span></button>
        <button className="button primary" onClick={present}><Radio size={17} /> Present</button>
      </div>
      <main className="editor-main">
        <section className="match-ribbon">
          <div className="match-context"><span className="eyebrow"><i /> Match analysis <span> / </span> {project.match.competition}</span><h1>{scene.name}</h1></div>
          <div className="ribbon-score" aria-label={`${project.match.home} against ${project.match.away}`}>
            <span><i className="team-indicator home" /> <b>{project.match.home}</b><small>{scene.homeFormation}</small></span>
            <strong>{project.match.score || 'v'}</strong>
            <span><i className="team-indicator away" /> <b>{project.match.away}</b><small>{scene.awayFormation}</small></span>
          </div>
          <div className="ribbon-scene"><span className="status-tag"><i /> {scene.classification}</span><small>{project.match.source}</small></div>
        </section>
        <EditorCanvas key={scene.id} playout={playout} onChange={commitScene} onReconstruct={reconstruct} onError={notify} />
        <Transport playout={playout} onChange={setPlayout} onAdd={() => addScene()} onDetails={() => setDialog('scene')} />
      </main>
    </>}
    {path === '/studio' && <StudioHome project={project} sessionId={session?.id} onOpen={open} onNew={() => named('new')} onDuplicate={copyProject}
      onImport={() => importFile.current?.click()} onTemplate={template => { addScene(template.scene); navigate(`/editor/${project.id}`) }}
      onRestore={snapshot => copyProject(snapshot.project, 'restored')} onData={matchId => navigate(matchId ? `/data?match=${encodeURIComponent(matchId)}` : '/data')} onGraphics={() => navigate('/graphics')} onPresent={present} onError={notify} />}
    {path === '/data' && <DataCenter producer={desk.state?.role === 'producer' && desk.connection === 'connected'} initialMatchId={new URLSearchParams(location.search).get('match') ?? undefined} onLoadTactics={loadMatch} onQueueGraphic={queue} />}
    {path === '/graphics' && <GraphicsLibrary onQueueGraphic={queue} />}
    {path !== '/studio' && path !== '/data' && path !== '/graphics' && !editor && <main className="recovery"><h1>Studio route unavailable</h1><button className="button primary" onClick={() => navigate('/')}>Open editor</button></main>}
    {dialog === 'scene' && <SceneSettings scene={scene} index={sceneIndex} count={project.scenes.length} onChange={commitScene} onClose={() => setDialog(null)}
      onMove={delta => { const items = [...project.scenes]; items.splice(sceneIndex + delta, 0, ...items.splice(sceneIndex, 1)); commit({ ...project, scenes: items }) }}
      onDelete={() => { const items = project.scenes.filter(item => item.id !== scene.id); commit({ ...project, scenes: items }, items[Math.max(0, sceneIndex - 1)].id) }}
      onDuplicate={() => addScene(scene)} onTemplate={value => void storage.saveTemplate({ id: uid(), title: value.name, scene: value }).then(() => setNotice('Scene template saved.')).catch(notify)} />}
    {dialog === 'export' && <ExportDialog busy={exporting} onClose={() => setDialog(null)} onProject={() => void exportProject(project).catch(notify)}
      onExport={options => { setExporting(0); void exportScene(scene, timeAt(playout, scene.duration), playout.cue, options, setExporting).then(() => setNotice('Scene exported.')).catch(notify).finally(() => setExporting(null)) }} />}
    {(dialog === 'new' || dialog === 'rename') && <Modal title={dialog === 'new' ? 'New production' : 'Rename production'} onClose={() => setDialog(null)}>
      <form onSubmit={event => { event.preventDefault(); if (!title.trim()) return; if (dialog === 'rename') commit({ ...project, name: title.trim() }); else open({
        version: 1, id: uid(), name: title.trim(),
        match: { home: 'Home', away: 'Away', homeShort: 'HOM', awayShort: 'AWY', competition: 'Tactical board', score: '', source: 'Manual line-up' },
        scenes: [newScene()],
      }); setDialog(null) }}>
        <label className="form-field">Production name<input autoFocus value={title} onChange={event => setTitle(event.target.value)} required maxLength={100} /></label>
        <div className="modal-actions"><button className="button primary" type="submit">{dialog === 'new' ? 'Create production' : 'Save name'}</button></div>
      </form>
    </Modal>}
    {toast}
  </div>
}

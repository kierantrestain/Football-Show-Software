import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, CircleStop, Clapperboard, Copy, ExternalLink, Flag, MonitorPlay, Pause, Play, Radio, RotateCcw, Shield, WifiOff } from 'lucide-react'
import QRCode from 'qrcode'
import { Pitch } from './Pitch'
import { Scorebug } from './Scorebug'
import { TacticsEditor } from './TacticsEditor'
import { BroadcastGraphic } from './data'
import { currentScene, switchCue, switchScene, timeAt, togglePlay, useLocalPreview, usePlayoutTime, withScene, type OutputFormat, type Playout } from './playback'
import { credentialsFromUrl, sessionUrl, useSession } from './session'
import type { SessionCredentials } from './session-types'
import { useMedia } from './useMedia'
import { activeSceneMedia, sceneFrameMatches } from './media-reference'
import { displayedFrameKey, useStagedFrames } from './useStagedFrames'
import { Modal } from './ui'

type FrameMap = Record<string, { url: string; ratio: number }>

export function BroadcastFrame({ content, heldAt, sceneOnly = false, staged }: {
  content: Playout; heldAt?: number | null; sceneOnly?: boolean; staged?: FrameMap
}) {
  const scene = currentScene(content)
  const time = usePlayoutTime(content, scene.duration, heldAt)
  const source = activeSceneMedia(scene)
  const frame = content.mediaManifest?.[scene.id]
  const prepared = source && frame && sceneFrameMatches(source, frame) ? staged?.[frame.key] : undefined
  const { url: localMedia } = useMedia(staged === undefined ? source?.assetId : undefined)
  const legacy = source && content.sharedImage?.assetId === source.assetId ? content.sharedImage.url : undefined
  const shared = prepared?.url ?? legacy
  const media = shared ?? localMedia
  const video = useRef<HTMLVideoElement>(null)
  const [dimensions, setDimensions] = useState<{ url: string; ratio: number }>()
  useEffect(() => {
    if (video.current && source?.frame !== undefined) video.current.currentTime = source.frame
  }, [media, source?.frame])
  if (content.graphic && !sceneOnly) return <div className={`broadcast-graphic-stage ${content.format === '9:16' ? 'portrait' : ''}`}>
    <BroadcastGraphic graphic={content.graphic} />
    {content.pip && <div className="air-pip"><BroadcastFrame content={{ ...content, format: '16:9' }} heldAt={heldAt} sceneOnly staged={staged} /></div>}
  </div>
  const overlay = content.format === 'Overlay'
  const showMedia = !overlay && !!media
  const ratio = prepared?.ratio ?? (dimensions?.url === media ? dimensions?.ratio : undefined)
    ?? (frame?.width && frame.height ? frame.width / frame.height : undefined)
    ?? (source?.width && source.height ? source.width / source.height : undefined)
  return <section className={`broadcast-frame ${content.format === 'Overlay' ? 'transparent' : ''} ${content.format === '9:16' ? 'portrait' : ''}`} aria-label="Broadcast frame">
    {content.format !== 'Overlay' && !sceneOnly && <Scorebug match={content.project.match} />}
    <div className="air-pitch" key={scene.id} data-transition={scene.transition}>
      {showMedia && media ? <div className="air-footage" style={{ '--footage-ratio': ratio ?? 16 / 9 } as CSSProperties}>
        {shared || source?.type === 'image' ? <img src={media} alt="Match analysis still" onLoad={event => {
          const image = event.currentTarget
          setDimensions({ url: media, ratio: image.naturalWidth / image.naturalHeight })
        }} /> : <video ref={video} src={media} muted playsInline preload="auto" onLoadedMetadata={event => {
          const clip = event.currentTarget
          clip.currentTime = source?.frame ?? 0
          setDimensions({ url: media, ratio: clip.videoWidth / clip.videoHeight })
        }} />}
        <Pitch scene={scene} time={time} cueIndex={content.cue} clean media />
      </div> : overlay && source
        ? <div className="air-footage" style={{ '--footage-ratio': ratio ?? 16 / 9 } as CSSProperties}><Pitch scene={scene} time={time} cueIndex={content.cue} clean transparent media /></div>
        : <Pitch scene={scene} time={time} cueIndex={content.cue} clean transparent={overlay} />}
    </div>
    {content.format !== 'Overlay' && !sceneOnly && <div className="air-title">
      <span>{content.project.match.competition} <i /> {content.project.match.source}</span>
      <strong>{scene.name}</strong>
      <small>{scene.classification}</small>
    </div>}
  </section>
}

export function OutputRoute({ id, fallback }: { id: string; fallback: Playout }) {
  const [credentials] = useState(() => id === 'local' ? null : credentialsFromUrl(id))
  const { state } = useSession<Playout>(credentials, { retainOnAir: true })
  const local = useLocalPreview(fallback)
  const [lastGood, setLastGood] = useState<{ content: Playout; heldAt?: number | null } | null>(null)
  const { frames } = useStagedFrames(credentials, state?.live, lastGood?.content)
  const candidate = state?.live
  const key = displayedFrameKey(candidate)
  const source = candidate && candidate.format !== 'Overlay' && (!candidate.graphic || candidate.pip) ? activeSceneMedia(currentScene(candidate)) : undefined
  const ready = !source || (key ? !!frames[key] : candidate?.sharedImage?.assetId === source.assetId)
  const remoteFrame = candidate && ready ? { content: candidate, heldAt: state?.heldAt } : candidate === null ? null : lastGood
  const live = id === 'local' ? local : remoteFrame?.content
  useEffect(() => {
    if (candidate === null) setLastGood(null)
    else if (candidate && ready) setLastGood({ content: candidate, heldAt: state?.heldAt })
    else if (candidate) setLastGood(previous => previous && previous.heldAt == null
      ? { ...previous, heldAt: Date.now() } : previous)
  }, [candidate, ready, state?.heldAt])
  useEffect(() => {
    document.body.classList.add('on-air-body')
    return () => document.body.classList.remove('on-air-body')
  }, [])
  return <main className="on-air" data-output={live?.format ?? 'blank'}>
    {live && <BroadcastFrame content={live} heldAt={id === 'local' ? null : remoteFrame?.heldAt} staged={id === 'local' ? undefined : frames} />}
  </main>
}

async function copyLink(url: string) {
  if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(url); return }
  const field = Object.assign(document.createElement('textarea'), { value: url, className: 'copy-scratch' })
  document.body.append(field)
  field.select()
  const copied = document.execCommand('copy')
  field.remove()
  if (!copied) throw new Error('Select the link and copy it manually.')
}

export function SessionLinks({ id, invites, onClose }: { id: string; invites: Record<'presenter-a' | 'presenter-b' | 'viewer', string>; onClose: () => void }) {
  const [role, setRole] = useState<keyof typeof invites>('presenter-a')
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState('')
  const url = sessionUrl(role === 'viewer' ? `/output/${id}` : `/remote/${id}`, invites[role])
  useEffect(() => {
    let active = true
    void QRCode.toDataURL(url, { width: 230, margin: 2, color: { dark: '#141a17', light: '#f1f5e4' } }).then(value => { if (active) setQr(value) }).catch(() => {})
    return () => { active = false }
  }, [url])
  return <Modal title="Connect devices" onClose={onClose}>
    <div className="invite-tabs">{(['presenter-a', 'presenter-b', 'viewer'] as const).map(item =>
      <button key={item} className="button" aria-pressed={role === item} onClick={() => { setRole(item); setCopied('') }}>{item === 'viewer' ? 'TV output' : item === 'presenter-a' ? 'Presenter A' : 'Presenter B'}</button>
    )}</div>
    <div className="qr-frame">{qr && <img src={qr} width="230" height="230" alt={`Join as ${role}`} />}</div>
    <label className="form-field">Secure link<input aria-label="Secure link" value={url} readOnly onFocus={event => event.currentTarget.select()} /></label>
    <div className="modal-actions">{role === 'viewer' && <a className="button quiet" target="_blank" rel="noreferrer" href={sessionUrl(`/remote/${id}`, invites.viewer)}>Read-only monitor</a>}<a className="button quiet" target="_blank" rel="noreferrer" href={url}><ExternalLink size={15} /> Open link</a><button className="button primary" onClick={() => void copyLink(url).then(() => setCopied('Copied')).catch(error => setCopied(String(error.message)))}><Copy size={15} /> {copied || 'Copy link'}</button></div>
  </Modal>
}

export function PresenterConsole({ fallback, credentials, remote = false, onChange, onCreate, onBack, onOpenLocal }: {
  fallback: Playout; credentials: SessionCredentials | null; remote?: boolean;
  onChange?: (content: Playout) => void; onCreate?: () => void; onBack?: () => void; onOpenLocal?: () => void;
}) {
  const { state, send, connection, error } = useSession<Playout>(credentials)
  const content = (state?.role === 'viewer' ? state.live : state?.preview) ?? fallback
  const scene = currentScene(content)
  const { frames, failed } = useStagedFrames(credentials, content, state?.live)
  const mediaKey = displayedFrameKey(content)
  const stagedStill = mediaKey ? frames[mediaKey] : undefined
  const time = usePlayoutTime(content, scene.duration)
  const [links, setLinks] = useState(false)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const producer = state?.role === 'producer'
  const canEdit = remote ? (state?.role === 'presenter-a' || state?.role === 'presenter-b') && state.access[state.role] : !state || producer
  const locked = Boolean(state?.lock && state.lock.owner !== state.role && state.lock.expiresAt > Date.now())
  const disabled = !canEdit || locked || busy || Boolean(credentials && connection !== 'connected')
  const boardOpen = editing && canEdit && !locked && (!credentials || state?.lock?.owner === state?.role)
  const update = (next: Playout) => {
    if (disabled) return
    if (!credentials) { onChange?.(next); return }
    setBusy(true)
    void send({ type: 'update', content: next }).finally(() => setBusy(false))
  }
  const index = content.project.scenes.findIndex(item => item.id === scene.id)
  const go = (delta: number) => {
    const target = content.project.scenes[index + delta]
    if (target) update(switchScene(content, target.id))
  }
  const play = !!content.startedAt && (time < scene.duration || content.loop)
  const cue = scene.cues[content.cue]
  const command = async (action: 'take' | 'hold' | 'clear' | 'preview' | 'claim' | 'release') => {
    setBusy(true)
    try { return await send({ type: action }) }
    finally { setBusy(false) }
  }
  const edit = async () => {
    if (!credentials) { setEditing(value => !value); return }
    if (boardOpen) { setEditing(false); await command('release'); return }
    if (await command('claim')) setEditing(true)
  }
  return <main className={`present-shell ${remote ? 'remote-shell' : ''}`}>
    <header className="present-header">
      <div className="present-identity">
        <div className="present-identity-label">
          {onBack && <button className="button quiet" onClick={onBack}><ArrowLeft size={17} /> Editor</button>}
          <span className="eyebrow"><Radio size={15} /> {remote ? state?.role === 'presenter-a' ? 'Presenter A' : state?.role === 'presenter-b' ? 'Presenter B' : state?.role === 'viewer' ? 'Read-only monitor' : 'Presenter remote' : 'Presentation desk'}</span>
        </div>
        <h1>{content.project.match.home} <span>v</span> {content.project.match.away}</h1>
        <span className="present-segment">{scene.name}</span>
      </div>
      <div className="present-header-actions">
        <span className={`status-tag ${state?.mode === 'live' ? 'live' : ''}`}><i />{state?.mode === 'live' ? 'On air' : state?.mode === 'hold' ? 'Held' : 'Preview'}</span>
        <span className="status-tag"><i />{credentials ? connection : 'Local rehearsal'}</span>
        {onCreate && !credentials && <button className="button primary" onClick={onCreate}><Radio size={16} /> Start shared session</button>}
        {producer && <button className="button" onClick={() => setLinks(true)}><MonitorPlay size={17} /> Connect devices</button>}
        {onOpenLocal && <button className="button" onClick={onOpenLocal}><ExternalLink size={16} /> Local preview</button>}
      </div>
    </header>
    {credentials && connection !== 'connected' && <p className="session-notice" role="status"><WifiOff size={16} /> {connection === 'connecting' ? 'Joining the studio…' : error || 'Connection interrupted. The last available state is shown.'}</p>}
    {remote && !credentials && <p className="session-notice">Open the secure presenter link supplied by the producer.</p>}
    {error && connection === 'connected' && <p className="session-notice" role="alert">{error}</p>}
    {!!failed.length && <p className="session-notice" role="alert">A prepared frame is unavailable. Check the rundown before taking it to air.</p>}
    <div className="present-grid">
      <div className="present-stage-column">
        <div className="present-stage">
          {boardOpen
            ? <TacticsEditor scene={scene} match={content.project.match} time={timeAt(content, scene.duration)} cueIndex={content.cue}
              media={stagedStill ? <img className="analysis-media" src={stagedStill.url} alt={scene.media?.name} /> : undefined}
              onChange={value => update(withScene(content, value))} />
            : <BroadcastFrame content={content} staged={credentials ? frames : undefined} />}
        </div>
        <nav className="present-rundown" aria-label="Rundown scenes">
          {content.project.scenes.map(item => <button type="button" key={item.id} className="button"
            aria-current={item.id === scene.id ? 'step' : undefined}
            disabled={disabled} onClick={() => update(switchScene(content, item.id))}>{item.name}</button>)}
        </nav>
        <div className="present-deck">
          <button className="button" disabled={disabled || index <= 0} onClick={() => go(-1)}><ChevronLeft size={19} /> Previous scene</button>
          <button className="button" disabled={disabled} onClick={() => update({ ...content, time: 0, cue: 0, startedAt: undefined })}><RotateCcw size={18} /> Reset</button>
          <button className="button" disabled={disabled} onClick={() => update(togglePlay(content))}>{play ? <Pause size={19} /> : <Play size={19} />}{play ? 'Pause' : 'Play'}</button>
          <button className="button" disabled={disabled || index === content.project.scenes.length - 1} onClick={() => go(1)}>Next scene <ChevronRight size={19} /></button>
        </div>
        {canEdit && <div className="present-deck secondary-deck">
          <button className="button" disabled={disabled} aria-pressed={boardOpen} onClick={() => void edit()}><Flag size={16} /> {boardOpen ? 'Release board' : 'Edit board'}</button>
          <label className="present-select">Highlight player<select aria-label="Highlight player" disabled={disabled} value={scene.players.find(player => player.highlight)?.id ?? ''} onChange={event => {
            const id = event.target.value
            update(withScene(content, { ...scene, players: scene.players.map(player => ({ ...player, highlight: player.id === id })) }))
          }}><option value="">None</option>{scene.players.map(player => <option key={player.id} value={player.id}>{player.number} · {player.name}</option>)}</select></label>
          {!!content.graphics?.length && <label className="present-select">Prepared graphic<select aria-label="Prepared graphic" disabled={disabled} value={content.graphic?.id ?? ''} onChange={event => update({
            ...content, graphic: content.graphics?.find(graphic => graphic.id === event.target.value),
          })}><option value="">Tactical board</option>{content.graphics.map(graphic => <option key={graphic.id} value={graphic.id}>{graphic.title}</option>)}</select></label>}
          {canEdit && content.graphic && <button className="button" disabled={disabled} aria-pressed={!!content.pip} onClick={() => update({ ...content, pip: !content.pip })}>Pitch inset</button>}
          {producer && <label className="present-select">Output format<select aria-label="Output format" value={content.format} onChange={event => update({ ...content, format: event.target.value as OutputFormat })}><option>16:9</option><option>9:16</option><option>Overlay</option></select></label>}
        </div>}
      </div>
      <aside className="cue-desk">
        <div className="eyebrow"><Clapperboard size={15} /> Scene {String(index + 1).padStart(2, '0')} / {String(content.project.scenes.length).padStart(2, '0')}</div>
        <h2>{scene.name}</h2>
        {scene.notes && <p>{scene.notes}</p>}
        <div className="cue-rows">
          <div><span>Previous cue</span><strong>{scene.cues[content.cue - 1]?.label ?? '—'}</strong></div>
          <div className="active-cue"><span>Current cue</span><strong>{cue?.label ?? 'Scene start'}</strong></div>
          <div><span>Next cue</span><strong>{scene.cues[content.cue + 1]?.label ?? 'End of scene'}</strong></div>
        </div>
        <div className="cue-actions"><button className="button" aria-label="Previous cue" disabled={disabled || content.cue <= 0} onClick={() => update(switchCue(content, -1))}><ArrowLeft size={19} /></button>
          <button className="button primary" disabled={disabled || content.cue >= scene.cues.length - 1} onClick={() => update(switchCue(content, 1))}>Next cue <ArrowRight size={18} /></button></div>
        {producer && <div className="air-actions">
          <button className="button air-take" disabled={busy || connection !== 'connected'} onClick={() => void command('take')}><Radio size={17} /> Take live</button>
          <button className="button" disabled={busy || !state?.live} onClick={() => void command('hold')}><Pause size={17} /> Hold output</button>
          <button className="button" disabled={busy || state?.mode === 'preview'} onClick={() => void command('preview')}><MonitorPlay size={17} /> Rehearse</button>
          <button className="button" disabled={busy || !state?.live} onClick={() => void command('clear')}><CircleStop size={17} /> Clear output</button>
          <button className="button" disabled={busy || !state?.lock} onClick={() => void command('release')}><Shield size={17} /> Release control</button>
        </div>}
        {producer && <div className="access-row">{(['presenter-a', 'presenter-b'] as const).map((role, n) => <button key={role} className="button quiet" disabled={busy} aria-pressed={state.access[role]} onClick={() => void send({ type: 'access', role, enabled: !state.access[role] })}>Presenter {n === 0 ? 'A' : 'B'} {state.access[role] ? 'enabled' : 'revoked'}</button>)}</div>}
      </aside>
    </div>
    {links && state?.invites && <SessionLinks id={state.id} invites={state.invites} onClose={() => setLinks(false)} />}
  </main>
}

export function RemoteRoute({ id, fallback }: { id: string; fallback: Playout }) {
  const [credentials] = useState(() => credentialsFromUrl(id))
  return <PresenterConsole fallback={fallback} credentials={credentials} remote />
}

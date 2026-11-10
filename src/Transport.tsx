import { useState } from 'react'
import { Clapperboard, FastForward, Gauge, Pause, Play, Plus, Repeat2, RotateCcw, SkipBack, SkipForward } from 'lucide-react'
import type { Scene } from './domain'
import { currentScene, switchScene, togglePlay, usePlayoutTime, type Playout } from './playback'
import { IconButton } from './ui'

const stamp = (time: number) => `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(Math.floor(time % 60)).padStart(2, '0')}.${String(Math.floor(time * 10) % 10)}`

export function Transport({ playout, onChange, onAdd, onDetails }: {
  playout: Playout; onChange: (value: Playout) => void; onAdd: () => void; onDetails: () => void
}) {
  const [zoom, setZoom] = useState(1)
  const scene = currentScene(playout)
  const time = usePlayoutTime(playout, scene.duration)
  const playing = Boolean(playout.startedAt && (time < scene.duration || playout.loop))
  const index = playout.project.scenes.findIndex(item => item.id === scene.id)
  const jump = (target: Scene | undefined) => { if (target) onChange(switchScene(playout, target.id)) }
  return <section className="timeline" aria-label="Scene timeline">
    <header className="timeline-header">
      <div className="timeline-label"><Clapperboard size={16} /> <strong>Rundown</strong> <span>{playout.project.scenes.length} SCENES</span></div>
      <div className="transport-controls">
        <IconButton label="Previous scene" disabled={index <= 0} onClick={() => jump(playout.project.scenes[index - 1])}><SkipBack size={16} /></IconButton>
        <IconButton label="Restart animation" onClick={() => onChange({ ...playout, time: 0, startedAt: undefined })}><RotateCcw size={15} /></IconButton>
        <IconButton label={playing ? 'Pause' : 'Play'} className="transport-play" onClick={() => onChange(togglePlay(playout))}>{playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</IconButton>
        <IconButton label="Next scene" disabled={index >= playout.project.scenes.length - 1} onClick={() => jump(playout.project.scenes[index + 1])}><SkipForward size={16} /></IconButton>
        <IconButton label="Loop playback" aria-pressed={playout.loop} onClick={() => onChange({ ...playout, loop: !playout.loop })}><Repeat2 size={17} /></IconButton>
        <div className="speed-choice"><Gauge size={14} /><select aria-label="Playback speed" value={playout.speed} onChange={event => onChange({ ...playout, speed: Number(event.target.value), time, startedAt: playing ? Date.now() : undefined })}><option value=".5">0.5×</option><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></div>
      </div>
      <button className="button quiet rundown-edit" onClick={onDetails}>Scene settings</button>
    </header>
    <div className="scene-strip">
      {playout.project.scenes.map((item, sceneIndex) => <button className="scene-tile" data-current={item.id === scene.id} aria-current={item.id === scene.id ? 'step' : undefined} key={item.id} onClick={() => jump(item)}>
        <span className="scene-number">{String(sceneIndex + 1).padStart(2, '0')}</span>
        <span className="scene-title"><strong>{item.name}</strong><small>{item.phase}</small></span>
        <span className="scene-seconds">{item.duration}s</span>
      </button>)}
      <IconButton label="Add scene" className="add-scene" onClick={onAdd}><Plus size={19} /></IconButton>
    </div>
    <div className="scrubber"><FastForward size={14} /><output>{stamp(time)}</output>
      <div className="scrub-window"><input aria-label="Timeline position" type="range" min={0} max={scene.duration} step={0.01} value={time}
        style={{ width: `${zoom * 100}%` }} onChange={event => onChange({ ...playout, time: Number(event.target.value), startedAt: undefined })} /></div>
      <span>{stamp(scene.duration)}</span>
      <select aria-label="Timeline zoom" value={zoom} onChange={event => setZoom(Number(event.target.value))}><option value="1">100%</option><option value="2">200%</option><option value="4">400%</option></select>
    </div>
  </section>
}

import { useRef, useState } from 'react'
import { Film, ImageUp, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import type { Scene } from './domain'
import { IconButton } from './ui'
import { useMedia } from './useMedia'
import { storeMedia } from './storage'

export function useEditorMedia(scene: Scene, onChange: (scene: Scene) => void, onError: (error: unknown) => void) {
  const asset = useMedia(scene.media?.assetId)
  const file = useRef<HTMLInputElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [duration, setDuration] = useState(0)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [shown, setShown] = useState(true)
  const media = scene.media && asset.url && shown && (scene.media.type === 'image'
    ? <img className="analysis-media" src={asset.url} alt={scene.media.name} />
    : <video className="analysis-media" ref={video} src={asset.url} muted playsInline preload="auto"
      onLoadedMetadata={event => {
        setDuration(event.currentTarget.duration)
        event.currentTarget.currentTime = scene.media?.frame ?? 0
        setTime(event.currentTarget.currentTime)
      }} onTimeUpdate={event => setTime(event.currentTarget.currentTime)}
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />)
  const seek = (target: number) => {
    if (!video.current) return
    video.current.pause()
    video.current.currentTime = Math.min(duration || 0, Math.max(0, target))
    setTime(video.current.currentTime)
  }
  const controls = <>
    <input ref={file} type="file" accept=".png,.jpg,.jpeg,.webp,.mp4,.webm,.mov" hidden aria-label="Import media" onChange={event => {
      const selected = event.target.files?.[0]
      event.currentTarget.value = ''
      if (selected) void storeMedia(selected).then(media => { setShown(true); onChange({ ...scene, media }) }).catch(onError)
    }} />
    {scene.media && <div className="media-transport">
      <Film size={16} /><b>{scene.media.name}</b>
      {asset.missing && <span>Media unavailable on this device</span>}
      {scene.media.type === 'video' && shown && <>
        <IconButton label="Back one frame (30 fps)" onClick={() => seek(time - 1 / 30)}><SkipBack size={16} /></IconButton>
        <IconButton label={playing ? 'Pause footage' : 'Play footage'} onClick={() => {
          if (video.current?.paused) void video.current.play().catch(onError)
          else video.current?.pause()
        }}>{playing ? <Pause size={16} /> : <Play size={16} />}</IconButton>
        <IconButton label="Forward one frame (30 fps)" onClick={() => seek(time + 1 / 30)}><SkipForward size={16} /></IconButton>
        <input aria-label="Video frame" type="range" min="0" max={duration || 0} step="0.01" value={time} onChange={event => seek(Number(event.target.value))} />
        <output>{time.toFixed(2)}s</output><button className="button" onClick={() => {
          seek(time)
          if (scene.media) onChange({ ...scene, media: { ...scene.media, frame: time } })
        }}>Save frame</button>
      </>}
      <button className="button quiet" onClick={() => setShown(value => !value)}>{shown ? 'Hide' : 'Show'} footage</button>
      <button className="button quiet" onClick={() => onChange({ ...scene, media: undefined })}>Detach</button>
    </div>}
  </>
  const upload = <button className="button quiet" onClick={() => file.current?.click()}><ImageUp size={16} /><span>Import media</span></button>
  return { media, controls, upload, mediaTime: time }
}

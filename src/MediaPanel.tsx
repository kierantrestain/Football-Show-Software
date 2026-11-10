import { useRef, useState, type ChangeEvent } from 'react'
import { Film, ImageUp, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import type { Scene } from './domain'
import { IconButton } from './ui'
import { useMedia } from './useMedia'
import { storeMedia } from './storage'
import './media-controls.css'

export function useEditorMedia(scene: Scene, onChange: (scene: Scene) => void, onError: (error: unknown) => void) {
  const asset = useMedia(scene.media?.assetId)
  const stillFile = useRef<HTMLInputElement>(null)
  const clipFile = useRef<HTMLInputElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [duration, setDuration] = useState(0)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const media = scene.media && asset.url && (scene.media.type === 'image'
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
  const attach = (event: ChangeEvent<HTMLInputElement>, stillOnly = false) => {
    const selected = event.target.files?.[0]
    event.currentTarget.value = ''
    if (!selected) return
    if (stillOnly && !/\.(?:jpe?g|png|webp)$/i.test(selected.name) && !/^image\/(?:jpeg|png|webp)$/i.test(selected.type)) {
      onError(new Error('Choose a JPG, PNG or WebP match still.'))
      return
    }
    void storeMedia(selected).then(media => {
      if (stillOnly && media.type !== 'image') throw new Error('Choose a JPG, PNG or WebP match still.')
      onChange({ ...scene, media, surface: 'media', objects: scene.objects.map(object => object.space ? object : {
        ...object, space: scene.media ? 'media' : 'pitch', mediaAssetId: scene.media?.assetId,
      }) })
    }).catch(onError)
  }
  const controls = <>
    <input ref={stillFile} type="file" accept=".png,.jpg,.jpeg,.webp" hidden aria-label="Import match still file" onChange={event => attach(event, true)} />
    <input ref={clipFile} type="file" accept=".mp4,.webm,.mov" hidden aria-label="Import media" onChange={event => attach(event)} />
    {scene.media && scene.surface !== 'pitch' && <div className="media-transport">
      <Film size={16} /><b>{scene.media.name}</b>
      {scene.media.width && scene.media.height && <span>{scene.media.width} × {scene.media.height}</span>}
      {asset.missing && <span role="alert">Media unavailable on this device</span>}
      {scene.media.type === 'video' && <>
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
      <button className="button quiet" onClick={() => onChange({ ...scene, media: undefined, surface: 'pitch' })}>Detach media</button>
    </div>}
  </>
  const upload = <div className="media-upload-group">
    <button className="button quiet media-upload" onClick={() => stillFile.current?.click()}><ImageUp size={16} /><span>Import match still</span></button>
    <IconButton label="Import footage" onClick={() => clipFile.current?.click()}><Film size={16} /></IconButton>
  </div>
  return { media, controls, upload, mediaTime: time }
}

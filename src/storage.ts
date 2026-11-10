import { openDB, type DBSchema } from 'idb'
import { uid, validateProject, type Project, type Scene } from './domain'

export type SavedProject = { project: Project; updatedAt: number }
export type Snapshot = { id: string; title: string; savedAt: number; project: Project }
export type Template = { id: string; title: string; scene: Scene }
type Asset = { id: string; blob: Blob; name: string }
interface StudioDb extends DBSchema {
  projects: { key: string; value: SavedProject }
  assets: { key: string; value: Asset }
  versions: { key: string; value: Snapshot }
  templates: { key: string; value: Template }
}
const database = () => openDB<StudioDb>('touchline-studio', 1, {
  upgrade(db) {
    for (const store of ['projects', 'assets', 'versions', 'templates'] as const) db.createObjectStore(store)
  },
})
let connection: ReturnType<typeof database> | undefined
const db = () => (connection ??= database())

export const storage = {
  projects: async () => (await (await db()).getAll('projects')).sort((a, b) => b.updatedAt - a.updatedAt),
  project: async (id: string) => (await db()).get('projects', id),
  save: async (project: Project) => (await db()).put('projects', { project, updatedAt: Date.now() }, project.id),
  saveAsset: async (asset: Asset) => (await db()).put('assets', asset, asset.id),
  asset: async (id: string) => (await db()).get('assets', id),
  saveVersion: async (snapshot: Snapshot) => (await db()).put('versions', snapshot, snapshot.id),
  versions: async () => (await (await db()).getAll('versions')).sort((a, b) => b.savedAt - a.savedAt),
  saveTemplate: async (template: Template) => (await db()).put('templates', template, template.id),
  templates: async () => (await db()).getAll('templates'),
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = Object.assign(document.createElement('a'), { href: url, download: filename })
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 20_000)
}

export function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

const supportedType = /^(image\/(png|jpeg|webp)|video\/(mp4|webm|quicktime))$/i
const mediaTypes: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
}
export async function storeMedia(file: File) {
  const type = file.type || mediaTypes[file.name.split('.').at(-1)?.toLowerCase() ?? '']
  if (!type || !supportedType.test(type)) throw new Error('Choose PNG, JPG, WebP, MP4, WebM or compatible MOV.')
  if (file.size > 250 * 1024 * 1024) throw new Error('The local asset limit is 250 MB.')
  const kind = type.startsWith('image/') ? 'image' : 'video'
  const blob = file.type === type ? file : file.slice(0, file.size, type)
  const url = URL.createObjectURL(blob)
  try {
    await new Promise<void>((resolve, reject) => {
      const media = kind === 'image' ? new Image() : document.createElement('video')
      const timeout = setTimeout(() => reject(new Error('The browser could not read this media file.')), 10_000)
      const finish = (error?: Error) => {
        clearTimeout(timeout)
        if (error) reject(error)
        else resolve()
      }
      media.onerror = () => finish(new Error('This browser cannot decode that file. Try H.264 MP4 or WebM for video.'))
      if (media instanceof HTMLVideoElement) {
        media.preload = 'metadata'
        media.onloadedmetadata = () => finish()
      } else media.onload = () => finish()
      media.src = url
    })
  } finally { URL.revokeObjectURL(url) }
  const id = uid()
  await storage.saveAsset({ id, blob, name: file.name })
  return { assetId: id, type: kind as 'image' | 'video', name: file.name, frame: 0 }
}

export async function exportProject(project: Project) {
  const ids = new Set(project.scenes.flatMap(scene => scene.media ? [scene.media.assetId] : []))
  const assets = await Promise.all([...ids].map(async id => {
    const asset = await storage.asset(id)
    return asset && { id, name: asset.name, data: await toDataUrl(asset.blob) }
  }))
  download(new Blob([JSON.stringify({ format: 'touchline-project', project, assets: assets.filter(Boolean) }, null, 2)], {
    type: 'application/json',
  }), `${project.name.replace(/[^\w-]+/g, '-').toLowerCase()}.touchline.json`)
}

export async function importProject(file: File): Promise<Project> {
  if (file.size > 360 * 1024 * 1024) throw new Error('The project file is too large.')
  const parsed: unknown = JSON.parse(await file.text())
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid project file.')
  const packageData = parsed as { project?: unknown; assets?: unknown[] }
  const project = validateProject(packageData.project ?? parsed)
  const assetIds = new Map<string, string>()
  const assets: Asset[] = []
  for (const raw of packageData.assets ?? []) {
    const asset = raw as { id?: string; name?: string; data?: string }
    if (typeof asset.id !== 'string' || typeof asset.name !== 'string' || typeof asset.data !== 'string' ||
      !/^data:(image\/(png|jpeg|webp)|video\/(mp4|webm|quicktime));base64,/.test(asset.data)) {
      throw new Error('This project contains an unsupported media asset.')
    }
    const id = uid()
    assetIds.set(asset.id, id)
    assets.push({ id, name: asset.name, blob: await (await fetch(asset.data)).blob() })
  }
  const scenes = project.scenes.map(scene => scene.media && assetIds.has(scene.media.assetId)
    ? { ...scene, media: { ...scene.media, assetId: assetIds.get(scene.media.assetId)! } }
    : scene)
  await Promise.all(assets.map(storage.saveAsset))
  return { ...project, id: uid(), scenes }
}

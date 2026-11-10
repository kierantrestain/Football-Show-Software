import { validateProject } from '../src/domain.js'

type RecordValue = Record<string, unknown>

function object(value: unknown): value is RecordValue {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function strings(record: RecordValue, fields: string[]) {
  return fields.every(field => typeof record[field] === 'string')
}
function optionalStrings(record: RecordValue, fields: string[]) {
  return fields.every(field => record[field] === undefined || typeof record[field] === 'string')
}
function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
function listOf(value: unknown, validate: (item: unknown) => boolean) {
  return value === undefined || (Array.isArray(value) && value.every(validate))
}

function graphic(value: unknown) {
  if (value === undefined) return true
  return object(value) && strings(value, ['id', 'kind', 'title', 'subtitle', 'source'])
    && optionalStrings(value, ['value', 'label', 'detail'])
    && (value.score === undefined || (Array.isArray(value.score) && value.score.length === 2 && value.score.every(finite)))
    && listOf(value.teams, team => object(team) && strings(team, ['name', 'shortName', 'color']) && optionalStrings(team, ['formation']))
    && listOf(value.subjects, subject => object(subject) && strings(subject, ['name', 'subtitle', 'color']))
    && listOf(value.lineup, player => object(player) && strings(player, ['name', 'position']) && finite(player.number))
    && listOf(value.rows, row => object(row) && strings(row, ['label']) && optionalStrings(row, ['value', 'detail', 'unit'])
      && listOf(row.values, item => item === null || finite(item)))
}

export function validStudioSnapshot(content: RecordValue) {
  try {
    const project = validateProject(content.project)
    const scene = project.scenes.find(scene => scene.id === content.sceneId)
    const image = content.sharedImage
    return !!scene
      && Number.isInteger(content.cue) && finite(content.cue) && content.cue >= 0 && content.cue < Math.max(scene.cues.length, 1)
      && finite(content.time) && content.time >= 0
      && finite(content.speed) && content.speed > 0
      && (content.startedAt === undefined || (finite(content.startedAt) && content.startedAt >= 0))
      && typeof content.loop === 'boolean'
      && (content.format === '16:9' || content.format === '9:16' || content.format === 'Overlay')
      && graphic(content.graphic)
      && (content.graphics === undefined || (Array.isArray(content.graphics) && content.graphics.length <= 20 && content.graphics.every(graphic)))
      && (image === undefined || (object(image) && typeof image.assetId === 'string' && typeof image.url === 'string'
        && (/^data:image\/(?:png|jpeg|webp);base64,/i.test(image.url) || image.url.startsWith('https://'))))
  } catch {
    return false
  }
}

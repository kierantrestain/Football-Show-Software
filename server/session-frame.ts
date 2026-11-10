import { createHash } from 'node:crypto'
import { MAX_FRAME_EDGE } from '../src/media-reference.js'

export const frameDigest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

export function frameDimensions(bytes: Uint8Array) {
  if (bytes.length < 16 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) return
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let size: { width: number; height: number } | undefined
  for (let cursor = 2; cursor + 4 < bytes.length;) {
    if (bytes[cursor++] !== 0xff) return
    while (bytes[cursor] === 0xff) cursor++
    if (cursor + 3 >= bytes.length) return
    const marker = bytes[cursor++]
    const length = data.getUint16(cursor)
    if (length < 2 || cursor + length > bytes.length) return
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      if (length < 8) return
      const height = data.getUint16(cursor + 3)
      const width = data.getUint16(cursor + 5)
      if (!width || !height || width > MAX_FRAME_EDGE || height > MAX_FRAME_EDGE) return
      size = { width, height }
    }
    if (marker === 0xda) return cursor + length < bytes.length - 2 ? size : undefined
    cursor += length
  }
}

export function readableFrame(bytes: Uint8Array | null, key: string): bytes is Uint8Array<ArrayBuffer> {
  return !!bytes && !!frameDimensions(bytes) && frameDigest(bytes) === key
}

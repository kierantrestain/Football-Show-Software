import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { test } from 'vitest'
import { createStudioServer } from '../server/index'
import { sampleProject } from '../src/domain'
import type { Playout } from '../src/playback'
import type { SessionAction, SessionCredentials, SessionState } from '../src/session-types'

type StudioState = SessionState<Playout>

function rundown(scene: number, cue: number): Playout {
  return { project: sampleProject, sceneId: sampleProject.scenes[scene].id, cue, time: 0, speed: 1, loop: false, format: '16:9' }
}

async function launch(sessionDirectory: string, staticDirectory: string) {
  const server = createStudioServer({ sessionDirectory, staticDirectory, longPollMs: 1500 })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected TCP studio service.')
  const base = `http://127.0.0.1:${address.port}`
  return {
    base,
    close: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve())
      server.closeAllConnections()
    }),
  }
}

function get(base: string, credentials: SessionCredentials, since?: number) {
  return fetch(`${base}/api/session?id=${credentials.id}${since === undefined ? '' : `&since=${since}`}`, {
    headers: { authorization: `Bearer ${credentials.token}` },
  })
}

function mutate(base: string, credentials: SessionCredentials, expectedRevision: number, action: SessionAction<Playout>) {
  return fetch(`${base}/api/session?id=${credentials.id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${credentials.token}` },
    body: JSON.stringify({ action, expectedRevision }),
  })
}

async function open(base: string, preview: Playout) {
  const response = await fetch(`${base}/api/session`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'create', preview }),
  })
  assert.equal(response.status, 201)
  const { credentials, state } = await response.json() as { credentials: SessionCredentials; state: StudioState }
  const { id } = credentials
  assert.ok(state.invites)
  return {
    producer: credentials,
    a: { id, token: state.invites['presenter-a'] },
    b: { id, token: state.invites['presenter-b'] },
    screen: { id, token: state.invites.viewer },
  }
}

async function read(response: Promise<Response>): Promise<StudioState> {
  const result = await response
  assert.equal(result.status, 200)
  return await result.json() as StudioState
}

test('producer, two presenters and output share authoritative cues, preview, hold and recovery over HTTP', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'football-studio-'))
  const sessionDirectory = join(directory, 'sessions')
  const app = await launch(sessionDirectory, directory)
  try {
    const opening = rundown(0, 0)
    const next = rundown(1, 1)
    const isolated = rundown(2, 1)
    const { producer, a, b, screen } = await open(app.base, opening)
    const [stateA, stateB, output] = await Promise.all([
      read(get(app.base, a)), read(get(app.base, b)), read(get(app.base, screen)),
    ])
    assert.equal(stateA.role, 'presenter-a')
    assert.equal(stateB.role, 'presenter-b')
    assert.equal(output.role, 'viewer')
    assert.equal(output.invites, undefined)
    assert.equal(output.live, null)
    assert.deepEqual(output.preview, {})
    assert.deepEqual(stateA.preview, opening)
    assert.equal((await mutate(app.base, screen, 0, { type: 'update', content: next })).status, 403)
    assert.equal((await mutate(app.base, b, 0, { type: 'take' })).status, 403)
    assert.equal((await get(app.base, { id: producer.id, token: 'A'.repeat(43) })).status, 401)

    let notified = false
    const watching = get(app.base, screen, 0).finally(() => { notified = true })
    await delay(30)
    assert.equal(notified, false, 'The viewer should wait for a new revision.')
    const live = await read(mutate(app.base, producer, 0, { type: 'take' }))
    assert.deepEqual(live.live, opening)
    const onAir = await Promise.race([read(watching), delay(1000).then(() => { throw new Error('The LAN viewer did not wake for the new revision.') })])
    assert.equal(onAir.revision, 1)
    assert.deepEqual(onAir.live, opening)

    const simultaneous = await Promise.all([
      mutate(app.base, a, 1, { type: 'update', content: next }),
      mutate(app.base, b, 1, { type: 'update', content: isolated }),
    ])
    assert.deepEqual(simultaneous.map(response => response.status).sort(), [200, 409])
    const authoritative = await read(get(app.base, screen))
    assert.equal(authoritative.revision, 2)
    assert.deepEqual(authoritative.preview, authoritative.live)

    const claimed = await read(mutate(app.base, a, 2, { type: 'claim' }))
    assert.equal(claimed.lock?.owner, 'presenter-a')
    assert.equal((await mutate(app.base, b, 3, { type: 'update', content: next })).status, 423)
    const featured: Playout = { ...authoritative.preview, project: { ...sampleProject, scenes: sampleProject.scenes.map(scene => ({
      ...scene, players: scene.players.map(player => ({ ...player, highlight: player.id === 'home-8' })),
    })) } }
    await read(mutate(app.base, a, 3, { type: 'update', content: featured }))
    assert.deepEqual((await read(get(app.base, screen))).live, featured)
    const revoked = await read(mutate(app.base, producer, 1, { type: 'access', role: 'presenter-a', enabled: false }))
    assert.equal(revoked.lock, null)
    assert.equal((await mutate(app.base, a, 5, { type: 'update', content: isolated })).status, 403)

    const held = await read(mutate(app.base, producer, 4, { type: 'hold' }))
    assert.equal(held.mode, 'hold')
    assert.ok(held.heldAt)
    assert.deepEqual(held.live, featured)
    assert.equal((await mutate(app.base, b, 5, { type: 'update', content: isolated })).status, 409)
    const rehearsal = await read(mutate(app.base, b, 6, { type: 'update', content: next }))
    assert.deepEqual(rehearsal.preview, next)
    assert.deepEqual(rehearsal.live, featured)
    const staged = await read(mutate(app.base, producer, 7, { type: 'stage', content: isolated }))
    assert.equal(staged.mode, 'preview')
    assert.deepEqual(staged.live, featured)
    assert.equal(staged.heldAt, held.heldAt)
    const taken = await read(mutate(app.base, producer, 8, { type: 'take' }))
    assert.deepEqual(taken.live, isolated)
    assert.equal(taken.heldAt, null)

    await app.close()
    const restarted = await launch(sessionDirectory, directory)
    try {
      assert.deepEqual((await read(get(restarted.base, screen))).live, isolated)
      assert.deepEqual((await read(get(restarted.base, b))).preview, isolated)
      const cleared = await read(mutate(restarted.base, producer, 7, { type: 'clear' }))
      assert.equal(cleared.live, null)
      assert.equal(cleared.mode, 'preview')
    } finally {
      await restarted.close()
    }
  } finally {
    await app.close().catch(() => undefined)
    await rm(directory, { recursive: true, force: true })
  }
})

test('LAN server serves clean deep routes, rejects malformed commands and enforces payload bounds', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'football-studio-'))
  await writeFile(join(directory, 'index.html'), '<!doctype html><title>Touchline</title>')
  const app = await launch(join(directory, 'sessions'), directory)
  try {
    assert.match(await (await fetch(`${app.base}/output/demo`)).text(), /Touchline/)
    assert.equal((await fetch(`${app.base}/missing.css`)).status, 404)
    assert.equal((await fetch(`${app.base}/api/missing`)).status, 404)
    const request = (body: string) => fetch(`${app.base}/api/session`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body,
    })
    assert.equal((await request('{')).status, 400)
    assert.equal((await request(JSON.stringify({ type: 'create', preview: [] }))).status, 400)
    assert.equal((await request(JSON.stringify({ type: 'create', preview: { ...rundown(0, 0), sceneId: 'unknown' } }))).status, 422)
    assert.equal((await request(JSON.stringify({ type: 'create', preview: { data: 'x'.repeat(1_050_000) } }))).status, 413)
    assert.equal((await fetch(`${app.base}/api/session?id=../private`)).status, 400)
    const opening = rundown(0, 0)
    const { producer, screen } = await open(app.base, opening)
    await read(mutate(app.base, producer, 0, { type: 'take' }))
    assert.equal((await mutate(app.base, producer, 1, { type: 'update', content: { ...opening, cue: 99 } })).status, 422)
    const oversizedRundown = { ...opening, graphics: Array.from({ length: 21 }, (_, index) => ({
      id: `graphic-${index}`, kind: 'title' as const, title: 'Untaken graphic', subtitle: 'Rehearsal', source: 'Demo',
    })) }
    assert.equal((await mutate(app.base, producer, 1, { type: 'stage', content: oversizedRundown })).status, 422)
    const protectedOutput = await read(get(app.base, screen))
    assert.equal(protectedOutput.revision, 1)
    assert.deepEqual(protectedOutput.live, opening)
  } finally {
    await app.close()
    await rm(directory, { recursive: true, force: true })
  }
})

// A generated one-pixel JPEG (RGB 35, 101, 129), with no match imagery.
const testJpeg = Buffer.from('/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAAaADAAQAAAABAAAAAQAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAAQABAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAAf/aAAwDAQACEQMRAD8A+T6KKK/ZD+cz/9k=', 'base64')

test('rundown frames are separate, scoped to air, and checked before changing the feed', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'football-staged-frames-'))
  const sessionDirectory = join(directory, 'sessions')
  const app = await launch(sessionDirectory, directory)
  try {
    const opening = rundown(0, 0)
    const { producer, a, b, screen } = await open(app.base, opening)
    const frame = (credentials: SessionCredentials, key?: string, body?: Buffer) => fetch(
      `${app.base}/api/session-asset?${new URLSearchParams(key ? { id: credentials.id, key } : { id: credentials.id })}`, {
        method: body ? 'POST' : 'GET',
        headers: { authorization: `Bearer ${credentials.token}`, ...(body ? { 'content-type': 'image/jpeg' } : {}) },
        body: body ? new Uint8Array(body) : undefined,
      },
    )
    assert.equal((await frame(a, undefined, testJpeg)).status, 403)
    assert.equal((await frame(producer, undefined, Buffer.from('not a JPEG'))).status, 422)
    const one = await frame(producer, undefined, testJpeg)
    assert.equal(one.status, 201)
    const first = { ...await one.json(), assetId: 'landscape', frame: 0 }
    const secondJpeg = Buffer.concat([testJpeg.subarray(0, 2), Buffer.from([255, 254, 0, 3, 97]), testJpeg.subarray(2)])
    const two = await frame(producer, undefined, secondJpeg)
    assert.equal(two.status, 201)
    const second = { ...await two.json(), assetId: 'portrait', frame: 0 }
    assert.notEqual(first.key, second.key)
    assert.equal(first.width, 1)
    assert.equal((await frame(screen, first.key)).status, 404)
    assert.equal((await frame({ ...producer, token: 'A'.repeat(43) }, first.key)).status, 401)

    const project = { ...opening.project, scenes: opening.project.scenes.map((scene, index) => index < 2 ? {
      ...scene, surface: 'media' as const, media: { type: 'image' as const, name: `frame ${index + 1}`, assetId: index === 0 ? first.assetId : second.assetId },
    } : scene) }
    const staged: Playout = { ...opening, project, mediaManifest: { [project.scenes[0].id]: first, [project.scenes[1].id]: second } }
    const current = await read(mutate(app.base, producer, 0, { type: 'stage', content: staged }))
    assert.equal(current.live, null)
    assert.equal((await frame(screen, first.key)).status, 404)
    assert.equal((await frame(a, first.key)).status, 200)
    const advanced = await read(mutate(app.base, a, current.revision, { type: 'update', content: { ...staged, sceneId: project.scenes[1].id } }))
    assert.equal(advanced.live, null)

    const take = await fetch(`${app.base}/api/session?id=${producer.id}`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${producer.token}` },
      body: JSON.stringify({ action: { type: 'take' }, expectedRevision: current.revision, expectedStageRevision: current.stageRevision }),
    })
    assert.equal(take.status, 200)
    const live = await take.json() as StudioState
    assert.equal(live.live?.sceneId, project.scenes[1].id)
    assert.deepEqual(Buffer.from(await (await frame(screen, first.key)).arrayBuffer()), testJpeg)
    assert.deepEqual(Buffer.from(await (await frame(screen, second.key)).arrayBuffer()), secondJpeg)

    const stagedPath = join(sessionDirectory, 'media', producer.id, `${first.key}.jpg`)
    await writeFile(stagedPath, 'corrupted frame')
    const unreadable = await mutate(app.base, b, live.revision, { type: 'update', content: staged })
    assert.equal(unreadable.status, 422)
    assert.match((await unreadable.json()).error, /unreadable/i)
    assert.equal((await read(get(app.base, screen))).live?.sceneId, project.scenes[1].id)
    await rm(stagedPath)
    const broken = await mutate(app.base, b, live.revision, { type: 'update', content: staged })
    assert.equal(broken.status, 422)
    assert.match((await broken.json()).error, /staged frame.*missing/i)
    assert.equal((await read(get(app.base, screen))).live?.sceneId, project.scenes[1].id)
    assert.equal((await mutate(app.base, producer, live.revision, { type: 'take' })).status, 422)
    assert.equal((await read(get(app.base, screen))).live?.sceneId, project.scenes[1].id)
  } finally {
    await app.close()
    await rm(directory, { recursive: true, force: true })
  }
})

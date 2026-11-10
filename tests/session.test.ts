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
    const revoked = await read(mutate(app.base, producer, 4, { type: 'access', role: 'presenter-a', enabled: false }))
    assert.equal(revoked.lock, null)
    assert.equal((await mutate(app.base, a, 5, { type: 'update', content: isolated })).status, 403)

    const held = await read(mutate(app.base, producer, 5, { type: 'hold' }))
    assert.equal(held.mode, 'hold')
    assert.ok(held.heldAt)
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
      const cleared = await read(mutate(restarted.base, producer, 9, { type: 'clear' }))
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
  } finally {
    await app.close()
    await rm(directory, { recursive: true, force: true })
  }
})

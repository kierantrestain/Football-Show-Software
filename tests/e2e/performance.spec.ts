import { expect, test } from '@playwright/test'
import { newScene, sampleProject, type MovementPath, type Scene, type TacticalObject } from '../../src/domain'

function measurementScene(name: string, lines: number, zones: number, moving: number): Scene {
  const scene = { ...newScene(), name, duration: 12 }
  const color = '#dbfb48'
  const arrows: TacticalObject[] = Array.from({ length: lines }, (_, index) => {
    const x = 7 + (index % 10) * 8.4
    const y = 9 + ((index * 13) % 48)
    return { id: `line-${index}`, kind: 'arrow', points: [{ x, y }, { x: x + 10, y: y + 3 }],
      curve: { x: x + 6, y: y - 4 }, color, opacity: .8, thickness: .24, arrowhead: true }
  })
  const areas: TacticalObject[] = Array.from({ length: zones }, (_, index) => {
    const x = 7 + (index % 8) * 11
    const y = 10 + Math.floor(index / 8) * 10
    return { id: `zone-${index}`, kind: 'zone', points: [{ x, y }, { x: x + 7, y: y + 4 }], color, opacity: .26, thickness: .24 }
  })
  const labels: TacticalObject[] = Array.from({ length: moving > 10 ? 12 : 4 }, (_, index) => ({
    id: `label-${index}`, kind: 'text', points: [{ x: 12 + (index % 6) * 14, y: 6 + Math.floor(index / 6) * 56 }],
    color, opacity: 1, thickness: .4, label: `UNIT ${index + 1}`,
  }))
  const paths: MovementPath[] = scene.players.slice(0, moving).map((player, index) => ({
    id: `move-${index}`, target: player.id, action: 'run', from: { x: player.x, y: player.y },
    to: { x: player.x + (player.side === 'home' ? 8 : -8), y: player.y },
    control: { x: player.x + (player.side === 'home' ? 3 : -3), y: player.y + 3 },
    start: 0, duration: 11, easing: 'linear',
  }))
  return { ...scene, objects: [...arrows, ...areas, ...labels], paths }
}

test('measure editor playback on typical and stress tactical scenes', async ({ page }, testInfo) => {
  const cases = [
    { name: 'Typical tactical load', arrows: 20, zones: 10, playersMoving: 6 },
    { name: 'Stress tactical load', arrows: 80, zones: 40, playersMoving: 22 },
  ]
  const scenes = cases.map(item => measurementScene(item.name, item.arrows, item.zones, item.playersMoving))
  const project = { ...sampleProject, name: 'Playback measurement', scenes }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.locator('input[aria-label="Import project file"]').setInputFiles({
    name: 'measurement.touchline.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)),
  })
  await expect(page.getByRole('button', { name: /Typical tactical load/ })).toBeVisible()

  const results = []
  for (const scene of scenes) {
    await page.getByRole('button', { name: new RegExp(scene.name) }).click()
    await expect(page.locator('[data-player-id]')).toHaveCount(22)
    await expect(page.locator('svg[aria-label="Football tactics pitch"] [data-object-id]')).toHaveCount(scene.objects.length)
    const motion = page.locator(`[data-player-id="${scene.players[0].id}"]`)
    const before = await motion.getAttribute('transform')
    await page.getByRole('region', { name: 'Scene timeline' }).getByRole('button', { name: 'Play', exact: true }).click()
    const timings = await page.evaluate(() => new Promise<{ elapsedMs: number; fps: number; worstFrameMs: number; p95FrameMs: number }>(resolve => {
      const deltas: number[] = []
      let start: number | undefined
      let previous: number | undefined
      const step = (now: number) => {
        start ??= now
        if (previous !== undefined) deltas.push(now - previous)
        previous = now
        const elapsedMs = now - start
        if (elapsedMs < 3500) {
          requestAnimationFrame(step)
          return
        }
        deltas.sort((a, b) => a - b)
        const round = (value: number) => Math.round(value * 10) / 10
        resolve({ elapsedMs: round(elapsedMs), fps: round(deltas.length * 1000 / elapsedMs),
          worstFrameMs: round(deltas.at(-1) ?? 0), p95FrameMs: round(deltas[Math.floor(deltas.length * .95)] ?? 0) })
      }
      requestAnimationFrame(step)
    }))
    await expect(motion).not.toHaveAttribute('transform', before ?? '')
    await page.getByRole('region', { name: 'Scene timeline' }).getByRole('button', { name: 'Pause', exact: true }).click()
    results.push({ ...cases[results.length], renderedPlayers: scene.players.length, labels: scene.objects.length - cases[results.length].arrows - cases[results.length].zones, ...timings })
  }

  const summary = JSON.stringify({ viewport: '1440x900', browser: 'Chromium headless', results }, null, 2)
  console.info(summary)
  await testInfo.attach('playback-measurements', { body: Buffer.from(summary), contentType: 'application/json' })
})

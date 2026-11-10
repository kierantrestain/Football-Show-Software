import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

async function markerCenter(page: Page, id: string) {
  const marker = page.locator(`[data-player-id="${id}"]`)
  const box = await marker.boundingBox()
  if (!box) throw new Error('Player marker was not visible.')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test('edit formations, drag a player, and create, undo and recover a scene', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Starting Shape' })).toBeVisible()
  await expect(page.locator('[data-player-id]')).toHaveCount(22)
  const original = await markerCenter(page, 'home-6')
  await page.mouse.move(original.x, original.y)
  await page.mouse.down()
  await page.mouse.move(original.x + 47, original.y - 33, { steps: 8 })
  await page.mouse.up()
  const moved = await markerCenter(page, 'home-6')
  expect(moved.x).toBeGreaterThan(original.x + 24)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  expect((await markerCenter(page, 'home-6')).x).toBeCloseTo(original.x, 0)
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  expect((await markerCenter(page, 'home-6')).x).toBeCloseTo(moved.x, 0)
  await page.getByRole('button', { name: 'Add scene' }).click()
  await expect(page.getByRole('heading', { name: 'Scene 6' })).toBeVisible()
  await page.getByRole('button', { name: 'Scene settings' }).click()
  await page.getByRole('dialog', { name: 'Scene settings' }).getByRole('textbox', { name: 'Scene name' }).fill('Recovery check')
  await page.getByRole('button', { name: 'Save scene' }).click()
  await expect(page.getByRole('heading', { name: 'Recovery check' })).toBeVisible()
  await expect(page.getByText('Saved locally')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: /Recovery check/ })).toBeVisible()
  await page.getByRole('button', { name: /Recovery check/ }).click()
  await page.getByRole('button', { name: 'Scene settings' }).click()
  await page.getByRole('button', { name: 'Move scene earlier' }).click()
  await expect(page.locator('.scene-tile').nth(4)).toContainText('Recovery check')
})

test('still telestration, annotated PNG, project export and offline recovery', async ({ page }, testInfo) => {
  await page.goto('/')
  const still = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 360
    const c = canvas.getContext('2d')!
    c.fillStyle = '#235548'; c.fillRect(0, 0, 640, 360)
    c.strokeStyle = '#edf7d9'; c.lineWidth = 3; c.strokeRect(25, 25, 590, 310)
    return canvas.toDataURL().split(',')[1]
  })
  await page.locator('input[aria-label="Import media"]').setInputFiles({ name: 'rehearsal.png', mimeType: 'image/png', buffer: Buffer.from(still, 'base64') })
  await expect(page.getByRole('img', { name: 'rehearsal.png' })).toBeVisible()
  const drawing = page.locator('[aria-label="Media telestration canvas"]')
  await expect(drawing).toBeVisible()
  await page.getByRole('button', { name: 'Defensive line', exact: true }).click()
  const box = await drawing.boundingBox()
  if (!box) throw new Error('Missing media canvas.')
  await page.mouse.move(box.x + box.width * .25, box.y + box.height * .33)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * .74, box.y + box.height * .62, { steps: 7 })
  await page.mouse.up()
  await expect(drawing.locator('[aria-label="line"]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  let downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export scene' }).click()
  const png = await downloadEvent
  const pngBytes = await readFile((await png.path())!)
  expect(pngBytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(pngBytes.readUInt32BE(16)).toBe(1920)
  expect(pngBytes.readUInt32BE(20)).toBe(1080)
  downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Project JSON' }).click()
  const projectFile = await downloadEvent
  const packageFile = await readFile((await projectFile.path())!)
  expect(JSON.parse(packageFile.toString()).assets).toHaveLength(1)
  await page.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'Studio', exact: true }).click()
  await page.locator('input[aria-label="Import project file"]').setInputFiles({ name: 'rehearsal.json', mimeType: 'application/json', buffer: packageFile })
  await expect(page.getByRole('img', { name: 'rehearsal.png' })).toBeVisible()
  await expect(page.getByText('Saved locally')).toBeVisible()
  await page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })) })
  await page.context().setOffline(true)
  await page.reload()
  await expect(page.getByText(/Offline · Local productions/)).toBeVisible()
  await expect(page.getByRole('img', { name: 'rehearsal.png' })).toBeVisible()
  await page.context().setOffline(false)
  await testInfo.attach('annotated-still', { body: pngBytes, contentType: 'image/png' })
})

test('browser screenshots cover editing, studio home and local television', async ({ page }, testInfo) => {
  await page.goto('/')
  for (const [width, height] of [[1920, 1080], [1440, 900], [1280, 800]]) {
    await page.setViewportSize({ width, height })
    await expect(page.locator('[data-player-id]')).toHaveCount(22)
    await page.screenshot({ path: testInfo.outputPath(`editor-${width}.png`), animations: 'disabled' })
  }
  await page.getByRole('button', { name: 'Studio', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Studio desk.' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('studio-home.png'), animations: 'disabled' })
  await page.goto('/output/local')
  await page.setViewportSize({ width: 1920, height: 1080 })
  await expect(page.getByRole('button')).toHaveCount(0)
  await expect(page.locator('[data-player-id]')).toHaveCount(22)
  await page.screenshot({ path: testInfo.outputPath('broadcast-1920.png'), animations: 'disabled' })
})

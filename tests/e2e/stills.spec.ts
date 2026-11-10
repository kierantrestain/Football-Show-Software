import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const solid = '#8c4122'

async function stillImage(page: Page, width: number, height: number) {
  const encoded = await page.evaluate(({ width, height, solid }) => {
    const canvas = Object.assign(document.createElement('canvas'), { width, height })
    const context = canvas.getContext('2d')!
    context.fillStyle = solid
    context.fillRect(0, 0, width, height)
    return canvas.toDataURL('image/png').split(',')[1]
  }, { width, height, solid })
  return Buffer.from(encoded, 'base64')
}

async function draw(page: Page, tool: string, from: [number, number], to: [number, number], menu = false) {
  if (menu) await page.getByRole('button', { name: 'Draw', exact: true }).click()
  await page.getByRole('button', { name: tool, exact: true }).click()
  const box = await page.getByLabel('Media telestration canvas').boundingBox()
  if (!box) throw new Error('Still canvas is missing.')
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1])
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 8 })
  await page.mouse.up()
}

test('portrait still marks survive fit, deliberate zoom, pitch switches and aligned PNG export', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/?mode=demo')
  const input = page.getByLabel('Import match still file')
  await input.setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not a PNG') })
  await expect(page.getByText(/image contents do not match/i)).toBeVisible()
  const original = await stillImage(page, 750, 1250)
  await input.setInputFiles({ name: 'portrait-still.png', mimeType: 'image/png', buffer: original })
  const canvas = page.getByLabel('Media telestration canvas')
  await expect(canvas).toBeVisible()
  const bounds = await canvas.boundingBox()
  expect(bounds!.width / bounds!.height).toBeCloseTo(.6, 2)
  await draw(page, 'Defensive line', [.2, .5], [.8, .5], true)
  const line = canvas.locator('[aria-label="line"] path[pointer-events="none"]').last()
  const straight = await line.getAttribute('d')
  await page.getByRole('button', { name: 'Curve', exact: true }).click()
  await expect(line).not.toHaveAttribute('d', straight!)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(line).toHaveAttribute('d', straight!)
  await draw(page, 'Run mark', [.2, .17], [.75, .26])
  await draw(page, 'Spotlight', [.46, .72], [.52, .74])
  await expect(canvas.locator('[aria-label="run"]')).toHaveCount(1)
  await expect(canvas.locator('[aria-label="spotlight"]')).toHaveCount(1)

  const zoom = page.getByRole('combobox', { name: 'Still view zoom' })
  await zoom.selectOption('1.5')
  await expect(line).toHaveAttribute('d', straight!)
  await zoom.selectOption('1')
  await page.getByRole('button', { name: 'Pitch', exact: true }).click()
  await expect(page.locator('[data-player-id]')).toHaveCount(22)
  await page.getByRole('button', { name: 'Still', exact: true }).click()
  await expect(line).toHaveAttribute('d', straight!)
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible()
  await page.reload()
  await expect(line).toHaveAttribute('d', straight!)
  await testInfo.attach('portrait-still-editor-laptop', { body: await page.screenshot(), contentType: 'image/png' })

  await page.getByRole('button', { name: 'Export', exact: true }).click()
  for (const [resolution, width, height] of [['1080p', 1920, 1080], ['4K', 3840, 2160]] as const) {
    await page.getByLabel('Resolution').selectOption(resolution)
    const downloading = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export scene' }).click()
    const file = await downloading
    const bytes = await readFile((await file.path())!)
    const decoded = await page.evaluate(async encoded => {
      const image = new Image()
      image.src = 'data:image/png;base64,' + encoded
      await image.decode()
      const canvas = Object.assign(document.createElement('canvas'), { width: image.naturalWidth, height: image.naturalHeight })
      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0)
      const pixel = (x: number, y: number) => [...context.getImageData(x, y, 1, 1).data]
      const alignedMark = Array.from({ length: 25 }, (_, offset) => pixel(canvas.width / 2, canvas.height / 2 - 12 + offset))
        .some(([red, , blue]) => blue > 120 && blue > red)
      return { width: canvas.width, height: canvas.height, alignedMark, image: pixel(canvas.width / 2, canvas.height * .35), gutter: pixel(canvas.width * .12, canvas.height * .35) }
    }, bytes.toString('base64'))
    expect(decoded).toEqual({ width, height, alignedMark: true, image: [140, 65, 34, 255], gutter: [9, 19, 15, 255] })
    await testInfo.attach(`portrait-still-${resolution}`, { body: bytes, contentType: 'image/png' })
  }
})

import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import { fixturesFor } from '../../src/data/footballDataset'

const fixtureId = 'pl:2026:manchester-united:aston-villa'
const fixturePath = '/data?match=' + encodeURIComponent(fixtureId)
const fixture = fixturesFor().find(match => match.id === fixtureId)!
const qaSource = {
  kind: 'pack',
  label: 'Synthetic QA identities · workflow test only',
  url: 'https://example.com/studio-qa',
  permission: 'Synthetic identifiers generated exclusively for test use.',
  checkedAt: '2026-11-10T00:00:00Z',
  updatedAt: '2026-11-10T00:00:00Z',
}
function samplePack() {
  const clubs = [fixture.home, fixture.away]
  const people = clubs.map((club, side) => Array.from({ length: 12 }, (_, index) => ({
    id: 'qa-' + side + '-' + (index + 1),
    name: 'Synthetic QA ' + club.shortName + ' ' + (index + 1),
    position: index === 0 ? 'GK' : index < 5 ? 'Defender' : index < 8 ? 'Midfielder' : 'Forward',
  })))
  return {
    schema: 1, revision: 'qa-authorised-workflow-1', source: qaSource,
    players: people.flat(), registrations: clubs.flatMap((club, side) => people[side].map((person, index) => ({
      playerId: person.id, teamId: club.id, competitionId: 'PL', season: '2026/27', eligibleFrom: '2026-08-21',
      number: index === 3 ? undefined : index + 1,
    }))),
    lineups: clubs.map((club, side) => ({
      fixtureId, teamId: club.id, formation: '4-3-3',
      starters: people[side].slice(0, 11).map(player => ({ playerId: player.id })), bench: [{ playerId: people[side][11].id }],
    })),
    events: [
      { id: 'qa-replacement', fixtureId, teamId: fixture.home.id, minute: 90, extra: 2, order: 1,
        kind: 'Substitution', title: 'QA replacement', description: 'Synthetic QA action.', playerOut: people[0][2].id, playerIn: people[0][11] },
      { id: 'qa-dismissal', fixtureId, teamId: fixture.home.id, minute: 90, extra: 2, order: 2,
        kind: 'Card', title: 'QA dismissal', description: 'Synthetic QA action.', dismissal: people[0][4].id },
    ],
  }
}

async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: info.outputPath(name + '.png'), animations: 'disabled' })
}

async function center(marker: Locator) {
  const bounds = await marker.boundingBox()
  if (!bounds) throw new Error('A player marker is outside the pitch.')
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
}

test.use({ viewport: { width: 1280, height: 800 } })

test('clean profile opens real fixture coverage, protects an incomplete XI and queues the pinned 4–4 result', async ({ page, context }, info) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Matchday desk' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Upcoming fixtures' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Manchester United v Aston Villa/ })).toBeVisible()
  await page.getByRole('button', { name: /Manchester United v Aston Villa/ }).click()
  await expect(page.locator('.data-hero-score')).toContainText('4 – 4')
  await expect(page.locator('.data-hero-bottom')).toContainText('8 Nov')
  await expect(page.getByLabel('Data coverage')).toContainText('380/380 fixtures')
  await capture(page, info, 'real-match-1280')
  await page.getByRole('button', { name: 'Queue match graphic' }).click()
  const tv = await context.newPage()
  await tv.setViewportSize({ width: 1920, height: 1080 })
  await tv.goto('/output/local')
  await expect(tv.getByTestId('broadcast-graphic')).toContainText('4 – 4')
  await expect(tv.getByTestId('broadcast-graphic')).toContainText('Manchester United')
  await expect(tv.getByRole('button')).toHaveCount(0)
  await capture(tv, info, 'real-result-1080')
  await tv.setViewportSize({ width: 3840, height: 2160 })
  await capture(tv, info, 'real-result-4k')
  await page.getByRole('button', { name: 'Open roster repair' }).click()
  const repair = page.getByRole('dialog', { name: 'Roster repair' })
  await expect(repair).toContainText('Manchester United needs 11 more')
  await expect(repair).toContainText('Aston Villa needs 11 more')
  await repair.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.locator('[data-player-id]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Present', exact: true }).click()
  await page.getByRole('button', { name: 'Start shared session' }).click()
  await expect(page.getByRole('status').filter({ hasText: /needs 11 more sourced players/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Connect devices' })).toHaveCount(0)
  await expect(tv.getByTestId('broadcast-graphic')).toContainText('4 – 4')
})

test('authorised-pack mechanics load a complete fixture board quickly and preserve a dismissal through formation and reload', async ({ page }, info) => {
  await page.goto(fixturePath)
  await page.getByText('Import authorised football records', { exact: true }).click()
  await page.getByLabel('Football data pack').setInputFiles({
    name: 'fixture-qa-only.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(samplePack())),
  })
  const preview = page.getByRole('region', { name: 'Football data import preview' })
  await expect(preview).toContainText('24 identities')
  await preview.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Publish verified pack' }).click()
  await expect(page.getByRole('button', { name: 'Load confirmed XIs' })).toBeVisible()
  await page.getByRole('button', { name: 'Studio', exact: true }).click()
  const started = Date.now()
  await page.getByRole('button', { name: /Manchester United v Aston Villa/ }).click()
  await page.getByRole('button', { name: 'Load confirmed XIs' }).click()
  const pitch = page.getByLabel('Football tactics pitch')
  await expect(pitch.locator('[data-player-id]')).toHaveCount(22)
  const elapsedMs = Date.now() - started
  expect(elapsedMs).toBeLessThan(30_000)
  console.log(JSON.stringify({ workflow: 'cached fixture to validated board', clicks: 2, elapsedMs, roster: 'synthetic QA pack' }))
  await expect(page.getByTestId('fixture-scorebug')).toContainText('4–4')
  await expect(page.getByText(/Estimated positions · Confirmed XI/)).toBeVisible()
  await capture(page, info, 'real-fixture-qa-board-1280')
  const editor = page.getByRole('region', { name: 'Tactics editor' })
  const before = await pitch.boundingBox()
  const carrier = await center(pitch.locator('[data-player-id="home-qa-0-6"]'))
  const receiver = await center(pitch.locator('[data-player-id="home-qa-0-1"]'))
  await page.mouse.click(carrier.x, carrier.y)
  await editor.getByRole('button', { name: 'Pass', exact: true }).click()
  await page.mouse.click(receiver.x, receiver.y)
  await expect(pitch.locator('[aria-label="pass"]')).toHaveCount(1)
  await page.getByRole('slider', { name: 'Timeline position' }).fill('4')
  await expect(pitch.locator('[data-ball]')).toHaveAttribute('data-owner-id', 'home-qa-0-1')
  expect(await pitch.boundingBox()).toEqual(before)

  await page.goto(fixturePath)
  await page.getByRole('button', { name: 'Reconstruct QA dismissal' }).click()
  await expect(pitch.locator('[data-player-id]')).toHaveCount(21)
  await expect(pitch.locator('[data-player-id="home-qa-0-12"]')).toHaveCount(1)
  await editor.getByRole('button', { name: 'Details', exact: true }).click()
  await editor.getByRole('button', { name: 'Teams', exact: true }).click()
  await editor.getByLabel('Manchester United formation').selectOption('5-3-2')
  await expect(pitch.locator('[data-player-id]')).toHaveCount(21)
  await expect(pitch.locator('[data-player-id="home-qa-0-5"]')).toHaveCount(0)
  await expect(page.getByText('Saved locally')).toBeVisible()
  await page.reload()
  await expect(pitch.locator('[data-player-id]')).toHaveCount(21)
})

test('result graphics keep long clubs, two-digit match scores and shootout scores inside title-safe framing', async ({ page, request }, info) => {
  const result = {
    ...fixture.fixture!, revision: 'qa-layout-test', score: [12, 12], shootout: [10, 9], period: 'penalties',
    home: { ...fixture.home, name: 'International Manchester United Football Club' },
    away: { ...fixture.away, name: 'Aston Villa Metropolitan Football Association' },
    source: { kind: 'pack', label: 'Synthetic typography stress test' },
  }
  const match = { home: result.home.name, away: result.away.name, homeShort: 'HOM', awayShort: 'AWY', competition: result.competition, score: '', source: 'Manual line-up' }
  const { newScene } = await import('../../src/domain')
  const scene = newScene()
  const graphic = { id: 'qa-long-result', kind: 'result', title: 'After penalties', subtitle: 'Typography stress test', source: result.source.label, fixture: result }
  const preview = { project: { version: 1, id: 'qa-typography', name: 'QA typography', match, scenes: [scene] }, sceneId: scene.id, cue: 0, time: 0, speed: 1, loop: false, format: '16:9', graphic }
  const created = await request.post('/api/session', { data: { type: 'create', preview } })
  expect(created.status()).toBe(201)
  const session = await created.json()
  const take = await request.post('/api/session?id=' + session.credentials.id, {
    headers: { authorization: 'Bearer ' + session.credentials.token },
    data: { expectedRevision: session.state.revision, action: { type: 'take' } },
  })
  expect(take.ok()).toBe(true)
  await page.setViewportSize({ width: 3840, height: 2160 })
  await page.goto('/output/' + session.credentials.id + '#' + session.state.invites.viewer)
  await expect(page.locator('.result-card-score > strong')).toHaveText('12 – 12')
  await expect(page.locator('.result-card-score > span')).toHaveText('10 – 9 on penalties')
  await expect(page.getByRole('button')).toHaveCount(0)
  for (const locator of [page.locator('.fixture-result-card header'), page.locator('.result-card-match'), page.locator('.fixture-result-card footer')]) {
    const bounds = await locator.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(192)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(3840 - 192)
    expect(bounds!.y).toBeGreaterThanOrEqual(108)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(2160 - 108)
  }
  await capture(page, info, 'qa-long-name-result-4k')
})

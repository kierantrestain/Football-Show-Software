import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test, type Page, type TestInfo } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 900 } })

async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready)
  const body = await page.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: 'disabled' })
  await testInfo.attach(name, { body, contentType: 'image/png' })
  if (process.env.STUDIO_CAPTURE_DOCS === '1') {
    const directory = join(process.cwd(), 'docs', 'screenshots')
    await mkdir(directory, { recursive: true })
    await page.screenshot({ path: join(directory, `${name}.png`), animations: 'disabled' })
  }
}

test('opens the fictional match, checks the full XIs and reconstructs a key moment', async ({ page }, testInfo) => {
  await page.goto('/data?mode=demo')
  await expect(page.getByRole('heading', { name: 'Match intelligence' })).toBeVisible()
  await expect(page.locator('.data-hero-score')).toContainText('2 – 1')
  await expect(page.getByRole('button', { name: 'Reconstruct Owen Reeves opens the scoring' })).toBeVisible()
  await screenshot(page, testInfo, 'match-centre')
  await page.getByRole('button', { name: 'Line-ups' }).click()
  await expect(page.locator('.data-lineup-list > ol > li')).toHaveCount(22)
  await page.getByRole('button', { name: 'Statistics' }).click()
  await expect(page.getByText('Expected goals', { exact: true })).toBeVisible()
  await expect(page.locator('.data-match-stat-list').getByText('—', { exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'Overview' }).click()
  await page.getByRole('button', { name: 'Reconstruct Finn Cole finds the winner' }).click()
  await expect(page).toHaveURL(/\/editor\//)
  await expect(page.locator('[data-player-id]')).toHaveCount(22)
  await expect(page.locator('[data-player-id][aria-label*="Felix Moss"]')).toHaveCount(1)
})

test('compares three real players, queues clean TV graphics and compares five teams', async ({ page, context }, testInfo) => {
  await page.goto('/data?mode=demo')
  await page.getByRole('button', { name: 'Comparisons', exact: true }).click()
  await expect(page.getByRole('columnheader', { name: 'Cole Palmer' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Kevin De Bruyne' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Phil Foden' })).toBeVisible()
  await expect(page.getByRole('row', { name: 'Goals 22 4 19', exact: true })).toBeVisible()
  await screenshot(page, testInfo, 'comparisons')
  await page.getByRole('button', { name: 'Queue comparison' }).click()
  const tv = await context.newPage()
  await tv.setViewportSize({ width: 1920, height: 1080 })
  await tv.goto('/output/local')
  await expect(tv.getByTestId('broadcast-graphic')).toContainText('Player comparison')
  await expect(tv.getByRole('button')).toHaveCount(0)
  await expect(tv.getByTestId('broadcast-graphic')).toContainText('Cole Palmer')
  await screenshot(tv, testInfo, 'graphic-output')
  await tv.close()
  await page.getByRole('button', { name: 'Teams', exact: true }).click()
  await page.getByRole('button', { name: /Aston Villa Premier League/ }).click()
  await page.getByRole('button', { name: /Tottenham Hotspur Premier League/ }).click()
  await expect(page.locator('.comparison-table thead th')).toHaveCount(6)
  await page.getByRole('button', { name: 'Ranking bars' }).click()
  await expect(page.locator('.data-ranking-bars .data-bar-row')).toHaveCount(20)
})

test('saves panel predictions, settles a fictional result, closes submissions and persists totals', async ({ page }, testInfo) => {
  await page.goto('/data?mode=demo')
  await page.getByRole('button', { name: 'Predictions', exact: true }).click()
  await page.getByLabel('Home score').fill('2')
  await page.getByLabel('Away score').fill('0')
  await page.getByLabel('Panel notes').fill('The press decides it.')
  await page.getByRole('button', { name: 'Save prediction' }).click()
  await expect(page.getByText('Prediction saved', { exact: true })).toBeVisible()
  await page.getByText('Enter a fictional result', { exact: true }).click()
  await page.getByLabel('Actual home').fill('2')
  await page.getByLabel('Actual away').fill('0')
  await page.getByRole('button', { name: 'Set result', exact: true }).click()
  await expect(page.getByRole('row', { name: '01 Ana 2 2 6' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save prediction' })).toBeDisabled()
  await page.reload()
  await page.getByRole('button', { name: 'Predictions', exact: true }).click()
  await expect(page.getByLabel('Panel notes')).toHaveValue('The press decides it.')
  await expect(page.getByRole('row', { name: '01 Ana 2 2 6' })).toBeVisible()
  await screenshot(page, testInfo, 'predictions')
  await page.getByRole('button', { name: 'Presenter desk' }).click()
  await page.getByRole('button', { name: 'Start shared session' }).click()
  await expect(page.getByRole('button', { name: 'Connect devices' })).toBeVisible()
  await page.getByRole('button', { name: 'Editor', exact: true }).click()
  await page.getByRole('button', { name: 'Match data', exact: true }).click()
  await page.getByLabel('Competition', { exact: true }).selectOption('demo')
  await page.getByRole('button', { name: 'Predictions', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Producer cutoff override' }).check()
  await expect(page.getByRole('button', { name: 'Save prediction' })).toBeEnabled()
})

test('previews and edits a match graphic before queuing it', async ({ page }, testInfo) => {
  await page.goto('/graphics?mode=demo')
  await expect(page.getByRole('heading', { name: 'Graphics library' })).toBeVisible()
  await expect(page.getByTestId('broadcast-graphic')).toContainText('2 – 1')
  await screenshot(page, testInfo, 'graphics')
  await page.getByRole('button', { name: 'Tactical title', exact: true }).click()
  await page.getByLabel('Title', { exact: true }).fill('The midfield box')
  await expect(page.getByTestId('broadcast-graphic')).toContainText('The midfield box')
  await page.getByRole('button', { name: 'Queue to preview' }).click()
  await expect(page.getByText('Added to studio preview', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Save template' }).click()
  await expect(page.getByText('Template saved in this browser', { exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Tactical title', exact: true }).click()
  await expect(page.getByTestId('broadcast-graphic')).toContainText('The midfield box')
})

test('opens real fixtures by default, previews coverage and preserves the verified result at roster repair', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-11-10T01:13:00Z'))
  await page.goto('/data')
  await expect(page.getByLabel('Competition', { exact: true })).toHaveValue('PL')
  await expect(page.getByLabel('Season', { exact: true })).toHaveValue('2026')
  await expect(page.getByLabel('Data coverage')).toContainText('380/380 fixtures')
  await expect(page.getByLabel('Data coverage')).toContainText('28 awaiting verification')
  await expect(page.locator('.data-hero-score')).toContainText('Manchester United')
  await expect(page.locator('.data-hero-score')).toContainText('Aston Villa')
  await expect(page.locator('.data-hero-score')).toContainText('4 – 4')
  await expect(page.getByText('Independently checked', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Queue match graphic' })).toBeEnabled()
  await screenshot(page, testInfo, 'match-data-review')
  await page.getByRole('button', { name: 'Upcoming', exact: true }).click()
  await expect(page.getByRole('button', { name: /Manchester City Fulham/ })).toBeVisible()
  await page.getByRole('button', { name: 'Results', exact: true }).click()
  await page.getByRole('button', { name: /Manchester United Aston Villa/ }).first().click()
  const repairStart = Date.now()
  await page.getByRole('button', { name: 'Open roster repair' }).click()
  await expect(page.getByRole('region', { name: 'Roster repair status' })).toBeVisible()
  await expect(page.locator('[data-player-id]')).toHaveCount(0)
  console.log('Real fixture result to roster repair took ' + (Date.now() - repairStart) + ' ms after selection.')
})

test('validates an authorised pack before making a squad proposal available', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-10T01:13:00Z'))
  await page.goto('/data')
  const roleCodes = ['GK', 'RB', 'CB', 'CB', 'LB', 'DM', 'CM', 'CM', 'RW', 'ST', 'LW']
  const teams = ['manchester-city', 'fulham']
  const identities = teams.flatMap((team, teamIndex) => roleCodes.map((position, index) => ({
    id: 'synthetic-' + team + '-' + index, name: 'Test identity ' + (teamIndex + 1) + '-' + (index + 1), position, teamId: team,
  })))
  const players = identities.map(({ id, name, position }) => ({ id, name, position }))
  const source = {
    kind: 'pack', label: 'Author-owned synthetic browser test identities', url: 'https://example.com/studio-test',
    permission: 'Synthetic browser test material', checkedAt: '2026-11-10T00:00:00Z', updatedAt: '2026-11-10T00:00:00Z',
  }
  const pack = {
    schema: 1, revision: 'browser-regression', source, players,
    registrations: identities.map(({ id, teamId }) => ({ playerId: id, teamId, competitionId: 'PL', season: '2026/27', eligibleFrom: '2026-08-21' })),
  }
  await page.getByText('Import authorised football records', { exact: true }).click()
  const input = page.getByLabel('Football data pack')
  await input.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...pack, players: [...players, players[0]] })) })
  await expect(page.getByText(/Duplicate player identity/)).toBeVisible()
  await input.setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pack)) })
  await expect(page.getByRole('region', { name: 'Football data import preview' })).toContainText('22 identities')
  await expect(page.getByRole('button', { name: 'Publish verified pack' })).toBeDisabled()
  await page.getByLabel('I am authorised to use these records in the studio.').check()
  await page.getByRole('button', { name: 'Publish verified pack' }).click()
  await expect(page.getByText('Published revision browser-regression in this browser.')).toBeVisible()
  await page.getByRole('button', { name: 'Upcoming', exact: true }).click()
  await page.getByRole('button', { name: /Manchester City Fulham/ }).click()
  await page.getByRole('button', { name: 'Review sourced squad XIs' }).click()
  const proposal = page.getByRole('region', { name: 'Proposed sourced squad line-ups' })
  await expect(proposal.locator('ol > li')).toHaveCount(22)
  await page.getByRole('button', { name: 'Use sourced squad XIs' }).click()
  await expect(page.locator('[data-player-id]')).toHaveCount(22)
  await expect(page.getByRole('region', { name: 'Roster repair status' })).toHaveCount(0)
})

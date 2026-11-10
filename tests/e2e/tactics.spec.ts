import { expect, test, type Locator } from '@playwright/test';

async function screenPoint(pitch: Locator, x: number, y: number) {
  return pitch.evaluate((svg: SVGSVGElement, [worldX, worldY]) => {
    const matrix = svg.getScreenCTM()!;
    const point = new DOMPoint(worldX, worldY).matrixTransform(matrix);
    return { x: point.x, y: point.y };
  }, [x, y]);
}

async function markerPoint(marker: Locator) {
  return marker.evaluate((element: SVGGElement) => {
    const matrix = element.getScreenCTM()!;
    return { x: matrix.e, y: matrix.f };
  });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('svg[aria-label="Football tactics pitch"] [data-player-id]')).toHaveCount(22);
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
});

test('load a full formation, give the ball, move two players and undo the move', async ({ page }) => {
  const editor = page.getByRole('region', { name: 'Tactics editor' });
  const pitch = editor.getByLabel('Football tactics pitch');
  await editor.getByRole('button', { name: 'Teams', exact: true }).click();
  await editor.getByLabel('Northbridge FC formation').selectOption('5-3-2');
  await expect(pitch.locator('[data-player-id][data-side="home"]')).toHaveCount(11);
  await expect(editor.getByLabel('Northbridge FC formation')).toHaveValue('5-3-2');

  const first = pitch.locator('[data-player-id="home-1"]');
  const second = pitch.locator('[data-player-id="home-2"]');
  const ball = pitch.locator('[data-ball]');
  await editor.getByRole('button', { name: 'Ball & possession' }).click();
  let point = await markerPoint(first);
  await page.mouse.click(point.x, point.y);
  const ballBefore = await ball.getAttribute('transform');

  await editor.getByRole('button', { name: 'Select', exact: true }).click();
  point = await markerPoint(second);
  await page.keyboard.down('Shift');
  await page.mouse.click(point.x, point.y);
  await page.keyboard.up('Shift');
  await expect(editor.getByText('2 PLAYERS SELECTED')).toBeVisible();
  const firstBefore = await first.getAttribute('transform');
  const secondBefore = await second.getAttribute('transform');
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 57, point.y + 26, { steps: 12 });
  await page.mouse.up();
  await expect(first).not.toHaveAttribute('transform', firstBefore!);
  await expect(second).not.toHaveAttribute('transform', secondBefore!);
  await expect(ball).not.toHaveAttribute('transform', ballBefore!);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(first).toHaveAttribute('transform', firstBefore!);
  await expect(second).toHaveAttribute('transform', secondBefore!);
  await expect(ball).toHaveAttribute('transform', ballBefore!);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(ball).not.toHaveAttribute('transform', ballBefore!);
});

test('create and reverse a curved run, and scrub a pass deterministically', async ({ page }) => {
  const editor = page.getByRole('region', { name: 'Tactics editor' });
  const pitch = editor.getByLabel('Football tactics pitch');
  const player = pitch.locator('[data-player-id="home-9"]');
  const ball = pitch.locator('[data-ball]');
  const start = await markerPoint(player);
  await page.mouse.click(start.x, start.y);
  await editor.getByRole('button', { name: 'Curved run', exact: true }).click();
  const end = await screenPoint(pitch, 67, 23);
  await page.mouse.click(end.x, end.y);
  await expect(editor.getByRole('button', { name: 'Reverse', exact: true })).toBeVisible();
  await expect(pitch.locator('[data-handle="curve"]')).toHaveCount(1);
  const firstHandle = await pitch.locator('[data-handle="0"] circle').last().getAttribute('cx');
  const lastHandle = await pitch.locator('[data-handle="1"] circle').last().getAttribute('cx');
  await editor.getByRole('button', { name: 'Reverse', exact: true }).click();
  await expect(pitch.locator('[data-handle="0"] circle').last()).toHaveAttribute('cx', lastHandle!);
  await expect(pitch.locator('[data-handle="1"] circle').last()).toHaveAttribute('cx', firstHandle!);

  await editor.getByRole('button', { name: 'Pass', exact: true }).click();
  const receiver = await markerPoint(pitch.locator('[data-player-id="away-0"]'));
  await page.mouse.click(receiver.x, receiver.y);
  await expect(editor.getByLabel('Easing')).toHaveValue('linear');
  const scrub = page.getByRole('slider', { name: 'Timeline position' });
  await scrub.fill('1');
  const ballMiddle = await ball.getAttribute('transform');
  await scrub.fill('3');
  await expect(ball).not.toHaveAttribute('transform', ballMiddle!);
  await scrub.fill('1');
  await expect(ball).toHaveAttribute('transform', ballMiddle!);
});

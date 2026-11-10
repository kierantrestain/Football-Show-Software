import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fixturesFor, validateFootballPack } from '../src/data/footballDataset.js'
import type { LineupPlayer } from '../src/data/model.js'

const input = process.argv[2]
if (!input) throw new Error('Supply the path to an authorised 2026/27 football pack.')
const pack = validateFootballPack(JSON.parse(await readFile(input, 'utf8')))
const match = fixturesFor('PL', '2026', pack).find(item => item.id === 'pl:2026:manchester-united:aston-villa')
assert.equal(match?.kickoff, '2026-11-08T16:30:00Z')
assert.deepEqual(match.score, [4, 4])
assert.equal(match.home.lineupKind, 'confirmed')
assert.equal(match.away.lineupKind, 'confirmed')

function digest(players: LineupPlayer[]) {
  assert.equal(players.length, 11)
  assert.equal(new Set(players.map(player => player.id)).size, 11)
  assert.ok(players.every(player => player.number !== undefined), 'The published team-sheet check requires shirt numbers.')
  const canonical = [...players].sort((a, b) => a.number! - b.number!).map(player =>
    String(player.number) + ':' + player.name.normalize('NFKD').replace(/\p{Mark}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, ''),
  ).join('\n')
  return createHash('sha256').update(canonical).digest('hex')
}

// Fingerprints of shirt and display-name pairs checked against the official team sheets.
// The team sheets remain external evidence and are not redistributed with the review.
assert.equal(digest(match.home.players), '1c8b26a77467b35cfc219995eb78d20f3f99ec646904b79615dc014ac28246da', 'Manchester United starting XI differs from the published reference.')
assert.equal(digest(match.away.players), '7a5ee8f5b40048e316a9aca72f18cf618345901a1f2baca9f1905740496b6ade', 'Aston Villa starting XI differs from the published reference.')
console.log('Confirmed both published United–Villa starting XIs, 22 unique sourced records, and the pinned kickoff and result.')

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { shortDescription } from './text.ts'

test('shortDescription: one line, at most 160 letters, cut at a word', () => {
  assert.equal(shortDescription('  A  deck\nof cards. '), 'A deck of cards.')
  const long = 'word '.repeat(60)
  const d = shortDescription(long)
  assert.ok(d.length <= 160, String(d.length))
  assert.ok(d.endsWith('word…'), d)
  assert.equal(shortDescription('x'.repeat(200)).length, 160)
})

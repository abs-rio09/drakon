import assert from 'node:assert/strict'
import { test } from 'node:test'
import { searchSummary } from './search.ts'

test('search summary: nothing, everything, or "Showing 48 of N"', () => {
  assert.equal(searchSummary('hoodie', 0, 0), 'Nothing found for "hoodie".')
  assert.equal(searchSummary('hoodie', 1, 1), '1 result for "hoodie"')
  assert.equal(searchSummary('hoodie', 7, 7), '7 results for "hoodie"')
  assert.equal(searchSummary('e', 48, 120), 'Showing 48 of 120 results for "e". Add a word to narrow it down.')
})

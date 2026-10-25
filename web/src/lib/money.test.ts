import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatTaka } from './money.ts'

test('formatTaka: whole taka, paisa with 2 digits, Bangladeshi grouping', () => {
  assert.equal(formatTaka(0), '৳0')
  assert.equal(formatTaka(5), '৳0.05')
  assert.equal(formatTaka(59950), '৳599.50')
  assert.equal(formatTaka(125000), '৳1,250')
  assert.equal(formatTaka(210050), '৳2,100.50') // never "৳2,100.5"
  assert.equal(formatTaka(10000000), '৳1,00,000')
  assert.equal(formatTaka(100000000), '৳10,00,000')
  assert.equal(formatTaka(123456789), '৳12,34,567.89')
})

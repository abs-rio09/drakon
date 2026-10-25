import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatPhone, labelRepeatsKind, parseTaka, takaInput, telHref } from './format.ts'

test('parseTaka reads what the admin types, as whole paisa', () => {
  assert.equal(parseTaka('1600'), 160000)
  assert.equal(parseTaka('1,600'), 160000)
  assert.equal(parseTaka('৳ 599.50'), 59950)
  assert.equal(parseTaka('599.5'), 59950)
  assert.equal(parseTaka('0.05'), 5)
  assert.equal(parseTaka(' 10,00,000 '), 100000000)
  // 0.1 + 0.2 style float mistakes cannot happen: 0.29 is exactly 29 paisa.
  assert.equal(parseTaka('0.29'), 29)
})

test('parseTaka refuses anything that is not a price', () => {
  for (const bad of ['', '0', '0.00', '-5', '1.234', '1e3', 'abc', '12.', '.50', '1 600 taka', '1234567890']) {
    assert.equal(parseTaka(bad), null, bad)
  }
})

test('takaInput turns paisa back into an input value', () => {
  assert.equal(takaInput(160000), '1600')
  assert.equal(takaInput(59950), '599.50')
  assert.equal(takaInput(5), '0.05')
  for (const paisa of [1, 99, 100, 59950, 160000, 100000000]) assert.equal(parseTaka(takaInput(paisa)), paisa)
})

test('phone helpers for the admin', () => {
  assert.equal(formatPhone('01712345678'), '01712-345678')
  assert.equal(formatPhone('123'), '123')
  assert.equal(telHref('01712345678'), 'tel:+8801712345678')
})

test('labelRepeatsKind: the same rule as the Go server', () => {
  for (const label of ['Size M', 'size XL', 'SIZE: L', 'Size-  S', '  Size M  ']) {
    assert.match(labelRepeatsKind(label, 'Size'), /Leave out the word “Size”/, label)
  }
  assert.match(labelRepeatsKind('Size M', 'Size'), /type M\./)
  for (const label of ['M', 'Size', 'Sizeable', 'Extra Size M', '']) assert.equal(labelRepeatsKind(label, 'Size'), '', label)
  assert.equal(labelRepeatsKind('Size M', ''), '')
  assert.match(labelRepeatsKind('Material Metal', 'Material'), /type Metal\./)
})

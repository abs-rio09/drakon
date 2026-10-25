import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { isCartStorageKey, loadCart, saveCart } from './cartStorage.ts'

// A tiny stand-in for the browser's localStorage (Node has no window).
function fakeStorage(start: Record<string, string> = {}) {
  const data = { ...start }
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v
    },
  }
}
const g = globalThis as unknown as { window?: { localStorage: unknown } }

beforeEach(() => {
  g.window = { localStorage: fakeStorage() }
})

test('save and load the cart', () => {
  saveCart([{ variantId: 3, qty: 2 }])
  assert.deepEqual(loadCart(), [{ variantId: 3, qty: 2 }])
})

test('broken or odd saved data never crashes: bad lines are dropped', () => {
  for (const raw of ['not json', '{"a":1}', '42', 'null', '']) {
    g.window = { localStorage: fakeStorage({ 'drakon.cart.v1': raw }) }
    assert.deepEqual(loadCart(), [], raw)
  }
  const mixed = JSON.stringify([
    { variantId: 'v-df-paper', qty: 1 }, // old text id
    { variantId: 5, qty: 0 },
    { variantId: 5, qty: 1.5 },
    { variantId: -1, qty: 1 },
    null,
    { variantId: 7, qty: 1 },
  ])
  g.window = { localStorage: fakeStorage({ 'drakon.cart.v1': mixed }) }
  assert.deepEqual(loadCart(), [{ variantId: 7, qty: 1 }])
})

test('localStorage that throws (private mode, blocked, full) does not crash', () => {
  g.window = {
    localStorage: {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    },
  }
  assert.deepEqual(loadCart(), [])
  assert.doesNotThrow(() => saveCart([{ variantId: 1, qty: 1 }]))
  g.window = undefined
  assert.deepEqual(loadCart(), [])
})

test('the storage key check (for other tabs)', () => {
  assert.equal(isCartStorageKey('drakon.cart.v1'), true)
  assert.equal(isCartStorageKey('other'), false)
  assert.equal(isCartStorageKey(null), false)
})

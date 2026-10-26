import assert from 'node:assert/strict'
import { test } from 'node:test'
import { districtAliases } from '../../features/checkout/districtAliases.ts'
import { exactOption, filterOptions, type ComboboxOption } from './comboboxFilter.ts'

// All 64 districts, as the delivery_areas table has them (not A to Z here
// on purpose, so the tests prove the sorting).
const names = `Sylhet Bagerhat Bandarban Barguna Barishal Bhola Bogura Brahmanbaria Chandpur Chapai_Nawabganj Chattogram
Chuadanga Cox's_Bazar Cumilla Dhaka Dinajpur Faridpur Feni Gaibandha Gazipur Gopalganj Habiganj Jamalpur Jashore Jhalokati
Jhenaidah Joypurhat Khagrachhari Khulna Kishoreganj Kurigram Kushtia Lakshmipur Lalmonirhat Madaripur Magura Manikganj
Meherpur Moulvibazar Munshiganj Mymensingh Naogaon Narail Narayanganj Narsingdi Natore Netrokona Nilphamari Noakhali Pabna
Panchagarh Patuakhali Pirojpur Rajbari Rajshahi Rangamati Rangpur Satkhira Shariatpur Sherpur Sirajganj Sunamganj Tangail
Thakurgaon`
  .split(/\s+/)
  .map((n) => n.replace('_', ' '))
const districts: ComboboxOption[] = names.map((n) => ({ value: n, label: n, aliases: districtAliases[n] }))
const labels = (text: string) => filterOptions(districts, text).map((o) => o.label)

test('64 districts in the test list', () => {
  assert.equal(districts.length, 64)
})

test('"s": districts that start with S first (A to Z), then the ones that contain s', () => {
  const got = labels('s')
  assert.deepEqual(got.slice(0, 6), ['Satkhira', 'Shariatpur', 'Sherpur', 'Sirajganj', 'Sunamganj', 'Sylhet'])
  const rest = got.slice(6)
  assert.ok(rest.length > 0)
  assert.deepEqual(rest, [...rest].sort((a, b) => a.localeCompare(b, 'en')))
  for (const name of rest) assert.ok(name.toLowerCase().includes('s') && !name.toLowerCase().startsWith('s'), name)
  assert.ok(rest.includes('Kushtia') && rest.includes("Cox's Bazar"))
  assert.ok(!got.includes('Dhaka'))
})

test('case does not matter, spaces around the text are ignored', () => {
  assert.deepEqual(labels('SYL'), ['Sylhet'])
  assert.deepEqual(labels('  sylhet '), ['Sylhet'])
})

test('old spellings find the official name', () => {
  assert.deepEqual(labels('Chittagong'), ['Chattogram'])
  assert.deepEqual(labels('comilla'), ['Cumilla'])
  assert.deepEqual(labels('Barisal'), ['Barishal'])
  assert.deepEqual(labels('bogra'), ['Bogura'])
  assert.deepEqual(labels('Jessore'), ['Jashore'])
  // An alias that starts with the text counts as "starts with".
  // ("Chittagong" starts with "chit"; Chattogram does not.)
  assert.deepEqual(labels('chit'), ['Chattogram'])
})

test('empty text: every district, A to Z', () => {
  const got = labels('')
  assert.equal(got.length, 64)
  assert.equal(got[0], 'Bagerhat')
  assert.equal(got[63], 'Thakurgaon')
  assert.deepEqual(got, [...names].sort((a, b) => a.localeCompare(b, 'en')))
})

test('no match: an empty list', () => {
  assert.deepEqual(labels('xyz'), [])
})

test('exactOption: full name or alias in any case, nothing for part of a name', () => {
  assert.equal(exactOption(districts, 'sylhet')?.value, 'Sylhet')
  assert.equal(exactOption(districts, ' Chittagong ')?.value, 'Chattogram')
  assert.equal(exactOption(districts, 'Syl'), undefined)
  assert.equal(exactOption(districts, ''), undefined)
})

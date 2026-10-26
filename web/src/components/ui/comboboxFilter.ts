// The list a Combobox shows for what the buyer typed. Pure (no React), so
// npm test can check it: comboboxFilter.test.ts.

export type ComboboxOption = {
  value: string
  label: string
  // Other names people search with, e.g. the old spelling "Chittagong" for
  // Chattogram. They only help finding; the list always shows the label.
  aliases?: readonly string[]
}

// Options whose label or alias STARTS with the text come first, then the
// ones that only contain it; each group A to Z. Case does not matter.
// Empty text = every option, A to Z.
export function filterOptions(options: readonly ComboboxOption[], text: string): ComboboxOption[] {
  const q = text.trim().toLowerCase()
  const starts: ComboboxOption[] = []
  const contains: ComboboxOption[] = []
  for (const o of options) {
    const names = [o.label, ...(o.aliases ?? [])].map((n) => n.toLowerCase())
    if (names.some((n) => n.startsWith(q))) starts.push(o)
    else if (names.some((n) => n.includes(q))) contains.push(o)
  }
  const byLabel = (a: ComboboxOption, b: ComboboxOption) => a.label.localeCompare(b.label, 'en')
  return [...starts.sort(byLabel), ...contains.sort(byLabel)]
}

// The option whose label or alias is exactly the text (any case), if any.
// Leaving the field with "sylhet" typed in full picks Sylhet.
export function exactOption(options: readonly ComboboxOption[], text: string): ComboboxOption | undefined {
  const q = text.trim().toLowerCase()
  if (q === '') return undefined
  return options.find((o) => [o.label, ...(o.aliases ?? [])].some((n) => n.toLowerCase() === q))
}

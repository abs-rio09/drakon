// A product summary as a description: one line, at most about 160 letters.
export function shortDescription(text: string, max = 160): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1)
  return cut.slice(0, cut.lastIndexOf(' ') > 80 ? cut.lastIndexOf(' ') : cut.length) + '…'
}

// The ids an input should list in aria-describedby, so screen readers read
// its hint and its error message together with the label.
export function describedBy(id: string, hint: unknown, error: string | undefined): string | undefined {
  const ids = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean)
  return ids.length > 0 ? ids.join(' ') : undefined
}

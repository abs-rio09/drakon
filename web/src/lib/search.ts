// The search page asks for this many results at once (no paging yet).
export const searchPageSize = 48

// The line above the search results. When there are more matches than one
// page shows, it says so ("Showing 48 of 120 …"), so nothing goes missing
// silently (open question 24).
export function searchSummary(query: string, shown: number, total: number): string {
  if (total === 0) return `Nothing found for "${query}".`
  const noun = total === 1 ? 'result' : 'results'
  if (shown < total) return `Showing ${shown} of ${total} ${noun} for "${query}". Add a word to narrow it down.`
  return `${total} ${noun} for "${query}"`
}

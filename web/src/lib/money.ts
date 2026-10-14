// Money is always whole paisa (1 taka = 100 paisa), never a float.
// This is the ONE place that turns paisa into text like "৳1,250".

const takaFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })

export function formatTaka(paisa: number): string {
  return '৳' + takaFormat.format(paisa / 100)
}

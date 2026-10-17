// Money is always whole paisa (1 taka = 100 paisa), never a float.
// This is the ONE place that turns paisa into text like "৳1,250".

const wholeTaka = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const withPaisa = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// 125000 -> "৳1,250", 210050 -> "৳2,100.50" (never "৳2,100.5").
export function formatTaka(paisa: number): string {
  return '৳' + (paisa % 100 === 0 ? wholeTaka.format(paisa / 100) : withPaisa.format(paisa / 100))
}

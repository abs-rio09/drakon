import { useEffect, useState, type CSSProperties } from 'react'

// The first items of a list rise in one after another (drakon-motion
// skill): only when the list appears after a real wait for its data,
// at most 6 items, --stagger-step (40ms) apart. A list shown from the
// cache (coming back to a page), later re-renders (a filter) and reduced
// motion get no animation.
const MAX_ITEMS = 6

type ItemProps = { className?: string; style?: CSSProperties }

function cssMs(name: string): number {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0
}

// const item = useStagger(state.status); <li {...item(i)}>
export function useStagger(status: 'loading' | 'error' | 'ready'): (index: number) => ItemProps {
  // Was the data missing when the list's page opened?
  const [waited] = useState(status !== 'ready')
  const [done, setDone] = useState(false)
  const playing = waited && status === 'ready' && !done

  // Once the last item has risen, switch off: items that mount later (a
  // filter change) just appear.
  useEffect(() => {
    if (!playing) return
    const ms = cssMs('--duration-slow') + (MAX_ITEMS - 1) * cssMs('--stagger-step')
    const timer = window.setTimeout(() => setDone(true), ms)
    return () => window.clearTimeout(timer)
  }, [playing])

  return (index) =>
    playing && index < MAX_ITEMS
      ? { className: 'motion-safe:animate-rise', style: { animationDelay: `calc(var(--stagger-step) * ${index})` } }
      : {}
}

import type { ReactNode } from 'react'

type SectionHeaderProps = {
  id: string // used by aria-labelledby on the section
  title: string
  intro?: string
  action?: ReactNode // the section link on the right
}

// Title and one-line intro on the left, the section link on the right,
// bottoms aligned (design README, "Layout and spacing").
export function SectionHeader({ id, title, intro, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-4">
      <div className="flex max-w-text flex-col gap-3">
        <h2 id={id} className="text-heading-3 text-ink-strong sm:text-heading-2">
          {title}
        </h2>
        {intro && <p className="text-body text-ink-muted">{intro}</p>}
      </div>
      {action}
    </div>
  )
}

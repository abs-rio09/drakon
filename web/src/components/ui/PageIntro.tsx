import type { ReactNode } from 'react'

type PageIntroProps = {
  title: string
  children?: ReactNode
}

// The title block at the top of simple pages: a heading and a short intro.
export function PageIntro({ title, children }: PageIntroProps) {
  return (
    <div className="flex max-w-form flex-col gap-3">
      <h1 className="text-heading-2 text-ink-strong sm:text-heading-1">{title}</h1>
      {children && <div className="max-w-text text-body-lg text-ink-muted">{children}</div>}
    </div>
  )
}

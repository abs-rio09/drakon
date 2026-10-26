import { useEffect, useRef, type ReactNode } from 'react'
import { CloseIcon } from '../icons'
import { pressable } from './styles'

// A panel that slides in from the right edge over a dim backdrop (the phone
// menu). Built on the native <dialog> opened with showModal(), so the
// browser does the hard parts: the rest of the page cannot be reached
// (focus stays inside), Esc closes it, and focus goes back to the button
// that opened it. We add: tap outside closes, the page behind does not
// scroll (index.css), and the slide (drakon-motion skill): in 400ms
// ease-out, out 250ms ease-in, a plain fade under reduced motion. Browsers
// without @starting-style just open it without the slide.

type SheetProps = {
  id: string
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
}

export function Sheet({ id, title, open, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      id={id}
      aria-labelledby={`${id}-title`}
      // Esc, or close() above: tell the parent.
      onClose={onClose}
      // The panel's content fills the whole dialog, so a click whose target
      // is the dialog itself landed on the backdrop (outside the panel).
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      // The browser lets Tab leave a modal for its own toolbar; wrap
      // instead, so focus really stays in the sheet.
      onKeyDown={(e) => {
        if (e.key !== 'Tab') return
        const items = e.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)')
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }}
      className={
        'sheet fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-[min(20rem,85vw)] max-w-none border-l border-line bg-surface-raised p-0 text-ink shadow-overlay ' +
        // Closed state (and where it leaves to): off the edge, see-through.
        'translate-x-full opacity-0 transition-[translate,opacity,display,overlay] transition-discrete duration-base ease-in-drakon ' +
        'open:translate-x-0 open:opacity-100 open:duration-slow open:ease-out-drakon starting:open:translate-x-full starting:open:opacity-0 ' +
        'motion-reduce:translate-x-0 motion-reduce:duration-fast motion-reduce:open:duration-fast motion-reduce:starting:open:translate-x-0 ' +
        // The dim backdrop fades with it.
        'backdrop:bg-scrim backdrop:opacity-0 backdrop:transition-[opacity,display,overlay] backdrop:transition-discrete backdrop:duration-base ' +
        'open:backdrop:opacity-100 open:backdrop:duration-slow starting:open:backdrop:opacity-0 motion-reduce:backdrop:duration-fast'
      }
    >
      <div className="flex h-full flex-col p-2">
        <div className="flex min-h-18 items-center justify-between pr-1 pl-4">
          <h2 id={`${id}-title`} className="text-title text-ink-strong">
            {title}
          </h2>
          <button
            type="button"
            aria-label={`Close ${title.toLowerCase()}`}
            onClick={onClose}
            className={'grid size-11 place-items-center rounded-full text-ink-muted hover:bg-field hover:text-ink-strong ' + pressable}
          >
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}

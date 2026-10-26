import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { CheckIcon, ChevronDownIcon } from '../icons'
import { exactOption, filterOptions, type ComboboxOption } from './comboboxFilter'
import { inputClass } from './Field'

// A text box with a list to choose from (WAI-ARIA "combobox with listbox
// popup"). Typing filters the list; only an option from the list can be
// chosen. Used for the district at checkout instead of a native <select>,
// whose list covers the field and cannot be searched.
//
// Keys: Down/Up move the highlight (and wrap), Enter picks, Tab picks and
// moves on, Esc closes and keeps the old value. Leaving the field with
// text that is no option puts the last choice back.

type ComboboxProps = {
  id: string
  name: string
  // Read out as the list's name ("Districts").
  listLabel: string
  value: string
  options: readonly ComboboxOption[]
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  noMatchText: string
  required?: boolean
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

export function Combobox({
  id,
  name,
  listLabel,
  value,
  options,
  onChange,
  onBlur,
  placeholder,
  noMatchText,
  required,
  ...aria
}: ComboboxProps) {
  // What the buyer typed, or null while they are not typing (then the box
  // shows the chosen option). A ref too, so a blur right after Tab sees
  // the pick even before React re-renders.
  const [text, setTextState] = useState<string | null>(null)
  const textRef = useRef<string | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const listRef = useRef<HTMLUListElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const listId = `${id}-listbox`
  const optionId = (i: number) => `${id}-option-${i}`
  const shown = filterOptions(options, text ?? '')
  const chosen = options.find((o) => o.value === value)

  function setText(next: string | null) {
    textRef.current = next
    setTextState(next)
  }

  function openList() {
    setOpen(true)
    // Start on the current choice, so the list opens where the buyer is.
    const i = shown.findIndex((o) => o.value === value)
    setActive(i >= 0 ? i : 0)
  }

  function close() {
    setText(null)
    setOpen(false)
    setActive(-1)
    // Still in the box (Esc, Enter, a tap): select the shown name, so the
    // next letter typed starts a new search instead of adding to it.
    requestAnimationFrame(() => {
      if (document.activeElement === inputRef.current) inputRef.current?.select()
    })
  }

  function pick(option: ComboboxOption) {
    onChange(option.value)
    close()
  }

  // Keep the highlighted row in view while moving with the keys.
  useEffect(() => {
    if (!open || active < 0) return
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const n = shown.length
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault()
        if (!open) openList()
        else if (n > 0) setActive((a) => (e.key === 'ArrowDown' ? (a + 1) % n : (a - 1 + n) % n))
        break
      case 'Enter':
        if (!open) return // Enter on a closed box sends the form, like any input
        e.preventDefault()
        if (shown[active]) pick(shown[active])
        break
      case 'Tab':
        if (open && shown[active]) pick(shown[active])
        break
      case 'Escape':
        if (open || text !== null) {
          e.preventDefault()
          close()
        }
        break
    }
  }

  function onInputBlur() {
    const typed = textRef.current
    if (typed !== null) {
      // "sylhet" typed in full counts as Sylhet; anything else is undone.
      const match = exactOption(options, typed)
      if (match) pick(match)
      else close()
    } else close()
    onBlur?.()
  }

  const activeId = open && shown[active] ? optionId(active) : undefined
  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeId}
        {...aria}
        value={text ?? chosen?.label ?? ''}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        // Typing replaces the shown name instead of adding to it.
        onFocus={(e) => e.currentTarget.select()}
        onClick={(e) => {
          if (textRef.current === null) e.currentTarget.select()
          if (!open) openList()
        }}
        onKeyDown={onKeyDown}
        onBlur={onInputBlur}
        className={inputClass + ' pr-12'}
      />
      <ChevronDownIcon
        className={
          'pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ink-muted transition-transform duration-150 ease-out motion-reduce:transition-none ' +
          (open ? 'rotate-180' : '')
        }
      />
      {/* Always below the box, never over it. mousedown is cancelled so a
          tap on the list does not take the focus away from the box. */}
      <div
        hidden={!open}
        onMouseDown={(e) => e.preventDefault()}
        className="absolute inset-x-0 top-full z-10 mt-2 overflow-hidden rounded-xl border border-line-strong bg-surface-raised shadow-overlay"
      >
        {/* About 6 rows of 44px, then it scrolls inside. */}
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={listLabel}
          hidden={shown.length === 0}
          className="max-h-68 overflow-y-auto overscroll-contain p-1">
          {shown.map((o, i) => {
            const isChosen = o.value === value
            return (
              <li
                key={o.value}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                onMouseMove={() => setActive(i)}
                onClick={() => pick(o)}
                className={
                  'flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-body ' +
                  (i === active ? 'bg-line text-ink-strong' : 'text-ink') +
                  (isChosen ? ' font-medium' : '')
                }
              >
                {o.label}
                {isChosen && <CheckIcon size={16} className="shrink-0 text-ink-muted" />}
              </li>
            )
          })}
        </ul>
        {shown.length === 0 && (
          <p aria-hidden="true" className="flex min-h-11 items-center px-4 text-body text-ink-subtle">
            {noMatchText}
          </p>
        )}
      </div>
      {/* Screen readers hear when nothing matches. */}
      <span role="status" className="sr-only">
        {open && shown.length === 0 ? noMatchText : ''}
      </span>
    </div>
  )
}

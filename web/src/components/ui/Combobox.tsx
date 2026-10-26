import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { CheckIcon, ChevronDownIcon } from '../icons'
import { exactOption, filterOptions, type ComboboxOption } from './comboboxFilter'
import { inputClass } from './Field'

// A text box with a list to choose from (WAI-ARIA "combobox with listbox
// popup"). Typing filters the list. Two modes:
// - choose (default): only an option from the list can be chosen. Used for
//   the district at checkout instead of a native <select>, whose list
//   covers the field and cannot be searched. Leaving the field with text
//   that is no option puts the last choice back.
// - freeText: any text is fine and the list only suggests (Area / Thana:
//   "Mirpur 10" is a good answer). Nothing is highlighted until Down/Up,
//   so Enter and Tab never replace what the buyer typed by surprise.
//
// Keys: Down/Up move the highlight (and wrap), Enter picks, Tab picks and
// moves on, Esc closes (choose mode: and keeps the old value).

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
  // Shown when nothing matches (choose mode only; free text needs no list).
  noMatchText?: string
  freeText?: boolean
  disabled?: boolean
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
  freeText = false,
  disabled,
  required,
  ...aria
}: ComboboxProps) {
  // Choose mode: what the buyer typed, or null while they are not typing
  // (then the box shows the chosen option). A ref too, so a blur right after
  // Tab sees the pick even before React re-renders. Free text mode keeps
  // the typed text in value itself.
  const [text, setTextState] = useState<string | null>(null)
  const textRef = useRef<string | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const listRef = useRef<HTMLUListElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const listId = `${id}-listbox`
  const optionId = (i: number) => `${id}-option-${i}`
  const shown = filterOptions(options, freeText ? value : (text ?? ''))
  const chosen = options.find((o) => o.value === value)
  // Free text with no matching suggestion: no list at all.
  const visible = open && (shown.length > 0 || !freeText)

  function setText(next: string | null) {
    textRef.current = next
    setTextState(next)
  }

  function openList() {
    setOpen(true)
    // Start on the current choice, so the list opens where the buyer is.
    const i = shown.findIndex((o) => o.value === value)
    setActive(i >= 0 ? i : freeText ? -1 : 0)
  }

  function close() {
    setText(null)
    setOpen(false)
    setActive(-1)
    // Still in the box (Esc, Enter, a tap): select the shown name, so the
    // next letter typed starts a new search instead of adding to it.
    if (freeText) return
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
        else if (n > 0) setActive((a) => (e.key === 'ArrowDown' ? (a + 1) % n : a <= 0 ? n - 1 : a - 1))
        break
      case 'Enter':
        if (!visible) return // Enter on a closed box sends the form, like any input
        e.preventDefault()
        if (shown[active]) pick(shown[active])
        else close()
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
    if (!freeText && typed !== null) {
      // "sylhet" typed in full counts as Sylhet; anything else is undone.
      const match = exactOption(options, typed)
      if (match) pick(match)
      else close()
    } else close()
    onBlur?.()
  }

  const activeId = visible && shown[active] ? optionId(active) : undefined
  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={listId}
        aria-activedescendant={activeId}
        {...aria}
        value={freeText ? value : (text ?? chosen?.label ?? '')}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        onChange={(e) => {
          if (freeText) onChange(e.target.value)
          else setText(e.target.value)
          setOpen(true)
          setActive(freeText ? -1 : 0)
        }}
        // Choose mode: typing replaces the shown name instead of adding to it.
        onFocus={(e) => {
          if (!freeText) e.currentTarget.select()
        }}
        onClick={(e) => {
          if (!freeText && textRef.current === null) e.currentTarget.select()
          if (!open) openList()
        }}
        onKeyDown={onKeyDown}
        onBlur={onInputBlur}
        className={inputClass + ' pr-12 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line-strong'}
      />
      <ChevronDownIcon
        className={
          'pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ink-muted transition-transform duration-150 ease-out motion-reduce:transition-none ' +
          (visible ? 'rotate-180' : '')
        }
      />
      {/* Always below the box, never over it. mousedown is cancelled so a
          tap on the list does not take the focus away from the box. */}
      <div
        hidden={!visible}
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
          className="max-h-68 overflow-y-auto overscroll-contain p-1"
        >
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
        {visible && shown.length === 0 ? noMatchText : ''}
      </span>
    </div>
  )
}

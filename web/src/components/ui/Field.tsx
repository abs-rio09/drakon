import type { ReactNode } from 'react'
import { AlertIcon } from '../icons'

// Form field parts, from docs/design/components/Input/README.md:
// a visible label, the input, then an optional hint and an error line.

export const inputClass =
  'block min-h-12 w-full rounded-xl border border-line-strong bg-field px-4 py-3 text-body text-ink transition-colors duration-150 ease-out placeholder:text-ink-subtle hover:border-ink-subtle aria-invalid:border-danger-text'

type FieldProps = {
  id: string
  label: string
  required?: boolean
  optional?: boolean
  hint?: ReactNode
  error?: string
  children: ReactNode
}

export function Field({ id, label, required, optional, hint, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label text-ink-muted">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1 text-accent-text">
            *
          </span>
        )}
        {optional && <span className="ml-1 font-normal text-ink-subtle">(optional)</span>}
      </label>
      {children}
      {hint && (
        <span id={`${id}-hint`} className="text-caption text-ink-subtle">
          {hint}
        </span>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  )
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <span id={id} className="flex items-start gap-2 text-caption text-danger-text">
      <AlertIcon size={16} className="mt-px shrink-0" />
      {children}
    </span>
  )
}

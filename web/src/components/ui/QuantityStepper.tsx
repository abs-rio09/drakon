import { MinusIcon, PlusIcon } from '../icons'

type QuantityStepperProps = {
  value: number
  min?: number
  max: number
  onChange: (next: number) => void
  label: string // accessible name of the group, for example "Quantity"
  // 'md' on the product page (48px wide buttons), 'sm' in the cart (44px).
  size?: 'md' | 'sm'
}

// The − 1 + control. The buttons switch off at the limits.
export function QuantityStepper({ value, min = 1, max, onChange, label, size = 'md' }: QuantityStepperProps) {
  const stepButton =
    (size === 'md' ? 'h-11.5 w-12' : 'h-10.5 w-11') +
    ' grid place-items-center text-ink transition-colors duration-fast ease-out-drakon enabled:hover:bg-field disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <div role="group" aria-label={label} className="inline-flex items-center rounded-xl border border-line-strong">
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className={stepButton + ' rounded-l-[9px]'}
      >
        <MinusIcon size={16} />
      </button>
      <span aria-live="polite" className={(size === 'md' ? 'min-w-8' : 'min-w-7') + ' text-center text-body font-medium text-ink-strong tabular-nums'}>
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className={stepButton + ' rounded-r-[9px]'}
      >
        <PlusIcon size={16} />
      </button>
    </div>
  )
}

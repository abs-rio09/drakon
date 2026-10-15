import { useEffect, useState } from 'react'
import { CheckIcon } from '../icons'
import { button } from '../ui/styles'

// Copies text (the order number) and says "Copied" for a moment.
export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState<boolean | 'failed'>(false)

  useEffect(() => {
    if (copied === false) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      // Old browser or no permission: the number is on screen to copy by hand.
      setCopied('failed')
    }
  }

  return (
    <>
      <button type="button" onClick={copy} className={button('secondary', 'sm')}>
        {copied === true && <CheckIcon size={16} />}
        {copied === true ? 'Copied' : label}
      </button>
      <span role="status" className="sr-only">
        {copied === true ? 'Order number copied' : copied === 'failed' ? 'Could not copy. Select the number to copy it.' : ''}
      </span>
    </>
  )
}

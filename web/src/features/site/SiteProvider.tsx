import type { ReactNode } from 'react'
import { LogoContent } from '../../components/Logo'
import { LoadError } from '../../components/ui/LoadState'
import { getDeliveryInfo, getPublicSettings } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { SiteContext } from './SiteContext'

const loadSite = () => Promise.all([getPublicSettings(), getDeliveryInfo()])

// Loads the settings and delivery charges before showing any page, so no
// page ever shows a made-up number. Business numbers come only from the API.
export function SiteProvider({ children }: { children: ReactNode }) {
  const site = useApi('site', loadSite)

  if (site.status !== 'ready') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
        <span className="inline-flex items-center gap-2">
          <LogoContent />
        </span>
        {site.status === 'error' ? (
          <LoadError error={site.error} onRetry={site.reload} />
        ) : (
          // The free API server sleeps when nobody visits, so the first visit can take a while.
          <p role="status" className="text-body text-ink-subtle motion-safe:animate-pulse">
            Opening the shop…
          </p>
        )}
      </div>
    )
  }

  const [settings, delivery] = site.data
  return <SiteContext value={{ settings, delivery }}>{children}</SiteContext>
}

import { createContext, useContext } from 'react'
import type { DeliveryInfo, PublicSettings } from '../../lib/types'

// Data almost every page needs: the business numbers and delivery charges.
// Loaded once when the site opens (see SiteProvider).
export type SiteData = {
  settings: PublicSettings
  delivery: DeliveryInfo
}

export const SiteContext = createContext<SiteData | null>(null)

export function useSite(): SiteData {
  const site = useContext(SiteContext)
  if (!site) throw new Error('useSite must be used inside <SiteProvider>')
  return site
}

import { PageIntro } from '../components/ui/PageIntro'
import { container } from '../components/ui/styles'

// Temporary page body while a route is being built.
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className={container + ' py-20'}>
      <PageIntro title={title}>
        <p>This page is being built.</p>
      </PageIntro>
    </div>
  )
}

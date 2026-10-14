import { Link } from 'react-router'
import { PageIntro } from '../components/ui/PageIntro'
import { container, primaryButton } from '../components/ui/styles'
import { settings } from '../mocks/settings'

// /about — the brand story, from docs/brand-vision.md.
const PEOPLE = ['Night workers', 'Dream chasers', 'Gamers', 'Coders', 'Creative minds', 'Silent hardworking people']

export default function About() {
  return (
    <div className="flex flex-col">
      <title>About: Drakon</title>
      <section className={container + ' flex flex-col gap-10 pt-16 pb-20 sm:pt-20 lg:pb-32'}>
        <PageIntro title="Made for the night shift">
          <p>Drakon makes limited playcards, sports toys, tech toys and clothes in Bangladesh.</p>
        </PageIntro>
        <blockquote
          lang="bn"
          className="max-w-200 border-l border-line-strong pl-6 font-bengali text-heading-3 leading-[1.75] font-medium text-ink-strong sm:text-heading-2 sm:leading-[1.6]"
        >
          রাত গভীর হলে যেসব মানুষ জেগে থেকে পৃথিবীর মানুষের জন্য অনেক কিছু করার চেষ্টা করে, তাদের জন্য আমাদের পক্ষ থেকে এই উপহার।
        </blockquote>
      </section>

      <section aria-labelledby="name-title" className="border-y border-line">
        <div className={container + ' grid gap-10 py-20 lg:grid-cols-2 lg:gap-20 lg:py-32'}>
          <div className="flex flex-col gap-4">
            <h2 id="name-title" className="text-heading-3 text-ink-strong sm:text-heading-2">
              The name
            </h2>
            <p className="text-body-lg text-ink-muted">
              Drakon comes from "dark". When the night gets deep, some people stay awake and keep working for everyone
              else. Drakon is our gift to them.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <h2 className="text-label text-ink-muted">Who it is for</h2>
            <ul className="grid grid-cols-2 gap-x-8 border-t border-line">
              {PEOPLE.map((p) => (
                <li key={p} className="border-b border-line py-3 text-body text-ink">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="how-title">
        <div className={container + ' grid gap-10 py-20 lg:grid-cols-3 lg:gap-10 lg:py-32'}>
          <h2 id="how-title" className="text-heading-3 text-ink-strong sm:text-heading-2 lg:col-span-3">
            How we make things
          </h2>
          {[
            {
              title: 'Made once',
              text: 'Each limited piece is one run. When it sells out, it moves to the archive and is never made again.',
            },
            {
              title: 'Design first',
              text: 'Every piece starts with original art, a clean layout and materials that feel premium in the hand.',
            },
            {
              title: 'Easy to buy',
              text: `Cash on Delivery across Bangladesh. We call you within ${settings.codConfirmHours} hours to confirm before we ship.`,
            },
          ].map((item) => (
            <div key={item.title} className="flex flex-col gap-3 border-t border-line pt-6">
              <h3 className="text-title text-ink-strong">{item.title}</h3>
              <p className="text-body text-ink-muted">{item.text}</p>
            </div>
          ))}
          <div className="lg:col-span-3">
            <Link to="/shop" className={primaryButton}>
              Shop the drop
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { PageMeta } from '../components/ui/PageMeta'
import { PageIntro } from '../components/ui/PageIntro'
import { container, inlineLink } from '../components/ui/styles'
import { useSite } from '../features/site/SiteContext'

// Return / Terms / Privacy. The text is a PLACEHOLDER until Abu Bakkar Siddik
// writes the real policies; the numbers come from settings, not from here.

type Section = { heading: string; body: ReactNode }

function PolicyPage({ title, intro, sections }: { title: string; intro: string; sections: Section[] }) {
  return (
    <div className={container + ' flex flex-col gap-14 py-16 sm:py-20'}>
      <PageMeta title={`${title}: Drakon`} description={intro} />
      <PageIntro title={title}>
        <p>{intro}</p>
        <p className="mt-2 text-caption text-ink-subtle">Draft text. The final policy will replace it before launch.</p>
      </PageIntro>
      <div className="flex max-w-form flex-col gap-10">
        {sections.map((s) => (
          <section key={s.heading} className="flex flex-col gap-3">
            <h2 className="text-heading-3 text-ink-strong">{s.heading}</h2>
            <div className="flex flex-col gap-3 text-body text-ink">{s.body}</div>
          </section>
        ))}
      </div>
    </div>
  )
}

export function ReturnsPolicy() {
  const days = useSite().settings.returnDays
  return (
    <PolicyPage
      title="Returns and refunds"
      intro={`You can return any order within ${days} days of delivery, for any reason.`}
      sections={[
        {
          heading: 'How to return',
          body: (
            <p>
              <Link to="/contact" className={inlineLink}>
                Contact us
              </Link>{' '}
              within {days} days of delivery with your order number and the phone number you ordered with. We arrange the
              pickup or tell you where to send it.
            </p>
          ),
        },
        {
          heading: 'Condition',
          body: <p>Items must be unused, with tags on, and in their original packaging or sleeve.</p>,
        },
        {
          heading: 'Refunds',
          body: (
            <p>
              Once we receive the item and check it, we refund you by bKash, Nagad or cash. [Who pays the delivery charge
              when the return is not our fault.]
            </p>
          ),
        },
      ]}
    />
  )
}

export function TermsPolicy() {
  const hours = useSite().settings.codConfirmHours
  return (
    <PolicyPage
      title="Terms"
      intro="The rules for buying from Drakon."
      sections={[
        {
          heading: 'Orders and payment',
          body: (
            <>
              <p>All orders are Cash on Delivery. You pay the courier in cash when the parcel arrives.</p>
              <p>
                We call you within {hours} hours to confirm your order. Orders we cannot confirm in that time are cancelled
                automatically.
              </p>
            </>
          ),
        },
        {
          heading: 'Prices and stock',
          body: (
            <p>
              Prices are in Bangladeshi taka. Limited runs are made once and are never restocked. Each product has a limit
              per customer, shown next to the quantity.
            </p>
          ),
        },
        {
          heading: 'Cancelling',
          body: <p>You can cancel an order from the Track order page until it ships.</p>,
        },
        { heading: 'More', body: <p>[Full terms to be written.]</p> },
      ]}
    />
  )
}

export function PrivacyPolicy() {
  return (
    <PolicyPage
      title="Privacy"
      intro="What we keep about you, and why."
      sections={[
        {
          heading: 'What we collect',
          body: (
            <p>
              Your name, phone number, delivery address and, if you give it, your email. We need them to deliver your
              order and to call you to confirm it.
            </p>
          ),
        },
        {
          heading: 'On this device',
          body: (
            <p>
              Your cart (which items and how many) is stored in this browser only. Nothing personal is stored in the
              browser.
            </p>
          ),
        },
        {
          heading: 'Sharing',
          body: <p>We share your name, phone and address only with the courier who delivers your order.</p>,
        },
        { heading: 'More', body: <p>[Full privacy policy to be written.]</p> },
      ]}
    />
  )
}

import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { MailIcon, PhoneIcon } from '../components/icons'
import { PageIntro } from '../components/ui/PageIntro'
import { container, inlineLink, textLink } from '../components/ui/styles'
import { contact } from '../mocks/contact'
import { settings } from '../mocks/settings'

// /contact — how to reach Drakon. The details are placeholders in
// src/mocks/contact.ts until Abu Bakkar Siddik decides them.
export default function Contact() {
  return (
    <div className={container + ' flex flex-col gap-14 py-16 sm:py-20'}>
      <title>Contact: Drakon</title>
      <PageIntro title="Contact">
        <p>Questions about an order, a return or a piece? Reach us here.</p>
      </PageIntro>

      <ul className="grid max-w-form gap-x-10 border-t border-line sm:grid-cols-2">
        <ContactRow icon={<PhoneIcon size={18} />} label="Phone">
          {contact.phone ? (
            <a href={`tel:${contact.phone}`} className={textLink + ' text-ink-strong tabular-nums'}>
              {contact.phone}
            </a>
          ) : (
            <NotSetYet />
          )}
        </ContactRow>
        <ContactRow icon={<MailIcon size={18} />} label="Email">
          {contact.email ? (
            <a href={`mailto:${contact.email}`} className={textLink + ' text-ink-strong'}>
              {contact.email}
            </a>
          ) : (
            <NotSetYet />
          )}
        </ContactRow>
        <ContactRow label="Facebook">
          {contact.facebookUrl ? (
            <a href={contact.facebookUrl} target="_blank" rel="noreferrer" className={textLink + ' text-ink-strong'}>
              Drakon on Facebook
            </a>
          ) : (
            <NotSetYet />
          )}
        </ContactRow>
        <ContactRow label="Hours">{contact.hours ?? <NotSetYet />}</ContactRow>
      </ul>

      <section aria-labelledby="help-title" className="flex max-w-form flex-col gap-6">
        <h2 id="help-title" className="text-heading-3 text-ink-strong">
          Before you write
        </h2>
        <dl className="flex flex-col border-t border-line">
          <div className="flex flex-col gap-1 border-b border-line py-4">
            <dt className="text-body font-medium text-ink-strong">Where is my order?</dt>
            <dd className="text-body text-ink-muted">
              Check the{' '}
              <Link to="/track" className={inlineLink}>
                Track order
              </Link>{' '}
              page with your order number and phone.
            </dd>
          </div>
          <div className="flex flex-col gap-1 border-b border-line py-4">
            <dt className="text-body font-medium text-ink-strong">I want to return something</dt>
            <dd className="text-body text-ink-muted">
              Contact us within {settings.returnDays} days of delivery with your order number. See the{' '}
              <Link to="/policies/returns" className={inlineLink}>
                return policy
              </Link>
              .
            </dd>
          </div>
          <div className="flex flex-col gap-1 border-b border-line py-4">
            <dt className="text-body font-medium text-ink-strong">When will you call me?</dt>
            <dd className="text-body text-ink-muted">
              Within {settings.codConfirmHours} hours of your order, to confirm it before we ship.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}

function ContactRow({ icon, label, children }: { icon?: ReactNode; label: string; children: ReactNode }) {
  return (
    <li className="flex gap-4 border-b border-line py-5">
      <span className="mt-0.5 w-4.5 shrink-0 text-ink-muted">{icon}</span>
      <div className="flex flex-col gap-1">
        <span className="text-label text-ink-muted">{label}</span>
        <span className="text-body text-ink">{children}</span>
      </div>
    </li>
  )
}

function NotSetYet() {
  return <span className="text-ink-subtle">Coming soon</span>
}

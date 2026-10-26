import { Link } from 'react-router'
import { ArrowUpRightIcon } from '../components/icons'
import { ArchiveCard } from '../components/product/ArchiveCard'
import { ProductGrid } from '../components/product/ProductCard'
import { Loaded, ProductGridSkeleton } from '../components/ui/LoadState'
import { PageMeta } from '../components/ui/PageMeta'
import { SectionHeader } from '../components/ui/SectionHeader'
import { button, container, secondaryButton, textLink } from '../components/ui/styles'
import { useSite } from '../features/site/SiteContext'
import { getCategories, getFeatured, getProducts, getSoldOut } from '../lib/api'
import { metaLine, priceLabel, stockFact } from '../lib/catalog'
import { zoneCharge } from '../lib/delivery'
import { formatTaka } from '../lib/money'
import { useApi } from '../lib/useApi'

// Every product on sale, for the collection counts (the shop has under 100).
const loadShop = () => getProducts({ limit: 100 })

// Home page, laid out from docs/design/screens/Main.dc.html
export default function Home() {
  return (
    <>
      <PageMeta title="Drakon: made once, never again" />
      <Hero />
      <Facts />
      <CurrentDrop />
      <BrandStory />
      <Collections />
      <ArchivePreview />
    </>
  )
}

const sectionPadding = 'py-20 sm:py-24 lg:py-32'

function Hero() {
  const { settings } = useSite()
  const featured = useApi('featured', getFeatured)
  // The label appears when the data arrives; the photo and headline do not wait.
  const product = featured.data?.hero

  return (
    // The hero slides up under the sticky header (72px bar + 1px line), so the
    // photo starts at the very top and the header sits over it.
    <section
      aria-labelledby="hero-title"
      className="relative -mt-[73px] flex flex-col xl:min-h-200 xl:flex-row xl:items-center"
    >
      {/* Photo: full-bleed behind the text on wide screens, on top on smaller ones */}
      <div className="relative aspect-[4/5] overflow-hidden md:aspect-video xl:absolute xl:inset-0 xl:aspect-auto">
        <picture>
          <source media="(min-width: 768px)" srcSet="/img/hero-wide.webp" width={1680} height={880} />
          <img
            src="/img/hero-tall.webp"
            width={900}
            height={1125}
            fetchPriority="high"
            decoding="async"
            alt="Dragon Flame playcards fanned on dark slate beside their box, lit by one warm light"
            className="size-full object-cover object-center motion-safe:animate-hero-in xl:object-right"
          />
        </picture>
        {/* Darkens the left side so the headline reads, and fades into the page at the bottom */}
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden bg-linear-to-r from-surface/90 via-surface/55 via-30% to-transparent to-56% xl:block"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-b from-surface/60 via-transparent via-22% to-surface xl:from-transparent xl:via-transparent xl:via-72%"
        />
      </div>

      {/* Gallery label for the product in the photo */}
      {product && (
        <Link
          to={`/product/${product.slug}`}
          aria-label={`${product.name}, ${priceLabel(product)}, ${stockFact(product, settings)}`}
          className="relative z-10 mx-4 -mt-12 flex flex-col gap-3 self-stretch rounded-2xl border border-line bg-surface-glass p-4 shadow-label backdrop-blur-xl transition-colors duration-fast ease-out-drakon hover:border-line-strong motion-safe:animate-rise motion-safe:[animation-delay:480ms] sm:mx-6 md:-mt-14 md:w-64 md:self-end xl:absolute xl:right-[max(32px,calc((100%-1280px)/2+32px))] xl:bottom-6 xl:mx-0 xl:mt-0"
        >
          <span className="flex flex-col gap-1">
            <span className="text-body font-medium text-ink-strong">{product.name}</span>
            <span className="text-caption text-ink-muted">{metaLine(product)}</span>
          </span>
          <span className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
            <span className="text-price text-ink-strong tabular-nums">{priceLabel(product)}</span>
            <span className="text-figure text-ink-muted tabular-nums">{stockFact(product, settings)}</span>
          </span>
        </Link>
      )}

      <div className={container + ' relative z-10 xl:order-first'}>
        <div className="flex max-w-135 flex-col items-start gap-8 pt-8 pb-6 xl:pt-20 xl:pb-0 [&>*]:motion-safe:animate-rise [&>*:nth-child(2)]:[animation-delay:120ms] [&>*:nth-child(3)]:[animation-delay:240ms] [&>*:nth-child(4)]:[animation-delay:360ms]">
          <h1 id="hero-title" className="flex flex-col text-display-sm text-ink-strong md:text-display-md lg:text-display">
            <span>Made once.</span>
            <span>Never again.</span>
          </h1>
          <p className="max-w-115 text-body-lg text-ink-muted">
            Limited playcards, sports toys, tech toys and clothes for people who come alive at night. Each product is one
            run. When it sells out, it goes to the archive for good.
          </p>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-1">
            <Link to="/shop" className={button('primary', 'hero')}>
              Shop the drop
            </Link>
            <Link to="/sold-out" className={textLink + ' text-body font-medium text-ink'}>
              See the archive
            </Link>
          </div>
          <span className="text-caption text-ink-subtle">Cash on Delivery across Bangladesh</span>
        </div>
      </div>
    </section>
  )
}

function Facts() {
  const { delivery } = useSite()
  const inside = zoneCharge(delivery, 'INSIDE_DHAKA')
  const outside = zoneCharge(delivery, 'OUTSIDE_DHAKA')
  const facts = [
    { title: 'Cash on Delivery', text: 'Pay the courier when it arrives' },
    ...(inside !== undefined ? [{ title: `${formatTaka(inside)} inside Dhaka`, text: 'Delivery charge' }] : []),
    ...(outside !== undefined ? [{ title: `${formatTaka(outside)} outside Dhaka`, text: 'Delivery charge' }] : []),
    { title: 'No account needed', text: 'Order and track as a guest' },
  ]
  return (
    <section aria-label="How ordering works" className={container}>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 border-y border-line py-8 sm:gap-x-8 lg:grid-cols-4">
        {facts.map((f) => (
          <li key={f.title} className="flex flex-col gap-1">
            <span className="text-body font-medium text-ink-strong tabular-nums">{f.title}</span>
            <span className="text-caption text-ink-subtle">{f.text}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function CurrentDrop() {
  const featured = useApi('featured', getFeatured)
  const products = featured.data?.products ?? []
  return (
    <section id="featured" aria-labelledby="drop-title" className={sectionPadding}>
      <div className={container + ' flex flex-col gap-14'}>
        <SectionHeader
          id="drop-title"
          title="The current drop"
          intro={
            featured.status === 'ready'
              ? `${products.length} pieces on sale now. Limited runs never come back once they sell out.`
              : 'Limited runs never come back once they sell out.'
          }
          action={
            <Link to="/shop" className={textLink + ' text-label text-ink-muted'}>
              All products
            </Link>
          }
        />
        <Loaded state={featured} loading={<ProductGridSkeleton />}>
          {(data) => <ProductGrid products={data.products} />}
        </Loaded>
      </div>
    </section>
  )
}

function BrandStory() {
  return (
    <section aria-labelledby="story-title" className="border-y border-line">
      <div
        className={
          container + ' grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-20 ' + sectionPadding
        }
      >
        <div className="flex flex-col gap-6">
          <h2 id="story-title" className="text-label text-ink-muted">
            Why Drakon
          </h2>
          <blockquote
            lang="bn"
            className="font-bengali text-heading-3 leading-[1.75] font-medium text-ink-strong sm:text-heading-2 sm:leading-[1.6]"
          >
            রাত গভীর হলে যেসব মানুষ জেগে থেকে পৃথিবীর মানুষের জন্য অনেক কিছু করার চেষ্টা করে, তাদের জন্য আমাদের পক্ষ থেকে এই
            উপহার।
          </blockquote>
        </div>
        <div className="flex flex-col gap-4 lg:pb-2">
          <p className="text-body-lg text-ink">
            When the night gets deep, some people stay awake and keep working for everyone else. Drakon is our gift to
            them.
          </p>
          <p className="text-body text-ink-muted">
            The name comes from "dark". It is for night workers, dream chasers, gamers, coders, creative minds and the
            quiet people who work hard while others sleep.
          </p>
          <Link to="/about" className={textLink + ' self-start text-label text-ink-muted'}>
            Our story
          </Link>
        </div>
      </div>
    </section>
  )
}

function Collections() {
  const cats = useApi('categories', getCategories)
  const shop = useApi('shop:all', loadShop)
  const categories = cats.data ?? []
  // Pieces on sale per collection; undefined while the products load.
  const countIn = (slug: string) => shop.data?.products.filter((p) => p.categorySlug === slug).length
  return (
    <section id="collections" aria-labelledby="col-title" className={sectionPadding + ' scroll-mt-18'}>
      <div className={container + ' flex flex-col gap-14'}>
        <SectionHeader
          id="col-title"
          title="Shop by collection"
          intro={
            cats.status === 'ready'
              ? `Every piece belongs to one of ${categories.length} collections.`
              : 'Every piece belongs to one collection.'
          }
        />
        {cats.status !== 'ready' && <Loaded state={cats}>{() => null}</Loaded>}
        <ul className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
          {categories.map((c) => {
            const count = countIn(c.slug)
            return (
              <li key={c.slug}>
                <Link to={`/shop/${c.slug}`} className="group relative block overflow-hidden rounded-2xl">
                  <span className="block aspect-[4/5] bg-field">
                    <img
                      src={c.image}
                      alt=""
                      width={800}
                      height={1000}
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover transition-transform duration-slow ease-out-drakon motion-safe:animate-fade-in motion-safe:group-hover:scale-[1.03]"
                    />
                  </span>
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-linear-to-b from-transparent to-surface/85"
                  />
                  <span className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3 sm:inset-x-6 sm:bottom-6">
                    <span className="flex flex-col gap-1">
                      <span className="text-title font-semibold text-ink-strong sm:text-heading-3">{c.name}</span>
                      {count !== undefined && (
                        <span className="hidden text-caption text-ink-muted tabular-nums sm:block">
                          {count === 1 ? '1 piece on sale' : `${count} pieces on sale`}
                        </span>
                      )}
                    </span>
                    <ArrowUpRightIcon className="shrink-0 text-ink-muted" />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

function ArchivePreview() {
  const archive = useApi('sold-out', getSoldOut)
  // Nothing has sold out yet: leave the section out instead of an empty box.
  if (archive.status === 'ready' && archive.data.length === 0) return null
  return (
    <section id="sold-out" aria-labelledby="arc-title" className={'border-t border-line ' + sectionPadding}>
      <div className={container + ' flex flex-col gap-14'}>
        <SectionHeader
          id="arc-title"
          title="Sold out. Never restocked."
          intro="When a limited piece sells out, it moves to the archive and stays there. It is the record of every DRAKON run."
          action={
            <Link to="/sold-out" className={secondaryButton}>
              See the archive
            </Link>
          }
        />
        <Loaded state={archive}>
          {(products) => (
            <ul className="grid border-t border-line md:grid-cols-3 md:gap-6 md:border-0 lg:gap-10">
              {products.slice(0, 3).map((p) => (
                <li key={p.id}>
                  <ArchiveCard product={p} />
                </li>
              ))}
            </ul>
          )}
        </Loaded>
      </div>
    </section>
  )
}

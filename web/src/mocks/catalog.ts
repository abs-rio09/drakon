// MOCK DATA — will be replaced by the Go API:
//   GET /api/categories, GET /api/products, GET /api/products/:slug
// The shapes below follow the database plan in docs/blueprint.md (part 5):
// a product has many variants, and each variant has its own price and stock.
// Prices are whole paisa (৳1,250 = 125000). Format them only with formatTaka().

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'SOLD_OUT' | 'ARCHIVED'

export type Category = {
  slug: string
  name: string // plural, for menus: "Playcards"
  image: string // material close-up for the collection tile (4:5)
}

export type ProductImage = {
  src: string // full photo, 1:1
  thumb: string // small square crop, 240px
  name: string // short name for the thumbnail button: "Back"
  alt: string
}

export type Variant = {
  id: string
  sku: string
  label: string // "M", "Metal", "Standard"
  note?: string // one plain line under the label: "Brushed steel, etched art"
  pricePaisa: number
  stock: number
  imageIndex?: number // which product photo shows this variant
}

export type Product = {
  id: string
  slug: string
  name: string
  categorySlug: string
  kind: string // what it is, singular: "Tech toy", "Collectible card"
  variantKind: string // the name of the choice: "Size", "Material"
  isLimited: boolean
  editionSize?: number // only when a run has a known size: 100
  status: ProductStatus
  purchaseLimit: number | null // null = use settings.defaultPurchaseLimit
  summary: string
  story: string[]
  details: { term: string; text: string }[]
  images: ProductImage[]
  variants: Variant[]
  soldOutAt?: string // ISO date, for the archive order
}

export const categories: Category[] = [
  { slug: 'playcards', name: 'Playcards', image: '/img/cat-playcard.webp' },
  { slug: 'sports-toys', name: 'Sports toys', image: '/img/cat-sports.webp' },
  { slug: 'tech-toys', name: 'Tech toys', image: '/img/cat-tech.webp' },
  { slug: 'clothes', name: 'Clothes', image: '/img/cat-clothes.webp' },
]

const img = (file: string, name: string, alt: string): ProductImage => ({
  src: `/img/${file}.webp`,
  thumb: `/img/t-${file}.webp`,
  name,
  alt,
})

export const products: Product[] = [
  {
    id: 'p1',
    slug: 'dragon-flame-card-edition-01',
    name: 'Dragon Flame Card · Edition 01',
    categorySlug: 'playcards',
    kind: 'Collectible card',
    variantKind: 'Material',
    isLimited: true,
    editionSize: 100,
    status: 'ACTIVE',
    purchaseLimit: 2,
    summary:
      'The first DRAKON card, for the people who stay awake at night. Every card is numbered from 1 to 100. Choose the material you want to hold.',
    story: [
      'Drakon comes from "dark". This card is a small gift for the people who stay awake when the night gets deep: night workers, gamers, coders, dream chasers.',
      '[Add the story of the Dragon Flame artwork and the designer who made it.]',
    ],
    details: [
      { term: 'Size', text: 'Card 63 × 88 mm, the standard playing card size. Key-ring [size in mm]' },
      { term: 'Hard paper', text: '[Paper weight and finish]' },
      { term: 'Plastic', text: '[Plastic type and thickness]' },
      { term: 'Metal', text: '[Metal type, thickness and etching]' },
      { term: 'Edition', text: '100 pieces across all materials, each card numbered' },
    ],
    images: [
      img('c-df-lineup', 'All materials', 'Dragon Flame card in hard paper, plastic and metal, with two key-rings'),
      img('c-df-paper', 'Hard paper', 'Hard paper Dragon Flame card with its back'),
      img('c-df-plastic', 'Plastic', 'Plastic Dragon Flame card with its back'),
      img('c-df-metal', 'Metal', 'Brushed metal Dragon Flame card with etched art'),
      img('c-df-keyring', 'Key-rings', 'Plastic and metal Dragon Flame key-rings'),
    ],
    variants: [
      { id: 'v-df-paper', sku: 'DF01-PAPER', label: 'Hard paper', note: 'Thick matte card stock', pricePaisa: 45000, stock: 22, imageIndex: 1 },
      { id: 'v-df-plastic', sku: 'DF01-PLASTIC', label: 'Plastic', note: 'Smooth, waterproof', pricePaisa: 69000, stock: 9, imageIndex: 2 },
      { id: 'v-df-metal', sku: 'DF01-METAL', label: 'Metal', note: 'Brushed steel, etched art', pricePaisa: 149000, stock: 3, imageIndex: 3 },
      { id: 'v-df-pkey', sku: 'DF01-PKEY', label: 'Plastic key-ring', note: 'Mini card with a steel ring', pricePaisa: 59000, stock: 0, imageIndex: 4 },
      { id: 'v-df-mkey', sku: 'DF01-MKEY', label: 'Metal key-ring', note: 'Mini steel card with a ring', pricePaisa: 129000, stock: 4, imageIndex: 4 },
    ],
  },
  {
    id: 'p2',
    slug: 'ember-night-hoodie-edition-02',
    name: 'Ember Night Hoodie · Edition 02',
    categorySlug: 'clothes',
    kind: 'Clothes',
    variantKind: 'Size',
    isLimited: true,
    status: 'ACTIVE',
    purchaseLimit: 2,
    summary:
      'A heavyweight black hoodie with the Drakon ember mark. Made in one numbered run. When it sells out, it moves to the archive for good.',
    story: [
      'Edition 02 follows the sold-out Edition 01. Same cut, a new ember print on the back, and a woven edition tag inside the collar.',
      '[Add the story of this drop: what inspired it and who it is for.]',
    ],
    details: [
      { term: 'Material', text: '[Fabric and weight, e.g. cotton fleece, GSM]' },
      { term: 'Fit', text: '[Regular / oversized]' },
      { term: 'Sizes', text: 'S, M, L, XL. [Chest and length per size, in cm]' },
      { term: 'Care', text: '[Washing instructions]' },
      { term: 'Edition', text: 'Edition 02 of a run of [number of pieces made]' },
    ],
    images: [
      img('p-hoodie02-front', 'Front', 'Ember Night Hoodie Edition 02, folded, front with the small ember mark'),
      { src: '/img/p-hoodie02-back.webp', thumb: '/img/p-hoodie02-back.webp', name: 'Back', alt: 'Back of the hoodie with the large ember eye print and Edition 02' },
      { src: '/img/p-hoodie02-detail.webp', thumb: '/img/p-hoodie02-detail.webp', name: 'Detail', alt: 'Close-up of the screen print and drawstring' },
      { src: '/img/p-hoodie02-tag.webp', thumb: '/img/p-hoodie02-tag.webp', name: 'Tag', alt: 'Woven Edition 02 label inside the collar' },
    ],
    variants: [
      { id: 'v-h2-s', sku: 'HD02-S', label: 'S', pricePaisa: 245000, stock: 3 },
      { id: 'v-h2-m', sku: 'HD02-M', label: 'M', pricePaisa: 245000, stock: 4 },
      { id: 'v-h2-l', sku: 'HD02-L', label: 'L', pricePaisa: 245000, stock: 0 },
      { id: 'v-h2-xl', sku: 'HD02-XL', label: 'XL', pricePaisa: 245000, stock: 6 },
    ],
  },
  {
    id: 'p3',
    slug: 'midnight-circuit-desk-drone',
    name: 'Midnight Circuit Desk Drone',
    categorySlug: 'tech-toys',
    kind: 'Tech toy',
    variantKind: 'Model',
    isLimited: true,
    status: 'ACTIVE',
    purchaseLimit: null,
    summary: 'A small black desk drone with four guarded rotors and an ember light strip. Made in one run.',
    story: ['[Add the story of the drone: flight time, charging, who it is for.]'],
    details: [
      { term: 'Size', text: '[Width × depth × height in mm]' },
      { term: 'Battery', text: '[Flight time and charging time]' },
      { term: 'In the box', text: '[Drone, charging cable, spare rotors]' },
    ],
    images: [img('p-desk-drone', 'Front', 'Black desk drone with four guarded rotors and an ember light strip')],
    variants: [{ id: 'v-drone', sku: 'DRN-01', label: 'Standard', pricePaisa: 340000, stock: 3 }],
  },
  {
    id: 'p4',
    slug: 'night-striker-football',
    name: 'Night Striker Football',
    categorySlug: 'sports-toys',
    kind: 'Sports toy',
    variantKind: 'Size',
    isLimited: false,
    status: 'ACTIVE',
    purchaseLimit: null,
    summary: 'A matte black football with muted ember pentagons. Made for night games under street lights.',
    story: ['[Add the story of the ball: material, where it plays best.]'],
    details: [
      { term: 'Size', text: 'Size 5, match size' },
      { term: 'Material', text: '[Cover material and bladder]' },
    ],
    images: [img('p-striker-football', 'Front', 'Matte black football with muted ember pentagons on dark slate')],
    variants: [{ id: 'v-ball', sku: 'BALL-5', label: 'Size 5', pricePaisa: 180000, stock: 20 }],
  },
  {
    id: 'p5',
    slug: 'dragon-flame-playcard-set',
    name: 'Dragon Flame Playcard Set',
    categorySlug: 'playcards',
    kind: 'Playcard set',
    variantKind: 'Edition',
    isLimited: true,
    status: 'ACTIVE',
    purchaseLimit: 5,
    summary: 'A full playcard set with the Dragon Flame art, in its own box. Made in one run.',
    story: ['[Add the story of the set: how many cards, what game it plays.]'],
    details: [
      { term: 'In the box', text: '[Number of cards and extras]' },
      { term: 'Card size', text: '63 × 88 mm' },
    ],
    images: [img('p-dragon-flame-set', 'Set', 'Dragon Flame playcards fanned beside their box')],
    variants: [{ id: 'v-dfset', sku: 'DFSET-STD', label: 'Standard', pricePaisa: 125000, stock: 12 }],
  },
  {
    id: 'p6',
    slug: 'card-sleeves-ember-100',
    name: 'Card Sleeves · Ember 100',
    categorySlug: 'playcards',
    kind: 'Playcard sleeves',
    variantKind: 'Pack',
    isLimited: false,
    status: 'ACTIVE',
    purchaseLimit: null,
    summary: 'A box of 100 matte card sleeves with a thin ember edge. Fits standard 63 × 88 mm cards.',
    story: ['[Add details about the sleeves.]'],
    details: [{ term: 'In the box', text: '100 sleeves' }],
    images: [img('p-card-sleeves', 'Box', 'Box of ember card sleeves with two sleeved cards')],
    variants: [{ id: 'v-sleeves', sku: 'SLV-100', label: 'Box of 100', pricePaisa: 35000, stock: 48 }],
  },
  {
    id: 'p7',
    slug: 'ember-logo-tee-black',
    name: 'Ember Logo Tee · Black',
    categorySlug: 'clothes',
    kind: 'Clothes',
    variantKind: 'Size',
    isLimited: false,
    status: 'ACTIVE',
    purchaseLimit: null,
    summary: 'A black cotton tee with a small ember D on the chest. Restocks.',
    story: ['[Add details about the tee.]'],
    details: [
      { term: 'Material', text: '[Fabric and weight]' },
      { term: 'Sizes', text: 'S, M, L, XL' },
    ],
    images: [img('p-logo-tee', 'Front', 'Folded black tee with a small ember D logo')],
    variants: [
      { id: 'v-tee-s', sku: 'TEE-S', label: 'S', pricePaisa: 99000, stock: 0 },
      { id: 'v-tee-m', sku: 'TEE-M', label: 'M', pricePaisa: 99000, stock: 0 },
      { id: 'v-tee-l', sku: 'TEE-L', label: 'L', pricePaisa: 99000, stock: 0 },
      { id: 'v-tee-xl', sku: 'TEE-XL', label: 'XL', pricePaisa: 99000, stock: 0 },
    ],
  },

  // Sold out limited runs: shown only in the archive, never deleted.
  {
    id: 'p8',
    slug: 'ember-night-hoodie-edition-01',
    name: 'Ember Night Hoodie · Edition 01',
    categorySlug: 'clothes',
    kind: 'Clothes',
    variantKind: 'Size',
    isLimited: true,
    status: 'ARCHIVED',
    purchaseLimit: 2,
    summary: 'The first ember print. Edition 02 keeps the cut and adds a new back print and a woven edition tag.',
    story: [],
    details: [],
    images: [{ src: '/img/so-hoodie01.webp', thumb: '/img/t-so-hoodie01.webp', name: 'Back', alt: 'Folded black hoodie, Edition 01, back print' }],
    variants: [{ id: 'v-h1-m', sku: 'HD01-M', label: 'M', pricePaisa: 210000, stock: 0 }],
    soldOutAt: '2026-10-08',
  },
  {
    id: 'p9',
    slug: 'founders-playcard-deck',
    name: 'Founders Playcard Deck',
    categorySlug: 'playcards',
    kind: 'Playcard deck',
    variantKind: 'Edition',
    isLimited: true,
    status: 'SOLD_OUT',
    purchaseLimit: null,
    summary: 'The founders deck.',
    story: [],
    details: [],
    images: [{ src: '/img/so-founders-deck.webp', thumb: '/img/t-so-founders-deck.webp', name: 'Deck', alt: 'Founders playcard deck and box' }],
    variants: [{ id: 'v-founders', sku: 'FND-STD', label: 'Standard', pricePaisa: 150000, stock: 0 }],
    soldOutAt: '2026-09-21',
  },
  {
    id: 'p10',
    slug: 'glow-arena-mini-goal',
    name: 'Glow Arena Mini Goal',
    categorySlug: 'sports-toys',
    kind: 'Sports toy',
    variantKind: 'Model',
    isLimited: true,
    status: 'SOLD_OUT',
    purchaseLimit: null,
    summary: 'A mini football goal with a glowing crossbar.',
    story: [],
    details: [],
    images: [{ src: '/img/so-mini-goal.webp', thumb: '/img/t-so-mini-goal.webp', name: 'Goal', alt: 'Mini football goal with a glowing crossbar' }],
    variants: [{ id: 'v-goal', sku: 'GOAL-01', label: 'Standard', pricePaisa: 260000, stock: 0 }],
    soldOutAt: '2026-09-02',
  },
]

// Which products the home page shows as "The current drop", in order.
export const featuredSlugs = [
  'dragon-flame-card-edition-01',
  'ember-night-hoodie-edition-02',
  'midnight-circuit-desk-drone',
  'night-striker-football',
]

// The product under the home hero's gallery label.
export const heroProductSlug = 'dragon-flame-playcard-set'

# রাতের কাজের লগ — 2026-10-15

Abu Bakkar Siddik, তুমি ঘুমানোর সময় আমি (Claude) শুধু **frontend** (`web/`) নিয়ে কাজ করেছি। প্রতিটা ধাপ আলাদা commit, কিছুই GitHub-এ push করা হয়নি।

সব ধাপ একসাথে দেখতে:

```zsh
cd ~/Desktop/projects/Drakon/drakon/web
npm run dev
```

তারপর ব্রাউজারে http://localhost:5173 খোলো। Phone-এর মাপ দেখতে Chrome-এ `F12` → `Ctrl+Shift+M` (device toolbar) → width 375 দাও।

Commit-গুলো দেখতে: `git log --oneline`

---

## ধাপ 1 — SiteHeader আর SiteFooter (step 1c)

### কী বানালাম
- `web/src/components/icons.tsx` — Lucide-ধাঁচের SVG icon (search, cart, menu, close, plus …)। সব icon `currentColor` ব্যবহার করে, তাই পাশের লেখার রং নেয়।
- `web/src/components/Logo.tsx` — কমলা "D" square + "Drakon" লেখা।
- `web/src/components/layout/SiteHeader.tsx` — উপরের bar: logo, চারটা link (Shop, Collections, Sold out, Track order), search, cart (সংখ্যার bubble সহ), আর phone-এ menu বাটন।
- `web/src/components/layout/SiteFooter.tsx` — নিচের অংশ: logo, ছোট বর্ণনা, তিনটা link-এর দল।
- `web/public/img/grain.webp` — পুরো page-এর হালকা দানাদার texture (design README অনুযায়ী)।

### মূল ধারণা (শেখার জন্য)
- **Component = function যেটা HTML-এর মতো JSX ফেরত দেয়।** `function SiteHeader() { return <header>…</header> }`। একবার লিখে বারবার ব্যবহার করা যায়: `<SiteHeader />`।
- **Props = component-এর input।** C-এর function parameter-এর মতো। `<SiteHeader cartCount={2} />` দিলে ভেতরে `cartCount` = 2। TypeScript-এ `type SiteHeaderProps = { cartCount?: number }` লিখে বলে দিই কোন prop কোন type-এর; `?` মানে ঐচ্ছিক।
- **State (`useState`) = component-এর নিজের মনে রাখা মান।** Phone menu খোলা না বন্ধ, সেটা `const [menuOpen, setMenuOpen] = useState(false)`। `setMenuOpen(true)` ডাকলে React নিজে থেকেই আবার render করে, menu দেখা যায়।
- **`useEffect` = render-এর পরে কোনো কাজ।** এখানে menu খোলা থাকলে `Escape` চাপলে বন্ধ হবে, সেই keyboard listener বসানো আর পরে সরানো (`return () => …` হলো cleanup)।
- **Conditional render:** `{menuOpen && <div>…</div>}` — `menuOpen` true হলে তবেই div দেখায়।
- **List render:** `NAV_LINKS.map(link => <a key={link.href}>…</a>)` — array থেকে অনেকগুলো link। প্রতিটার `key` আলাদা হতে হয়, যাতে React চিনতে পারে।
- **Tailwind mobile-first:** `hidden md:flex` মানে ছোট screen-এ লুকানো, 768px (md) থেকে দেখা যায়। `md:hidden` উল্টো। আগে phone-এর style লিখি, তারপর বড় screen-এর জন্য `sm:` `md:` `lg:` দিয়ে বদলাই।
- **শুধু theme token:** `bg-surface-glass`, `text-ink-muted`, `border-line` — সব রং `src/index.css`-এর `@theme` থেকে আসে, কোনো hex code component-এ নেই।
- **Accessibility:** icon-বাটনে `aria-label` ("Cart, 2 items"), menu বাটনে `aria-expanded`, বর্তমান page-এর link-এ `aria-current="page"`।

### ব্রাউজারে কীভাবে test করবে
1. 1280px চওড়ায়: উপরে logo, মাঝখানে চারটা link, ডানে search আর cart (সংখ্যা 2)। নিচে footer-এ তিনটা কলাম।
2. 375px চওড়ায়: link লুকিয়ে যায়, ডানে ☰ বাটন। চাপলে একটা panel খোলে, `Escape` চাপলে বা আবার চাপলে বন্ধ হয়।
3. `Tab` চাপতে থাকো: প্রতিটা link/বাটনে কমলা focus outline দেখা যাবে।

### সিদ্ধান্ত / প্রশ্ন
- **Account (Sign in) icon রাখিনি** — খোলা প্রশ্ন 3-এর উত্তর আসেনি, তাই সেটা বাদ।
- এই ধাপে link-গুলো সাধারণ `<a href>`; ধাপ 2-এ react-router-এর `Link`/`NavLink` দিয়ে বদলানো হবে।
- Header `sticky` (scroll করলেও উপরে থাকে, glass blur সহ)। Design-এ home hero-র ওপর transparent header আছে; সেটা সরল রাখতে আপাতত সব page-এ একই glass header।

---

## ধাপ 2 — Routing (react-router v7)

### কী বানালাম
- `npm i react-router@7` — **একমাত্র নতুন library।** (খেয়াল করো: সাধারণ `npm i react-router` এখন **v8.4** install করে। CLAUDE.md আর তোমার নির্দেশে v7 লেখা, তাই `@7` দিয়ে v7.18.4 pin করেছি। v8-এ যাবে কিনা পরে ঠিক করো — নিচে প্রশ্ন দেখো।)
- `src/main.tsx` — পুরো app `<BrowserRouter>`-এর ভেতরে।
- `src/App.tsx` — সব URL-এর তালিকা (blueprint ভাগ ৬ অনুযায়ী):

| URL | Page |
|---|---|
| `/` | Home |
| `/shop`, `/shop/:category` | Shop / Category (একই component) |
| `/product/:slug` | Product details |
| `/search` | Search |
| `/sold-out` | Sold Out archive |
| `/cart` | Cart |
| `/checkout` | Checkout (আলাদা শান্ত header) |
| `/order/:number` | Order confirmation |
| `/track` | Track order |
| `/about`, `/contact` | About, Contact |
| `/policies/returns`, `/policies/terms`, `/policies/privacy` | Policy page (খসড়া লেখা) |
| বাকি সব | 404 "Page not found" |

- `components/layout/RootLayout.tsx` — header + `<Outlet />` + footer। `CheckoutLayout.tsx` — শুধু logo আর "Back to cart"।
- `components/layout/ScrollManager.tsx` — নতুন page-এ গেলে উপরে scroll; `/#collections`-এর মতো link হলে সেই section-এ যায়।
- `components/ui/styles.ts` — বাটন/link/panel-এর Tailwind class এক জায়গায় (`primaryButton`, `secondaryButton`, `textLink` …), যাতে সব page একরকম দেখায়।
- `lib/money.ts` — `formatTaka(paisa)`: পয়সা → "৳1,250"। **দাম format করার একমাত্র জায়গা।**
- `mocks/settings.ts` — return 3 দিন, 48 ঘণ্টা, limit 5। Policy page এখান থেকে সংখ্যা নেয়।

### মূল ধারণা
- **SPA (Single Page App):** ব্রাউজার একটাই HTML নেয়। URL বদলালে react-router JavaScript দিয়ে শুধু ভেতরের অংশ বদলায়, পুরো page reload হয় না।
- **`<Routes>` / `<Route path="shop" element={<Shop />} />`:** "URL যদি `/shop` হয় তাহলে `<Shop />` দেখাও"। C-এর `switch`-এর মতো ভাবতে পারো।
- **Layout route + `<Outlet />`:** `<Route element={<RootLayout />}>`-এর ভেতরের সব route RootLayout-এর `<Outlet />`-এর জায়গায় বসে। তাই header/footer একবারই লিখতে হয়।
- **`:category`, `:slug` = URL parameter।** `/product/dragon-flame-card`-এ `useParams()` দিলে `{ slug: 'dragon-flame-card' }` পাওয়া যায়।
- **`<Link to="/shop">` বনাম `<a href>`:** `<a>` পুরো page reload করে; `<Link>` করে না, তাই দ্রুত আর state (যেমন cart) হারায় না।
- **`useLocation()`** দিয়ে এখনকার URL জেনে header ঠিক করে কোন link-এর নিচে দাগ থাকবে।
- **`path="*"`** — কোনো route না মিললে 404 page।

### ব্রাউজারে test
1. Header-এর প্রতিটা link চাপো — page reload ছাড়াই বদলাবে, বর্তমান link-এর নিচে সাদা দাগ।
2. http://localhost:5173/abc খোলো → "Page not found"।
3. http://localhost:5173/checkout → উপরে শুধু logo আর "Back to cart"।
4. Footer → Returns and refunds → "within 3 days" লেখা (সংখ্যাটা `mocks/settings.ts` থেকে; ওখানে 3 বদলে 7 করে দেখো)।
5. Page থেকে page-এ গেলে সবসময় উপর থেকে শুরু হয়।

### প্রশ্ন
- **react-router v8 এসে গেছে।** এখন v7 রেখেছি (তোমার নির্দেশ)। পরে v8-এ যাবে কি? আমার সুপারিশ: MVP শেষ হওয়া পর্যন্ত v7, কারণ CLAUDE.md আর blueprint সেটাই বলে।
- Policy page-এর লেখা খসড়া; `[ ]` বন্ধনীর জায়গাগুলো তোমাকে লিখতে হবে।

---

## ধাপ 3 — Home page, ProductCard, mock data (সাথে Shop/Category আর Search)

### কী বানালাম
- **`web/src/mocks/`** — সব নকল data এক জায়গায়, প্রতিটা ফাইলের উপরে লেখা "will be replaced by the Go API":
  - `catalog.ts` — 4টা collection, 10টা product (7টা বিক্রিতে, 3টা sold out/archived)। প্রতিটা product-এর একাধিক **variant** (size / material), প্রতিটা variant-এর নিজের `pricePaisa` আর `stock` — ঠিক blueprint-এর database plan-এর মতো।
  - `delivery.ts` — দুইটা zone (৳60 / ৳100, paisa-তে 6000 / 10000), ঢাকার "city / outside city" পছন্দ, আর বাংলাদেশের 64টা জেলা।
  - `settings.ts` — 48 ঘণ্টা, limit 5, return 3 দিন, "Only N left" কখন দেখাবে (5)।
- **`web/src/lib/`** — mock data পড়ার function: `getShopProducts()`, `getProduct(slug)`, `getArchive()`, `searchProducts()`, `stockFact()` ("38 of 100 left", "Only 3 left", "Sold out") ইত্যাদি। পরে শুধু এই ফাইলগুলো Go API-তে `fetch` করবে; page-গুলো বদলাতে হবে না।
- **Component** (`components/product/`): `GalleryLabel` (নাম → এক লাইনের বর্ণনা → দাগ → দাম + stock), `ProductPhoto` (ছবি fade-in, hover-এ ধীরে zoom, sold out হলে grayscale), `ProductCard` + `ProductGrid` (phone-এ 2, 640px থেকে 3, 1024px থেকে 4 কলাম), `ArchiveCard`, `Badge`।
- **Home page** (`pages/Home.tsx`, Main.dc.html থেকে): hero ("Made once. Never again." + ছবির উপর glass gallery label), facts সারি (৳60/৳100 আসে `mocks/delivery.ts` থেকে), The current drop, বাংলা brand story, Shop by collection, Sold out archive-এর ঝলক।
- **Shop / Category** (`/shop`, `/shop/clothes`…) — collection chip দিয়ে filter; ভুল collection নাম হলে 404।
- **Search** (`/search?q=card`) — নাম দিয়ে খোঁজা; শব্দটা URL-এ থাকে।
- `web/public/img/` — design folder থেকে 37টা ছবি কপি (Founders Deck II-এর ছবি বাদ, ওটা DRAFT product)।

### মূল ধারণা
- **TypeScript `type`:** `type Product = { name: string; variants: Variant[] … }` — C-এর `struct`-এর মতো। ভুল field লিখলে `npm run build` তখনই error দেয়।
- **Union type:** `status: 'DRAFT' | 'ACTIVE' | 'SOLD_OUT' | 'ARCHIVED'` — এই চারটার বাইরে কিছু লেখা যায় না (C-এর `enum`-এর মতো)।
- **টাকা paisa-তে:** `pricePaisa: 245000` = ৳2,450। শুধু `formatTaka()` (`lib/money.ts`) "৳" বানায়। Float কখনো না, কারণ 0.1 + 0.2 ≠ 0.3।
- **Array method:** `.filter()` (বাছাই), `.map()` (প্রতিটা থেকে নতুন কিছু), `.reduce()` (যোগফল, যেমন মোট stock), `.find()` (প্রথম মিল)।
- **Component composition:** `ProductCard` নিজে `ProductPhoto` আর `GalleryLabel` ব্যবহার করে — ছোট টুকরা জুড়ে বড় জিনিস।
- **`useParams()`** দিয়ে `/shop/:category` থেকে collection নাম; **`useSearchParams()`** দিয়ে `?q=` পড়া/লেখা।
- **React 19-এ `<title>`:** page component-এর ভেতরে `<title>` লিখলে React নিজেই সেটা browser tab-এ বসায়।
- **Tailwind:** `aspect-square`, `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`, `bg-linear-to-r from-surface/90` (token রং 90% opacity-তে), `group` + `group-hover:scale-[1.03]` (card-এর উপর mouse গেলে ভেতরের ছবি zoom), `motion-safe:animate-…` (যারা কম animation চায় তাদের জন্য বন্ধ)।
- **Accessibility:** ছবির link `tabIndex={-1}` + `aria-hidden` (নামের link-টাই যথেষ্ট, Tab দুবার থামে না), sold out দামের আগে screen reader-এর জন্য লুকানো "Was"।

### ব্রাউজারে test
1. `/` — hero, 4টা product card, বাংলা লেখা, 4টা collection tile, 3টা sold out (ধূসর, দাম কাটা)।
2. Collection tile চাপো → `/shop/clothes` ইত্যাদি। Chip চেপে collection বদলাও।
3. Header-এর 🔍 → `card` লিখে Search।
4. `web/src/mocks/catalog.ts`-এ drone-এর `stock: 3` বদলে `0` করো → card-এ "Sold out" দেখাবে। `settings.ts`-এ `lowStockThreshold` বদলে দেখো "Only N left" কখন আসে।
5. 375px-এ: hero-র নিচে label, product 2 কলামে, archive সারি আকারে।

### সিদ্ধান্ত / প্রশ্ন
- এই browser-এ (আমার test machine) "reduce motion" চালু ছিল, তাই animation বন্ধ দেখেছি — এটাই ঠিক আচরণ। তোমার PC-তে hero ধীরে ভেসে উঠবে।
- Product card-এর "+" (quick add) বাটন ধাপ 5-এ cart তৈরির পরে যোগ হবে।
- Header-এর "Collections" link Home-এর `#collections` section-এ যায় (আলাদা page নেই, design-এও নেই)।
- Mock product-এর অনেক বর্ণনায় `[ ]` বন্ধনী আছে (design থেকে নেওয়া) — আসল লেখা তুমি পরে admin থেকে দেবে।


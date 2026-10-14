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

---

## ধাপ 4 — Product details page (variant বাছাই সহ)

### কী বানালাম
- `pages/Product.tsx` (`/product/:slug`) — Product.dc.html আর ProductCard.dc.html মিলিয়ে:
  - Breadcrumb (Shop / Collection / নাম)।
  - বড় ছবি + thumbnail সারি; thumbnail চাপলে বড় ছবি বদলায়। Limited হলে ছবিতে "Limited run" / "Edition of 100" badge।
  - Buy box: নাম, বর্ণনা লাইন, দাম (বাছাই করা variant-এর), মোট stock fact।
  - **Variant picker** (`components/product/VariantPicker.tsx`): দুই রকম — hoodie/tee-র জন্য ছোট size বাটন (S M L XL), Dragon Flame card-এর জন্য বড় সারি (ছোট ছবি, নাম, note, দাম, stock)। Material বদলালে দাম আর বড় ছবিও বদলায়। Sold out variant (যেমন hoodie-র L) দাগ-কাটা, চাপা যায় না।
  - **Quantity stepper** (`components/ui/QuantityStepper.tsx`): সর্বোচ্চ = purchase limit আর stock-এর মধ্যে যেটা কম। পাশে "Limit 2 per customer"।
  - Add to cart বাটন মোট দামসহ — **এই ধাপে বন্ধ (disabled)**, ধাপ 5-এ চালু হবে।
  - নিচে promises (COD, delivery ৳60/৳100, return 3 দিন, "One run only") — সব সংখ্যা mocks থেকে।
  - About this piece + details table, আর "Pairs well with" (একই collection আগে)।
  - Sold out / archived product (যেমন `/product/founders-playcard-deck`): ধূসর ছবি, দাম কাটা, কেনার কোনো বাটন নেই, archive-এ যাওয়ার link।
  - ভুল slug → 404।

### মূল ধারণা
- **একাধিক `useState`:** `variantId`, `qty`, `imageIndex` — তিনটা আলাদা মান মনে রাখা হয়। একটা বদলালে React page আবার আঁকে।
- **Derived value (হিসাব করে পাওয়া মান) state-এ রাখি না:** `variant`, `maxQty`, `canBuy` প্রতিবার render-এ state থেকে হিসাব হয়। এতে দুই জায়গায় একই তথ্য রেখে গরমিল হওয়ার ভয় নেই।
- **`key` দিয়ে state reset:** `<ProductView key={product.id} />` — অন্য product-এ গেলে key বদলায়, React পুরনো component ফেলে নতুন বানায়, তাই qty আবার 1 থেকে শুরু।
- **Props-এ function পাঠানো:** `<VariantPicker onSelect={selectVariant} />` — child component বাছাই হলে parent-এর function ডাকে ("lifting state up")।
- **লুকানো radio button:** আসল `<input type="radio">` আছে কিন্তু `sr-only` দিয়ে চোখে লুকানো; তার `<label>`-টাকেই সুন্দর বাটনের মতো সাজানো। এতে keyboard-এর arrow key আর screen reader নিজে থেকেই কাজ করে। Tailwind-এর `has-[:focus-visible]:outline-2` দিয়ে label-এ focus দাগ।
- **Tailwind `@utility`:** `index.css`-এ নিজের utility `bg-strike` (sold-out size-এর কোনাকুনি দাগ) বানালাম।
- **CSS subgrid:** details table-এ `grid-cols-subgrid` দিয়ে সব সারির কলাম এক লাইনে।

### ব্রাউজারে test
1. Home → "Dragon Flame Card · Edition 01" → Metal চাপো: দাম ৳1,490, বড় ছবি metal card। "Plastic key-ring" চাপা যায় না (Sold out)।
2. Quantity + চাপো: 2-এর পরে + বন্ধ (limit 2)। Metal-এ stock 3, limit 2 → সর্বোচ্চ 2।
3. Hoodie: L দাগ-কাটা; M বাছলে "Only 4 left in size M"।
4. `/product/founders-playcard-deck` → sold out রূপ। `/product/ember-logo-tee-black` → সব size শেষ, বাটনে "Out of stock"।
5. Keyboard: Tab দিয়ে variant-এ গিয়ে ←/→ arrow চাপো, বাছাই বদলায়।

### প্রশ্ন
- "Size guide" link এখন details table-এ নিয়ে যায়; আসল মাপের chart (cm) তোমাকে দিতে হবে।

---

## ধাপ 5 — Cart (localStorage-এ, শুধু variant id + qty)

### কী বানালাম
- `features/cart/cartStorage.ts` — localStorage-এ `drakon.cart.v1` নামে শুধু `[{ variantId, qty }]` রাখে। নষ্ট/অচেনা data পেলে ফেলে দেয়, page crash করে না।
- `features/cart/CartContext.ts`, `CartProvider.tsx`, `useCart.ts` — পুরো app-এ cart ভাগ করে নেওয়া। `main.tsx`-এ `<CartProvider>` দিয়ে app মোড়ানো।
- `features/cart/cartItems.ts` — `resolveCart()`: সংরক্ষিত id + qty-কে catalogue-এর নাম, দাম, stock-এর সাথে জোড়া দেয়। Sold out হয়ে যাওয়া item আলাদা করে দেয়।
- Product page-এর **Add to cart চালু** — যোগ করলে "Added 1 × Metal to your cart · View cart" বার্তা; আগেই cart-এ থাকলে "You have N in your cart"; limit পূর্ণ হলে বাটন "Limit reached in your cart"।
- Product card-এর গোল **"+" বাটন** (`components/product/QuickAdd.tsx`): একটাই variant হলে সরাসরি cart-এ, size/material থাকলে product page খোলে।
- **Cart page** (`/cart`, Cart.dc.html থেকে): প্রতিটা item-এর ছবি, নাম, variant, একক দাম, মোট, quantity stepper, Remove; ডানে Summary (Subtotal, Delivery "Set at checkout", Total before delivery, **Go to checkout**)। খালি হলে "Your cart is empty"। Sold out item থাকলে উপরে নোটিশ + Remove।
- Header-এর cart bubble এখন আসল সংখ্যা দেখায় (শুধু যা অর্ডার করা যায়)।

### মূল ধারণা
- **localStorage:** browser-এর ছোট key–value ভাণ্ডার, শুধু text রাখে। তাই `JSON.stringify` (array → text) আর `JSON.parse` (text → array)। Page reload বা browser বন্ধ করলেও থাকে।
- **কেন শুধু id + qty?** দাম বা stock browser-এ রাখলে পুরনো বা বদলানো (hack করা) দাম থেকে যেতে পারে। নিয়ম: **দাম সবসময় server ঠিক করে।** এখন mock থেকে দেখাই; পরে Go API থেকে আসবে, আর order-এর সময় Go আবার সব যাচাই করবে।
- **Context:** `createContext` + `<CartContext value={...}>` + `useContext` — props হাত-বদল না করে দূরের component-এ data পৌঁছানো (header আর product page দুজনেই একই cart দেখে)।
- **Custom hook (`useCart`)**: নিজের বানানো `use…` function, যেটা ভেতরে অন্য hook ব্যবহার করে। Provider-এর বাইরে ডাকলে পরিষ্কার error দেয়।
- **`useState(() => loadCart())`**: arrow function দিলে localStorage শুধু প্রথম render-এ একবার পড়া হয়।
- **`useEffect(() => saveCart(lines), [lines])`**: `lines` বদলালেই save — dependency array `[lines]` বলে দেয় কখন effect চলবে।
- **Immutable update:** `setLines(prev => prev.map(...))` — পুরনো array বদলাই না, নতুন array বানাই; React তখনই বোঝে কিছু বদলেছে।
- **`storage` event:** অন্য tab-এ cart বদলালে এই tab-ও আপডেট হয়।
- **`useMemo`:** cart না বদলালে context-এর object নতুন করে বানায় না (অকারণ re-render কমে)।
- **TypeScript type guard:** `function isCartLine(value: unknown): value is CartLine` — অজানা data যাচাই করে TypeScript-কে নিশ্চিত করা।

### ব্রাউজারে test
1. Shop-এ drone-এর "+" চাপো → header-এ 1। আবার চাপো → 2। Stock 3, তাই 3-এর পর "+" বন্ধ।
2. Dragon Flame Card → Metal → Add to cart → সবুজ নয়, সাদা ✓ বার্তা (রং নিয়ম মেনে)। "View cart"।
3. `/cart`-এ quantity বদলাও, Remove করো; সব সরালে খালি অবস্থা।
4. Page reload করো — cart থেকে যায়। Chrome DevTools → Application → Local Storage → `drakon.cart.v1` দেখো: শুধু id আর qty।
5. দুইটা tab খোলো; একটায় যোগ করলে অন্যটার header-ও বদলায়।
6. Console-এ `localStorage.setItem('drakon.cart.v1', '[{"variantId":"v-founders","qty":1}]')` দিয়ে reload করো → sold out নোটিশ।

### সিদ্ধান্ত / প্রশ্ন
- Cart-এর qty যদি limit/stock-এর বেশি জমা থাকে (যেমন stock পরে কমে গেছে), cart page সেটা সর্বোচ্চ সংখ্যায় নামিয়ে দেখায়। আসল যাচাই checkout-এ server করবে।
- Purchase limit এখন শুধু এই browser-এর cart-এ দেখা হয়। Blueprint অনুযায়ী আসল limit server একই ফোন নম্বরের আগের order মিলিয়ে দেখবে।

---

## ধাপ 6 — Checkout (শুধু UI, কোনো order হয় না)

### কী বানালাম
- `pages/Checkout.tsx` (`/checkout`, Checkout.dc.html থেকে), শান্ত header সহ:
  1. **Contact:** Full name*, Phone number* (01XXXXXXXXX), Email (optional)।
  2. **Delivery:** District* (64টা জেলা, `mocks/delivery.ts` থেকে), Area / Thana*; জেলা **Dhaka** হলে "Dhaka city (৳60) / Outside Dhaka city (৳100)" বাছাই*; Full address*; courier note (optional); **"This is a gift"** চাপলে receiver-এর নাম*, ফোন*, gift note (150 অক্ষর, গণনা সহ), "Leave prices off the packing slip", আর মনে করিয়ে দেওয়া যে receiver টাকা দেবে।
  3. **Payment:** শুধু Cash on Delivery।
- **Order summary** (ডানে, phone-এ নিচে): item, Subtotal, Delivery (জেলা বাছলে zone আর charge বদলায়), Pay on delivery total।
- **"Place order" বাটন বন্ধ** — লেখা "**Ordering opens soon**" (🔒 icon) আর নিচে ব্যাখ্যা "no order is placed yet"। কোনো নকল order, নকল order number বা নকল payment নেই।
- "Check my details" (secondary) বাটন — form যাচাই করে: ভুল থাকলে প্রথম ভুল field-এ cursor নিয়ে যায়; সব ঠিক হলে লেখে "Your details look complete. Ordering opens soon, so nothing has been ordered yet."
- Phone/tablet-এ নিচে আটকানো bar (total + বন্ধ বাটন), আর উপরে "Your order, see details" link।
- Cart খালি হলে checkout "Your cart is empty" দেখায়।
- `features/checkout/validation.ts` — সব নিয়ম এক জায়গায় (pure function, UI ছাড়া)। `features/checkout/deliveryQuote.ts` — জেলা → zone।
- `components/ui/Field.tsx` — label, `*` চিহ্ন, hint, error (icon + বাক্য, শুধু লাল দাগ না)।

### Phone নিয়ম
`01` দিয়ে শুরু, তৃতীয় অঙ্ক 3–9, মোট 11 অঙ্ক: `/^01[3-9]\d{8}$/`। Space, dash আর `+880`/`880` আগে মুছে ফেলা হয়, তাই `+880 1712-345678` ঠিক বলে ধরা হয়।

### মূল ধারণা
- **Controlled input:** `<input value={form.name} onChange={…}>` — input-এর মান React state-এ থাকে, state-ই সত্যের উৎস।
- **একটা object-এ পুরো form:** `useState<CheckoutForm>(emptyCheckoutForm)`; `update('name', value)` দিয়ে `{ ...prev, [name]: value }` — spread (`...`) দিয়ে পুরনো সব field কপি করে শুধু একটা বদলানো।
- **Validation = pure function:** `validateCheckout(form)` শুধু input নেয়, error-এর object ফেরত দেয়। React ছাড়াই বোঝা আর test করা সহজ।
- **কখন error দেখাব:** field ছেড়ে গেলে (`onBlur` → `touched`) বা submit করলে। টাইপ করার সময় না (Input README-র নিয়ম)।
- **Regular expression (regex):** `^` শুরু, `$` শেষ, `\d{8}` = ঠিক 8টা অঙ্ক, `[3-9]` = 3 থেকে 9-এর যেকোনো একটা।
- **`e.preventDefault()`:** form submit-এ browser-এর page reload থামানো।
- **TypeScript generic:** `function update<K extends FieldName>(name: K, value: CheckoutForm[K])` — `name` যে field, `value`-কেও সেই field-এর type হতে হবে (`isGift`-এ string দিলে build error)।
- **Mapped type:** `TextFieldName` = শুধু যেসব field string (checkbox বাদ)।
- **Accessibility:** `aria-invalid`, `aria-describedby` (hint আর error input-এর সাথে জোড়া), `role="status"` (ফলাফল screen reader পড়ে), `<fieldset>/<legend>` radio দলের জন্য, `noValidate` দিয়ে browser-এর নিজের popup বন্ধ করে নিজেদের সুন্দর বার্তা।
- **Bug যেটা ধরলাম:** 375px-এ form ডানে বেরিয়ে যাচ্ছিল। কারণ: CSS grid-এর default কলাম ভেতরের সবচেয়ে চওড়া জিনিসের সমান হতে চায়। সমাধান: `grid-cols-[minmax(0,1fr)]`। (সব page 375px-এ মেপে দেখেছি, আর কোথাও পাশে scroll নেই।)

### ব্রাউজারে test
1. Cart-এ কিছু রেখে "Go to checkout"।
2. কিছু না লিখে "Check my details" → লাল বার্তা, cursor নামের ঘরে।
3. Phone-এ `12345` লিখে Tab → ভুলের বার্তা। `+880 1712-345678` → ঠিক।
4. District = Dhaka → নতুন প্রশ্ন "Where in Dhaka?"; Outside Dhaka city বাছলে Delivery ৳100, Dhaka city বাছলে ৳60। অন্য জেলা (যেমন Sylhet) → ৳100।
5. "This is a gift" চাপো → নতুন ঘর; gift note-এ লিখলে অক্ষর গোনা দেখায়।
6. "Ordering opens soon" বাটন চাপা যায় না। কোনো order তৈরি হয় না, কিছুই কোথাও পাঠানো হয় না।
7. Reload করলে form খালি হয় — ইচ্ছা করেই: নাম/ফোন/ঠিকানা browser-এ জমা রাখি না (privacy)।

### সিদ্ধান্ত / প্রশ্ন
- **"Sign in to use your saved address" লাইন বাদ** (খোলা প্রশ্ন 3)।
- **"bKash, Nagad, cards — Coming soon" বাদ দিয়েছি।** Design-এ ছিল, কিন্তু CLAUDE.md বলে MVP-তে শুধু COD, কোনো নকল payment নয়। চাইলে পরে যোগ করা যাবে।
- **Dhaka-র "city / outside city" আগে থেকে বাছাই করা থাকে না** (design-এ "Dhaka city" আগে থেকে টিক দেওয়া ছিল)। ভুল করে কম charge দেখানো এড়াতে buyer-কে নিজে বাছতে হয়। ঠিক আছে কিনা বলো।
- Delivery আর total এখন browser-এ mock থেকে হিসাব (শুধু দেখানোর জন্য)। Go API এলে `quote` endpoint থেকে আসবে।

---

## ধাপ 7 — Sold Out archive, Track order, About, Contact (সাথে Order page)

### কী বানালাম
- **Sold Out archive** (`/sold-out`, SoldOut.dc.html থেকে): "The archive" শিরোনাম; সবচেয়ে সাম্প্রতিক sold out run বড় করে (ধূসর ছবি, দাম কাটা, "Sold out, never restocked", আর নতুন edition থাকলে link — Hoodie Edition 01 → Edition 02); তারপর "Every sold-out run" — collection chip দিয়ে filter (All / Playcards / Sports toys / Tech toys / Clothes); কিছু না থাকলে "Nothing in this collection has sold out yet."; শেষে "Shop the current drop"। Mock-এ `successorSlug` field যোগ করেছি।
- **Track order** (`/track`): Order number (DRK-7K3Q9P ধাঁচ, ছোট হাতে লিখলেও চলে) + Phone, যাচাই সহ। ঠিক থাকলে **কোনো নকল ফলাফল নয়** — শুধু বলে "Tracking opens with ordering", কারণ এখনো কোনো order নেই।
- **About** (`/about`): brand-vision.md থেকে — বাংলা উক্তি, নামের মানে, কাদের জন্য (night workers, dream chasers…), "How we make things"।
- **Contact** (`/contact`): Phone / Email / Facebook / Hours — **এখন "Coming soon"**, কারণ আসল তথ্য জানি না (`src/mocks/contact.ts`-এ `null`)। নিচে সাধারণ প্রশ্ন (order কোথায়, return, কখন call)।
- **Order confirmation** (`/order/:number`): সৎভাবে বলে "No order to show — online ordering opens soon"। নকল order number দেখায় না।
- পুরনো `ComingSoon` placeholder মুছে ফেলেছি — এখন সব route-এ আসল page।
- Gift note (150) আর courier note (200)-এর সীমাও `mocks/settings.ts`-এ সরিয়েছি, যাতে সব business সংখ্যা এক জায়গায়।

### মূল ধারণা
- **Client-side filter:** `useState('all')` + `archive.filter(...)` — chip চাপলে state বদলায়, তালিকা নতুন করে ফিল্টার হয়, server লাগে না।
- **`aria-pressed`** — toggle বাটন (chip) চাপা আছে কিনা screen reader-কে জানায়।
- **Optional field (`successorSlug?:`)** আর `&&` দিয়ে শর্তসাপেক্ষে link দেখানো।
- **`null` মানে "এখনো ঠিক হয়নি"** — `contact.phone ?? <NotSetYet />`: `??` বাঁ পাশ `null`/`undefined` হলে ডান পাশ নেয়।
- **নিয়ম মানা:** backend ছাড়া কোনো page নকল ডেটা (order, tracking ফল) দেখায় না।

### ব্রাউজারে test
1. `/sold-out` → chip "Clothes" চাপো → শুধু Hoodie; "Tech toys" → "Nothing … yet"।
2. `/track` → খালি রেখে Track → বার্তা; `abc` → format বার্তা; `drk-7k3q9p` + `01712345678` → "Tracking opens with ordering"।
3. `/about`, `/contact` দেখো। `src/mocks/contact.ts`-এ `phone: '01XXXXXXXXX'` বসিয়ে দেখো phone link হয়ে যায়।
4. `/order/DRK-12345` → "No order to show"।

### প্রশ্ন
- **Contact-এর আসল phone, email, Facebook page link আর সময় কী হবে?** `web/src/mocks/contact.ts`-এ বসালেই page-এ দেখাবে।
- Track page-এ design-এর "Recent on this device" chip আর timeline বাদ — order চালু হলে (Go API সহ) যোগ হবে।

---

## শেষ সারসংক্ষেপ

**সাতটা ধাপই শেষ, প্রতিটা আলাদা commit।** প্রতিটা commit-এর আগে `npm run build` আর `npm run lint` চালিয়ে 0 error, 0 warning। সব page 375px-এ মেপে দেখেছি — কোথাও পাশে scroll নেই। 1280px+-এও screenshot দিয়ে দেখেছি।

| ধাপ | Commit |
|---|---|
| 1 Header/Footer | `web: add SiteHeader and SiteFooter (step 1c)` |
| 2 Routing | `web: add react-router v7 routes and page shells (step 2)` |
| 3 Home, ProductCard, mocks | `web: add mock catalog, ProductCard, Home, Shop and Search pages (step 3)` |
| 4 Product page | `web: add product details page with variant picker (step 4)` |
| 5 Cart | `web: add localStorage cart, quick add and cart page (step 5)` |
| 6 Checkout UI | `web: add checkout form with validation; ordering stays disabled (step 6)` |
| 7 Sold Out, Track, About, Contact | `web: add sold-out archive, track, about, contact pages (step 7)` |

**কী করিনি (নির্দেশ অনুযায়ী):** `api/`-এ কিছু না, admin না, account/sign-in না, কোনো payment বা নকল order না, GitHub-এ push না, repo-র বাইরে কিছু না। নতুন library শুধু `react-router@7`।

**Mock data কোথায়:** `web/src/mocks/` (catalog, delivery, settings, contact)। Page-গুলো mock সরাসরি না পড়ে `web/src/lib/` আর `web/src/features/`-এর function দিয়ে পড়ে, তাই Go API এলে শুধু ওই function বদলাবে।

### তোমার জন্য সব প্রশ্ন এক জায়গায়
1. **react-router v8** এসেছে; v7 রেখেছি। ঠিক আছে?
2. **Dhaka city / outside** — checkout-এ আগে থেকে বাছাই না রেখে buyer-কে বাছতে বাধ্য করেছি। ঠিক আছে?
3. **bKash/Nagad "Coming soon"** লাইন বাদ দিয়েছি (COD-only নিয়ম)। রাখতে চাও?
4. **Contact তথ্য** (phone, email, Facebook, সময়) দাও।
5. **Policy page-এর** `[ ]` জায়গাগুলোর লেখা (return-এ delivery charge কে দেবে ইত্যাদি)।
6. Home-এর header **design-এ hero ছবির উপর transparent**; আমি সব page-এ একই glass header রেখেছি (সহজ ও স্থির)। Transparent চাইলে বলো।
7. Product-এর `[ ]` বর্ণনা (material, size chart) — পরে admin থেকে আসবে।

### সকালে প্রথমে কী দেখবে
```zsh
cd ~/Desktop/projects/Drakon/drakon
git log --oneline | head -8
cd web && npm run dev
```
তারপর পুরো পথটা হেঁটে দেখো: Home → collection → product → variant বাছাই → Add to cart → Cart → Checkout (form ভরে "Check my details") → Track → Sold out।

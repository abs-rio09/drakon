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


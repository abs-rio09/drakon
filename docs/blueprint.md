# Drakon Blueprint (Task 1)

Status: ভাগ ১–৩ সম্পন্ন (2026-10-06)। ভাগ ৪–১১ খসড়া লেখা হয়েছে (2026-10-14), Abu Bakkar Siddik-এর অনুমোদন বাকি — 🟡 চিহ্নিত সিদ্ধান্তগুলো (১ নম্বর ✅ হয়ে গেছে)।

## Blueprint ভাগ
1. MVP বাছাই ✅
2. Business rules ✅
3. Tech stack মূল্যায়ন ✅
4. System architecture 📝 খসড়া (diagram: Technical_Direction_v2.drawio)
5. Database design 📝
6. Sitemap 📝
7. Customer flow 📝
8. Admin flow 📝
9. API + folder structure 📝
10. Roadmap 📝
11. Risks 📝

## সিদ্ধান্ত
- বিক্রি শুধু Bangladesh-এ; international পরে (database extensible রাখা হবে)
- Trade license নেই → MVP শুধু Cash on Delivery; online payment (bKash/Nagad/Card) পরে, code-এ plug-in করার মতো জায়গা রাখা হবে
- Architecture: React + TS + Tailwind → Go REST API → PostgreSQL। Frontend কখনো সরাসরি database ছোঁবে না
- Crypto বাদ (Bangladesh-এ আইনি ঝুঁকি)
- ✅ Frontend tool চূড়ান্ত (2026-10-13): **Vite**, Next.js নয়। আর খোলা প্রশ্ন নয়।

## Tech Stack (ভাগ ৩)
- Frontend: Vite + React + TypeScript + Tailwind (Next.js নয় — Node server এড়াতে)
- পুরনো Next.js scaffold ("website for Drakon") থেকে React component, TypeScript আর Tailwind নেওয়া হবে; `next/link` → `react-router`, `next/image` → সাধারণ `<img>`, Supabase বাদ (login হবে Go দিয়ে)। কোড সরানোর কাজ frontend শুরুর সময় ধাপে ধাপে।
- Facebook/Google share-এর জন্য Go server product page-এর HTML-এ meta tag (ছবি, নাম, দাম) বসিয়ে পাঠাবে
- Backend: Go standard `net/http` + pgx (driver) + sqlc (SQL → Go code) + goose (migration)। ORM নয়
- Auth: HttpOnly cookie session (localStorage-এ token নয়), password bcrypt hash
- Database: PostgreSQL (local-এ Docker দিয়ে)
- Dev tools: Node.js (শুধু Vite চালাতে), Go, PostgreSQL, VS Code, Git

## Services — সিদ্ধান্ত: এখন শুধু ফ্রি, কোনো paid নয়
- Frontend hosting: Cloudflare Workers Static Assets (ফ্রি) — ✅ 2026-10-15 চূড়ান্ত (Pages-এর বদলে)
- ছবি: Cloudflare R2 (10 GB ফ্রি, egress ফ্রি)
- Email: Resend (ফ্রি: 3,000/মাস, 100/দিন)
- Database: Neon (ফ্রি: 1 GB/project; 5 মিনিট অব্যবহারে ঘুমায়)
- Go backend: Render ফ্রি plan (অব্যবহারে ঘুমায়)
- Domain নেই এখন → ফ্রি subdomain ব্যবহার
- জানা সীমাবদ্ধতা: ফ্রি server ঘুমায় (প্রথম load ধীর); নিজের domain ছাড়া customer-দের email পাঠানো যাবে না
- পরে যখন দরকার হবে: Render Starter ($7/মাস), .com domain (~$10.46/বছর); ডলারে বিল দিতে international/dual-currency card লাগবে
- পরের বিকল্প: Hetzner VPS (নিজে server সামলাতে হবে)

## চূড়ান্ত MVP
- Product (size/color variant, একাধিক ছবি), Category, নাম দিয়ে search
- Lifecycle DRAFT → ACTIVE ⇄ SOLD_OUT → ARCHIVED + Sold Out Showcase
- Cart, Guest checkout, COD
- Overselling ঠেকানো (database-এ নিরাপদ stock কমানো)
- Delivery charge database setting থেকে (zone ভিত্তিক)
- Order status: PENDING → CONFIRMED → SHIPPED → DELIVERED / CANCELLED
- Order confirmation, admin ফোনে COD যাচাই
- Order tracking (order number + phone)
- Admin: login, product, category, stock, order, settings, সাধারণ বিক্রির হিসাব
- পেজ: About, Contact, Return/Refund, Terms, Privacy
- Mobile-first, হালকা animation

## Business Rules (ভাগ ২)
1. **Purchase limit:** প্রতিটা product-এ admin limit বসাবে; না বসালে default 5। Guest-দের limit ফোন নম্বর দিয়ে চেক।
2. **Cancel:** PENDING/CONFIRMED অবস্থায় customer নিজে (order number + phone) cancel করতে পারবে; SHIPPED-এর পর শুধু admin। Cancel হলে stock ফেরত।
3. **Return:** যেকোনো কারণে return নেওয়া হবে, ডেলিভারির 3 দিনের মধ্যে (admin setting)।
   - Company-র ভুল (ভাঙা/ভুল product/ভুল size) → delivery খরচ company-র
   - অন্য কারণ → delivery খরচ customer-এর; শুধু অব্যবহৃত, tag লাগানো, seal না খোলা অবস্থায়
   - COD refund হাতে (bKash/Nagad-এ পাঠানো), admin panel-এ রেকর্ড
4. **COD যাচাই:** 48 ঘণ্টায় ফোনে confirm না হলে auto-CANCELLED, stock ফেরত, customer-কে email। সময় admin setting। বারবার order না নেওয়া ফোন নম্বর admin block করতে পারবে।
5. **Delivery zone:** Customer জেলা বাছবে; ঢাকা হলে "ঢাকা সিটি / ঢাকা সিটির বাইরে"। Zone: Inside Dhaka = 60, Outside Dhaka = 100। জেলা/এলাকা → zone mapping এবং charge admin নিয়ন্ত্রণ করবে; নতুন zone যোগ করা যাবে।
6. **Free delivery:** "এত টাকার বেশি হলে free" setting + on/off, launch-এ off। Zone অনুযায়ী আলাদা করা যাবে। Coupon দিয়ে free delivery পরে।
7. **Notification:** ফোন বাধ্যতামূলক, email ঐচ্ছিক ("Order-এর আপডেট পেতে email দিন")। Order-এর পর স্ক্রিনে order number + Copy বাটন। Status বদলালে স্বয়ংক্রিয় notification: email থাকলে email, না থাকলে website-এ (পরে SMS)। Login ছাড়া tracking: order number + phone, এবং ব্রাউজার সাম্প্রতিক order মনে রাখবে (শুধু order number + গোপন key, ব্যক্তিগত তথ্য না)। SMS-এর জন্য notification module-এ জায়গা রাখা।
8. **Admin:** MVP-তে একটাই Owner account। Database-এ role ঘর (শুরুতে OWNER), পরে Staff role। Password শেয়ার নয়। শক্ত password, বারবার ভুল হলে সাময়িক login বন্ধ, admin URL customer site-এ দেখানো হবে না। Audit log পরে।
9. **Lifecycle:** DRAFT → ACTIVE ⇄ SOLD_OUT → ARCHIVED।
   - প্রতিটা product-এ "Limited: হ্যাঁ/না"। Limited → stock 0 হলে SOLD_OUT, Showcase-এ। সাধারণ → "Out of stock", restock করা যায়।
   - Variant: একটা size শেষ হলে শুধু সেটা disabled; সব শেষ হলে SOLD_OUT।
   - Cancel/return-এ stock ফিরলে SOLD_OUT → আবার ACTIVE।
   - SOLD_OUT হওয়ার 7 দিন পর (admin setting) auto-ARCHIVED, বা admin হাতে।
   - ARCHIVED → ACTIVE শুধু Owner: সতর্কবার্তা, কারণ লেখা বাধ্যতামূলক, রেকর্ড থাকবে।
   - কোনো product কখনো delete হবে না।
10. **দাম ও currency:** শুধু BDT। দাম integer পয়সায় (৳599.50 = 59950), প্রতিটা দামের সাথে currency ঘর। দাম DRAFT-এ বদলানো যাবে; ACTIVE হলে তালাবদ্ধ; জরুরি সংশোধন শুধু Owner (সতর্কবার্তা + কারণ + রেকর্ড)। Publish-এর আগে দাম নিশ্চিতকরণ। Order তৈরির সময় দাম, delivery charge, product নাম order-এ কপি (snapshot)।

## MVP-এর পরে
Customer account + order history, review (verified buyer), wishlist, Create With Drakon, coupon, reward points, online payment, SMS, Staff role, audit log, পূর্ণ analytics

## ভবিষ্যতে
International বিক্রি, smart products, একাধিক ভাষা

---

# ভাগ ৪–১১ (খসড়া, 2026-10-14)

> এই অংশ Claude রাতে লিখেছে, Abu Bakkar Siddik এখনো অনুমোদন দেয়নি। "🟡 সিদ্ধান্ত দরকার" লেখা জায়গাগুলোতে Abu Bakkar Siddik হ্যাঁ/না বললে তারপর চূড়ান্ত হবে। ভাগ ১–৩ এর কোনো নিয়ম এখানে বদলানো হয়নি।

## ভাগ ৪ — System architecture

```
Customer / Admin (browser, mobile)
        │  https://drakon.<account>.workers.dev
        ▼
Cloudflare Worker ── Vite + React build (static ফাইল)
        │  /api/*  → Worker-এর ছোট proxy code (শুধু request পাঠিয়ে দেয়)
        ▼
Render (ফ্রি) ── Go REST API: validation, business rules, auth, background jobs
        │  SQL (pgx + sqlc)
        ▼
Neon (ফ্রি) ── PostgreSQL

পাশে: Cloudflare R2 (product ছবি) · Resend (email, domain আসার পরে) · Payment gateway (পরে, dashed)
```

**মূল নিয়ম**
- Frontend শুধু দেখায়। দাম, stock, delivery charge, limit — সব হিসাব Go server-এ হয়, database থেকে নিয়ে। Browser যা পাঠায় তা বিশ্বাস করা হয় না।
- Frontend কখনো সরাসরি database ছোঁয় না (Technical_Direction_v2.drawio-এর মতোই)।
- Business-এর সংখ্যা (60/100 টাকা, 48 ঘণ্টা, limit 5, 3 দিন, 7 দিন) code-এ লেখা থাকবে না; database-এর `settings` আর `delivery_zones` table থেকে আসবে।

**✅ সিদ্ধান্ত ১ — `/api` proxy + Cloudflare Workers hosting (Abu Bakkar Siddik হ্যাঁ বলেছে, 2026-10-15)**
- সমস্যা: website Cloudflare-এ (`workers.dev`) আর API `onrender.com`-এ থাকলে login cookie "third-party cookie" হয়ে যায়। Safari আর অনেক phone browser সেটা আটকে দেয়, তখন admin login কাজ করবে না।
- সমাধান: Cloudflare-এর একটা ছোট code `/api/*` request-গুলো Render-এ পাঠিয়ে দেবে। Browser ভাববে সব একই site (`drakon.<account>.workers.dev/api/...`)। Cookie ঠিক থাকবে, CORS ঝামেলাও থাকবে না।
- এটা Node/Express server নয়। মাত্র ~15 লাইনের JS, Cloudflare-এর ফ্রি plan-এ চলে।
- Local-এ একই কাজ Vite-এর `server.proxy` করবে। তাই dev আর production একই রকম থাকবে।
- **Context7 যাচাই (2026-10-15):** Cloudflare-এর docs এখন বলছে নতুন প্রজেক্ট **Pages নয়, Workers Static Assets** দিয়ে শুরু করতে। Pages চলবে, কিন্তু নতুন feature শুধু Workers-এ আসছে। তাই সুপারিশ বদলেছে: একটা Worker build করা React ফাইল দেবে (`not_found_handling: "single-page-application"`), আর `run_worker_first: ["/api/*"]` দিয়ে শুধু `/api` request-গুলো Worker-এর code-এ যাবে, সেখান থেকে Render-এ। ঠিকানা হবে `drakon.<তোমার-account>.workers.dev`। কাজ আর খরচ একই, শুধু জায়গা বদল।

**🟡 সিদ্ধান্ত দরকার ২ — Facebook share preview (meta tag)**
- ভাগ ৩-এ লেখা ছিল "Go server product page-এর HTML-এ meta tag বসাবে"। কিন্তু HTML এখন Cloudflare থেকে যাবে, Go থেকে নয়। তাই এই লাইনটা বর্তমান architecture-এর সাথে মেলে না।
- সুপারিশ: একই Worker `/product/*` page-এর জন্য Go API থেকে নাম, ছবি আর দাম এনে `<head>`-এ og:title, og:image বসাবে। কাজটা বাকি সব ঠিকঠাক চালু হওয়ার পরে (roadmap ধাপ ১০)।

**Background job (auto-cancel 48 ঘণ্টা, auto-archive 7 দিন)**
- Render-এর ফ্রি server ঘুমিয়ে পড়ে, তাই "প্রতি ঘণ্টায় চালাও" ধরনের cron-এর ওপর ভরসা করা যায় না।
- সমাধান:
  - Server চালু হলেই একবার sweep চালাবে।
  - জেগে থাকা অবস্থায় প্রতি 10 মিনিটে sweep চালাবে।
  - Admin order list খোলার আগেও sweep চালাবে।
- কেউ server না জাগালে কোনো পুরনো অবস্থা কারো চোখেও পড়ে না, তাই ফল একই থাকে।
- পরে চাইলে Cloudflare-এর ফ্রি Cron Worker দিয়ে নির্দিষ্ট সময়ে server জাগানো যাবে।

## ভাগ ৫ — Database design

টাকা সবসময় `BIGINT` পয়সায় (`*_paisa`), সাথে `currency` ঘর (এখন সবসময় 'BDT')। সময় `TIMESTAMPTZ`। কোনো product বা order delete হয় না।

**Catalog**
| Table | মূল ঘর | নোট |
|---|---|---|
| `categories` | id, slug (unique), name, sort_order, is_active | Delete নয়, শুধু বন্ধ (is_active=false) |
| `products` | id, category_id, slug (unique), name, story, status (DRAFT/ACTIVE/SOLD_OUT/ARCHIVED), is_limited, purchase_limit (খালি = settings-এর default), sold_out_at, archived_at, created_at, updated_at | `status` Postgres enum |
| `product_images` | id, product_id, url, alt, sort_order | ছবি R2-তে, এখানে শুধু link |
| `product_variants` | id, product_id, sku (unique), label (size/color/material), price_paisa, currency, stock, is_active | `CHECK (stock >= 0)` থাকায় database নিজেই overselling আটকায়। দাম variant-এ থাকায় এক product-এর ভিন্ন variant ভিন্ন দামে বিক্রি করা যায়। |
| `inventory_movements` | id, variant_id, change (+/-), reason (ORDER/CANCEL/RETURN/RESTOCK/ADJUST), order_id, note, created_at | Stock কেন বাড়ল বা কমল তার খাতা |
| `product_events` | id, product_id, type (PUBLISH/SOLD_OUT/ARCHIVE/REACTIVATE/PRICE_FIX), reason, old_value, new_value, by_admin_id, created_at | Owner-এর ঝুঁকিপূর্ণ কাজের (কারণসহ) রেকর্ড |

**Delivery আর settings**
| Table | মূল ঘর | নোট |
|---|---|---|
| `delivery_zones` | id, code (INSIDE_DHAKA…), name, charge_paisa, free_over_paisa (খালি = বন্ধ), is_active | শুরুর data: 6000 আর 10000 পয়সা |
| `delivery_areas` | id, district, area_label ("Dhaka City" / "Outside Dhaka City" / বাকি জেলা), zone_id | জেলা থেকে zone ঠিক হয়, admin বদলাতে পারে |
| `settings` | key (PK), value (JSONB), updated_at | cod_confirm_hours=48, default_purchase_limit=5, return_days=3, archive_after_days=7, free_delivery_enabled=false |

**Order**
| Table | মূল ঘর | নোট |
|---|---|---|
| `orders` | id, order_number (unique, যেমন DRK-7K3Q9P, এলোমেলো), track_token_hash, customer_id (খালি = guest), name, phone, email (ঐচ্ছিক), district, area, address, courier_note, zone_code + delivery_paisa (snapshot), subtotal_paisa, total_paisa, currency, payment_method ('COD'), status, is_gift, gift_receiver_name, gift_receiver_phone, gift_note, courier_name, courier_tracking, created_at, confirmed_at, cancelled_at, cancel_reason | Order number এলোমেলো রাখা হবে, যাতে কেউ মোট order সংখ্যা আন্দাজ করতে না পারে |
| `order_items` | id, order_id, variant_id, product_name, variant_label, unit_price_paisa, qty, line_total_paisa | নাম আর দাম order-এর সময়ের কপি (snapshot) |
| `order_status_history` | id, order_id, from_status, to_status, by (CUSTOMER/ADMIN/SYSTEM), note, created_at | Tracking timeline এখান থেকে দেখানো হবে |
| `payments` | id, order_id, method (COD), amount_paisa, status (PENDING/COLLECTED/REFUNDED), collected_at, ref | পরে bKash/Nagad এলে নতুন method যোগ হবে, table বদলাতে হবে না |
| `returns` | id, order_id, reason_type (COMPANY_FAULT/OTHER), note, delivery_paid_by, refund_paisa, refund_method (BKASH/NAGAD/CASH), refund_ref, status, created_at | |
| `blocked_phones` | phone (PK), reason, created_at | |
| `notifications` | id, order_id, channel (EMAIL/SITE/SMS), status, sent_at, error | Email পাঠানো গেল কিনা তার রেকর্ড |

**Login**
| Table | মূল ঘর | নোট |
|---|---|---|
| `admins` | id, email, password_hash (bcrypt), role (OWNER), failed_attempts, locked_until | MVP-তে শুধু একজন Owner |
| `sessions` | id_hash, admin_id বা customer_id, expires_at, created_at | Browser-এ শুধু এলোমেলো session id যায় (HttpOnly cookie) |
| `customers` | id, name, phone, email, password_hash, created_at | 🟡 নিচের সিদ্ধান্ত ৩ দেখো |

**পুরনো ER diagram (drakon_database_table_relationships.html) থেকে যা বদলানো হলো**
- COLLECTIONS → `categories`। Drop বা collection পরে আলাদা table হতে পারে।
- VARIANT_PRICES → দাম সরাসরি variant-এ (MVP-তে একটাই currency, তাই আলাদা table লাগবে না)।
- INVENTORY → stock সরাসরি variant-এ, সাথে `inventory_movements`।
- SHIPMENTS → MVP-তে order-এ শুধু courier_name আর courier_tracking।

**Overselling কীভাবে আটকানো হবে (সহজ ভাষায়)**
- Order তৈরি একটা transaction-এর ভেতরে হয়। হয় পুরো কাজটা হবে, নয়তো কিছুই হবে না।
- প্রতিটা item-এর জন্য চলে: `UPDATE product_variants SET stock = stock - $qty WHERE id = $id AND stock >= $qty`।
- কোনো row না বদলালে বুঝতে হবে stock শেষ। তখন পুরো order বাতিল হয় (rollback)।
- এক সাথে দুজন শেষ কার্ডটা কিনতে চাইলেও শুধু একজনই পাবে।

**🟡 সিদ্ধান্ত দরকার ৩ — Customer account MVP-তে নাকি পরে?**
- Design-এ Sign in, Sign up আর Account screen তৈরি আছে, কিন্তু ভাগ ১-এ এটা "MVP-এর পরে" লেখা।
- সুপারিশ: আগে guest checkout আর tracking চালু হোক, account পরে যোগ হবে।
- `orders.customer_id` খালি রাখার সুযোগ আগে থেকেই আছে, তাই পরে account যোগ করতে database ভাঙতে হবে না।

## ভাগ ৬ — Sitemap

**Customer site**
- `/` Home
- `/shop`, `/shop/:category` সব product, category অনুযায়ী
- `/product/:slug` Product details
- `/search?q=` নাম দিয়ে search
- `/sold-out` Sold Out Showcase (archive)
- `/cart` Cart
- `/checkout` Checkout (guest, COD, gift option)
- `/order/:number` Confirmation (order number + Copy)
- `/track` Track ও cancel (order number + phone)
- `/about` Brand story · `/contact`
- `/policies/returns` · `/policies/terms` · `/policies/privacy`
- পরে: `/signin`, `/signup`, `/account` (সিদ্ধান্ত ৩-এর ওপর নির্ভর করে)

**Admin (customer site-এ কোথাও link নেই, `noindex`)**
- `/admin/login`
- `/admin` Dashboard: আজকের call list, বিক্রির হিসাব
- `/admin/orders`, `/admin/orders/:id`
- `/admin/products`, `/admin/products/new`, `/admin/products/:id`
- `/admin/categories`
- `/admin/delivery` zone, charge, জেলা mapping
- `/admin/settings` 48 ঘণ্টা, limit, return দিন, archive দিন, free delivery
- `/admin/blocked-phones` · `/admin/returns`

## ভাগ ৭ — Customer flow

1. **দেখা:** Home → Shop/Category → Product। Account লাগে না।
2. **Cart:** Variant বেছে "Add to cart"। Cart browser-এ (localStorage) থাকে, শুধু variant id আর qty। দাম আর stock server থেকে আসে।
3. **Checkout:** নাম → ফোন (বাধ্যতামূলক) → email (ঐচ্ছিক) → জেলা।
   - ঢাকা হলে বাছবে "Dhaka City / Outside Dhaka City"।
   - তারপর এলাকা → ঠিকানা → courier note → gift (ঐচ্ছিক: receiver-এর নাম, ফোন, note)।
4. **দাম দেখা:** প্রতিবার জেলা বা cart বদলালে server `quote` হিসাব করে subtotal, delivery আর total দেখায়। Payment শুধু "Cash on Delivery"।
5. **Order দেওয়া:** Server আবার সব যাচাই করে:
   - stock
   - purchase limit (একই ফোনের আগের চালু order মিলিয়ে)
   - blocked phone
   - তারপর transaction-এ stock কমিয়ে order তৈরি করে, status PENDING।
6. **Confirmation:** Order number + Copy বাটন। স্ক্রিনে লেখা থাকে "48 ঘণ্টার মধ্যে আমরা ফোন করব" (ঘণ্টার সংখ্যা settings থেকে আসে)। Browser order number + গোপন token মনে রাখে।
7. **ফোন যাচাই:** Admin ফোন করে।
   - কথা হলে CONFIRMED।
   - 48 ঘণ্টায় না হলে SYSTEM নিজে CANCELLED করে, stock ফেরত যায়।
8. **Tracking:** `/track`-এ order number + phone দিলে timeline দেখায়। PENDING বা CONFIRMED অবস্থায় customer নিজে cancel করতে পারে।
9. **Delivery:** SHIPPED (courier-এর তথ্যসহ) → DELIVERED (COD টাকা জমা)।
10. **Return:** ডেলিভারির 3 দিনের মধ্যে Contact-এ যোগাযোগ করবে। MVP-তে admin হাতে return রেকর্ড করবে।

## ভাগ ৮ — Admin flow

**প্রতিদিনের order কাজ**
1. Login (ভুল password বারবার দিলে সাময়িক lock)।
2. Dashboard: "আজ ফোন করতে হবে" list, সবচেয়ে পুরনো PENDING order আগে, প্রতিটার পাশে বাকি সময় দেখায়।
3. Order খুলে ফোন করবে → Confirm বা Cancel (কারণ লিখে)। দরকার হলে ফোন নম্বর block করবে।
4. প্যাক করে courier-এ দেবে → SHIPPED (courier নাম আর tracking)।
5. DELIVERED হলে COD payment COLLECTED।
6. Return এলে return রেকর্ড → stock ফেরত (যদি বিক্রির মতো অবস্থায় থাকে) → refund রেকর্ড (bKash/Nagad ref)।

**Product কাজ**
1. New product (DRAFT) → category, নাম, story, Limited হ্যাঁ/না, purchase limit।
2. ছবি যোগ করা → variant (label, দাম, stock)।
3. Publish-এর আগে দাম নিশ্চিত করার screen → ACTIVE (এরপর দাম তালাবদ্ধ)।
4. Stock 0 হলে:
   - Limited product SOLD_OUT হয়, 7 দিন পর ARCHIVED (Showcase-এ থাকে)।
   - সাধারণ product "Out of stock" দেখায়, restock করা যায়।
5. ARCHIVED → ACTIVE বা দাম সংশোধন: শুধু Owner, সতর্কবার্তা আর কারণ লিখতে হবে, `product_events`-এ রেকর্ড থাকে।

**Settings কাজ:** Delivery zone, charge আর জেলা mapping। 48 ঘণ্টা, limit, return দিন, archive দিন, free delivery on/off। কোনো code বদলাতে হয় না।

## ভাগ ৯ — API আর folder structure

**Public API** (সব JSON, `/api` দিয়ে শুরু)
| Method | Path | কাজ |
|---|---|---|
| GET | `/api/health` | Server বেঁচে আছে কিনা |
| GET | `/api/categories` | Category list |
| GET | `/api/products?category=&q=&page=` | ACTIVE product (SOLD_OUT গুলো Showcase-এ) |
| GET | `/api/products/:slug` | Product + ছবি + variant + stock অবস্থা |
| GET | `/api/sold-out` | Showcase (SOLD_OUT + ARCHIVED) |
| GET | `/api/delivery/areas` | জেলা/এলাকা → zone + charge |
| POST | `/api/checkout/quote` | Cart + এলাকা → subtotal, delivery, total, সমস্যা |
| POST | `/api/orders` | Order তৈরি → order_number + track token |
| POST | `/api/orders/track` | order_number + phone (বা token) → status timeline |
| POST | `/api/orders/cancel` | order_number + phone → cancel (PENDING/CONFIRMED হলে) |
| GET | `/api/settings/public` | Policy page-এর সংখ্যা (return দিন, ঘণ্টা) |

**Admin API** (`/api/admin/...`, session cookie লাগবে)
- `POST login`, `POST logout`, `GET me`
- `GET/POST products`, `GET/PATCH products/:id`
- `POST products/:id/publish`, `.../archive`, `.../reactivate` (কারণ), `.../price-fix` (কারণ)
- `POST products/:id/images`, `PATCH/DELETE images/:id`
- `POST products/:id/variants`, `PATCH variants/:id`, `POST variants/:id/stock` (change + কারণ)
- `GET/POST/PATCH categories`
- `GET orders?status=`, `GET orders/:id`, `POST orders/:id/status` (to + note), `POST orders/:id/returns`
- `GET/PUT delivery/zones`, `GET/PUT delivery/areas`, `GET/PUT settings`
- `GET/POST/DELETE blocked-phones`, `GET reports/summary?from=&to=`

নিরাপত্তা:
- Admin cookie: `HttpOnly; Secure; SameSite=Lax`।
- যে request কিছু বদলায় (POST, PATCH, PUT, DELETE), তাতে server `Origin` header মিলিয়ে দেখবে (CSRF থেকে রক্ষা)।
- সব input server-এ যাচাই হবে। Error সবসময় একই আকারে আসবে: `{ "error": { "code", "message" } }`।

**Folder structure (একটা repo: `drakon`)**
```
drakon/
├── CLAUDE.md            ← Claude Code-এর নিয়ম
├── README.md
├── .gitignore
├── docker-compose.yml   ← local PostgreSQL
├── docs/                ← blueprint, সিদ্ধান্ত, খোলা প্রশ্ন
├── web/                 ← Vite + React + TS + Tailwind
│   ├── worker/index.ts   ← Cloudflare /api proxy (deploy-এর সময়), সাথে wrangler.jsonc
│   └── src/
│       ├── main.tsx, App.tsx (routes)
│       ├── pages/       ← প্রতিটা page একটা ফাইল (Home, Shop, Product, Cart…)
│       ├── components/  ← ProductCard, Button, GalleryLabel, SiteHeader…
│       ├── features/    ← cart/, checkout/, track/, admin/
│       ├── lib/         ← api.ts (fetch), money.ts (পয়সা → ৳)
│       └── styles/      ← tokens (design system-এর রং, font, spacing)
└── api/                 ← Go
    ├── cmd/server/main.go
    ├── internal/
    │   ├── config/      ← env পড়া (DATABASE_URL, PORT…)
    │   ├── httpapi/     ← router, middleware, handler
    │   ├── catalog/     ← product, category logic
    │   ├── orders/      ← checkout, stock, status, limit
    │   ├── delivery/    ← zone, charge
    │   ├── auth/        ← session, bcrypt, lockout
    │   ├── jobs/        ← auto-cancel, auto-archive sweep
    │   └── db/          ← sqlc-এর তৈরি Go code (হাতে লেখা নয়)
    ├── db/migrations/   ← goose SQL ফাইল (001_catalog.sql…)
    ├── db/queries/      ← sqlc-এর জন্য SQL query
    └── sqlc.yaml
```

## ভাগ ১০ — Roadmap (শেখা + বানানো একসাথে)

প্রতিটা ধাপ ছোট। প্রতিটা ধাপে থাকবে: কী বানাচ্ছি, কেন, ফাইল, code, কীভাবে চালাবে, কীভাবে test করবে, আর common error।

| # | বানাবে | এই ধাপে যা শিখবে | শেষে যা দেখা যাবে |
|---|---|---|---|
| 0 | Repo, CLAUDE.md, tool install (Node, Go, Docker) | Git, terminal | `git log`-এ প্রথম commit |
| 1 | Vite app + design tokens + SiteHeader/Footer | JS/TS-এর ন্যূনতম, React component | কালো DRAKON shell browser-এ |
| 2 | Home, Shop, Product page (নকল data) | Props, list, routing (react-router) | Design canvas-এর মতো page |
| 3 | Cart (localStorage) | State, useEffect | Cart-এ যোগ/বাদ |
| 4 | Local PostgreSQL + catalog migration + seed | SQL: CREATE TABLE, INSERT, SELECT, JOIN | `psql`-এ product দেখা |
| 5 | Go API: health, categories, products | Go net/http, JSON, sqlc | `curl /api/products` |
| 6 | Web ↔ API যুক্ত করা (Vite proxy) | fetch, loading/error অবস্থা | আসল data দিয়ে Shop |
| 7 | Delivery zone + checkout quote + order তৈরি | Transaction, validation | Order DB-তে, confirmation screen |
| 8 | Track + customer cancel | Status machine | `/track` কাজ করে |
| 9 | Admin login + order screen + status বদলানো | Cookie session, bcrypt, middleware | Admin দিয়ে order CONFIRMED |
| 10 | Admin product/variant/ছবি, settings, Sold Out, jobs, meta tag | File upload, background job | Admin থেকে নতুন product publish |
| 11 | Policy page, About, mobile ঠিক করা, SEO | Responsive, accessibility | Phone-এ সব page ঠিকঠাক |
| 12 | Deploy: Neon, Render, Cloudflare Worker + proxy, R2 | Environment variable, build | `drakon.<account>.workers.dev` live |
| 13 | Production review (Phase 5 checklist) | Security, backup, test | Launch-এর জন্য তৈরি |

এরপর (MVP-এর পরে): customer account → review → wishlist → Create With Drakon → coupon → reward points → online payment।

## ভাগ ১১ — বড় ঝুঁকি আর যে ভুলগুলো এড়াতে হবে

| ঝুঁকি | কেন বিপদ | কী করব |
|---|---|---|
| Browser-এর পাঠানো দাম বিশ্বাস করা | যে কেউ ৳1-এ order দিতে পারবে | দাম সবসময় server আর DB থেকে |
| Overselling | Limited কার্ড দুজনের কাছে বিক্রি হয়ে যাবে | `stock >= qty` শর্তসহ UPDATE, transaction-এর ভেতরে |
| ভুয়া COD order | Stock আটকে থাকে, courier খরচ নষ্ট হয় | 48 ঘণ্টা auto-cancel, phone block, purchase limit, 🟡 rate limit |
| `.env` বা password GitHub-এ চলে যাওয়া | Public repo, সবাই দেখবে | `.gitignore`-এ `.env`, শুধু `.env.example` commit |
| ফ্রি server ঘুমিয়ে থাকা | প্রথম load 30–60 সেকেন্ড | "Loading" অবস্থা দেখানো, launch-এর আগে Render Starter ভাবা |
| Cross-site cookie | Phone-এ admin login কাজ করবে না | `/api` proxy (সিদ্ধান্ত ১) |
| Business সংখ্যা code-এ লিখে ফেলা | দাম বা charge বদলাতে code বদলাতে হবে | `settings` আর `delivery_zones` table |
| পয়সার হিসাবে float ব্যবহার | 0.1 + 0.2 ≠ 0.3 ধরনের ভুল | সব টাকা integer পয়সায় |
| Product delete করা | Order history ভেঙে যাবে, archive হারাবে | Delete নেই, শুধু status বদলায় |
| Neon ফ্রি-তে backup কম | Data হারানোর ঝুঁকি | সপ্তাহে একবার `pg_dump` (roadmap ধাপ 13-এ ঠিক হবে) |
| একসাথে সব শেখার চেষ্টা | ক্লান্তি, কাজ আটকে যাওয়া | প্রতি ধাপে শুধু যতটুকু লাগে |
| আসল brand-এর ছবি বা logo ব্যবহার | Copyright সমস্যা | শুধু নিজের ছবি আর design |
| Policy ছাড়া launch | Customer-এর আস্থা কমে, Facebook ad-এ সমস্যা হতে পারে | Return, Terms, Privacy page MVP-তেই |

**🟡 সিদ্ধান্ত দরকার ৪ — Spam থেকে রক্ষা (সুপারিশ: হ্যাঁ, ধাপ 7-এ)**
- Checkout, track আর admin login-এ Go-তে সাধারণ rate limit (প্রতি IP-তে প্রতি মিনিটে কতবার)।
- দরকার হলে পরে Cloudflare Turnstile যোগ হবে (ফ্রি, ছবি বাছাইয়ের ঝামেলা নেই)।

---

## Docs যাচাই (Context7, 2026-10-15)

Plan-এ যে library-গুলো আছে, তাদের বর্তমান docs মিলিয়ে দেখা হয়েছে:

| বিষয় | বর্তমান docs যা বলে | Plan-এ প্রভাব |
|---|---|---|
| Hosting | Cloudflare নতুন প্রজেক্টের জন্য **Workers Static Assets** সুপারিশ করে, Pages নয় | ভাগ ৪-এর সিদ্ধান্ত ১ আপডেট (Pages → Workers) |
| Tailwind | v4: `npm install tailwindcss @tailwindcss/vite`, CSS-এ `@import "tailwindcss";`, রং/font `@theme { --color-… }` দিয়ে CSS-এই। `tailwind.config.js` লাগে না | Design token সরাসরি CSS-এ বসবে |
| React Router | v7-এ শুধু `npm i react-router`, import `"react-router"` থেকে। `react-router-dom` শুধু পুরনো নামের re-export | পুরনো tutorial-এর `react-router-dom` এড়াও |
| Vite | Vite 8 এসেছে। `npm create vite@latest web -- --template react-ts`। `server.proxy` দিয়ে `/api` → `http://localhost:8080` | আগের plan-ই ঠিক |
| sqlc | `sql_package: "pgx/v5"`। `schema:`-এ goose migration ফোল্ডার দেওয়া যায়, sqlc `-- +goose Down` অংশ বাদ দেয়। ফাইলের নাম শূন্য দিয়ে শুরু (`00001_…`) | `db/migrations` একই সাথে goose আর sqlc দুজনেই পড়বে |

# খোলা প্রশ্ন (Abu Bakkar Siddik-এর উত্তর দরকার)

উত্তর না আসা পর্যন্ত এগুলো build করা হবে না।

| # | প্রশ্ন | Claude-এর সুপারিশ | উত্তর |
|---|---|---|---|
| 1 | `/api` proxy দিয়ে API একই site-এ আনা (login cookie phone-এ কাজ করার জন্য)। **আপডেট:** Cloudflare এখন নতুন প্রজেক্টে Pages-এর বদলে Workers সুপারিশ করে, তাই hosting হবে Workers Static Assets (`drakon.<account>.workers.dev`) | হ্যাঁ, Workers দিয়ে | ✅ **হ্যাঁ** (Abu Bakkar Siddik, 2026-10-15) |
| 2 | Facebook share preview: একই Worker দিয়ে product page-এ og:title / og:image বসানো (ভাগ ৩-এর "Go HTML পাঠাবে" লাইনের বদলে) | হ্যাঁ, roadmap ধাপ 10-এ | ⏳ **পরে** (Abu Bakkar Siddik, 2026-10-15) |
| 3 | Customer account (Sign in / Sign up / Account) MVP-তে নাকি পরে? | পরে; আগে guest checkout + tracking | ⏳ **Later** (Abu Bakkar Siddik, 2026-10-25) |
| 4 | Checkout, track, admin login-এ rate limit (প্রয়োজনে পরে Turnstile) | হ্যাঁ, ধাপ 7-এ | ✅ **Yes**, per-IP rate limit (Abu Bakkar Siddik, 2026-10-25), building |
| 5 | Repo public থাকলে `docs/`-এর blueprint আর brand vision (ব্যবসার পরিকল্পনা) সবাই দেখতে পাবে। Public রাখবে নাকি private? | Private (GitHub-এ private repo-ও ফ্রি)। পরে চাইলে public করা যাবে। | ✅ **Public** (Abu Bakkar Siddik, 2026-10-15) |
| 6 | Purchase limit: per product (all variants together, as built) or per variant? | Per product (blueprint rule 1) | ✅ **Per product, as recommended** (Abu Bakkar Siddik, 2026-10-25) |
| 7 | Should the search page also show sold-out runs from the archive? Now it shows only products on sale. | No, keep search for products on sale | ✅ **No, as recommended** (Abu Bakkar Siddik, 2026-10-25) |
| 8 | When an order is cancelled, should the COD payment row get a new status (for example VOID)? Now it stays PENDING. | Add VOID together with the admin panel | ✅ **Yes, VOID** (Abu Bakkar Siddik, 2026-10-25), building |
| 9 | Do you want a script to reset the dev database to the sample catalogue (wipes your test orders)? | Yes, as `make reset-dev`, only with a confirmation | ✅ **Yes**, `make reset-dev` with a confirmation (Abu Bakkar Siddik, 2026-10-25), building |
| 10 | A wrong method on a known path (e.g. `POST /api/health`) answers 404, not 405. OK? | OK (simple, harmless) | ✅ **OK, as recommended** (Abu Bakkar Siddik, 2026-10-25) |
| 11 | Hero product on the home page is a setting (`home_hero_product_slug`). Should the admin choose it in Admin > Settings later? | Yes | ✅ built in Admin > Settings (overnight 2026-10-18), confirm |
| 12 | A category turned off leaves the menu, but its products stay on sale. Should "off" also hide its products? | No: archive products one by one | ✅ **No, as recommended** (archive one by one) (Abu Bakkar Siddik, 2026-10-25) |
| 13 | Publishing a **limited** run with 0 stock is refused (it would be sold out at once). OK? | Yes | ✅ **Yes, as recommended** (Abu Bakkar Siddik, 2026-10-25) |
| 14 | Anyone can pause your admin login by typing 5 wrong passwords (the lockout). Only IP rate limiting (question 4) or a Turnstile check stops that. Build it before launch? | Yes, before launch | ✅ **Yes, before launch** (Abu Bakkar Siddik, 2026-10-25), building |
| 15 | Settings, category and delivery changes do not record *who* changed them (order, stock, product and return changes do). Audit log later, as the blueprint says? | Yes, later | ⏳ **Later** (Abu Bakkar Siddik, 2026-10-25) |
| 16 | The admin order search puts the phone into the URL (`?q=017…`), so it is in your browser history and maybe the hosting logs. OK for one owner? | OK for now | ✅ **OK for now, as recommended** (Abu Bakkar Siddik, 2026-10-25) |
| 17 | The design menu has a "Stock" page and the sitemap a "Returns" list page. Both are on each product/order page now. Separate pages later? | Later | ⏳ **Later** (Abu Bakkar Siddik, 2026-10-25) |
| 18 | Couriers to choose from: Steadfast, Pathao, RedX, Other (typed). Others you use? | Add yours | ✅ **Keep the list** (Abu Bakkar Siddik, 2026-10-25) |
| 19 | A new variant can be added to a product that is already on sale, with any price and no reason in the record. Should that follow the price lock (refuse it, or ask for a reason and record it like a price fix)? | Ask for a reason and record it | ✅ **Reason + record** (Abu Bakkar Siddik, 2026-10-24), built |
| 20 | Turning a variant off does not re-check the product: a limited run whose other variants are all at 0 stays "Active" with nothing to buy. Should "turned off" count like "sold out" here? | Yes: re-check after every on/off change | ✅ **Yes** (Abu Bakkar Siddik, 2026-10-24), built |
| 21 | The admin can type an option name that repeats its kind ("Size M" for a Size), which shows as "Size Size M". Refuse it in the form? | Yes, with a clear message | ✅ **Yes**, with a clear message (Abu Bakkar Siddik, 2026-10-25), building |
| 22 | Many shop links are smaller than 44 px (footer links, breadcrumbs, category chips). Make them bigger like the admin (2026-10-21)? | Yes, before launch | ✅ **Yes** (shop and the remaining admin ones) (Abu Bakkar Siddik, 2026-10-25), building |
| 23 | The website has no unit tests (only build + lint). Add a few with Node's built-in test runner (no new package) for money and phone formatting? | Yes, small | ✅ **Yes**, `node --test`, no new package (Abu Bakkar Siddik, 2026-10-25), building |
| 24 | Search shows at most 48 results, with no "show more". Add paging or a "48 of N" line? | A "48 of N" line is enough for now | ✅ **Yes**, a "Showing 48 of N" line (Abu Bakkar Siddik, 2026-10-25), building |

## আগের suggestion list (এখনো হ্যাঁ/না বলা হয়নি)
- এখন: material variant (paper / plastic / metal / key-ring) আলাদা দাম আর stock সহ, Bangla policy page, backup
- পরে: edition number, analytics
- (Gift option আর About/brand story তুমি আগেই হ্যাঁ বলেছ, design-এ আর blueprint-এর ভাগ ৭-এ আছে।)

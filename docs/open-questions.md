# খোলা প্রশ্ন (Abu Bakkar Siddik-এর উত্তর দরকার)

উত্তর না আসা পর্যন্ত এগুলো build করা হবে না।

| # | প্রশ্ন | Claude-এর সুপারিশ | উত্তর |
|---|---|---|---|
| 1 | `/api` proxy দিয়ে API একই site-এ আনা (login cookie phone-এ কাজ করার জন্য)। **আপডেট:** Cloudflare এখন নতুন প্রজেক্টে Pages-এর বদলে Workers সুপারিশ করে, তাই hosting হবে Workers Static Assets (`drakon.<account>.workers.dev`) | হ্যাঁ, Workers দিয়ে | ✅ **হ্যাঁ** (Abu Bakkar Siddik, 2026-10-15) |
| 2 | Facebook share preview: একই Worker দিয়ে product page-এ og:title / og:image বসানো (ভাগ ৩-এর "Go HTML পাঠাবে" লাইনের বদলে) | হ্যাঁ, roadmap ধাপ 10-এ | ⏳ **পরে** (Abu Bakkar Siddik, 2026-10-15) |
| 3 | Customer account (Sign in / Sign up / Account) MVP-তে নাকি পরে? | পরে; আগে guest checkout + tracking | — |
| 4 | Checkout, track, admin login-এ rate limit (প্রয়োজনে পরে Turnstile) | হ্যাঁ, ধাপ 7-এ | — |
| 5 | Repo public থাকলে `docs/`-এর blueprint আর brand vision (ব্যবসার পরিকল্পনা) সবাই দেখতে পাবে। Public রাখবে নাকি private? | Private (GitHub-এ private repo-ও ফ্রি)। পরে চাইলে public করা যাবে। | ✅ **Public** (Abu Bakkar Siddik, 2026-10-15) |
| 6 | Purchase limit: per product (all variants together, as built) or per variant? | Per product (blueprint rule 1) | — |
| 7 | Should the search page also show sold-out runs from the archive? Now it shows only products on sale. | No, keep search for products on sale | — |
| 8 | When an order is cancelled, should the COD payment row get a new status (for example VOID)? Now it stays PENDING. | Add VOID together with the admin panel | — |
| 9 | Do you want a script to reset the dev database to the sample catalogue (wipes your test orders)? | Yes, as `make reset-dev`, only with a confirmation | — |
| 10 | A wrong method on a known path (e.g. `POST /api/health`) answers 404, not 405. OK? | OK (simple, harmless) | — |
| 11 | Hero product on the home page is a setting (`home_hero_product_slug`). Should the admin choose it in Admin > Settings later? | Yes | — |

## আগের suggestion list (এখনো হ্যাঁ/না বলা হয়নি)
- এখন: material variant (paper / plastic / metal / key-ring) আলাদা দাম আর stock সহ, Bangla policy page, backup
- পরে: edition number, analytics
- (Gift option আর About/brand story তুমি আগেই হ্যাঁ বলেছ, design-এ আর blueprint-এর ভাগ ৭-এ আছে।)

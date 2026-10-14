# খোলা প্রশ্ন (Rio-র উত্তর দরকার)

উত্তর না আসা পর্যন্ত এগুলো build করা হবে না।

| # | প্রশ্ন | Claude-এর সুপারিশ | উত্তর |
|---|---|---|---|
| 1 | `/api` proxy দিয়ে API একই site-এ আনা (login cookie phone-এ কাজ করার জন্য)। **আপডেট:** Cloudflare এখন নতুন প্রজেক্টে Pages-এর বদলে Workers সুপারিশ করে, তাই hosting হবে Workers Static Assets (`drakon.<account>.workers.dev`) | হ্যাঁ, Workers দিয়ে | — |
| 2 | Facebook share preview: একই Worker দিয়ে product page-এ og:title / og:image বসানো (ভাগ ৩-এর "Go HTML পাঠাবে" লাইনের বদলে) | হ্যাঁ, roadmap ধাপ 10-এ | — |
| 3 | Customer account (Sign in / Sign up / Account) MVP-তে নাকি পরে? | পরে; আগে guest checkout + tracking | — |
| 4 | Checkout, track, admin login-এ rate limit (প্রয়োজনে পরে Turnstile) | হ্যাঁ, ধাপ 7-এ | — |
| 5 | Repo public থাকলে `docs/`-এর blueprint আর brand vision (ব্যবসার পরিকল্পনা) সবাই দেখতে পাবে। Public রাখবে নাকি private? | Private (GitHub-এ private repo-ও ফ্রি)। পরে চাইলে public করা যাবে। | ✅ **Public** (Rio, 2026-10-15) |

## আগের suggestion list (এখনো হ্যাঁ/না বলা হয়নি)
- এখন: material variant (paper / plastic / metal / key-ring) আলাদা দাম আর stock সহ, Bangla policy page, backup
- পরে: edition number, analytics
- (Gift option আর About/brand story তুমি আগেই হ্যাঁ বলেছ, design-এ আর blueprint-এর ভাগ ৭-এ আছে।)

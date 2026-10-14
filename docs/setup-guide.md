# Setup — ধাপে ধাপে

প্রতিবার একটা ধাপ করো। ঠিক হলে কী দেখার কথা, সেটা প্রতিটা ধাপের নিচে লেখা আছে। না মিললে ওখানেই থামো।

Repo-র জায়গা: `~/Desktop/projects/Drakon/drakon`
পুরনো Next.js code (শুধু দেখার জন্য): `~/Desktop/projects/Drakon/drakon-old-nextjs`

---

## ✅ ধাপ ১ — ফোল্ডার আর `git init` (হয়ে গেছে)
## ✅ ধাপ ২ — Starter kit বসানো (Claude সরাসরি বসিয়েছে)

---

## ধাপ ৩ — প্রথম commit

Git-এ নাম আর email আগে কখনো না দিয়ে থাকলে একবার দাও।

Email কোনটা দেবে:
- Repo public হলে commit-এ email সবাই দেখতে পাবে।
- তাই GitHub → Settings → Emails → **Keep my email addresses private** চালু করো।
- ওখানে যে `...@users.noreply.github.com` ঠিকানা দেখাবে, সেটাই দাও।

```bash
git config --global user.name "Abu Bakkar Siddik"
git config --global user.email "PASTE_NOREPLY_EMAIL_HERE"
```

তারপর commit করো:

```bash
cd ~/Desktop/projects/Drakon/drakon
git add .
git commit -m "docs: add blueprint, CLAUDE.md and design reference"
```

✅ ঠিক হলে: `git log --oneline` চালালে একটা commit দেখা যাবে।

---

## ধাপ ৪ — Claude Code চালু করা

```bash
cd ~/Desktop/projects/Drakon/drakon
claude
```

"Do you trust the files in this folder?" জিজ্ঞেস করলে → **Yes** (এই ফোল্ডারটা তোমার নিজের)।

তারপর লেখো `/mcp`। তালিকায় **context7** থাকা উচিত।

এরপর এই লেখাটা পাঠাও:

> CLAUDE.md, docs/blueprint.md আর docs/open-questions.md পড়ো। কোনো code লিখবে না। শুধু বাংলায় ৫ লাইনে বলো প্রজেক্টটা কী আর আমাদের পরের ধাপ (roadmap ধাপ 0) কী।

✅ ঠিক হলে: Claude Code বাংলায় DRAKON-এর সারাংশ দেবে।

---

## ধাপ ৫ — খোলা প্রশ্নের উত্তর

`docs/open-questions.md`-এ ৫টা প্রশ্ন আছে। এভাবে উত্তর দিলেই হবে:

> "১ হ্যাঁ, ২ হ্যাঁ, ৩ পরে, ৪ হ্যাঁ, ৫ private"

---

⚠️ GitHub-এ push এখনই নয়। আগে একসাথে দেখে নেব কোনো গোপন ফাইল যাচ্ছে কিনা।

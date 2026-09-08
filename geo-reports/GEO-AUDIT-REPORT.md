# GEO Audit Report: araS

**Audit Date:** 2026-09-02
**URL:** https://arasasset.com
**Business Type:** Consumer SaaS (personal-finance app + marketing site)
**Pages Analyzed:** 4 (`/`, `/privacy`, `/support`, `/terms`)
**Audited against:** the **live** production site. PR #126 (`feature/web-google-analytics`)
is **not yet deployed** — its projected effect is noted per category.

> **Update 2026-09-02 — PR #126 extended.** Beyond the original FAQ/schema/llms
> work, the branch now also ships: an `/about` page (with `BreadcrumbList`), a
> quotable "araS 是什麼" lead paragraph on the homepage + factual platform/login
> copy in the Showcase section, `BreadcrumbList` on every legal page, `FAQPage`
> on `/support`, `Organization` enriched with `alternateName` / `email` /
> `foundingDate`, `/about` in the sitemap + footer, and `public/llms-full.txt`.
> These raise the projected post-deploy score to **~48/100** (still Poor —
> Brand Authority and Platform Optimization remain the off-site ceiling).
> Not addressed in code: `Content-Signal` in robots.txt and IndexNow (the
> dynamic `app/robots.ts` would need converting to static — deferred).

---

## Re-audit — 2026-09-02, post-deploy (PR #126 → #127 live)

The full branch shipped to production (`main` `ec3c7d0`, Vercel deploy verified:
`/about` 200, `/llms.txt` 200, `robots.txt` carries `Content-Signal`, homepage
`@graph` has Organization + Person + WebSite + SoftwareApplication + FAQPage).
Re-scored against the live site:

**Overall GEO Score: 31 → 50 / 100 (Poor — Fair starts at 60).**

| Category                 | Before | After  | What moved it                                                                                                                                                                    |
| ------------------------ | ------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI Citability            | 32     | **60** | quotable "araS 是一款…" lead sentence, 8-Q&A FAQ, `/about` (~350 words), `llms.txt` + `llms-full.txt`; visible word count ~300 → ~1,100                                          |
| Brand Authority          | 12     | **17** | only `founder` (Person KO CHUAN LI) + `alternateName` in schema; no off-site change                                                                                              |
| Content E-E-A-T          | 28     | **46** | `/about` with a **named, credentialed developer** (前端工程師) + `Person` schema + `Organization.founder` — the biggest gap, now closed                                          |
| Technical GEO            | 72     | **84** | `llms.txt` + `llms-full.txt` live; `robots.txt` `Content-Signal: search=yes, ai-input=yes, ai-train=yes`; IndexNow key file (ping still manual)                                  |
| Schema & Structured Data | 35     | **82** | `@graph` (Organization + founder / WebSite / SoftwareApplication `softwareVersion 1.4` / FAQPage) + `BreadcrumbList` on all sub-pages + `Person` on `/about`; `/support` FAQPage |
| Platform Optimization    | 8      | **13** | negligible — off-site                                                                                                                                                            |
| **Overall**              | **31** | **50** |                                                                                                                                                                                  |

**On-site is now ~80/100 on average** (Technical 84, Schema 82, Citability 60,
E-E-A-T 46). The ceiling is **Brand Authority (17)** and **Platform Optimization
(13)** — together 30% of the weighted score, both near the floor, both 100%
off-site. Even pushing Citability to ~75 and E-E-A-T to ~60 lands around 57 —
reaching Fair (60) requires the off-site work.

### Remaining path to Fair (60+) — all off-site

1. araS-branded social profiles (FB Page / IG / Threads) → add each to
   `SAME_AS` in `apps/web/app/page.tsx` + `llms.txt`.
2. ≥1 genuinely third-party mention: Product Hunt launch, a Taiwan app
   directory, or a finance/tech blog (塔科女子 / 蘋果仁 / vocus).
3. Publish the Google Play listing (a second first-party anchor).
4. Personal Medium / Threads / LinkedIn posts (supporting signal, weaker than
   earned mentions).
5. After any deploy: GSC "Request Indexing" for changed URLs +
   `pnpm --filter @repo/web indexnow`.

### Post-deploy follow-ups still open

- [ ] GSC: request indexing for `/` and `/about` (content changed / new page).
- [ ] Run `pnpm --filter @repo/web indexnow` once.
- [ ] Consider making the landing page a Server Component (it is fully
      `"use client"`, ~292 kB first-load JS) — helps Core Web Vitals, which feed
      AI-Overview eligibility.

---

## Executive Summary (original audit)

**Overall GEO Score: 31/100 (Critical)**

araS has a genuinely strong _technical_ foundation — server-side rendered HTML,
an open `robots.txt`, a valid submitted sitemap, and a full set of security
headers — but it is close to invisible to AI answer engines for everything that
actually drives citation: there is almost no extractable factual content, no
third-party brand presence, no expertise/authorship signals, and the name "araS"
collides with an established software vendor (Aras Corp) so AI systems don't
recognise it as a distinct entity. The site is new and carries ~1 search
impression in 3 months.

PR #126 (FAQ + FAQPage/Organization/WebSite schema + `llms.txt` + keyword `<h1>`)
lifts the projected score to **~44/100 (Poor)** — a real improvement, but the
gap to "Fair" is off-site work that cannot be shipped in code.

### Score Breakdown

| Category                 | Score  | Weight | Weighted   | Projected w/ PR #126 |
| ------------------------ | ------ | ------ | ---------- | -------------------- |
| AI Citability            | 32/100 | 25%    | 8.0        | ~14.3                |
| Brand Authority          | 12/100 | 20%    | 2.4        | ~3.6                 |
| Content E-E-A-T          | 28/100 | 20%    | 5.6        | ~6.6                 |
| Technical GEO            | 72/100 | 15%    | 10.8       | ~12.0                |
| Schema & Structured Data | 35/100 | 10%    | 3.5        | ~7.0                 |
| Platform Optimization    | 8/100  | 10%    | 0.8        | ~0.8                 |
| **Overall GEO Score**    |        |        | **31/100** | **~44/100**          |

---

## Critical Issues (Fix Immediately)

1. **No entity recognition — "araS" is not a distinct entity to AI systems.**
   Searches for the brand return Aras Corp (PLM software, has a Wikipedia page),
   艾瑞斯資訊 (Taiwan Aras reseller), and an unrelated "Aras" finance app on Google
   Play (`com.adiss.aras`). araS has zero disambiguating signals off-site.
   _Fix:_ build `sameAs` identity anchors (App Store, Play, a LinkedIn/FB page,
   a Threads/IG profile) and get the brand mentioned on ≥2 third-party Taiwan
   finance-app roundups. Add `Organization` schema with all of them (PR #126
   starts this with one `sameAs`).

2. **Near-zero citable content.** The homepage is ~250–300 words of aspirational
   marketing copy ("掌握你的每一分資產", "安心、直覺，為你而設計") with no factual
   statements, definitions, specs, or comparisons an AI would quote. No FAQ.
   _Fix:_ PR #126's FAQ block + a plain-language "araS 是什麼" paragraph. Then a
   few guide pages (see 30-day plan).

## High Priority Issues

3. **`llms.txt` returns 404** on the live site. (Authored in PR #126, ships on
   next production deploy.)

4. **No `About` page / no named humans.** No founder story, no team, no company
   registration, no physical presence. AI systems treat anonymous sites as
   low-trust. _Fix:_ a short `/about` page — who builds araS, why, contact.

5. **Schema is one minimal node.** Live site has a single `SoftwareApplication`
   JSON-LD with `operatingSystem: "iOS"` only. No `Organization`, `WebSite`,
   `FAQPage`, or `BreadcrumbList`. (PR #126 adds the first three.)

6. **Landing page is 100% client-rendered** (`"use client"` on the whole
   `landing-content.tsx`). Next.js still SSRs it to HTML so crawlers get content,
   but it inflates JS (~292 kB first load) and puts LCP/INP at risk — Core Web
   Vitals feed both SEO and AI-Overview eligibility.

## Medium Priority Issues

7. **No brand presence on any platform AI models cite** — no Reddit/PTT/Dcard/
   Threads threads, no YouTube, no Product Hunt, no iOS-review-blog coverage
   (競品 Doremi / Synx / Percento / Capivot all have blog writeups; araS has none).

8. **`/support`, `/privacy`, `/terms` carry no structured data.** The `/support`
   page has real Q&A content ("如何登入", "資料安全嗎", "如何刪除帳號") that should
   be marked up as `FAQPage`.

9. **`operatingSystem` understates reach.** Says iOS only; the product is iOS +
   Android + Web. (Fixed in PR #126 → `"iOS, Android, Web"`.)

10. **No content freshness surface.** No blog, changelog, or "updated on" dates
    outside the legal pages. AI engines favour visibly-maintained sites.

11. **Sitemap missing `/terms`** (page is `index:true`; just absent from
    `sitemap.ts`). Fixed in PR #126.

## Low Priority Issues

12. `BreadcrumbList` schema absent on sub-pages.
13. No `Content-Signal` / AI-usage opt-in directive in `robots.txt`.
14. No `llms-full.txt` (inline all FAQ answers for AI retrieval).
15. No IndexNow ping on deploy (helps Bing/Copilot freshness).
16. OG image is a single generic asset; no per-page OG.
17. No `speakable` schema (niche; safe to skip).

---

## Category Deep Dives

### AI Citability (32/100)

**What's working:** The `/support` mini-FAQ (~150 words of real Q&A) and the
`/privacy` + `/terms` pages are the only genuinely citable surfaces today — an AI
asked "how do I delete my araS account" or "what is araS's refund policy" could
extract an answer. The `SoftwareApplication.description` in JSON-LD is a decent
one-sentence factual anchor.

**What's not:** The homepage has no quotable sentence. Headings are moods, not
claims ("安心、直覺，為你而設計"). There is no "araS is a …" sentence in body copy,
no feature list in prose (only icon cards), no numbers, no comparison to
alternatives, no dates, no author. An AI summarising "best net-worth apps in
Taiwan" has nothing to pull.

**Rewrite suggestions:**

- Add a lead paragraph: _"araS 是一款個人資產管理工具，把現金、股票、加密貨幣、
  不動產、貸款與保單整合在一個介面，即時計算新台幣淨值。提供 iOS、Android 與
  網頁版，用 Google 或 LINE 登入。"_
- Convert the six feature cards into a prose list with one factual sentence each.
- Ship the PR #126 FAQ (8 Q&As ≈ 600 words of structured fact).

**Projected with PR #126: ~57/100.**

### Brand Authority (12/100)

**Platform presence map:**

| Platform                                              | Status                                            |
| ----------------------------------------------------- | ------------------------------------------------- |
| App Store                                             | ✅ listed (`id6785747999`) — weak signal, present |
| Google Play                                           | ⏳ listing pending                                |
| Wikipedia                                             | ❌ (name held by Aras Corp)                       |
| Reddit / PTT / Dcard / Threads                        | ❌ none                                           |
| YouTube                                               | ❌ none                                           |
| LinkedIn / Facebook / Instagram                       | ❌ none                                           |
| Product Hunt                                          | ❌ none                                           |
| Taiwan finance-app blogs (塔科女子 / 蘋果仁 / vocus…) | ❌ none                                           |
| G2 / Capterra                                         | ❌ none                                           |

**Mention volume:** effectively zero. **Sentiment:** n/a. **Entity confusion:**
active — three unrelated "Aras" software entities outrank the brand.

This is the single biggest lever and none of it is code. See the 30-day plan.

**Projected with PR #126: ~18/100** (one `sameAs` + `Organization` node only
nudges disambiguation).

### Content E-E-A-T (28/100)

- **Experience:** none demonstrated. No "why we built this", no annotated
  screenshots, no usage walkthrough.
- **Expertise:** none. No author, no team page, no credentials, no finance
  domain signals.
- **Authoritativeness:** none. No press, reviews, testimonials, or external
  links in.
- **Trustworthiness:** _partial and the only bright spot_ — real, detailed
  `/privacy` and `/terms` (EULA) pages, HTTPS, a contact email on `/support` and
  `/terms`, clear data-handling language ("僅與你的帳號關聯，只有你能存取").
  Missing: company/registration identity, a named person, a physical or legal
  address.
- **Freshness:** legal pages dated (2026-06-30 / 2026-07-27); nothing else.
- **Depth:** 4 pages total.

**Biggest single win:** an `/about` page with a real person behind it.

**Projected with PR #126: ~33/100.**

### Technical GEO (72/100)

**Strong:**

- **SSR** — Next.js App Router serves fully-rendered HTML; crawlers that don't
  run JS (GPTBot, ClaudeBot, PerplexityBot, Bingbot) get real content. This is
  the #1 technical GEO requirement and it passes.
- **`robots.txt`** — `User-agent: *` / `Allow: /`, no AI-crawler blocks, sitemap
  referenced. Disallows only private app routes (`/api/`, `/assets`,
  `/transactions`, …).
- **`sitemap.xml`** — valid, submitted to GSC, last read 2026-08-29, status
  "success".
- **Security headers** — CSP, HSTS (`max-age=31536000; includeSubDomains;
preload`), `X-Frame-Options: DENY`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, COOP. Well above average.
- Canonical tags on every page; `index, follow` on the public pages, deny-by-
  default everywhere else.
- Mobile-responsive (Tailwind, viewport meta).

**Weak:**

- `llms.txt` 404 on live (PR #126).
- Landing is fully client-rendered → ~292 kB first-load JS, heavy framer-motion;
  Core Web Vitals not measured but LCP/INP are at risk.
- No GA4 live yet (PR #126 + Vercel env).

**Projected with PR #126: ~80/100.**

### Schema & Structured Data (35/100)

**Found (live):** one `SoftwareApplication` node on `/`, valid but minimal
(`name`, `description`, `applicationCategory`, `operatingSystem: "iOS"`,
`offers`). Nothing on `/privacy`, `/support`, `/terms`.

**Missing (GEO-critical for a consumer SaaS):**

| Schema                                     | Where              | Status                      |
| ------------------------------------------ | ------------------ | --------------------------- |
| `Organization` (+ `sameAs`, `logo`)        | site-wide          | ❌ → PR #126 adds it        |
| `WebSite`                                  | site-wide          | ❌ → PR #126 adds it        |
| `FAQPage`                                  | `/` and `/support` | ❌ → PR #126 adds it on `/` |
| `SoftwareApplication` w/ `aggregateRating` | `/`                | partial (no rating)         |
| `BreadcrumbList`                           | sub-pages          | ❌                          |
| `Organization.foundingDate` / `founder`    | site-wide          | ❌                          |

**Projected with PR #126: ~70/100** (still no `BreadcrumbList`, no schema on
legal/support pages, no `aggregateRating`).

### Platform Optimization (8/100)

Readiness per engine:

| Engine                  | Readiness | Blocker                                                              |
| ----------------------- | --------- | -------------------------------------------------------------------- |
| **Google AI Overviews** | Low       | thin content, no authority, no FAQ (live), CWV risk                  |
| **ChatGPT search**      | Low       | Bing-indexed but no citable content, no brand mentions               |
| **Perplexity**          | Low       | crawler allowed, but nothing quotable + no third-party corroboration |
| **Gemini**              | Low       | same as AI Overviews                                                 |
| **Bing Copilot**        | Low–Med   | sitemap can be imported to Bing WMT; still content-starved           |

No presence on YouTube, Reddit, Wikipedia, Product Hunt, or any review platform
that these engines lean on. This score barely moves without off-site work.

---

## Quick Wins (Implement This Week)

1. **Merge & deploy PR #126** — ships FAQ + FAQPage/Organization/WebSite schema +
   `llms.txt` + keyword `<h1>` + sitemap `/terms`. Single biggest code lever.
2. **Add an `/about` page** — one screen: who builds araS, why it exists, contact.
   Add `Organization.founder` / `foundingDate` to the schema.
3. **Add a lead paragraph to the homepage** stating plainly what araS is, in one
   quotable sentence (draft above).
4. **Import the site into Bing Webmaster Tools** (from GSC) — done ✅.
5. **Mark up the `/support` Q&A as `FAQPage`** — the content already exists.
6. **Re-request indexing for `/` in GSC** once PR #126 is live, so Google
   re-crawls with the new schema and FAQ.

## 30-Day Action Plan

### Week 1: Ship the code foundation

- [ ] Merge PR #126 → `develop`, open `develop → main`, deploy to production
- [ ] Set `NEXT_PUBLIC_GA_ID` in Vercel Production — done ✅
- [ ] Add `/about` page + `Organization.founder`/`foundingDate`
- [ ] Homepage lead paragraph (quotable "araS 是什麼")
- [ ] Re-request GSC indexing for `/`, add `/about` to sitemap

### Week 2: Off-site identity (the Brand Authority lever)

- [ ] Publish the Google Play listing; put `arasasset.com` in the store website
      field — done ✅ for App Store, verify Play
- [ ] Create a LinkedIn (or Facebook) page + an Instagram/Threads profile;
      add all to `sameAs`
- [ ] Submit araS to Product Hunt and 1–2 Taiwan app directories
- [ ] Add `sameAs` array to `Organization` schema with every profile above

### Week 3: Citable content

- [ ] Add a visible FAQ section to `/support` matching the `FAQPage` markup
- [ ] Write 2 guide pages targeting real queries:
      「淨值怎麼算」、「資產管理 App 怎麼選（含 araS vs 記帳 App 的差異）」
- [ ] Add `/llms-full.txt` inlining all FAQ answers
- [ ] Add `BreadcrumbList` schema to all sub-pages

### Week 4: Reach & measurement

- [ ] Get araS mentioned in ≥1 third-party Taiwan finance-app roundup
      (pitch 塔科女子 / 蘋果仁 / vocus authors, or write a guest post)
- [ ] Post a genuine "I built this" thread on PTT Tech_Job / Dcard 理財 / Threads
- [ ] Add IndexNow ping to the deploy pipeline
- [ ] Re-run this audit; compare deltas (target: 44 → 55+)

---

## Appendix: Pages Analyzed

| URL                             | Title                                  | GEO Issues                                                                       |
| ------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------- |
| `https://arasasset.com/`        | araS｜把資產、負債、投資都管在一個 App | thin body copy, no FAQ (live), 1 minimal schema node, client-rendered, no author |
| `https://arasasset.com/privacy` | 隱私權政策｜araS                       | no schema; otherwise a genuine trust asset                                       |
| `https://arasasset.com/support` | 支援與聯絡｜araS                       | real Q&A content not marked up as `FAQPage`; no schema                           |
| `https://arasasset.com/terms`   | 使用條款｜araS                         | missing from `sitemap.xml` (fixed in PR #126); no schema                         |

### Fetch failures

- `https://arasasset.com/llms.txt` — HTTP 404 (expected; authored in PR #126, not yet deployed)

---
name: mobile-release
description: Use when updating, releasing, shipping, or publishing a new version of the araS mobile app (apps/mobile, Expo + EAS) — decides whether a change ships as an OTA update (eas update, no review) or needs a native rebuild + App Store submission, and covers version numbering, the build/submit commands, and the App Store Connect flow. Trigger on phrases like "更新版本", "上架", "發版", "release the app", "ship an update", "OTA", "重新 build", "送審".
---

# araS Mobile Release Workflow

Decide **OTA vs native rebuild**, set the version correctly, and drive the
App Store submission for `apps/mobile` (Expo SDK 54 + EAS).

## Step 0 — Ask what changed, then classify

Before anything, determine: **does the change touch the native layer?**

| Change                                                                                         | Native? | Road            |
| ---------------------------------------------------------------------------------------------- | ------- | --------------- |
| Text, colors, layout, styling                                                                  | No      | **A — OTA**     |
| Logic, calculations, API calls, JS bug fixes                                                   | No      | **A — OTA**     |
| New/removed native package (a library with native code, e.g. a new `react-native-*` with pods) | **Yes** | **B — rebuild** |
| Expo SDK upgrade (54 → 55)                                                                     | **Yes** | **B — rebuild** |
| `app.json` native config (icon, splash, permissions, `plugins`, `bundleIdentifier`)            | **Yes** | **B — rebuild** |
| App name / icon                                                                                | **Yes** | **B — rebuild** |

If unsure, inspect the diff: changes only under JS/TSX/logic → Road A. Anything
touching `package.json` native deps, `app.json` native fields, or `ios/`/pods →
Road B.

**`app.json` is not uniformly native.** The row above means the fields the
native build consumes — `icon`, `splash`, `plugins`, `bundleIdentifier`,
`permissions`, `associatedDomains`. `expo.extra` is the opposite: it is read at
runtime from JS via `Constants.expoConfig?.extra`, ships inside the OTA
manifest, and needs **no** rebuild. So editing `extra.whatsNew` (the release
notes the App shows after updating) stays Road A. Do not let "the diff touches
app.json" alone push a JS-only change into a two-week App Store round trip.

**Critical rule (learned the hard way):** OTA (`eas update`) can only ship
**JavaScript**. It can NOT add a native module to an already-installed binary.
Pushing JS that imports a native module the shipped binary lacks will **crash on
device**. When in doubt whether the native module is in the live build, treat it
as Road B.

---

## Step 0.5 — Version confirmation (MANDATORY, both roads)

The app shows its version in Settings, so every release must leave that display
correct. **Confirm the version with the user before publishing anything** — state
the current value, the value after this release, and why.

**The rule that makes this non-obvious:** `app.json` has
`runtimeVersion.policy: "appVersion"`, so **runtimeVersion IS the `version`
string**. An OTA is only delivered to binaries whose runtimeVersion matches
exactly. Bumping `version` for an OTA therefore publishes an update that **no
installed device can ever receive — silently, with no error**.

| Road             | `app.json` `version` | What the user sees in Settings         |
| ---------------- | -------------------- | -------------------------------------- |
| A — OTA          | **Never touch it**   | Same version, new 「更新於」 timestamp |
| B — native build | **Bump it**          | New version number                     |

So the version display stays honest without manual bookkeeping on Road A:
`app/(app)/settings.tsx` renders `Constants.expoConfig?.version` plus
`Updates.createdAt` (when the running OTA bundle was published), which changes on
every `eas update` by itself.

Confirm like this before running the publish command:

> Road A (OTA). Version stays **1.1** — bumping it would make the update
> undeliverable to the 1.1 binaries users have installed. Settings will show
> `版本 1.1` with 「更新於」 refreshed to now. Proceed?

> Road B (native build). Version **1.1 → 1.2** (new feature). Settings will show
> `版本 1.2`. This one goes through Apple review. Proceed?

**Do not bump the build number.** EAS owns it (`autoIncrement` +
`appVersionSource: "remote"`), so `app.json`'s `buildNumber` is permanently stale
at `"1"` and must not be read or edited. Showing the real build number in-app
would need `expo-application` — a native module, so it can only be added on a
Road B release, never via OTA.

If the user ever asks to bump the version on an OTA anyway, the only correct way
is switching `runtimeVersion.policy` to `"fingerprint"` — which itself requires a
Road B build first, and cuts existing users off from OTAs until they install it.
Say so rather than quietly bumping.

**No git tags, no `package.json` bump.** `apps/mobile/app.json` is the single
source of truth for the version; root `package.json`'s `version` is scaffold
residue and nothing consumes it. EAS records the commit hash for every build and
update, which is why tagging was deliberately dropped.

### Record it in CHANGELOG.md

After the release, run **`/git:changelog`** on `develop`:

- Road A → `/git:changelog --ota` (dated bullet under the current version)
- Road B → `/git:changelog --release` (new `## X.Y` section)

On Road B this matters twice over: that section's text **is** the App Store
Connect 「此版本新增功能」 copy, so write it as user-visible behaviour rather than
implementation detail.

---

## Road A — OTA hot update (most small updates)

For JS/UI/logic-only changes. No version bump, no App Store Connect, no review.

```bash
cd apps/mobile
eas update --branch production --clear-cache --message "…"
```

- Do **NOT** change `app.json` `version` (see Step 0.5) — but DO confirm it with
  the user first.
- **DO update `app.json`'s `expo.extra.whatsNew` before publishing** — the
  「本次更新」 sheet the App shows after an update applies reads its copy from
  there, and `CHANGELOG.md` is not bundled. Change **both** `sections` (reuse
  the changelog bullets, don't compose new copy — sorted into 新功能／優化／
  立即重啟, omitting any section with nothing in it) and `id` — the sheet is
  shown once per `id`, so an unchanged `id` shows nothing to anyone who saw the
  last one.
  `extra` is read from JS, not a native config field, so this stays Road A and
  needs no rebuild. Skipping it is fail-safe: users see **nothing** rather than
  the previous release's notes. Full detail in `/git:changelog` step 6.6.
- Users get it on next app reopen (minutes). More precisely: **two** opens —
  `fallbackToCacheTimeout` is unset (0), so launch N runs the old bundle while
  downloading in the background and launch N+1 runs the new one. The
  update-ready banner exists to collapse that into one launch by offering
  `Updates.reloadAsync()`, but it only helps from the update _after_ the one
  that ships the banner itself.
- Verify locally first in Expo Go (`pnpm --filter @repo/mobile start`) — but note
  Expo Go does not run RevenueCat/native store (see Gotchas).
- **Dry-run what the OTA would ship before publishing** (catches wrong env vars):
  ```bash
  cd apps/mobile && NODE_ENV=production npx expo export --platform ios
  grep -ac "192.168" dist/_expo/static/js/ios/*.hbc   # want 0
  grep -ac "19\.2\.4" dist/_expo/static/js/ios/*.hbc  # want 0 — web's React
  ```
  **Hermes stores non-ASCII string constants as UTF-16LE**, so grepping the
  `.hbc` for a Chinese string always returns 0 even when the string is present —
  that is the encoding, not a missing string. Verify with ASCII markers (keys,
  URLs, version numbers), or decode explicitly:
  ```bash
  python -c "print(open('dist/_expo/static/js/ios/entry.hbc','rb').read().count('回復購買'.encode('utf-16-le')))"
  ```
  Also pass `grep -a`: without it, grep treats the bundle as binary and prints
  "Binary file matches" instead of counting.

---

## Road B — Native rebuild + App Store submission

For anything touching native. Full pipeline:

```bash
# 1. Bump the marketing version in apps/mobile/app.json (see "Versioning")
# 2. Commit (EAS builds from the committed project)
git add -A && git commit -m "…"

# 3. Build (cloud, ~15–20 min) and upload
cd apps/mobile
eas build --profile production --platform ios
eas submit --platform ios --latest
```

Then in **App Store Connect** (wait for the uploaded build to finish
"Processing" first):

1. The **new version** entry: the "**＋ 版本或平台**" button reappears only after
   the previous version is released — you can have **only one version in review
   at a time**. Choose "**新增版本**" (NOT "新增平台"). Version number must match
   `app.json` exactly.
2. Fill **「此版本新增功能」** (What's New).
3. Under **建置版本 (Build)**, select the build just uploaded (matching
   version + highest build number).
4. **加入以供審查 / 送出審查** → Apple review 1–3 days.

### Before Road B, verify on a real binary WITHOUT App Store review

`eas build --profile preview --platform ios` produces a real-device `.ipa`
(internal distribution, no Apple review). Install it, reproduce, and confirm the
native change works. This is the correct way to test native behavior that Expo Go
can't show.

### If the backend needs new API routes the release depends on

Check whether `main` (Vercel production) already has every route the new
mobile build calls, **before** submitting for review — not after approval.
`git diff origin/main..origin/develop -- apps/web/app/api` tells you fast.

This project holds `main` behind `develop` for long stretches deliberately
(new backend gates shouldn't go live against an old binary that has no way to
satisfy them — e.g. a paywall gate against a build with no purchase flow). But
if the _new_ release's own screens call routes that only exist on `develop`,
merging **has to happen before submission**, not after: an Apple reviewer
testing the new build against production would see those screens 404 and
could never reach the feature being reviewed (a paywall in particular — no
IAP validation possible if it never renders). Work out a way to neutralize the
old concern (e.g. temporarily loosen a cap so it can't lock out the currently
-installed binary) rather than delaying the merge past submission.

### First native build after a native-entitlement change to `app.json`

If `ios.associatedDomains` (or any other Apple-capability field —
push, HealthKit, iCloud, etc.) changed in `app.json` since the **last
successful native build**, expect:

```
Provisioning profile "...AppStore ..." doesn't support the Associated
Domains capability.
```

OTA ships can go out for weeks between native builds and will not surface
this — the entitlement only matters to a provisioning profile, and OTAs don't
touch profiles. It only breaks on the next `eas build`, which may be a long
time later and right when you're trying to ship. Compare
`eas build:list --platform ios --limit 10 --non-interactive --json` against
`git log -S'associatedDomains' -- apps/mobile/app.json` before a Road B build
if it's been a while since the last one, so this doesn't surprise you mid
-release.

**Fix requires a human in a real terminal** — `eas credentials -p ios` is
interactive-only (no flags beyond `-p`) and cannot run where stdin isn't a
real TTY (background/agent shells, `!`-prefixed commands in a coding
assistant, etc.). Walk the user through it:

1. `cd apps/mobile && eas credentials -p ios`
2. `production` → **Build Credentials**
3. If a stale provisioning profile already exists for the project, **delete
   it first** (`Provisioning Profile: Delete one from your project`) — Apple
   may otherwise report the old one as still "active" and EAS reuses it
   instead of regenerating.
4. **All: Set up all the required credentials to build your project** — this
   re-validates the existing Distribution Certificate (reuses it if still
   valid, no new cert needed) and syncs `app.json`'s entitlements onto the
   Apple App ID. Watch for `Synced capabilities: Enabled: <name>` in the
   output — that line confirms the fix took.
5. `Generate a new Apple Provisioning Profile? (Y/n)` → **Y**

Only after this does `eas build --profile production --platform ios` pick up
a profile with the right entitlement. A failed build still consumes EAS
quota, so budget for one wasted attempt if this wasn't checked beforehand.

---

## Versioning

Two numbers — you only ever set the first one:

| Number                                            | Example | Who sets it                                                           | Action                |
| ------------------------------------------------- | ------- | --------------------------------------------------------------------- | --------------------- |
| **Marketing version** (`version` in `app.json`)   | `1.1`   | **You**                                                               | Bump every submission |
| **Build number** (the `(N)` in App Store Connect) | `(5)`   | **EAS**, automatically (`autoIncrement` + `appVersionSource: remote`) | Never touch           |

Bump rules (semver `major.minor.patch`):

- Bug fix / small change → last digit: `1.1` → `1.1.1` (or `1.2`)
- New feature → middle: `1.1` → `1.2`
- Big rewrite → first: `1.9` → `2.0`
- The only hard rule: **must be strictly higher than the currently-released
  version**, and must **match** the version entry created in App Store Connect.

Only Road B bumps the version. Road A (OTA) keeps the same version.

### Resubmitting after a rejection — do NOT bump the version

A rejected version was never released, so it is still strictly higher than the
live one and the ASC version entry already exists under that number. Bumping it
would force a new ASC version entry for no reason.

- `app.json` `version`: **unchanged** (1.2 stays 1.2)
- Build number: EAS increments it by itself (7 → 8)
- Rebuild, `eas submit`, then in ASC switch **建置版本** to the new build and
  resubmit.

Fix the code, rebuild, resubmit — that is the whole loop.

---

## App Store Connect facts (avoid past confusion)

- **「新增平台」** (Add Platform) = add iOS/macOS/tvOS. This app is iOS-only; it
  is used **once, ever**. Never click it for a version update.
- **「新增版本」** = the per-update action, via the "**＋**" next to the version
  list. It is **hidden while a version is in review** — that's expected, not a bug.
- The **live version** (e.g. "1.0 已可發佈" / green check) is what users download
  now. **Never remove/disable it.** When the new version is approved, it takes
  over automatically and the old one becomes history. Old versions accumulate in
  the list and are never cleaned up.
- Consider setting the version's release to **manual** to control go-live timing.
- **年齡分級 (Age Rating) is App-level metadata, not tied to any version** — it
  can be edited any time, including right after a release, with no rebuild and
  no resubmission. If Apple adds new questionnaire fields (e.g. the 2026 social
  media / UGC questions) they surface as a **banner with a deep link** — "前往
  「App 資訊」頁面" — on both the version page and the App Info page. If the
  年齡分級 section's normal 編輯 button doesn't respond, use that banner link
  first; it routes to the questionnaire directly. Also try an incognito window
  (extensions can silently break ASC's edit buttons) before assuming the
  feature hasn't rolled out to the account yet. Sub-questions are gated on
  their parent answer — a greyed-out child question is normal until the parent
  is answered, not a bug.

### After release: verify the purchase chain end-to-end, don't trust config alone

Getting every ASC field right does not prove the money path works — five
components (RevenueCat SDK → Apple transaction → Apple's server notification →
your webhook's signature verification → the DB write your `isPremium` check
reads) can each be individually correct in config and still never have executed
together in production. **The only real proof is one real purchase**, then
confirming the account actually flips to premium in the app.

Two things worth checking _before_ that purchase, because both fail silently
(HTTP 200, no error, entitlement just never arrives):

- **App Store Server Notifications URL must be Version 2**, matching whatever
  signature-verification library the webhook uses (`SignedDataVerifier` here
  only parses V2 JWS). If ASC's edit dialog for the URL shows no version
  selector at all, that means the account no longer offers V1 — nothing to do.
  Point Production **and** Sandbox at your own webhook URL, not RevenueCat's —
  RevenueCat only reads purchases via its own SDK config; entitlement here is
  decided by your own DB, which only your webhook writes.
- **A verifying-certificate env var (e.g. `APPLE_ROOT_CA_CERTS_BASE64`) missing
  in production makes the webhook silently no-op.** If the handler's shape is
  "return 200 without processing when the cert config is absent" (so Apple
  doesn't retry forever once the URL is registered), you cannot tell "not
  configured" and "configured but nothing has hit it yet" apart from the
  outside — until you send something. Probe cheaply with an empty POST:
  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Content-Type: application/json" -d '{}' <webhook-url>
  ```
  `400 missing signedPayload` means the handler got past the cert-config check
  (good — infra is live). `200` with no processing means the env var is
  missing in that environment. This distinguishes the two failure modes without
  needing a real transaction.

Also remember **the subscription _product_ is approved separately from the
app** — an approved app version with a still-pending subscription product shows
an empty plan list to real users, indistinguishable from the unsigned Paid Apps
Agreement failure mode. Check 營利 → 訂閱 shows 已核准 before treating "App is
Ready for Sale" as done.

### Submitting a subscription (first time selling anything)

**Before touching RevenueCat or the paywall UI, check ASC → 業務
(https://appstoreconnect.apple.com/business) → 協議 for 「付費 App 協議」
status.** If it says **新** (never accepted) rather than **有效**, StoreKit
returns **zero products** in sandbox and production alike — no RevenueCat
config, API key, or product/offering setup can work around it. This is easy
to burn hours on by debugging the wrong layer: an app that's a _free_ app up
to now (1.0/1.1 here) only ever needed the Free Apps agreement, so the paid
one is untested territory the first time a release adds IAP.

**A useful triage signal from the app itself**, if `paywall.tsx`-style code
distinguishes the two failure modes (see `apps/mobile/app/(app)/paywall.tsx`
`previewMode = !isPurchasesConfigured()`): preview/placeholder plans mean the
RevenueCat SDK itself failed to configure (client-side problem); an empty
"not available yet" state with the SDK otherwise configured means the SDK is
fine and offerings came back empty — a server-side problem (ASC agreement,
RevenueCat Offering not marked Current, or Product ID mismatch), not
something fixable in app code.

Once the agreement needs signing, expect this chain (each step gates the
next; Apple validated banking/tax same-day the one time this was timed, not
over days as some documentation suggests):

1. **Legal entity** may need updating first (a banner blocks agreement
   signing until it's current — usually resolves itself, rarely needs manual
   editing).
2. **Bank account** — for Taiwan, Apple pays in **TWD via 台灣銀行代碼 +
   帳戶號碼, there is no SWIFT field on this form.** Register the **TWD**
   account, not a foreign-currency/USD account, even though the FX account is
   the one with an English name and SWIFT code sitting right there in online
   banking. `銀行貨幣` TWD / `版稅貨幣` USD is a valid combination (Apple
   converts on payout).
3. **Tax forms** — for a Taiwanese individual: 台灣稅務表格 (TIN = 身分證字號,
   answer 是 when asked "你是否擁有台灣的稅務 ID?"), U.S. Form W-8BEN (not a
   US tax resident → 否 on that ASC pre-question; leave Part II/treaty
   benefits blank — no comprehensive US–Taiwan income tax treaty to claim
   under, and Part III is signed under penalties of perjury; foreign TIN =
   身分證字號; DOB is **MM-DD-YYYY**, US order), and Apple's own U.S.
   Certificate of Foreign Status of Beneficial Owner (Title field: `Owner`
   for a sole individual). The e-signature name on these forms is your Apple
   ID display name, which may differ from the legal entity name — Apple
   prefills it this way by design; that name is **not editable in ASC**
   (only via appleid.apple.com), so don't chase changing it as a blocker.
4. **DSA (Digital Services Act) trader declaration** — a separate one-time
   prompt. Declaring "I am a trader" publishes your registered address and
   phone number on EU App Store product pages. For an app with no real EU
   audience, "I am not a trader / do not intend to distribute in the EU" is
   usually the better default — it just drops EU distribution, no other
   consequence.

**Then, to actually add a subscription to a version's review submission**,
three separate "新增以供審查" clicks are needed, not one:

1. On the **subscription group** page (e.g. `araS Premium`) — this alone is
   _not_ enough, despite looking like the whole thing.
2. On **each individual subscription product inside the group** (Monthly,
   Yearly, ...) separately. Each one independently needs:
   - **供應狀況 (availability/territories)** set — "all territories" is fine;
     Apple automatically restricts to wherever the app itself is available,
     so this doesn't need to special-case a DSA-driven EU exclusion.
   - **A review screenshot** — must be a **native, unmodified device
     screenshot** (the OS screenshot gesture, saved straight from Photos).
     Any screenshot that's been through **LINE or a similar chat app's image
     send** gets silently recompressed to a non-standard pixel size (seen:
     1024×1024 from a manual crop, then 870×1882 twice in a row from LINE —
     switching LINE's "photo" send to "file" send did **not** fix it) and
     ASC rejects it with 「有一張或多張截圖的尺寸錯誤」. Get the file off the
     phone via email-to-self (choose "actual size", not "small/medium"),
     cloud photo sync + browser download, or a USB cable import — anything
     that doesn't route through chat-app compression. A native iPhone
     screenshot (e.g. 1170×2532 for iPhone 12/13/14) is accepted as-is; no
     manual resizing needed. The same screenshot can be reused for every
     subscription product in the group.
3. On the **App version itself** (e.g. `iOS App 1.2`).

Only once all relevant items — subscription group, each subscription
product, and the app version — show up together in "已可提交的項目" does
「提交以供審查」stop being greyed out.

### Guideline 3.1 checklist — work it as a list, not from user needs

1.2 was rejected **twice in a row** on this, once per round. Both misses share
a root cause worth stating plainly: **Apple's requirements are not derived from
what users need.** They are an independent checklist. Engineering intuition
reasons from user needs, so it misses this class of item systematically.

| Requirement                                      | Where it lives                                |
| ------------------------------------------------ | --------------------------------------------- |
| **3.1.1** distinct **Restore Purchases** control | Code — paywall                                |
| **3.1.2** EULA / Terms of Use link               | **Both** in-app _and_ ASC metadata            |
| 3.1.2 auto-renewal disclosure                    | Code — on the paywall, next to the buy action |
| 3.1.2 price + duration per plan                  | Code — visible before purchase                |
| Privacy policy link                              | ASC dedicated field + in-app                  |
| Subscription management link                     | Code — _should_, not _must_                   |

Two traps in that table:

- **The EULA needs to be in ASC metadata too, not just in the app.** Rejected
  2026-08-05 for exactly this while the in-app link was already fine. Privacy
  Policy has a **dedicated ASC field** so it can't be forgotten; Terms of Use
  has **none** — it must be pasted into the **App Description** (a marketing
  field), or registered under App Information → License Agreement. Writing a
  custom EULA page and linking it only from the paywall is _not_ enough.
  Fix: append to the App Description, no rebuild needed.

  ```
  使用條款 (EULA)：https://arasasset.com/terms
  隱私權政策：https://arasasset.com/privacy
  ```

- **Restore is required even when the architecture makes it pointless.**
  Rejected 2026-08-06 for its absence. Entitlement here is keyed by
  `deriveAppleAccountToken(clerkUserId)`, so a user on a new device just signs
  in and is premium again — the problem Restore exists to solve does not exist
  in this app, which is precisely why nobody built it. Apple's test is purely
  formal, and the rejection pre-empts the usual defence: _"automatically
  restoring purchases on launch will not resolve this issue."_ Ship a distinct,
  user-initiated button.

  Do **not** gate the Restore button on whether offerings loaded. The buy button
  is gated that way, and offerings really did come back empty once (unsigned
  Paid Apps agreement) — gating Restore identically hides it exactly when a
  subscriber needs it and when the reviewer looks for it.

### Rejections come in rounds — passing one says nothing about the next

Reviewers reject on the **first** problem found; they do not test everything and
report once. Observed on 1.2:

| Round | Kind                                                            | Caught                   |
| ----- | --------------------------------------------------------------- | ------------------------ |
| 1     | **Automated** — the message says "This is an automated message" | metadata (missing EULA)  |
| 2     | **Human** — the message lists Review Devices and a review date  | in-app (missing Restore) |
| 3     | **Human**, screenshot only, no prose                            | the SAME missing Restore |

So round 1 never opened the app at all. Budget for more rounds, and work the
whole 3.1 checklist above before resubmitting rather than fixing only what was
quoted.

### Uploading a build does NOT attach it — round 3 was the old binary

Round 3 rejected an issue already fixed: the reviewer was still testing **build
7** while the fix sat in build 8. `eas submit` uploads a build to App Store
Connect; it does **not** point the version's 建置版本 field at it. **After every
`eas submit`, open the version in ASC and confirm 建置版本 shows the new build
number before resubmitting.**

Two techniques for proving which binary a reviewer actually ran, when the
rejection is just a screenshot:

- **Render logic.** If the disputed control's condition is a strict subset of
  something visible in the screenshot, that screenshot cannot come from the
  fixed build. (Restore renders on `!isPremium && !loading`; the buy button adds
  `&& plans.length > 0` — so a screenshot showing the buy button but no Restore
  is impossible on the fixed build.)
- **A value that differs between builds acts as a fingerprint.** `FREE_ENTRY_LIMIT`
  is interpolated into the paywall copy and differed (20 vs 100_000) across the
  two builds, which identified the binary outright.

And to settle "is the fix even in that binary": `eas build:list --json` carries
each build's `gitCommitHash`, so `git merge-base --is-ancestor <fix> <buildhash>`
answers it in one command. `eas update:list --branch production` rules out an OTA
having replaced the bundle — updates only reach a matching runtime version.

**"Bug Fix Submissions" offer:** a rejection may say the issue is _eligible to
be resolved on your next update_ — reply and they will approve this one. Only
take that for a genuine bug-fix release. Declining it and fixing properly is
the right call when the missing piece is core to the feature being shipped (a
subscription release with no Restore will generate refund requests the moment
someone changes device).

### A compliance fix needs a REBUILD, not an OTA

Even when the fix is pure JS over an already-shipped native module (Restore is
— `react-native-purchases` is already in the binary), **never ship it as an OTA
for a resubmission.** The reviewer opens the App Store binary and the OTA
downloads in the background, so the first launch — the one where they check for
the thing they rejected — can still be running the embedded bundle.

---

## Project-specific gotchas (from real incidents)

- **Every `eas` command must run from `apps/mobile`.** `eas.json` lives there,
  not at the repo root, and from the root you get
  `eas.json could not be found at .../araS/eas.json`.
- **`Redundant Binary Upload` (409) means the submit already worked.** Apple
  rejecting _"You've already uploaded a build with build number 'N'"_ is a
  duplicate `eas submit`, not a failure — the binary is in App Store Connect.
  Check TestFlight before rebuilding anything; nothing needs redoing and the
  build number does not need incrementing.
- **`restorePurchases()` cannot run in Expo Go** (no native store), same as
  `Purchases.configure()`. Any Restore work is therefore unexercised until it
  reaches TestFlight — test both outcomes there (no purchase → "not found";
  active sandbox subscription → restored + paywall flips) before resubmitting
  for review.

- **`eas update` ignores `eas.json`'s `env` blocks** — those apply to `eas build`
  only. It bundles at `NODE_ENV=production` and inlines whatever `EXPO_PUBLIC_*`
  Expo's dotenv chain resolves. A 2026-07-09 OTA shipped the LAN dev URL to every
  user ("Network request failed"). Fixed 2026-07-20 by committing
  **`apps/mobile/.env.production`** (prod values), which outranks `.env` at
  `NODE_ENV=production` while `.env` still serves local Expo Go dev. **Keep
  `.env.production` in sync with `eas.json`'s `build.production.env`** — they feed
  OTA and native builds respectively, and drift between them produces a working
  OTA with a broken rebuild.
- **Version display in Settings** — `app/(app)/settings.tsx` reads
  `Constants.expoConfig?.version` + `Updates.createdAt`. Both come from
  `expo-constants` / `expo-updates`, which are already in the binary, so this
  ships fine over OTA. Do not reach for `expo-application` to get the build
  number without a Road B rebuild.

- **pnpm + Sentry native build:** the iOS "Bundle React Native code and images"
  phase does `require.resolve('@sentry/cli/package.json')` from `ios/`, which
  fails in this pnpm monorepo unless `@sentry/cli` is a **direct devDependency**
  of `@repo/mobile` (pinned to the version `@sentry/react-native` requires).
  Symptom: EAS "Run fastlane" / `PhaseScriptExecution failed`,
  "Cannot find module '@sentry/cli/package.json'".
- **Sentry Expo plugin path:** for `@sentry/react-native` v7 the config plugin is
  `@sentry/react-native` (has `app.plugin.js`); the `@sentry/react-native/expo`
  subpath is **v8-only**. Match the plugin entry to the installed major version.
- **RevenueCat in Expo Go:** `Purchases.configure()` throws in Expo Go (no native
  store) and crashes the app on login. `lib/purchases.ts` already guards with
  `Constants.executionEnvironment === "storeClient"` + try/catch — keep it.
- **`react-native-svg` + non-finite data:** feeding `NaN`/`Infinity` coordinates
  to an SVG path hard-crashes on iOS. Chart/number inputs derived from API data
  must be coerced to finite numbers (see `retirement.tsx` / `ProjectionChart.tsx`).
- **`runtimeVersion.policy: "appVersion"`** ties OTA compatibility to the version
  string. If native modules change, prefer moving to `"fingerprint"` so an OTA
  that needs new native code is never delivered to an incompatible binary.
- **Dependency versions:** run `npx expo install --check` in `apps/mobile` before
  a Road B build; align any flagged package to the SDK-recommended version.
- **Lockfile:** run installs with the repo's pinned pnpm (`packageManager` in root
  `package.json`) so the lockfile isn't reformatted wholesale.
- **CI does not run on PRs into `develop`** — `.github/workflows/ci.yml`
  triggers only on `pull_request: branches: [main]` and
  `push: branches: [main, dev]` (`dev` matches no real branch in this repo).
  `gh pr checks <n>` on a develop-targeted PR shows only the Vercel deploy
  check, which reads like "CI passed" but isn't. Run `pnpm lint` / `pnpm
type-check` / `pnpm test` locally (after `pnpm db:generate`) before merging
  into `develop`; only a PR targeting `main` gets the real GitHub Actions
  suite.
- **A local dev environment pointed at the production database can leave
  fake `Subscription` rows behind.** Before 2026-07-27 this project's local
  `pnpm dev` connected straight to the prod Supabase project (no separate dev
  project existed yet), so anyone who used `/api/dev/subscription` (the
  `NODE_ENV !== "production"` premium-simulation toggle) or manually inserted
  a test row during that period left a permanent grant sitting in prod —
  `entitlements.service.isPremium` only checks `status`/`expiresAt`, it
  doesn't care whether the row came from a real Apple purchase or a dev
  toggle. Symptom: your own test account reads as already-Premium the moment
  the real entitlement check goes live, even though you've made no purchase.
  Real product IDs are always `com.Sara.assetapp.premium.*`; anything else in
  `SELECT * FROM "Subscription"` (seen: `dev_test_premium`,
  `manual_test_grant`) is residue —
  `DELETE FROM "Subscription" WHERE "productId" NOT LIKE 'com.Sara.assetapp.%'`
  clears it safely (structurally cannot touch a real purchase) and lets a
  clean sandbox purchase test run against your normal account instead of
  needing a throwaway one.
- **A `--clear-cache` OTA can pull the web app's React into the mobile
  bundle**, even with no source change. `@react-native-community/slider`
  declares no `react` dependency, so under pnpm's isolated `node_modules`
  Metro's upward walk can resolve `react` from the **web** app instead of
  `apps/mobile` — both end up in the bundle and the second has no active
  dispatcher, crashing on first hook use (seen: retirement screen,
  `Cannot read property 'useState' of null`). Fixed in
  `apps/mobile/metro.config.js` via a `resolver.resolveRequest` that pins
  `react`/`react-dom`/`react-native` to `apps/mobile` regardless of
  importer. Before any OTA that touches dependencies, add this to the
  dry-run export check:

  ```bash
  grep -c "19.2.4" dist/_expo/static/js/ios/*.hbc   # web's React — must be 0
  grep -c "19.1.0" dist/_expo/static/js/ios/*.hbc   # mobile's React — must be > 0
  ```

  (Update the version numbers if either app's React version changes.)
  Hermes bytecode keeps ASCII string constants in the clear, so this grep
  works for version strings/URLs/keys but not Chinese text.

  **Caution before running that DELETE:** it assumes the exact product-id
  prefix. Verify the real prefix against the actual ASC subscription product
  ids (or just `SELECT` and eyeball every row) before running it — a wrong
  guess at the prefix can delete a real purchase instead of test residue. Safer
  first move either way: `SELECT` everything and read it, never delete blind.

- **`isPremium` does not check `environment` — a Sandbox purchase grants real
  Premium indistinguishably from a Production one.** `entitlements.service.ts`
  reads only `status` and `expiresAt`. This is deliberate, not a bug: filtering
  to Production would make TestFlight purchase testing impossible, and
  TestFlight is the _only_ place `restorePurchases()` and the buy flow can ever
  be exercised (`Purchases.configure()` throws in Expo Go). So every
  `environment: Sandbox` row in `Subscription` is a real, permanent grant of
  premium until it expires or is deleted by hand — clean it up after each round
  of TestFlight purchase testing rather than leaving it to expire on its own.

- **A `@repo/shared` constant can be both a backend gate and on-screen App
  copy at the same time.** `FREE_ENTRY_LIMIT` feeds both
  `entries.service.ts`'s create-limit check and `paywall.tsx`'s first selling
  point (`` `免費版上限 ${FREE_ENTRY_LIMIT} 筆` ``) — changing it for
  backend-compatibility reasons silently rewrites a user-facing screen too. A
  1.2 build shipped saying "免費版上限 100000 筆" for this reason, visible to
  App Review. Before changing any shared constant, `grep` its usages across
  both `apps/web` and `apps/mobile` — if mobile interpolates it into copy, the
  fix needs an OTA alongside the web deploy, not just a Vercel redeploy.

---

## Quick reference

```
Change made
  │  (always: confirm the version with the user first — Step 0.5)
  ├─ JS / UI / logic only ──────────► eas update --branch production --clear-cache
  │                                     (Road A: version UNCHANGED, no review)
  └─ touches native ────────────────► Road B:
        bump app.json version → git commit
        → eas build --profile production --platform ios
        → eas submit --platform ios --latest
        → App Store Connect: 新增版本 (not 平台) → 填更新說明 → 選 build → 送審
        → Apple review 1–3 days
```

Key files: `apps/mobile/app.json` (`version`, `plugins`, native config),
`apps/mobile/eas.json` (`preview` = internal test build, `production` = store),
`apps/mobile/RELEASE.md` (ops handbook), `apps/mobile/lib/purchases.ts`.

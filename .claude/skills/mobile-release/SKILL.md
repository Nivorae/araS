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
- Users get it on next app reopen (minutes).
- Verify locally first in Expo Go (`pnpm --filter @repo/mobile start`) — but note
  Expo Go does not run RevenueCat/native store (see Gotchas).
- **Dry-run what the OTA would ship before publishing** (catches wrong env vars):
  ```bash
  cd apps/mobile && NODE_ENV=production npx expo export --platform ios
  grep -c "192.168" dist/_expo/static/js/ios/*.hbc   # want 0
  ```

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

---

## Project-specific gotchas (from real incidents)

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

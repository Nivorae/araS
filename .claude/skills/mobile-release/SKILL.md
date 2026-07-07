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

## Road A — OTA hot update (most small updates)

For JS/UI/logic-only changes. No version bump, no App Store Connect, no review.

```bash
cd apps/mobile
eas update --branch production
```

- Do NOT change `app.json` `version`.
- Users get it on next app reopen (minutes).
- Verify locally first in Expo Go (`pnpm --filter @repo/mobile start`) — but note
  Expo Go does not run RevenueCat/native store (see Gotchas).

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
  ├─ JS / UI / logic only ──────────► eas update --branch production   (Road A: no version, no review)
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

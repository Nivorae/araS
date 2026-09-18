/**
 * `app.json`'s `expo.extra` (incl. `whatsNew`) is read at runtime from JS, not
 * baked into the native binary — but @expo/fingerprint's default source list
 * still hashes the whole `extra` section into the native fingerprint. Under
 * `runtimeVersion.policy: "fingerprint"`, that means every OTA that updates
 * `extra.whatsNew` (as every OTA is supposed to, per docs/TODO.md) silently
 * produces a runtimeVersion that no longer matches the shipped binary — the
 * OTA becomes undeliverable with no error anywhere (incident: 2026-09-18).
 *
 * `ExpoConfigExtraSection` excludes `extra` from the fingerprint so editing
 * `whatsNew` never again breaks OTA delivery. Only takes effect starting with
 * the next native build that picks up this file (1.6+) — it can't retroactively
 * fix a fingerprint already baked into an already-shipped binary (like 1.5's).
 */
module.exports = {
  sourceSkips: ["ExpoConfigExtraSection"],
};

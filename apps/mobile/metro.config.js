// Metro config tuned for this pnpm + Turborepo monorepo.
//
// pnpm uses an isolated store: each package's dependencies are symlinked into
// that package's OWN node_modules (under .pnpm/...). So Metro must:
//   - keep hierarchical lookup ON (the default) so it can walk up into each
//     package's local node_modules to find its symlinked deps (e.g. `expo`
//     resolving `expo-modules-core`). Disabling it breaks pnpm resolution.
//   - follow symlinks — on by default in Metro 0.84, so we don't set it.
//   - watch the monorepo root so the .pnpm store and @repo/shared are visible.
//   - enable package exports so @repo/shared resolves "." -> "./src/index.ts"
//     via its package.json "exports" field.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [...(config.watchFolders ?? []), monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

config.resolver.unstable_enablePackageExports = true;

module.exports = config;

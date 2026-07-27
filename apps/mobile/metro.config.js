const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [...(config.watchFolders ?? []), monorepoRoot];

// Watching the monorepo root means watching apps/web/.next, which `next dev`
// deletes and recreates continuously. Metro's fallback watcher (used on Windows
// without watchman) throws ENOENT and kills the dev server when a directory it is
// walking disappears mid-walk — so starting Metro while the web server is warming
// up crashes it. Nothing under these paths is ever bundled into the app, so drop
// them from the watch set instead.
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  /[\\/]apps[\\/]web[\\/]\.next[\\/].*/,
  /[\\/]\.turbo[\\/].*/,
  /[\\/]apps[\\/]web[\\/]\.vercel[\\/].*/,
];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

config.resolver.unstable_enablePackageExports = true;

module.exports = config;

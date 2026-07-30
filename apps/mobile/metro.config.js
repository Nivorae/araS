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

// React, react-dom and react-native must be single instances in the bundle.
//
// pnpm keeps a hoisted copy of the WEB app's React (19.2.4) at
// node_modules/.pnpm/node_modules/react. A package that declares no `react`
// dependency of its own — @react-native-community/slider declares neither a
// dependency nor a peerDependency — has nothing to resolve against locally, so
// Metro walks up from the package's location inside .pnpm and finds that copy
// instead of the app's 19.1.0. Both then land in the bundle, and the second
// React has no active dispatcher: its first hook throws "Cannot read property
// 'useState' of null", which crashed the retirement screen on every device.
//
// `nodeModulesPaths` alone does not prevent this — it adds search roots but
// does not stop the upward walk. Resolving these three from the app directory
// does. Verify with: grep the exported .hbc for "19.2.4"; it must not appear.
const SINGLETONS = new Set(["react", "react-dom", "react-native"]);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const pkg = moduleName.startsWith("@")
    ? moduleName.split("/").slice(0, 2).join("/")
    : moduleName.split("/")[0];

  if (SINGLETONS.has(pkg)) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(projectRoot, "package.json") },
      moduleName,
      platform
    );
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

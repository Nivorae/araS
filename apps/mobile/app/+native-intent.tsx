// Universal Links (iOS) / App Links (Android) carry the web app's URL paths,
// which don't all match this app's route structure — remap them here before
// Expo Router tries to match a screen.
const PATH_REDIRECTS: Record<string, string> = {
  "/assets": "/",
  "/more": "/settings",
  "/sign-in": "/welcome",
  "/sign-up": "/welcome",
};

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const pathname = path.split("?")[0] ?? path;
    return PATH_REDIRECTS[pathname] ?? path;
  } catch {
    return "/";
  }
}

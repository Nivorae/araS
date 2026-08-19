export const MOBILE_APP_PROMPT = "如果要使用該功能，請下載手機版本。";

/**
 * Shared fallback for anything web can't do (Premium/IAP features, or native-only
 * capabilities): web has no in-app purchase path and no plans to build one, so
 * every such gap funnels users to the mobile app instead of a web workaround.
 */
export function promptMobileApp(message: string = MOBILE_APP_PROMPT) {
  window.alert(message);
}

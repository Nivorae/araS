// Single choke point for premium-feature checks. v1 ships fully free, so this
// always returns true — once IAP (RevenueCat/StoreKit2 + App Store Server
// Notifications) lands, swap the body for a `Subscription` row lookup and
// every caller gains the paywall without further changes.
export class EntitlementsService {
  async isPremium(_userId: string): Promise<boolean> {
    return true;
  }
}

export const entitlementsService = new EntitlementsService();

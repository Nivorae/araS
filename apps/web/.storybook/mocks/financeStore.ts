import type { Entry } from "@repo/shared";
import demo from "../../data/demo.json";
import { useFinanceStore } from "../../store/useFinanceStore";

type FinanceState = ReturnType<typeof useFinanceStore.getState>;
export type FinanceStoreSeed = Partial<FinanceState>;

/** The demo entries the guest mode shows — for stories that pick an entry by name. */
export const demoEntries = demo.entries as Entry[];

const INITIAL = useFinanceStore.getState();

/**
 * Resets the store, then loads it exactly as a signed-out visitor sees it —
 * through the store's own guest path, so Storybook can't drift from the app.
 *
 * Guest mode is also what keeps stories off the network: the store and the
 * components that check `isGuest` skip `/api/*`. That means only guest
 * branches are reachable here. Signed-in states need network mocking (MSW),
 * with guest kept as one variant — see docs/TODO.md.
 */
export async function seedFinanceStore(overrides: FinanceStoreSeed | undefined) {
  useFinanceStore.setState(INITIAL, true);
  await useFinanceStore.getState().fetchAll(false, { force: true });
  if (overrides) useFinanceStore.setState(overrides);
}

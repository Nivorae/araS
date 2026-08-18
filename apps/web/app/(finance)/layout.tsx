import { BottomNav } from "../../components/layout/BottomNav";
import { NavProvider } from "./nav-context";
import { FinanceDataProvider } from "../../components/layout/FinanceDataProvider";

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <NavProvider>
      <FinanceDataProvider />
      <div className="min-h-screen bg-[#f2f2f7]">
        <BottomNav />
        {/* Phone-width column by default, widening in two steps on iPad
            (md ≈ portrait, lg ≈ landscape) so the app is not a 448px sliver
            stranded in the middle of the screen. Every full-screen sheet
            repeats these breakpoints so the column never jumps width.
            pt-16 pairs with the `calc(100dvh - 64px)` the tab pages size
            themselves against — keep the two in step. */}
        <div className="mx-auto max-w-md pt-16 md:max-w-xl lg:max-w-2xl">{children}</div>
      </div>
    </NavProvider>
  );
}

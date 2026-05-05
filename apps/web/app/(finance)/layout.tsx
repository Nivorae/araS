import { BottomNav } from "../../components/layout/BottomNav";

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f2f2f7]">
      <BottomNav />
      <div className="mx-auto max-w-md pt-16">{children}</div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Building2, BarChart3, Shield, Landmark, Loader2, PiggyBank } from "lucide-react";

const tabs = [
  { href: "/assets", icon: Building2, label: "資產" },
  { href: "/transactions", icon: BarChart3, label: "收支" },
  { href: "/loans", icon: Landmark, label: "貸款" },
  { href: "/insurance", icon: Shield, label: "保險" },
  { href: "/retirement", icon: PiggyBank, label: "退休金" },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const navigate = (href: string) => {
    if (href === pathname) return;
    setPendingHref(href);
    startTransition(() => {
      router.push(href);
    });
  };

  return (
    <nav className="fixed top-3 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-1 rounded-full bg-white/70 px-3 py-2 shadow-lg ring-1 ring-black/5 backdrop-blur-xl">
        {tabs.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          const loading = isPending && pendingHref === href;
          return (
            <button
              key={href}
              onClick={() => navigate(href)}
              aria-label={label}
              disabled={loading}
              className={`flex items-center justify-center rounded-full p-3 transition-colors ${
                active ? "bg-black/8 text-black" : "text-[#c7c7cc] hover:text-[#8e8e93]"
              }`}
            >
              {loading ? (
                <Loader2 size={22} className="animate-spin" />
              ) : (
                <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

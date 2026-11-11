"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  GalleryVerticalEnd,
  BarChart3,
  Loader2,
  PiggyBank,
  Plus,
  Home,
  Settings,
} from "lucide-react";
import { useNavContext } from "../../app/(finance)/nav-context";
import { useAuth } from "@clerk/nextjs";

const tabs = [
  { href: "/assets", icon: GalleryVerticalEnd, label: "資產" },
  { href: "/transactions", icon: BarChart3, label: "收支" },
  { href: "/retirement", icon: PiggyBank, label: "退休金" },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const { addAction } = useNavContext();
  const { isSignedIn } = useAuth();
  // The icon that just became active hops once (not on first mount).
  const [hopHref, setHopHref] = useState<string | null>(null);
  const prevPath = useRef(pathname);
  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;
    setHopHref(pathname);
    const t = setTimeout(() => setHopHref(null), 520);
    return () => clearTimeout(t);
  }, [pathname]);

  // "+" is on every tab, like mobile: a page can register its own action
  // (the assets page opens its picker in place); elsewhere it goes to the
  // assets tab and opens the picker there.
  const handleAdd = addAction ?? (() => navigate("/assets?add=1"));

  const navigate = (href: string) => {
    if (href === pathname) return;
    setPendingHref(href);
    startTransition(() => {
      router.push(href);
    });
  };

  // Signed in, the last slot opens 設定 (which is where 登出 now lives); signed
  // out there is no account to configure, so it stays a way back to 首頁.
  const handleLastButton = () => navigate(isSignedIn ? "/more" : "/welcome");

  const LastIcon = isSignedIn ? Settings : Home;
  const lastLabel = isSignedIn ? "設定" : "首頁";
  const lastActive = isSignedIn ? pathname === "/more" : pathname === "/welcome";

  return (
    <nav className="fixed top-6 left-1/2 z-50 -translate-x-1/2">
      <div
        className="relative flex items-center gap-1 rounded-full px-3"
        style={{
          /* Glass body — near-opaque white like the image panels */
          background:
            "linear-gradient(160deg, rgba(255,255,255,0.96) 0%, rgba(245,245,248,0.88) 40%, rgba(238,238,244,0.82) 65%, rgba(248,248,252,0.90) 100%)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          /* Metallic border: lighter on top-left, subtle on bottom-right */
          border: "1.5px solid rgba(190,190,200,0.70)",
          boxShadow: [
            /* Outer drop shadow */
            "0 10px 32px rgba(0,0,0,0.18)",
            "0 3px 8px rgba(0,0,0,0.10)",
            /* Top bright inner rim (glass edge highlight) */
            "inset 0 2px 3px rgba(255,255,255,1)",
            /* Left bright inner rim */
            "inset 2px 0 3px rgba(255,255,255,0.80)",
            /* Bottom inner shadow for depth */
            "inset 0 -2px 4px rgba(180,180,190,0.25)",
          ].join(", "),
        }}
      >
        {/* Diagonal light streak — upper-left quadrant, like the image reflection */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
          style={{
            background:
              "linear-gradient(128deg, rgba(255,255,255,0.90) 0%, rgba(255,255,255,0.60) 22%, rgba(255,255,255,0.10) 45%, transparent 55%)",
          }}
        />

        {/* Corner sparkle — top-left */}
        <div
          className="pointer-events-none absolute top-1 left-3 rounded-full"
          style={{
            width: 18,
            height: 18,
            background:
              "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.40) 40%, transparent 70%)",
          }}
        />

        {/* Corner sparkle — bottom-right */}
        <div
          className="pointer-events-none absolute right-3 bottom-1 rounded-full"
          style={{
            width: 12,
            height: 12,
            background:
              "radial-gradient(circle, rgba(255,255,255,0.90) 0%, rgba(255,255,255,0.20) 50%, transparent 70%)",
          }}
        />

        {tabs.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          const loading = isPending && pendingHref === href;
          return (
            <button
              key={href}
              onClick={() => navigate(href)}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              disabled={loading}
              className="group relative z-10 flex cursor-pointer items-center justify-center rounded-full p-3 transition-colors duration-200"
              style={{
                color: active ? "rgba(30,30,40,0.85)" : "rgba(30,30,40,0.32)",
              }}
            >
              {/* Active highlight — springs in behind the icon. */}
              <span
                aria-hidden
                className="absolute top-1/2 left-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(30,30,40,0.08)]"
                style={{
                  opacity: active ? 1 : 0,
                  scale: active ? "1" : "0.5",
                  transition: "opacity 250ms ease-out, scale 380ms cubic-bezier(0.34,1.56,0.64,1)",
                }}
              />
              <span
                className="relative inline-flex transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-active:scale-[0.72] group-active:duration-75"
                style={
                  hopHref === href
                    ? { animation: "nav-hop 520ms cubic-bezier(0.34,1.56,0.64,1)" }
                    : undefined
                }
              >
                {loading ? (
                  <Loader2 size={22} className="animate-spin" />
                ) : (
                  <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
                )}
              </span>
            </button>
          );
        })}

        {/* Home (guest) or Logout (signed in) */}
        <button
          onClick={handleLastButton}
          aria-label={lastLabel}
          className="relative z-10 flex cursor-pointer items-center justify-center rounded-full p-3 transition-all duration-200"
          style={{
            color: lastActive ? "rgba(30,30,40,0.85)" : "rgba(30,30,40,0.32)",
          }}
        >
          <LastIcon size={22} strokeWidth={lastActive ? 2.5 : 1.5} />
        </button>

        {(isSignedIn || addAction) && (
          <>
            <div
              className="relative z-10 mx-1 h-5 w-px"
              style={{ background: "rgba(0,0,0,0.12)" }}
            />
            <button
              onClick={handleAdd}
              aria-label="新增"
              className="relative z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-opacity active:opacity-70"
              style={{
                background:
                  "linear-gradient(160deg, rgba(72,84,104,0.92) 0%, rgba(40,50,64,0.96) 100%)",
                boxShadow:
                  "0 2px 8px rgba(40,50,64,0.40), inset 0 1.5px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.22)",
              }}
            >
              <Plus size={18} className="text-white" />
            </button>
          </>
        )}
      </div>
    </nav>
  );
}

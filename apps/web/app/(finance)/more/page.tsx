"use client";

import { useEffect, useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { Check, LogOut, Trash2, type LucideIcon } from "lucide-react";
import { Spinner } from "../../../components/ui/Spinner";
import { BottomSheet } from "../../../components/ui/BottomSheet";
import { api } from "../../../lib/api-client";
import { useIsPremium } from "../../../hooks/useIsPremium";

// Web port of apps/mobile/app/(app)/settings.tsx. Native-only rows are left
// out on purpose: Face ID lock, the monthly push reminder, the IAP upgrade /
// restore / manage-subscription cards, demo mode, the OTA version footer and
// the OTA "更新內容" notes (they describe the iPhone app, not this site).

const AVATAR_SIZE = 40;

function SettingCard({
  icon: Icon,
  label,
  color,
  textColor,
  loading = false,
  disabled = false,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  color: string;
  textColor: string;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const Tag = onPress ? "button" : "div";
  return (
    <Tag
      {...(onPress ? { type: "button" as const, onClick: onPress, disabled } : {})}
      className={`flex w-full items-center gap-3 rounded-[26px] px-5 py-5 text-left shadow-[0_-2px_12px_rgba(0,0,0,0.08)] transition-[transform,opacity] duration-200 ${
        onPress ? "cursor-pointer active:scale-[0.97] active:opacity-85" : ""
      } ${disabled ? "opacity-60" : ""}`}
      style={{ backgroundColor: color, color: textColor }}
    >
      {loading ? <Spinner size={20} /> : <Icon size={20} />}
      <span className="text-[16px] font-bold">{label}</span>
    </Tag>
  );
}

function Avatar({ imageUrl, initial }: { imageUrl: string | null; initial: string }) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className="shrink-0 rounded-full object-cover"
        style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-[#C7C7D4] text-[17px] font-bold text-[#1c1c1e]"
      style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
    >
      {initial}
    </span>
  );
}

export default function MorePage() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { isPremium } = useIsPremium();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? "";
  const name = user?.fullName ?? "";
  const greetingName = user?.firstName ?? user?.fullName ?? "";
  const initial = (name || email || "?")[0]!.toUpperCase();
  const imageUrl = user?.hasImage ? (user.imageUrl ?? null) : null;

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  async function handleDelete() {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await api.delete("/account");
      if (!res.success) {
        // Keep the sheet open so the user can retry rather than losing the flow.
        setDeleteError(res.error.message);
        return;
      }
      // Data + Clerk user are gone; web needs the destination spelled out.
      await signOut({ redirectUrl: "/welcome" });
    } catch {
      setDeleteError("網路連線中斷，請稍後再試");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="relative min-h-[calc(100dvh-64px)]">
      {/* Soft blue glow — three radial gradients that fade to transparent. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-0"
        style={{
          background: [
            "radial-gradient(circle 62vw at 10% 12%, rgba(76,125,240,0.34) 0%, rgba(76,125,240,0.14) 55%, rgba(76,125,240,0) 100%)",
            "radial-gradient(circle 50vw at 95% 30%, rgba(126,166,245,0.30) 0%, rgba(126,166,245,0.12) 55%, rgba(126,166,245,0) 100%)",
            "radial-gradient(circle 66vw at 30% 92%, rgba(55,66,84,0.18) 0%, rgba(55,66,84,0.07) 60%, rgba(55,66,84,0) 100%)",
            "#f4f6fb",
          ].join(", "),
        }}
      />

      <div className="relative px-4 pt-2 pb-10">
        {/* Header: account avatar on the right (opens the menu with 登出). */}
        <div className="flex items-center justify-end py-3">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="帳號選單"
            aria-expanded={menuOpen}
            className="cursor-pointer rounded-full border-2 border-white/90 shadow-[0_2px_8px_rgba(28,28,30,0.12)] active:opacity-70"
          >
            <Avatar imageUrl={imageUrl} initial={initial} />
          </button>
        </div>

        {/* Greeting — the page's title block */}
        <div className="pt-5 pb-9">
          <h1 className="text-[32px] font-bold tracking-[-0.5px] text-[#1c1c1e]">
            {greetingName ? `Hi, ${greetingName}` : "Hi"}
          </h1>
          <p className="mt-1 text-[26px] font-bold tracking-[-0.5px] text-[#8e8e93]">
            今天離你的目標又更進一步囉
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {/* Status only — web has no purchase path (CLAUDE.md "No web premium/paywall UI"). */}
          {isPremium && (
            <SettingCard icon={Check} label="已升級 Premium" color="#374254" textColor="#ffffff" />
          )}
          <SettingCard
            icon={Trash2}
            label={deleteLoading ? "刪除中…" : "刪除帳號"}
            color="#FFFFFF"
            textColor="#ff3b30"
            loading={deleteLoading}
            disabled={deleteLoading}
            onPress={() => {
              setDeleteError(null);
              setShowDeleteConfirm(true);
            }}
          />
        </div>

        <p className="mt-4 text-center text-[13px] text-[#8e8e93]">
          永久刪除帳號與所有資料，無法復原。
        </p>
      </div>

      {/* Avatar menu: identity + 登出, anchored under the avatar. No dim. */}
      {menuOpen && (
        <div className="fixed inset-0 z-[80]" onClick={() => setMenuOpen(false)}>
          <div className="mx-auto flex max-w-md justify-end px-4 pt-[124px] md:max-w-xl lg:max-w-2xl">
            <div
              role="menu"
              onClick={(e) => e.stopPropagation()}
              className="max-w-[300px] min-w-[220px] animate-[modal-scrim-in_180ms_ease-out] rounded-[20px] bg-white py-2 shadow-[0_8px_20px_rgba(0,0,0,0.16)]"
            >
              <div className="flex items-center gap-3 border-b border-[#e5e5ea] px-4 py-3">
                <Avatar imageUrl={imageUrl} initial={initial} />
                <div className="min-w-0">
                  {name && <p className="truncate text-[15px] font-bold text-[#1c1c1e]">{name}</p>}
                  <p className="truncate text-[13px] text-[#8e8e93]">{email}</p>
                </div>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  void signOut({ redirectUrl: "/welcome" });
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-3.5 text-left active:opacity-60"
              >
                <LogOut size={18} className="text-[#1c1c1e]" />
                <span className="text-[15px] font-semibold text-[#1c1c1e]">登出</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete account confirmation */}
      <BottomSheet
        open={showDeleteConfirm}
        onClose={() => {
          if (!deleteLoading) setShowDeleteConfirm(false);
        }}
        dismissOnBackdrop={!deleteLoading}
        panelClassName="px-5 pt-4 pb-10"
        label="刪除帳號"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#e5e5ea]" />
        <p className="mb-2 text-center text-[16px] font-semibold text-[#1c1c1e]">刪除帳號</p>
        <p className="mb-6 text-center text-[13px] text-[#8e8e93]">
          此動作會永久刪除你的帳號與所有資料（資產、負債、交易、投資組合），且無法復原。確定要繼續嗎？
        </p>
        {deleteError && (
          <p role="alert" className="mb-4 text-center text-[13px] text-[#ff3b30]">
            {deleteError}
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => setShowDeleteConfirm(false)}
            disabled={deleteLoading}
            className="flex-1 cursor-pointer rounded-full border border-[#e5e5ea] py-3 text-[15px] font-semibold text-[#1c1c1e] active:bg-[#f2f2f7] disabled:opacity-40"
          >
            取消
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteLoading}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-[#ff3b30] py-3 text-[15px] font-semibold text-white active:opacity-80 disabled:opacity-40"
          >
            {deleteLoading && <Spinner size={14} />}
            {deleteLoading ? "刪除中…" : "確認刪除"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

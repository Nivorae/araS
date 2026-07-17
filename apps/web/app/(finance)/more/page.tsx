"use client";

import { useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { LogOut, Trash2 } from "lucide-react";
import { Spinner } from "../../../components/ui/Spinner";
import { api } from "../../../lib/api-client";

const sectionLabel = "mb-2 ml-1 text-[13px] font-semibold tracking-wide text-[#8e8e93] uppercase";
const row =
  "mb-2 flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-[15px] text-left shadow-sm active:opacity-60";

export default function MorePage() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? "—";
  const name = user?.fullName ?? "";

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
      // Data + Clerk user are gone. Unlike mobile — where the root layout sends
      // the user to welcome once the session clears — web needs the destination
      // spelled out.
      await signOut({ redirectUrl: "/welcome" });
    } catch {
      setDeleteError("網路連線中斷，請稍後再試");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="px-4 pt-6 pb-10">
      <h1 className="mb-4 text-xl font-bold text-[#1c1c1e]">設定</h1>

      <p className={sectionLabel}>帳號</p>
      <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        {name && <p className="text-[16px] font-semibold text-[#1c1c1e]">{name}</p>}
        <p className="text-[15px] text-[#3c3c43]">{email}</p>
      </div>

      <button type="button" onClick={() => signOut({ redirectUrl: "/welcome" })} className={row}>
        <LogOut size={20} className="text-[#374254]" />
        <span className="text-[16px] font-medium text-[#1c1c1e]">登出</span>
      </button>

      <p className={`mt-7 ${sectionLabel}`}>危險操作</p>
      <button type="button" onClick={() => setShowDeleteConfirm(true)} className={row}>
        <Trash2 size={20} className="text-[#ff3b30]" />
        <span className="text-[16px] font-medium text-[#ff3b30]">刪除帳號</span>
      </button>
      <p className="mt-2 ml-1 text-[13px] text-[#8e8e93]">永久刪除帳號與所有資料，無法復原。</p>

      {/* Delete account confirmation bottom sheet */}
      {showDeleteConfirm && (
        <>
          <div
            className="fixed inset-0 z-[80] bg-black/40"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-[81] mx-auto max-w-md rounded-t-2xl bg-white px-5 pt-4 pb-10">
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
                className="flex-1 rounded-full border border-[#e5e5ea] py-3 text-[15px] font-semibold text-[#1c1c1e] active:bg-[#f2f2f7] disabled:opacity-40"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#ff3b30] py-3 text-[15px] font-semibold text-white active:opacity-80 disabled:opacity-40"
              >
                {deleteLoading && <Spinner size={14} />}
                {deleteLoading ? "刪除中..." : "確認刪除"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { BottomSheet } from "./BottomSheet";
import { Spinner } from "./Spinner";

/**
 * Destructive confirmation as a bottom sheet — the web stand-in for the native
 * `Alert.alert(title, message, [取消, 刪除])` the mobile app uses.
 */
export function ConfirmSheet({
  open,
  title,
  message,
  confirmLabel = "刪除",
  busy = false,
  busyLabel = "刪除中…",
  onConfirm,
  onClose,
  onClosed,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  busy?: boolean;
  busyLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  onClosed?: () => void;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={busy ? () => {} : onClose}
      {...(onClosed ? { onClosed } : {})}
      dismissOnBackdrop={!busy}
      panelClassName="px-5 pt-4 pb-10"
      label={title}
    >
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#e5e5ea]" />
      <p className="mb-2 text-center text-[16px] font-semibold text-[#1c1c1e]">{title}</p>
      {message && <p className="mb-6 text-center text-[13px] text-[#8e8e93]">{message}</p>}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="flex-1 cursor-pointer rounded-full border border-[#e5e5ea] py-3 text-[15px] font-semibold text-[#1c1c1e] active:bg-[#f2f2f7] disabled:opacity-40"
        >
          取消
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-[#ff3b30] py-3 text-[15px] font-semibold text-white active:opacity-80 disabled:opacity-40"
        >
          {busy && <Spinner size={14} />}
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </BottomSheet>
  );
}

/** Informational one-button sheet — the web stand-in for a single-button `Alert.alert`. */
export function NoticeSheet({
  open,
  title,
  message,
  onClose,
}: {
  open: boolean;
  title: string;
  message?: string;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} panelClassName="px-5 pt-4 pb-10" label={title}>
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#e5e5ea]" />
      <p className="mb-2 text-center text-[16px] font-semibold text-[#1c1c1e]">{title}</p>
      {message && <p className="mb-6 text-center text-[13px] text-[#8e8e93]">{message}</p>}
      <button
        type="button"
        onClick={onClose}
        className="w-full cursor-pointer rounded-full bg-[#1c1c1e] py-3 text-[15px] font-semibold text-white active:opacity-80"
      >
        好
      </button>
    </BottomSheet>
  );
}

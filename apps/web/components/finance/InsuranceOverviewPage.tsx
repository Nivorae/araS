"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Pencil, Plus, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { INSURANCE_TYPE_LABELS, type Insurance } from "@repo/shared";
import { formatCurrency } from "../../lib/format";
import { Spinner } from "../ui/Spinner";
import { InsurerLogo } from "../ui/InsurerLogo";
import { ConfirmSheet, NoticeSheet } from "../ui/ConfirmSheet";
import { CATEGORIES, INSURANCE_ACCENT } from "./categoryConfig";
import { InsuranceFormPage } from "./InsuranceFormPage";

// Web port of apps/mobile/app/(app)/insurance/overview.tsx: every policy as a
// card in a 3D cover-flow deck; tapping the centred card grows it in place
// into the detail card (編輯 / 刪除 at the bottom).

const UNKNOWN = "不確定";
const CARD_RADIUS = 22;
const EXPANDED_RADIUS = 26;
const HEADER_H_EXPANDED = 116;
const CARD_BASE_MAX_WIDTH = 700;
const EXPANDED_MAX_WIDTH = 640;
const EXPANDED_MAX_HEIGHT = 900;
const SHADOW_PAD = 32;

const LIGHT_BG_TEXT = {
  muted: "rgba(28,28,30,0.55)",
  dashed: "rgba(28,28,30,0.16)",
  closeBg: "rgba(28,28,30,0.08)",
};
const DARK_BG_TEXT = {
  muted: "rgba(255,255,255,0.75)",
  dashed: "rgba(255,255,255,0.3)",
  closeBg: "rgba(255,255,255,0.22)",
};

// The five net-worth category colours (minus 保險 itself), cycled per card.
const PALETTE = CATEGORIES.filter((c) => c.name !== "保險").map((c) => ({
  bg: c.color,
  text: c.textColor,
  ...(c.textColor.toLowerCase() === "#ffffff" ? DARK_BG_TEXT : LIGHT_BG_TEXT),
}));
const themeFor = (i: number) => PALETTE[i % PALETTE.length]!;

function formatDate(iso: string | null): string {
  if (!iso) return UNKNOWN;
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

// Interpolate across the five stops at offsets −2…+2 cards from centre.
function lerpStops(t: number, stops: [number, number, number, number, number]) {
  const x = Math.max(-2, Math.min(2, t)) + 2; // 0…4
  const i = Math.min(3, Math.floor(x));
  const f = x - i;
  return stops[i]! + (stops[i + 1]! - stops[i]!) * f;
}

function Row({
  label,
  value,
  text,
  muted,
}: {
  label: string;
  value: string;
  text: string;
  muted: string;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="mr-3 shrink-0 text-[14px]" style={{ color: muted }}>
        {label}
      </span>
      <span className="min-w-0 text-right text-[14px] font-medium" style={{ color: text }}>
        {value}
      </span>
    </div>
  );
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function InsuranceOverviewPage({
  open,
  focusId,
  onClose,
  onChanged,
}: {
  open: boolean;
  /** Centre the deck on this policy when opening. */
  focusId: string | null;
  onClose: () => void;
  /** Refresh the entries store after an add / edit / delete. */
  onChanged: () => void;
}) {
  const [insurances, setInsurances] = useState<Insurance[] | null>(null);
  const [viewport, setViewport] = useState({ w: 390, h: 844 });
  const [activeIndex, setActiveIndex] = useState(0);
  const [expanded, setExpanded] = useState<{ ins: Insurance; index: number; origin: Rect } | null>(
    null
  );
  const [closing, setClosing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formEdit, setFormEdit] = useState<Insurance | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const focusedFor = useRef<string | null>(null);

  useLayoutEffect(() => {
    const measure = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/insurances");
      const json = await res.json();
      const list: Insurance[] = json.success ? json.data : [];
      setInsurances(list);
      return list;
    } catch {
      setInsurances([]);
      return [];
    }
  }, []);

  useEffect(() => {
    if (!open) {
      focusedFor.current = null;
      return;
    }
    setExpanded(null);
    void load();
  }, [open, load]);

  // Oldest first, so the deck reads left → right in creation order.
  const sorted = useMemo(
    () =>
      insurances
        ? [...insurances].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
        : [],
    [insurances]
  );

  // Geometry — same formulas as mobile, from a bounded width.
  const CARD_W = Math.round(Math.min(viewport.w, CARD_BASE_MAX_WIDTH) * 0.54);
  const CARD_H = Math.round(Math.min(CARD_W * 1.35, viewport.h * 0.62));
  const SPACING = -Math.round(CARD_W * 0.38);
  const INTERVAL = CARD_W + SPACING;
  const sideInset = (viewport.w - CARD_W) / 2;
  const EXPANDED_W = Math.round(Math.min(viewport.w * 0.86, EXPANDED_MAX_WIDTH));
  const EXPANDED_H = Math.round(Math.min(viewport.h * 0.72, EXPANDED_MAX_HEIGHT));
  const expandedRect: Rect = {
    left: (viewport.w - EXPANDED_W) / 2,
    top: (viewport.h - EXPANDED_H) / 2,
    width: EXPANDED_W,
    height: EXPANDED_H,
  };

  // Per-card cover-flow transform, written to the DOM on every scroll frame.
  const paint = useCallback(() => {
    const sc = scrollRef.current;
    if (!sc || INTERVAL <= 0) return;
    const x = sc.scrollLeft;
    const count = cardRefs.current.length;
    const active = Math.max(0, Math.min(count - 1, Math.round(x / INTERVAL)));
    cardRefs.current.forEach((el, i) => {
      if (!el) return;
      const t = (x - i * INTERVAL) / INTERVAL; // >0: card is left of centre
      const rotate = lerpStops(t, [-55, -40, 0, 40, 55]);
      const scale = lerpStops(t, [0.66, 0.82, 1, 0.82, 0.66]);
      const opacity = lerpStops(t, [0.4, 0.7, 1, 0.7, 0.4]);
      el.style.transform = `perspective(900px) rotateY(${rotate}deg) scale(${scale})`;
      el.style.opacity = String(opacity);
      el.style.zIndex = String(count - Math.abs(i - active));
    });
    setActiveIndex((prev) => (prev === active ? prev : active));
  }, [INTERVAL]);

  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    paint();
    sc.addEventListener("scroll", paint, { passive: true });
    return () => sc.removeEventListener("scroll", paint);
  }, [paint, sorted.length]);

  // Centre the deck on the policy tapped in from the assets page — once per open.
  useLayoutEffect(() => {
    if (!open || insurances === null || focusedFor.current === (focusId ?? "")) return;
    focusedFor.current = focusId ?? "";
    const idx = Math.max(
      0,
      sorted.findIndex((i) => i.id === focusId)
    );
    if (scrollRef.current) scrollRef.current.scrollLeft = idx * INTERVAL;
    paint();
  }, [open, insurances, sorted, focusId, INTERVAL, paint]);

  const goTo = (i: number) =>
    scrollRef.current?.scrollTo({ left: i * INTERVAL, behavior: "smooth" });

  const openDetail = (ins: Insurance, index: number) => {
    const el = cardRefs.current[index];
    const r = el?.getBoundingClientRect();
    setClosing(false);
    setExpanded({
      ins,
      index,
      origin: r ? { left: r.left, top: r.top, width: r.width, height: r.height } : expandedRect,
    });
  };

  const closeDetail = () => setClosing(true);

  async function handleDelete() {
    if (!expanded) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/insurances/${expanded.ins.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error();
      setConfirmDelete(false);
      const list = await load();
      setActiveIndex((i) => Math.max(0, Math.min(i, list.length - 1)));
      onChanged();
      closeDetail();
    } catch {
      setConfirmDelete(false);
      setNotice({ title: "刪除失敗", message: "請稍後再試" });
    } finally {
      setDeleting(false);
    }
  }

  const exp = expanded;
  const theme = exp ? themeFor(exp.index) : PALETTE[0]!;
  const target = closing && exp ? exp.origin : expandedRect;
  const springT = { type: "spring" as const, stiffness: 170, damping: 21 };
  const closeT = { duration: 0.22, ease: "easeInOut" as const };

  return (
    <div
      className={`fixed inset-0 z-[60] bg-[#f2f2f7] transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
      aria-hidden={!open}
    >
      {/* Header: back · add */}
      <div className="absolute inset-x-0 top-0 z-10 mx-auto flex max-w-md items-center justify-between px-4 pt-12 md:max-w-xl lg:max-w-2xl">
        <button
          onClick={onClose}
          aria-label="返回"
          className="flex h-10 w-10 cursor-pointer items-center justify-center active:opacity-60"
        >
          <ChevronLeft size={22} className="text-[#1c1c1e]" />
        </button>
        <p className="text-[17px] font-bold text-[#1c1c1e]">保單</p>
        <button
          onClick={() => {
            setFormEdit(null);
            setFormOpen(true);
          }}
          aria-label="新增保單"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#2f3a4a] text-white shadow-[0_2px_8px_rgba(40,50,64,0.4)] active:opacity-80"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Deck, vertically centred */}
      <div className="flex h-full items-center justify-center">
        {insurances === null ? (
          <span style={{ color: INSURANCE_ACCENT }}>
            <Spinner size={28} />
          </span>
        ) : sorted.length === 0 ? (
          <p className="text-[15px] text-[#8e8e93]">還沒有保單</p>
        ) : (
          <div
            ref={scrollRef}
            className="flex w-full snap-x snap-mandatory items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{
              height: CARD_H + SHADOW_PAD * 2,
              paddingLeft: sideInset,
              paddingRight: sideInset,
              scrollPaddingLeft: sideInset,
            }}
            data-testid="insurance-deck"
          >
            {sorted.map((ins, i) => {
              const t = themeFor(i);
              const isBeingExpanded = exp?.ins.id === ins.id;
              return (
                <div
                  key={ins.id}
                  ref={(el) => {
                    cardRefs.current[i] = el;
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${INSURANCE_TYPE_LABELS[ins.insuranceType]} ${ins.insurer}`}
                  onClick={() => (i === activeIndex ? openDetail(ins, i) : goTo(i))}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    if (i === activeIndex) openDetail(ins, i);
                    else goTo(i);
                  }}
                  className="relative flex shrink-0 cursor-pointer snap-start flex-col items-center justify-center px-5 shadow-[0_8px_16px_rgba(0,0,0,0.22)] will-change-transform"
                  style={{
                    width: CARD_W,
                    height: CARD_H,
                    marginRight: i === sorted.length - 1 ? 0 : SPACING,
                    backgroundColor: t.bg,
                    borderRadius: CARD_RADIUS,
                  }}
                >
                  <p className="text-center text-[24px] font-extrabold" style={{ color: t.text }}>
                    {INSURANCE_TYPE_LABELS[ins.insuranceType]}
                  </p>
                  <div className="mt-1.5 flex items-center justify-center gap-1.5">
                    <InsurerLogo name={ins.insurer} size={18} />
                    <p
                      className="line-clamp-2 text-center text-[15px] font-semibold"
                      style={{ color: t.muted }}
                    >
                      {ins.insurer}
                    </p>
                  </div>
                  {/* Covers the source card while it's shown grown in the overlay. */}
                  {isBeingExpanded && (
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{ backgroundColor: t.bg, borderRadius: CARD_RADIUS }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* The tapped card grows in place into the detail card */}
      <AnimatePresence>
        {exp && (
          <div className="fixed inset-0 z-[70]">
            <motion.div
              className="absolute inset-0 bg-black"
              initial={{ opacity: 0 }}
              animate={{ opacity: closing ? 0 : 0.55 }}
              transition={closing ? closeT : springT}
              onClick={deleting ? undefined : closeDetail}
            />
            <motion.div
              role="dialog"
              aria-label={INSURANCE_TYPE_LABELS[exp.ins.insuranceType]}
              className="absolute overflow-hidden shadow-[0_12px_24px_rgba(0,0,0,0.3)]"
              style={{ backgroundColor: theme.bg }}
              initial={{ ...exp.origin, borderRadius: CARD_RADIUS }}
              animate={{ ...target, borderRadius: closing ? CARD_RADIUS : EXPANDED_RADIUS }}
              transition={closing ? closeT : springT}
              onAnimationComplete={() => {
                if (closing) {
                  setExpanded(null);
                  setClosing(false);
                }
              }}
            >
              {/* Header text stays centred in its own shrinking box — no jump. */}
              <motion.div
                className="absolute inset-x-0 top-0 flex flex-col items-center justify-center px-5"
                initial={{ height: exp.origin.height }}
                animate={{ height: closing ? exp.origin.height : HEADER_H_EXPANDED }}
                transition={closing ? closeT : springT}
              >
                <p className="text-center text-[24px] font-extrabold" style={{ color: theme.text }}>
                  {INSURANCE_TYPE_LABELS[exp.ins.insuranceType]}
                </p>
                <div className="mt-1.5 flex items-center justify-center gap-1.5">
                  <InsurerLogo name={exp.ins.insurer} size={18} />
                  <p
                    className="line-clamp-2 text-center text-[15px] font-semibold"
                    style={{ color: theme.muted }}
                  >
                    {exp.ins.insurer}
                  </p>
                </div>
              </motion.div>

              {/* Detail fades in once the card has mostly grown */}
              <motion.div
                className="absolute inset-x-0 bottom-0 flex flex-col"
                style={{ top: HEADER_H_EXPANDED }}
                initial={{ opacity: 0 }}
                animate={{ opacity: closing ? 0 : 1 }}
                transition={closing ? { duration: 0.1 } : { delay: 0.12, duration: 0.25 }}
              >
                <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3">
                  {exp.ins.policyName && (
                    <p className="text-center text-[14px]" style={{ color: theme.muted }}>
                      {exp.ins.policyName}
                    </p>
                  )}
                  <div
                    className="my-3.5 border-b border-dashed"
                    style={{ borderColor: theme.dashed }}
                  />
                  <Row
                    label="被保人"
                    value={exp.ins.insuredName}
                    text={theme.text}
                    muted={theme.muted}
                  />
                  <Row
                    label="保單號碼"
                    value={exp.ins.policyNumber ?? UNKNOWN}
                    text={theme.text}
                    muted={theme.muted}
                  />
                  <Row
                    label="投保日期"
                    value={formatDate(exp.ins.startDate)}
                    text={theme.text}
                    muted={theme.muted}
                  />
                  <Row
                    label="繳費年期"
                    value={
                      exp.ins.paymentTermYears != null ? `${exp.ins.paymentTermYears} 年` : UNKNOWN
                    }
                    text={theme.text}
                    muted={theme.muted}
                  />
                  <Row
                    label="保障期間"
                    value={exp.ins.coveragePeriod ?? UNKNOWN}
                    text={theme.text}
                    muted={theme.muted}
                  />
                  <Row
                    label="年繳保費"
                    value={
                      exp.ins.annualPremium != null
                        ? formatCurrency(exp.ins.annualPremium)
                        : UNKNOWN
                    }
                    text={theme.text}
                    muted={theme.muted}
                  />
                  {exp.ins.coverage.length > 0 && (
                    <>
                      <div
                        className="my-3.5 border-b border-dashed"
                        style={{ borderColor: theme.dashed }}
                      />
                      <p className="mb-1.5 text-[13px] font-bold" style={{ color: theme.muted }}>
                        保障項目
                      </p>
                      {exp.ins.coverage.map((c) => (
                        <Row
                          key={c.key}
                          label={c.label}
                          value={formatCurrency(c.value)}
                          text={theme.text}
                          muted={theme.muted}
                        />
                      ))}
                    </>
                  )}
                </div>
                <div className="flex gap-3 px-5 pt-3 pb-5">
                  <button
                    onClick={() => {
                      setFormEdit(exp.ins);
                      setFormOpen(true);
                    }}
                    disabled={deleting}
                    className="flex h-12 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[14px] text-[15px] font-semibold"
                    style={{ backgroundColor: theme.closeBg, color: theme.text }}
                  >
                    <Pencil size={18} />
                    編輯
                  </button>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    disabled={deleting}
                    className="flex h-12 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[14px] text-[15px] font-semibold text-[#ff3b30] disabled:opacity-50"
                    style={{ backgroundColor: theme.closeBg }}
                  >
                    <Trash2 size={18} />
                    刪除
                  </button>
                </div>
              </motion.div>

              <motion.button
                className="absolute top-3.5 right-3.5 z-[2] flex h-8 w-8 cursor-pointer items-center justify-center rounded-full"
                style={{ backgroundColor: theme.closeBg, color: theme.text }}
                initial={{ opacity: 0 }}
                animate={{ opacity: closing ? 0 : 1 }}
                transition={{ delay: closing ? 0 : 0.12 }}
                onClick={closeDetail}
                disabled={deleting}
                aria-label="關閉"
              >
                <X size={18} />
              </motion.button>

              {deleting && (
                <div
                  className="absolute inset-0 z-[3] flex items-center justify-center bg-black/15"
                  style={{ color: theme.text }}
                >
                  <Spinner size={28} />
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmSheet
        open={confirmDelete}
        title="刪除保單"
        message="確定要刪除這張保單嗎？此動作無法復原。"
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onClose={() => setConfirmDelete(false)}
      />
      <NoticeSheet
        open={notice !== null}
        title={notice?.title ?? ""}
        message={notice?.message ?? ""}
        onClose={() => setNotice(null)}
      />

      <InsuranceFormPage
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          onChanged();
          void load().then((list) => {
            // Keep the grown card showing the saved data.
            setExpanded((cur) => {
              if (!cur) return cur;
              const fresh = list.find((i) => i.id === cur.ins.id);
              return fresh ? { ...cur, ins: fresh } : cur;
            });
          });
        }}
        categoryColor={INSURANCE_ACCENT}
        editItem={formEdit}
      />
    </div>
  );
}

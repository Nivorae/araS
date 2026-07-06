"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, MotionConfig, type Variants } from "motion/react";
import {
  Wallet,
  Scale,
  ArrowLeftRight,
  PieChart,
  Umbrella,
  TrendingUp,
  LineChart,
  LogIn,
  Lock,
  Download,
  type LucideIcon,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Config                                                                     */
/* -------------------------------------------------------------------------- */

const PRIVACY_HREF = "/privacy";
const DOWNLOAD_HREF = "https://apps.apple.com/us/app/aras-asset/id6785747999"; // 假連結，之後接上 App Store / 下載頁

// 五支手機的截圖插槽。把圖片放到 apps/web/public/landing/ 後，
// 這裡的路徑就會自動顯示；找不到檔案時會回退成占位畫面。
const PHONE_SHOTS = [
  "/landing/phone-1.png",
  "/landing/phone-2.png",
  "/landing/phone-3.png",
  "/landing/phone-4.png",
  "/landing/phone-5.png",
];

interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
}

const FEATURES: Feature[] = [
  { icon: Wallet, title: "淨資產總覽", desc: "一眼看清總資產與淨值" },
  { icon: Scale, title: "資產與負債", desc: "分類管理每一筆進出" },
  { icon: ArrowLeftRight, title: "交易紀錄", desc: "收支一筆不漏，自動歸類" },
  { icon: PieChart, title: "投資組合", desc: "追蹤持股與報酬表現" },
  { icon: Umbrella, title: "保險保障", desc: "集中管理所有保單資訊" },
  { icon: TrendingUp, title: "退休規劃", desc: "預估未來，提早準備" },
];

const HIGHLIGHTS: Feature[] = [
  {
    icon: LineChart,
    title: "即時淨值總覽",
    desc: "資產、負債與投資即時彙整成一個清楚的淨值數字，隨時掌握全貌。",
  },
  {
    icon: LogIn,
    title: "一鍵安全登入",
    desc: "支援 Google 與 LINE 登入，免記密碼，開啟就能用。",
  },
  {
    icon: Lock,
    title: "資料私密加密",
    desc: "全程 HTTPS 加密傳輸，資料僅與你的帳號關聯，只有你能存取。",
  },
];

/* -------------------------------------------------------------------------- */
/*  Motion variants — 入場 (whileInView) + 離場 (滾出視窗自動回到 hidden)        */
/* -------------------------------------------------------------------------- */

const EASE = [0.22, 1, 0.36, 1] as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 44 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const popIn: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.9 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: EASE } },
};

// 讓每個區塊滾入時進場、滾出時退場的共用視窗設定
const inView = { once: false, amount: 0.2 } as const;

/* -------------------------------------------------------------------------- */
/*  Phone frame                                                                */
/* -------------------------------------------------------------------------- */

function PhoneFrame({ src, width = 240 }: { src?: string | undefined; width?: number }) {
  const [errored, setErrored] = useState(false);
  const showImg = src && !errored;

  return (
    <div
      style={{
        width,
        aspectRatio: "9 / 19.3",
        background: "#0b0b0f",
        borderRadius: width * 0.16,
        padding: width * 0.03,
        boxShadow: "0 30px 60px -18px rgba(15,20,35,0.4)",
      }}
    >
      <div
        className="relative h-full w-full overflow-hidden"
        style={{ borderRadius: width * 0.13, background: "#e9e9ef" }}
      >
        {/* notch */}
        <div
          className="absolute left-1/2 z-10 -translate-x-1/2"
          style={{
            top: width * 0.03,
            width: "34%",
            height: width * 0.075,
            background: "#0b0b0f",
            borderRadius: 999,
          }}
        />
        {showImg ? (
          <Image
            src={src}
            alt="araS App 畫面"
            fill
            sizes="248px"
            onError={() => setErrored(true)}
            className="object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-center"
            style={{
              background: "linear-gradient(160deg, #374254 0%, #0e1424 100%)",
            }}
          >
            <span className="text-xs font-medium tracking-wide text-white/70">araS</span>
            <span className="text-[11px] text-white/45">畫面截圖</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export function LandingContent() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen overflow-x-hidden bg-white text-[#1c1c1e]">
        <NavBar />
        <Hero />
        <Showcase />
        <Highlights />
        <CtaBand />
        <Footer />
      </div>
    </MotionConfig>
  );
}

/* --------------------------------- Nav ------------------------------------ */

function NavBar() {
  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/icons/icon.svg" alt="araS" width={30} height={30} className="rounded-lg" />
          <span className="text-lg font-bold tracking-tight">araS</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href={PRIVACY_HREF}
            className="rounded-full px-3 py-2 text-sm font-medium text-[#8e8e93] transition-colors hover:text-[#1c1c1e]"
          >
            隱私政策
          </Link>
          <a
            href={DOWNLOAD_HREF}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#374254] px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.03] active:scale-95"
          >
            <Download size={15} strokeWidth={2.5} />
            下載
          </a>
        </div>
      </nav>
    </header>
  );
}

/* -------------------------------- Hero ------------------------------------ */

// 扇形排開的手機：中間最大最高、往兩側縮小下沉
const HERO_PHONES = [
  { width: 168, y: 76, z: 10, show: "hidden xl:block" },
  { width: 204, y: 34, z: 20, show: "hidden md:block" },
  { width: 248, y: 0, z: 30, show: "block" },
  { width: 204, y: 34, z: 20, show: "hidden md:block" },
  { width: 168, y: 76, z: 10, show: "hidden xl:block" },
];

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* 背景柔光 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        style={{
          background: "linear-gradient(180deg, #eef1f6 0%, #f7f8fa 55%, #ffffff 100%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-5 pt-14 pb-4 text-center sm:px-8 sm:pt-20">
        <motion.div initial="hidden" animate="show" variants={stagger}>
          <motion.div variants={fadeUp} className="mb-6 flex justify-center">
            <Image
              src="/icons/icon.svg"
              alt="araS"
              width={72}
              height={72}
              priority
              className="rounded-[18px] shadow-[0_10px_30px_rgba(55,66,84,0.28)]"
            />
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="mx-auto max-w-3xl text-4xl leading-[1.1] font-extrabold tracking-tight text-[#1c1c1e] sm:text-6xl"
          >
            掌握你的每一分資產
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-5 max-w-xl text-base text-[#6b6b70] sm:text-lg"
          >
            araS 把資產、負債、投資、保險與退休規劃，
            <br className="hidden sm:block" />
            整合在一個乾淨俐落的介面，隨時看清你的淨值全貌。
          </motion.p>

          <motion.div variants={fadeUp} className="mt-8 flex flex-col items-center gap-3">
            <a
              href={DOWNLOAD_HREF}
              className="inline-flex items-center gap-2 rounded-full bg-[#374254] px-7 py-3.5 text-base font-semibold text-white shadow-[0_10px_24px_rgba(55,66,84,0.3)] transition-transform hover:scale-[1.03] active:scale-95"
            >
              <Download size={18} strokeWidth={2.5} />
              免費下載使用
            </a>
            <p className="text-sm text-[#a1a1a6]">Google／LINE 一鍵登入・資料加密保護</p>
          </motion.div>
        </motion.div>
      </div>

      {/* 手機扇形 */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={stagger}
        className="relative mx-auto mt-6 flex max-w-6xl items-start justify-center px-5 pb-16 sm:px-8"
      >
        {HERO_PHONES.map((p, i) => (
          <motion.div
            key={i}
            variants={popIn}
            className={p.show}
            style={{ marginTop: p.y, zIndex: p.z, marginInline: -14 }}
          >
            <PhoneFrame src={PHONE_SHOTS[i]} width={p.width} />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

/* ------------------------------ Showcase ---------------------------------- */

function Showcase() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={inView}
        className="mx-auto max-w-2xl text-center"
      >
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
          一個 App，管理你的全部財務
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-base text-[#6b6b70] sm:text-lg">
          從日常收支到長期規劃，araS 內建你需要的每一個模組，不必再切換多個工具。
        </p>
      </motion.div>

      {/* 桌面：卡片左右夾著手機 */}
      <div className="mt-16 hidden items-center justify-center gap-8 lg:flex">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={inView}
          className="flex w-72 flex-col gap-5"
        >
          {FEATURES.slice(0, 3).map((f) => (
            <FeatureCard key={f.title} feature={f} align="right" />
          ))}
        </motion.div>

        <motion.div variants={popIn} initial="hidden" whileInView="show" viewport={inView}>
          <PhoneFrame src={PHONE_SHOTS[2]} width={248} />
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={inView}
          className="flex w-72 flex-col gap-5"
        >
          {FEATURES.slice(3).map((f) => (
            <FeatureCard key={f.title} feature={f} align="left" />
          ))}
        </motion.div>
      </div>

      {/* 手機／平板：手機在上，功能卡片兩欄排列 */}
      <div className="mt-14 flex flex-col items-center gap-10 lg:hidden">
        <motion.div variants={popIn} initial="hidden" whileInView="show" viewport={inView}>
          <PhoneFrame src={PHONE_SHOTS[2]} width={220} />
        </motion.div>
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={inView}
          className="grid w-full max-w-xl grid-cols-1 gap-4 sm:grid-cols-2"
        >
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} feature={f} align="left" />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function FeatureCard({ feature, align }: { feature: Feature; align: "left" | "right" }) {
  const Icon = feature.icon;
  return (
    <motion.div
      variants={popIn}
      className={`flex items-center gap-3.5 rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_8px_24px_rgba(15,20,35,0.06)] ${
        align === "right" ? "lg:flex-row-reverse lg:text-right" : ""
      }`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#374254]/8 text-[#374254]">
        <Icon size={22} strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-[#1c1c1e]">{feature.title}</span>
        <span className="block text-[13px] text-[#8e8e93]">{feature.desc}</span>
      </span>
    </motion.div>
  );
}

/* ----------------------------- Highlights --------------------------------- */

function Highlights() {
  return (
    <section className="bg-[#f7f8fa] py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <motion.h2
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={inView}
          className="mx-auto max-w-2xl text-center text-3xl font-extrabold tracking-tight sm:text-4xl"
        >
          安心、直覺，為你而設計
        </motion.h2>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={inView}
          className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3"
        >
          {HIGHLIGHTS.map((h) => {
            const Icon = h.icon;
            return (
              <motion.div
                key={h.title}
                variants={popIn}
                className="rounded-3xl border border-black/[0.06] bg-white p-7 shadow-[0_8px_28px_rgba(15,20,35,0.05)]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#374254] text-white">
                  <Icon size={24} strokeWidth={2} />
                </span>
                <h3 className="mt-5 text-lg font-bold text-[#1c1c1e]">{h.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[#6b6b70]">{h.desc}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------ CTA band ---------------------------------- */

function CtaBand() {
  return (
    <section className="px-5 py-20 sm:px-8 sm:py-24">
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={inView}
        className="relative mx-auto max-w-5xl overflow-hidden rounded-[32px] px-8 py-16 text-center sm:py-20"
        style={{ background: "linear-gradient(150deg, #1a2233 0%, #0e1424 100%)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, #66788e 0%, transparent 70%)" }}
        />
        <h2 className="relative text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          開始掌握你的財務全貌
        </h2>
        <p className="relative mx-auto mt-4 max-w-md text-base text-white/60 sm:text-lg">
          免費下載 araS，幾分鐘就能建立屬於你的資產總覽。
        </p>
        <a
          href={DOWNLOAD_HREF}
          className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-semibold text-[#0e1424] transition-transform hover:scale-[1.03] active:scale-95"
        >
          <Download size={18} strokeWidth={2.5} />
          立即下載
        </a>
      </motion.div>
    </section>
  );
}

/* ------------------------------- Footer ----------------------------------- */

function Footer() {
  return (
    <footer className="border-t border-black/5 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-8">
        <div className="flex items-center gap-2">
          <Image src="/icons/icon.svg" alt="araS" width={22} height={22} className="rounded-md" />
          <span className="text-sm font-semibold">araS</span>
          <span className="text-sm text-[#a1a1a6]">個人資產管理工具</span>
        </div>
        <div className="flex items-center gap-5 text-sm text-[#8e8e93]">
          <Link href={PRIVACY_HREF} className="transition-colors hover:text-[#1c1c1e]">
            隱私政策
          </Link>
          <Link href="/support" className="transition-colors hover:text-[#1c1c1e]">
            支援
          </Link>
          <span className="text-[#c7c7cc]">© {new Date().getFullYear()} araS</span>
        </div>
      </div>
    </footer>
  );
}

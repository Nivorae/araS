"use client";

import Image from "next/image";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useClerk } from "@clerk/nextjs";

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function LineIcon() {
  return (
    <span
      aria-hidden
      style={{
        width: 20,
        height: 20,
        background: "#fff",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 800,
        color: "#06C755",
        flexShrink: 0,
      }}
    >
      L
    </span>
  );
}

export default function SignInPage() {
  const { isSignedIn } = useAuth();
  const clerk = useClerk();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn) router.replace("/assets");
  }, [isSignedIn, router]);

  async function handleOAuth(strategy: "oauth_google" | "oauth_line") {
    const origin = window.location.origin;
    await clerk.client?.signIn.authenticateWithRedirect({
      strategy,
      redirectUrl: origin + "/sso-callback",
      redirectUrlComplete: origin + "/assets",
    });
  }

  return (
    <main className="flex min-h-[100dvh] flex-col" style={{ background: "#374254" }}>
      {/* Back button */}
      <div className="flex flex-shrink-0 px-5 pt-14">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full transition-opacity active:opacity-60"
          style={{ background: "rgba(255,255,255,0.15)" }}
          aria-label="返回"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 19l-7-7 7-7"
              stroke="#fff"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Brand section */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 pt-4 pb-8">
        <Image
          src="/icons/app-icon.png"
          alt="araS"
          width={72}
          height={72}
          style={{ borderRadius: 18 }}
          priority
        />
        <p style={{ color: "#fff", fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>araS</p>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14 }}>個人資產管理工具</p>
      </div>

      {/* Login card */}
      <div
        className="flex flex-col gap-3 px-7 pt-8 pb-12"
        style={{ background: "#fff", borderRadius: "28px 28px 0 0" }}
      >
        <p style={{ color: "#1c1c1e", fontSize: 17, fontWeight: 600, marginBottom: 4 }}>
          登入你的帳號
        </p>

        <button
          onClick={() => handleOAuth("oauth_google")}
          className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[14px] text-[15px] font-semibold transition-opacity active:opacity-60"
          style={{ background: "#f2f2f7", color: "#1c1c1e" }}
        >
          <GoogleIcon />以 Google 繼續
        </button>

        <button
          onClick={() => handleOAuth("oauth_line")}
          className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[14px] text-[15px] font-semibold transition-opacity active:opacity-60"
          style={{ background: "#06C755", color: "#fff" }}
        >
          <LineIcon />以 LINE 繼續
        </button>

        <p
          style={{
            color: "#8e8e93",
            fontSize: 11,
            textAlign: "center",
            lineHeight: 1.6,
            marginTop: 4,
          }}
        >
          繼續即代表你同意 <span style={{ color: "#374254" }}>服務條款</span> 與{" "}
          <span style={{ color: "#374254" }}>隱私政策</span>
        </p>
      </div>
    </main>
  );
}

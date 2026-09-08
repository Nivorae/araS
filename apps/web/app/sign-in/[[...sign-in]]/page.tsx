import Image from "next/image";
import { SignIn } from "@clerk/nextjs";

// Clerk's hosted <SignIn> renders the OAuth buttons with each provider's
// official branding. A hand-built "Continue with Google" button (custom 4-colour
// logo, our own copy) both breaks Google's OAuth branding rules and reads to
// Safe Browsing's classifier as a credential-phishing page on an unfamiliar
// domain — which is what got arasasset.com flagged as "deceptive". The araS
// wordmark above the card keeps the page unambiguously ours.
export default function SignInPage() {
  return (
    <main className="bg-surface flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-12">
      <div className="flex flex-col items-center gap-2">
        <Image
          src="/icons/app-icon.png"
          alt="araS"
          width={64}
          height={64}
          style={{ borderRadius: 16 }}
          priority
        />
        <p className="text-lg font-bold tracking-tight text-[#1c1c1e]">araS</p>
        <p className="text-sm text-[#8e8e93]">登入 araS 個人資產管理工具</p>
      </div>
      <SignIn />
    </main>
  );
}

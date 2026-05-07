import Link from "next/link";

export default function RootPage() {
  return (
    <main className="bg-surface flex min-h-screen flex-col items-center justify-center text-center">
      <h1 className="text-foreground text-4xl font-bold tracking-tight">araS</h1>
      <p className="text-foreground-secondary mt-2 text-sm">個人財務管理工具</p>
      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <Link
          href="#"
          className="bg-primary text-primary-foreground focus-visible:ring-ring w-full cursor-pointer rounded-[--radius] py-3 text-center text-sm font-medium transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          登入
        </Link>
        <Link
          href="#"
          className="border-primary bg-surface text-primary focus-visible:ring-ring w-full cursor-pointer rounded-[--radius] border py-3 text-center text-sm font-medium transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          註冊
        </Link>
        <Link
          href="/assets"
          className="bg-muted text-muted-foreground focus-visible:ring-ring w-full cursor-pointer rounded-[--radius] py-3 text-center text-sm font-medium transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          訪客瀏覽
        </Link>
      </div>
    </main>
  );
}

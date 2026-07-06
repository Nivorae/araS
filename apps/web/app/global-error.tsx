"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="zh-TW">
      <body>
        <div style={{ padding: 32, textAlign: "center" }}>
          <p>發生未預期的錯誤,請重新整理頁面。</p>
        </div>
      </body>
    </html>
  );
}

// 產生 public/icons 下的 PWA 圖示。一次性腳本，不在 build 流程裡。
//
// sharp 刻意不是 @repo/web 的相依套件：EAS 的 iOS 打包會安裝整個 workspace，
// 而 sharp 的 install script 在新的 macOS 建置映像上會改從原始碼編譯然後失敗，
// 整包 build 就停在安裝階段。Vercel 上 Next.js 的圖片最佳化用的是平台自己提供的
// sharp，不靠這裡。
//
// 要重跑這支腳本時臨時裝一下再移除：
//   pnpm --filter @repo/web add -D sharp
//   pnpm --filter @repo/web gen-icons
//   pnpm --filter @repo/web remove sharp
import sharp from "sharp";
import { mkdirSync } from "fs";

mkdirSync("public/icons", { recursive: true });

const sizes = [192, 512];

for (const size of sizes) {
  const fontSize = Math.floor(size * 0.45);
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 17, g: 24, b: 39, alpha: 1 },
    },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
            <text x="50%" y="54%" font-family="serif" font-size="${fontSize}"
                  fill="white" text-anchor="middle" dominant-baseline="middle">¥</text>
          </svg>`
        ),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toFile(`public/icons/icon-${size}x${size}.png`);

  console.log(`✓ icon-${size}x${size}.png`);
}

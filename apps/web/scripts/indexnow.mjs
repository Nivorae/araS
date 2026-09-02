// Pings IndexNow (Bing, Yandex, Seznam, Naver — and Copilot's freshness) with
// araS's public URLs. Run after a production deploy:
//
//   pnpm --filter @repo/web indexnow
//
// The key file must stay reachable at https://arasasset.com/<KEY>.txt with this
// exact key as its only content (apps/web/public/<KEY>.txt).

const KEY = "42273540bc2d049348f599ea70dcf81a";
const HOST = "arasasset.com";

const urlList = [
  `https://${HOST}/`,
  `https://${HOST}/about`,
  `https://${HOST}/privacy`,
  `https://${HOST}/support`,
  `https://${HOST}/terms`,
];

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/${KEY}.txt`,
    urlList,
  }),
});

const text = await res.text();
console.log(`IndexNow → ${res.status} ${res.statusText}${text ? `\n${text}` : ""}`);
// 200 or 202 = accepted. 422 = key/URL mismatch. 403 = key not found at keyLocation.
if (![200, 202].includes(res.status)) process.exit(1);

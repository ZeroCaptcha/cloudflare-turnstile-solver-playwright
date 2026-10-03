// Passes the Cloudflare challenge page ("Just a moment...") in front of TARGET_URL with
// ZeroCaptcha, then opens the page in Chromium through the same proxy, with the cf_clearance
// cookie and the user agent it is bound to:
//
//   ZEROCAPTCHA_API=https://api.zerocaptcha.io ZEROCAPTCHA_KEY=zc_live_... \
//     PROXY_URL=http://user:pass@proxy.example.net:8080 \
//     TARGET_URL=https://your-site.example/ node pass-challenge.mjs
//
// HEADED=1 shows the browser. Use it only on sites you own or are allowed to automate.
import { chromium } from "playwright";

import { openWithClearance, playwrightProxy } from "./src/flows.mjs";
import { zeroCaptcha } from "./src/zerocaptcha.mjs";

const target = process.env.TARGET_URL;
const proxy = process.env.PROXY_URL;
if (!target || !proxy) {
  console.error("Set TARGET_URL to the page behind the challenge and PROXY_URL to your proxy.");
  process.exit(2);
}

const clearance = await zeroCaptcha().solveChallenge({ websiteURL: target, proxy });
const browser = await chromium.launch({
  headless: process.env.HEADED !== "1",
  proxy: playwrightProxy(proxy),
});
try {
  const { page, status } = await openWithClearance(browser, target, clearance);
  console.log(`HTTP ${status}. ${page.url()}: ${await page.title()}`);
} finally {
  await browser.close();
}

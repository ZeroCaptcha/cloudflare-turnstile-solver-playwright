<!-- zc:header (generated from the registry; edit repos/registry.json) -->
# Cloudflare Turnstile and challenge pages in Playwright

[![CI](https://github.com/ZeroCaptcha/cloudflare-turnstile-solver-playwright/actions/workflows/ci.yml/badge.svg)](https://github.com/ZeroCaptcha/cloudflare-turnstile-solver-playwright/actions/workflows/ci.yml)

Solve Cloudflare Turnstile in Playwright: read the widget's sitekey, get a token from the ZeroCaptcha API, fill cf-turnstile-response and submit. Also passes a Cloudflare challenge page by loading its cf_clearance cookie with the same proxy and user agent. Tested end to end.

[Website](https://zerocaptcha.io/cloudflare-turnstile-solver/playwright) · [Docs](https://zerocaptcha.io/docs) · [Quickstart](https://zerocaptcha.io/docs/quickstart) · [API reference](https://zerocaptcha.io/docs/reference/api) · [Pricing](https://zerocaptcha.io/pricing)
<!-- /zc:header -->

## What it does

Two small Playwright flows for pages you own or are allowed to automate:

- **`solve-turnstile.mjs`** opens a page with a Cloudflare Turnstile widget, reads its sitekey (and action and cData), gets a token from the ZeroCaptcha API, puts it in the widget's `cf-turnstile-response` field, calls the widget's callback, and submits the form.
- **`pass-challenge.mjs`** passes the Cloudflare challenge page ("Just a moment...") in front of a site: ZeroCaptcha solves it through your proxy and returns the `cf_clearance` cookie with the user agent it is bound to; Chromium then opens the site through the same proxy, with that cookie and that user agent.

Both are functions in `src/flows.mjs` (`solveAndSubmit`, `openWithClearance`) that take your own `page` or `browser`, so they drop into existing scripts and Playwright Test suites. The API client in `src/zerocaptcha.mjs` has no dependencies.

## Quickstart

1. Create an account on the ZeroCaptcha website, create an API key on the dashboard and add funds (crypto, from $10). A task is charged only when it succeeds.
2. Install, and put the API's address and your key in your environment:

   ```sh
   npm ci
   npx playwright install chromium
   export ZEROCAPTCHA_API=https://api.zerocaptcha.io
   export ZEROCAPTCHA_KEY=zc_live_...
   ```

3. Solve a Cloudflare Turnstile widget and submit its form. `TARGET_URL` is the page with the widget; `HEADED=1` shows the browser:

   ```sh
   TARGET_URL=https://your-site.example/login npm run solve
   ```

4. Or pass a Cloudflare challenge page, through your own proxy:

   ```sh
   PROXY_URL=http://user:pass@proxy.example.net:8080 TARGET_URL=https://your-site.example/ npm run challenge
   ```

## Use it in your own script

```js
import { chromium } from "playwright";
import { solveAndSubmit } from "./src/flows.mjs";
import { zeroCaptcha } from "./src/zerocaptcha.mjs";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("https://your-site.example/login");
await page.getByLabel("Email").fill("me@example.com");
await solveAndSubmit(page, zeroCaptcha()); // reads ZEROCAPTCHA_API and ZEROCAPTCHA_KEY
console.log(await page.title());
```

## How it works

**A Cloudflare Turnstile widget.** The widget is an element with `data-sitekey`, and it puts its token in a hidden `cf-turnstile-response` field of its form (or the name in `data-response-field-name`). The site sends that token to Cloudflare's siteverify when the form arrives. `solveAndSubmit` asks ZeroCaptcha for a token for the page's URL and sitekey, with the widget's `data-action` and `data-cdata` when it sets them (many sites check both when they verify the token), writes it into that field (creating it if the widget has not rendered one), calls the function named in `data-callback` if there is one, and submits. The [guide to submitting the token](https://zerocaptcha.io/guides/submit-cloudflare-turnstile-token) has more on where the token goes.

**A Cloudflare challenge page.** A challenge is passed once per visitor, and Cloudflare then remembers the visitor by its `cf_clearance` cookie, which works only from the same IP address and with the same user agent. So the task runs through your proxy, and the browser must use that proxy and that user agent too. `openWithClearance` makes a context with the user agent and the cookie; launch the browser with `proxy: playwrightProxy(PROXY_URL)`.

## Honest limits

- **A token works once, for 300 seconds.** Solve right before you submit; a failed submit needs a new token.
- **Explicitly rendered widgets** (`turnstile.render(...)` with no `data-sitekey` in the page) need the sitekey, action and cData from the render call's `sitekey`, `action` and `cData` options; the [sitekey guide](https://zerocaptcha.io/guides/find-cloudflare-turnstile-sitekey) shows where to find them. Pass them to `client.solveTurnstile` yourself.
- **A clearance is bound to the proxy's IP address and the user agent,** and lasts as long as the site's Challenge Passage setting allows (30 minutes by default). Cloudflare may also compare the browser's TLS fingerprint with its user agent; Chromium's matches a Chrome user agent.
- **No SOCKS proxies:** `http` and `https` only.
- **Only for sites you own or are allowed to automate.** The [Acceptable Use Policy](https://zerocaptcha.io/legal/acceptable-use) applies to every task.

## FAQ

**Which pages can I try it on?**
Your own: put a Cloudflare Turnstile widget with one of Cloudflare's [test sitekeys](https://github.com/ZeroCaptcha/awesome-cloudflare-turnstile#testing) on a page, or use a staging copy of the site you automate. The [CI guide](https://zerocaptcha.io/guides/test-cloudflare-turnstile-in-ci) shows how to test flows with a widget in them.

**Does it work with Playwright Test, Python or .NET?**
Yes: `solveAndSubmit` takes any Playwright `page`, so call it from a Playwright Test step. In Python or .NET, run the same `fillTurnstileToken` script with `page.evaluate` after getting a token from the [Python](https://github.com/ZeroCaptcha/cloudflare-turnstile-solver-python) or [C#](https://github.com/ZeroCaptcha/cloudflare-turnstile-solver-csharp) example.

**Why not let the widget solve itself in the browser?**
In headless and automated browsers the widget often fails or loops; see the [headless browser article](https://zerocaptcha.io/blog/cloudflare-turnstile-headless-browser). A token from the API is used the same way the widget's own would be.

**What does a solve cost?**
The [pricing page](https://zerocaptcha.io/pricing) lists the price per 1,000 solved tasks for each task type. Only a task that succeeds is charged.

**Where is the same for Puppeteer or Selenium?**
[cloudflare-turnstile-solver-puppeteer](https://github.com/ZeroCaptcha/cloudflare-turnstile-solver-puppeteer) and [cloudflare-turnstile-solver-selenium](https://github.com/ZeroCaptcha/cloudflare-turnstile-solver-selenium).

## Run the tests

```sh
npm ci
npx playwright install chromium
npm test
```

The tests run both flows in a real headless Chromium against stand-ins on your machine: an API, a login page with a Cloudflare Turnstile widget, and a proxy that answers for a site behind a Cloudflare challenge. No key, no real task, nothing spent.

<!-- zc:footer (generated from the registry) -->
## More from ZeroCaptcha

- The website: [ZeroCaptcha](https://zerocaptcha.io), the [docs](https://zerocaptcha.io/docs), the [guides](https://zerocaptcha.io/guides), the [blog](https://zerocaptcha.io/blog) and the [status page](https://zerocaptcha.io/status)
- Start here: [zerocaptcha](https://github.com/ZeroCaptcha/zerocaptcha), [cloudflare-turnstile-solver](https://github.com/ZeroCaptcha/cloudflare-turnstile-solver), [cloudflare-challenge-solver](https://github.com/ZeroCaptcha/cloudflare-challenge-solver)
- Examples by language: [cloudflare-turnstile-solver-python](https://github.com/ZeroCaptcha/cloudflare-turnstile-solver-python), [cloudflare-turnstile-solver-nodejs](https://github.com/ZeroCaptcha/cloudflare-turnstile-solver-nodejs), [cloudflare-turnstile-solver-go](https://github.com/ZeroCaptcha/cloudflare-turnstile-solver-go), [cloudflare-turnstile-solver-php](https://github.com/ZeroCaptcha/cloudflare-turnstile-solver-php), [cloudflare-turnstile-solver-java](https://github.com/ZeroCaptcha/cloudflare-turnstile-solver-java), [cloudflare-turnstile-solver-csharp](https://github.com/ZeroCaptcha/cloudflare-turnstile-solver-csharp), [cloudflare-turnstile-solver-rust](https://github.com/ZeroCaptcha/cloudflare-turnstile-solver-rust)
- Browser automation: **cloudflare-turnstile-solver-playwright**, [cloudflare-turnstile-solver-puppeteer](https://github.com/ZeroCaptcha/cloudflare-turnstile-solver-puppeteer), [cloudflare-turnstile-solver-selenium](https://github.com/ZeroCaptcha/cloudflare-turnstile-solver-selenium)
- SDKs, MCP server and migration: [zerocaptcha-js](https://github.com/ZeroCaptcha/zerocaptcha-js), [zerocaptcha-python](https://github.com/ZeroCaptcha/zerocaptcha-python), [zerocaptcha-go](https://github.com/ZeroCaptcha/zerocaptcha-go), [zerocaptcha-mcp](https://github.com/ZeroCaptcha/zerocaptcha-mcp), [createtask-api-migration](https://github.com/ZeroCaptcha/createtask-api-migration)
- Lists: [awesome-cloudflare-turnstile](https://github.com/ZeroCaptcha/awesome-cloudflare-turnstile)

## Licence

MIT: see [LICENSE](LICENSE).

## Disclaimer

ZeroCaptcha is an independent service, not affiliated with or endorsed by Cloudflare. Cloudflare and Turnstile are trademarks of Cloudflare, Inc. Use ZeroCaptcha only on sites you own or are allowed to automate, as the [Acceptable Use Policy](https://zerocaptcha.io/legal/acceptable-use) says; any site owner can [opt out](https://zerocaptcha.io/opt-out).
<!-- /zc:footer -->

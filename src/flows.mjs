// The two flows, each on a Playwright page or browser you give it, so they fit into your own
// scripts and tests: fill a Cloudflare Turnstile widget with a token and submit its form, or open
// a page behind a Cloudflare challenge with its cf_clearance cookie.

/**
 * Runs in the page: puts the token where the widget would, in its response field (named
 * cf-turnstile-response unless the widget renames it), creating the field if the widget has not
 * rendered it, then calls the widget's data-callback as the widget would. Returns how many fields
 * it filled.
 *
 * @param {string} token
 */
export function fillTurnstileToken(token) {
  const widget = document.querySelector("[data-sitekey]");
  const name = widget?.getAttribute("data-response-field-name") || "cf-turnstile-response";
  const form = widget?.closest("form") ?? document.querySelector("form");
  let fields = [...document.querySelectorAll(`[name="${name}"]`)];
  if (fields.length === 0 && form !== null) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    form.append(input);
    fields = [input];
  }
  for (const field of fields) field.value = token;
  const callback = widget?.getAttribute("data-callback");
  if (callback && typeof window[callback] === "function") window[callback](token);
  return fields.length;
}

/**
 * The widget's settings, from its data attributes: the sitekey, and the action and cData if it
 * sets them. Waits up to 15 seconds for the widget to appear.
 *
 * @param {import("playwright").Page} page
 */
export async function readWidget(page) {
  const widget = page.locator("[data-sitekey]").first();
  await widget.waitFor({ state: "attached", timeout: 15_000 });
  const attribute = async (name) => (await widget.getAttribute(name)) ?? undefined;
  return {
    websiteKey: await attribute("data-sitekey"),
    action: await attribute("data-action"),
    cdata: await attribute("data-cdata"),
  };
}

/**
 * Solves the Cloudflare Turnstile widget on the page, fills its token in, and submits the form
 * it sits in. Resolves once the answer to the form has loaded.
 *
 * @param {import("playwright").Page} page a page showing the widget
 * @param {ReturnType<typeof import("./zerocaptcha.mjs").zeroCaptcha>} client
 */
export async function solveAndSubmit(page, client) {
  const widget = await readWidget(page);
  const task = { websiteURL: page.url(), websiteKey: widget.websiteKey };
  if (widget.action !== undefined) task.action = widget.action;
  if (widget.cdata !== undefined) task.cdata = widget.cdata;
  const token = await client.solveTurnstile(task);
  // The token works once, for 300 seconds: fill it in and submit straight away.
  await page.evaluate(fillTurnstileToken, token);
  const form = page.locator("form", { has: page.locator("[data-sitekey]") }).first();
  const submit = form.locator('[type="submit"]').first();
  if ((await submit.count()) > 0) await submit.click();
  else await form.evaluate((element) => element.requestSubmit());
  await page.waitForLoadState();
  return token;
}

/**
 * Opens a page behind a Cloudflare challenge with a clearance from ZeroCaptcha: a new context
 * with the user agent the clearance was earned with, and the cf_clearance cookie. Launch the
 * browser with the same proxy the challenge task used: a clearance works only from that address.
 *
 * @param {import("playwright").Browser} browser
 * @param {string} url the page behind the challenge
 * @param {{ cfClearance: string, userAgent: string }} clearance
 */
export async function openWithClearance(browser, url, clearance) {
  const context = await browser.newContext({ userAgent: clearance.userAgent });
  await context.addCookies([{ name: "cf_clearance", value: clearance.cfClearance, url }]);
  const page = await context.newPage();
  const response = await page.goto(url);
  return { page, status: response?.status() };
}

/**
 * Playwright's proxy settings from a proxy URL such as http://user:pass@proxy.example.net:8080.
 *
 * @param {string} proxyUrl
 */
export function playwrightProxy(proxyUrl) {
  const url = new URL(proxyUrl);
  const proxy = { server: `${url.protocol}//${url.host}` };
  if (url.username !== "") proxy.username = decodeURIComponent(url.username);
  if (url.password !== "") proxy.password = decodeURIComponent(url.password);
  return proxy;
}

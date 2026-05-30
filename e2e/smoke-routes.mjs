import { chromium } from "@playwright/test";

const BASE = "http://localhost:80";
const routes = [
  "/", "/start", "/dashboard", "/report/nonexistent-id", "/coach", "/insights",
  "/integrations", "/pricing", "/waitlist", "/diagnosis", "/lab", "/signal-check",
  "/roadmap", "/privacy", "/terms", "/checkout/success", "/checkout/cancel",
  "/checkout/dating-reset", "/partners/shebangs", "/partner", "/blueprint",
  "/mirror", "/your-mirror", "/mirror/journal", "/mirror/dates", "/archetype",
  "/reflection", "/profile-reader", "/style-map", "/next-message", "/glow-up",
  "/connection-style", "/compatibility-compass", "/progress/timeline",
  "/progress/patterns", "/progress/experiments", "/progress/followup",
  "/progress/scorecard", "/progress/feed", "/progress/control",
  "/progress/insights-roadmap", "/progress/readiness", "/progress/companion",
  "/wellness", "/user-control", "/life-context", "/future-connections",
  "/copilot", "/copilot/reset", "/copilot/reply", "/copilot/profile",
  "/copilot/debrief", "/copilot/weekly-plan", "/copilot/prep", "/copilot/flirt",
  "/copilot/what-changed", "/me", "/matching", "/account", "/account/sessions",
  "/quiz", "/gallery", "/connections", "/vault", "/imports", "/progress/wins",
  "/progress/pattern-breaker", "/feedback", "/sample-report", "/scan", "/trash",
  "/quizzes", "/quizzes/love-pace", "/blog", "/founder",
];

const IGNORE = [
  /React DevTools/i, /\[vite\]/i, /favicon/i, /Download the React/i,
  /sourcemap/i, /preloaded using link preload/i,
];
const ignore = (t) => IGNORE.some((re) => re.test(t || ""));

async function checkRoute(browser, route) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (m) => { if (m.type() === "error" && !ignore(m.text())) consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => { if (!ignore(e.message)) pageErrors.push(e.message); });
  let status = "?";
  let bodyLen = 0;
  let boundary = false;
  try {
    const resp = await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 12000 });
    status = resp ? resp.status() : "no-resp";
    await page.waitForTimeout(900);
    const txt = (await page.evaluate(() => document.body?.innerText || "")).trim();
    bodyLen = txt.length;
    boundary = /something went wrong|unexpected error|error boundary|cannot read prop|is not a function/i.test(txt);
  } catch (e) {
    pageErrors.push("NAV:" + e.message.split("\n")[0]);
  }
  await ctx.close();
  return { route, status, bodyLen, boundary, consoleErrors, pageErrors };
}

async function run() {
  const browser = await chromium.launch();
  const results = [];
  const CONC = 6;
  for (let i = 0; i < routes.length; i += CONC) {
    const batch = routes.slice(i, i + CONC);
    const r = await Promise.all(batch.map((rt) => checkRoute(browser, rt)));
    results.push(...r);
  }
  await browser.close();

  const problems = results.filter(
    (r) => r.pageErrors.length || r.consoleErrors.length || r.boundary || r.bodyLen < 40 || (typeof r.status === "number" && r.status >= 400)
  );
  console.log(`\n=== SWEEP: ${results.length} routes, ${problems.length} with issues ===\n`);
  for (const p of problems) {
    console.log(`✗ ${p.route}  [status ${p.status}, bodyLen ${p.bodyLen}${p.boundary ? ", ERROR-TEXT" : ""}]`);
    p.pageErrors.slice(0, 2).forEach((e) => console.log(`    pageerror: ${e.slice(0, 160)}`));
    p.consoleErrors.slice(0, 2).forEach((e) => console.log(`    console:   ${e.slice(0, 160)}`));
  }
  const clean = results.filter((r) => !problems.includes(r));
  console.log(`\n=== CLEAN (${clean.length}): ${clean.map((r) => r.route).join(", ")}\n`);
}
run().catch((e) => { console.error("FATAL", e); process.exit(1); });

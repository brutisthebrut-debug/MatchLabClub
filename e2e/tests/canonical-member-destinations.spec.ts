import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

const API_ORIGIN = "http://localhost:8080";

const DESTINATIONS = [
  { path: "/today", heading: "One clear place to begin." },
  { path: "/matches", heading: "Your matches" },
  {
    path: "/my-matchlab",
    heading: "What you have chosen to build and keep.",
  },
  { path: "/journey", heading: "Keep the thread, not a score." },
  { path: "/play", heading: "Learn through curiosity." },
  {
    path: "/trust-data",
    heading: "Your information stays under your control.",
  },
  { path: "/echo", heading: "Echo" },
] as const;

const PRIMARY_DESTINATIONS = [
  "Today",
  "Matches",
  "My MatchLab",
  "Journey",
  "Play",
];

async function signInAsSeededDemo(
  request: APIRequestContext,
  context: BrowserContext,
): Promise<void> {
  const response = await request.get(
    `${API_ORIGIN}/api/dev/login?state=power&returnTo=/today`,
    { maxRedirects: 0 },
  );

  expect(response.status()).toBe(302);
  const setCookie = response
    .headersArray()
    .filter(({ name }) => name.toLowerCase() === "set-cookie")
    .map(({ value }) => value)
    .join(",");
  const session = setCookie.match(/(?:^|,\s*)sid=([^;]+)/)?.[1];

  expect(session, "development login must mint a sid session").toBeTruthy();
  await context.addCookies([
    {
      name: "sid",
      value: session as string,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

async function baselineAccessibilityIssues(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const issues: string[] = [];
    const visible = (element: Element): boolean => {
      const node = element as HTMLElement;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const accessibleName = (element: Element): string => {
      const labelledBy = element.getAttribute("aria-labelledby");
      const referenced = labelledBy
        ? labelledBy
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent ?? "")
            .join(" ")
        : "";
      return (
        [
          element.getAttribute("aria-label"),
          referenced,
          element.getAttribute("title"),
          element.textContent,
        ].find((value) => value?.trim())?.trim() ?? ""
      );
    };

    const ids = new Map<string, number>();
    document.querySelectorAll("[id]").forEach((element) => {
      const id = element.id;
      ids.set(id, (ids.get(id) ?? 0) + 1);
    });
    for (const [id, count] of ids) {
      if (count > 1) issues.push(`duplicate id "${id}" appears ${count} times`);
    }

    document.querySelectorAll("img").forEach((image) => {
      if (visible(image) && !image.hasAttribute("alt")) {
        issues.push("visible image is missing alt text");
      }
    });

    document.querySelectorAll("button, a[href]").forEach((control) => {
      if (visible(control) && !accessibleName(control)) {
        issues.push(`${control.tagName.toLowerCase()} has no accessible name`);
      }
    });

    document
      .querySelectorAll("input:not([type='hidden']), textarea, select")
      .forEach((control) => {
        if (!visible(control)) return;
        const field = control as HTMLInputElement;
        const hasLabel =
          Boolean(field.labels?.length) ||
          Boolean(control.getAttribute("aria-label")) ||
          Boolean(control.getAttribute("aria-labelledby")) ||
          Boolean(control.getAttribute("title")) ||
          Boolean(control.getAttribute("placeholder"));
        if (!hasLabel) {
          issues.push(`${control.tagName.toLowerCase()} has no label`);
        }
      });

    return issues;
  });
}

async function verifyDestination(
  page: Page,
  destination: (typeof DESTINATIONS)[number],
  pageErrors: string[],
  serverErrors: string[],
): Promise<void> {
  pageErrors.splice(0);
  serverErrors.splice(0);

  const response = await page.goto(destination.path, {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status(), `${destination.path} document status`).toBeLessThan(
    400,
  );
  await expect(page).toHaveURL(new RegExp(`${destination.path.replace("/", "\\/")}\\/?$`));
  await expect(page.locator('[data-testid="demo-account-flag"]')).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    destination.heading,
  );
  await expect(page.getByRole("main")).toHaveCount(1);
  expect(await page.title(), `${destination.path} document title`).not.toBe("");

  if (destination.path !== "/echo") {
    await expect(
      page.getByRole("button", { name: "Open Echo" }),
    ).toBeVisible();
  }

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      (document.scrollingElement?.scrollWidth ?? document.documentElement.scrollWidth) >
      window.innerWidth + 2,
  );
  expect(
    hasHorizontalOverflow,
    `${destination.path} must not overflow horizontally`,
  ).toBe(false);

  const accessibilityIssues = await baselineAccessibilityIssues(page);
  expect(
    accessibilityIssues,
    `${destination.path} baseline accessibility issues`,
  ).toEqual([]);

  expect(pageErrors, `${destination.path} browser errors`).toEqual([]);
  expect(serverErrors, `${destination.path} API 5xx responses`).toEqual([]);
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "phone", width: 390, height: 844 },
] as const) {
  test(`seeded member can walk every canonical destination on ${viewport.name}`, async ({
    page,
    request,
    context,
  }) => {
    await page.setViewportSize(viewport);
    await signInAsSeededDemo(request, context);

    const pageErrors: string[] = [];
    const serverErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 500 && response.url().includes("/api/")) {
        serverErrors.push(`${response.status()} ${response.url()}`);
      }
    });

    for (const destination of DESTINATIONS) {
      await verifyDestination(page, destination, pageErrors, serverErrors);

      const mobileNav = page.getByRole("navigation", {
        name: "Primary member destinations",
      });
      if (viewport.name === "phone") {
        await expect(mobileNav).toBeVisible();
        await expect(mobileNav.getByRole("link")).toHaveCount(5);
        expect(
          (await mobileNav.getByRole("link").allTextContents()).map((label) =>
            label.trim(),
          ),
        ).toEqual(PRIMARY_DESTINATIONS);
      } else {
        await expect(mobileNav).toBeHidden();
      }
    }
  });
}

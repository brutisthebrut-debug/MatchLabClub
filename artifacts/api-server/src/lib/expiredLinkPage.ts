import type { Request, Response } from "express";

export interface ExpiredLinkPageOptions {
  pageTitle: string;
  heading: string;
  bodyParagraphs: string[];
  ctaLabel: string;
  ctaUrl: string;
}

export interface SendExpiredLinkOptions extends ExpiredLinkPageOptions {
  jsonError: string;
  jsonStatus?: number;
}

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

export function originFor(req: Request): string {
  return getOrigin(req);
}

export function wantsHtml(req: Request): boolean {
  const accept = req.headers["accept"];
  if (typeof accept === "string" && accept.includes("text/html")) return true;
  // Some browsers may send */* on direct navigation; treat as HTML when there
  // is also a Sec-Fetch-Mode=navigate hint.
  const fetchMode = req.headers["sec-fetch-mode"];
  if (typeof fetchMode === "string" && fetchMode === "navigate") return true;
  return false;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderExpiredLinkPage(opts: ExpiredLinkPageOptions): string {
  const paragraphs = opts.bodyParagraphs
    .map((p) => `      <p>${p}</p>`)
    .join("\n");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(opts.pageTitle)}</title>
    <meta name="robots" content="noindex" />
    <style>
      :root {
        color-scheme: light;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
          "Helvetica Neue", Arial, sans-serif;
        background: linear-gradient(135deg, #fdf6f0 0%, #f5ecff 100%);
        color: #1f1233;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      .card {
        background: #ffffff;
        border-radius: 20px;
        box-shadow: 0 24px 60px -24px rgba(63, 22, 122, 0.25);
        max-width: 480px;
        width: 100%;
        padding: 40px 36px;
        text-align: center;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #fff0e9;
        color: #b04318;
        font-size: 13px;
        font-weight: 600;
        padding: 6px 12px;
        border-radius: 999px;
        margin-bottom: 20px;
      }
      h1 {
        font-family: "Playfair Display", Georgia, serif;
        font-size: 28px;
        line-height: 1.2;
        margin: 0 0 12px;
      }
      p {
        font-size: 16px;
        line-height: 1.55;
        color: #4a3a66;
        margin: 0 0 12px;
      }
      .cta {
        display: inline-block;
        margin-top: 24px;
        background: #6c2bd9;
        color: #ffffff;
        text-decoration: none;
        font-weight: 600;
        font-size: 15px;
        padding: 12px 22px;
        border-radius: 999px;
        transition: background 120ms ease;
      }
      .cta:hover { background: #5821b3; }
      .footer {
        margin-top: 28px;
        font-size: 13px;
        color: #8579a3;
      }
    </style>
  </head>
  <body>
    <main class="card" role="main">
      <div class="badge">Link expired</div>
      <h1>${opts.heading}</h1>
${paragraphs}
      <a class="cta" href="${escapeHtml(opts.ctaUrl)}">${escapeHtml(opts.ctaLabel)}</a>
      <div class="footer">MatchLab Club</div>
    </main>
  </body>
</html>`;
}

export function sendExpiredLink(
  req: Request,
  res: Response,
  opts: SendExpiredLinkOptions,
): void {
  if (wantsHtml(req)) {
    res.status(410);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(renderExpiredLinkPage(opts));
    return;
  }
  res.status(opts.jsonStatus ?? 400).json({ error: opts.jsonError });
}

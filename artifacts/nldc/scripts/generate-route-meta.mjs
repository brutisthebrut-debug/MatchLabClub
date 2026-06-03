// Post-build prerender step for public acquisition routes.
//
// The app is a Vite SPA: index.html ships one shared <head> and the real
// route-specific metadata is applied client-side by useMeta() after hydration.
// Social and AI crawlers do not run our JavaScript, so without this step they
// only ever see the homepage title/description/OG block for every deep URL.
//
// This script runs after `vite build`. It reads the built index.html as a
// template and, for each public route, emits a sibling index.html with the
// correct static <title>, description, canonical, Open Graph, and Twitter tags
// in the first HTML response. The metadata mirrors what each page passes to
// useMeta(); dynamic blog/quiz routes derive their slugs from the source files
// so new entries are picked up automatically.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.resolve(ROOT, "dist/public");
const TEMPLATE = path.resolve(DIST, "index.html");

// Production origin used for canonical / og:url in the static HTML. Must match
// the FALLBACK_ORIGIN in src/lib/seo.ts.
const ORIGIN = "https://matchlab.club";
const BRAND = "MatchLab Club";
const DEFAULT_OG_IMAGE = "/opengraph.jpg";

function absoluteUrl(p) {
  if (/^https?:\/\//i.test(p)) return p;
  const suffix = p.startsWith("/") ? p : `/${p}`;
  return `${ORIGIN}${suffix}`;
}

// Mirror of the normalize()/title logic in src/hooks/useMeta.ts so the static
// <title> matches what the client renders once hydrated.
function fullTitle(title) {
  const clean = title
    .replace(/\s*[·—\-|]\s*NLDC.*$/i, "")
    .replace(/\s*[·—\-|]\s*(MatchLab Club|Next Level Dating Club).*$/i, "")
    .trim();
  return clean ? `${clean} | ${BRAND}` : BRAND;
}

function htmlEscape(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Pull `slug: "..."` values out of a source file. Reliable for the flat object
// literals in blogArticles.ts / quizzes.ts and needs no TS toolchain.
async function extractSlugs(relPath) {
  const full = path.resolve(ROOT, relPath);
  if (!existsSync(full)) return [];
  const src = await readFile(full, "utf8");
  const slugs = new Set();
  const re = /slug:\s*"([a-z0-9-]+)"/g;
  let m;
  while ((m = re.exec(src)) !== null) slugs.add(m[1]);
  return [...slugs];
}

// Extract `title`/`metaTitle`/`excerpt`/`metaDescription`/`pitch` for a given
// slug from a source file, so blog and quiz pages get real per-page metadata
// instead of a generic fallback. Best-effort: falls back to the route default.
async function extractEntries(relPath, fields) {
  const full = path.resolve(ROOT, relPath);
  if (!existsSync(full)) return {};
  const src = await readFile(full, "utf8");
  const entries = {};
  const re = /slug:\s*"([a-z0-9-]+)"/g;
  let m;
  const matches = [];
  while ((m = re.exec(src)) !== null) matches.push({ slug: m[1], index: m.index });
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : src.length;
    const block = src.slice(start, end);
    const out = {};
    for (const field of fields) {
      const fre = new RegExp(`${field}:\\s*"((?:[^"\\\\]|\\\\.)*)"`);
      const fm = fre.exec(block);
      if (fm) out[field] = fm[1].replace(/\\"/g, '"');
    }
    entries[matches[i].slug] = out;
  }
  return entries;
}

function buildHead({ title, description, canonicalPath, ogImage, type = "website" }) {
  const t = fullTitle(title);
  const canonical = absoluteUrl(canonicalPath);
  const image = absoluteUrl(ogImage ?? DEFAULT_OG_IMAGE);
  return {
    title: htmlEscape(t),
    description: htmlEscape(description),
    canonical: htmlEscape(canonical),
    image: htmlEscape(image),
    type,
  };
}

// Replace the head metadata in the template with route-specific values. Tags
// not present in the template are appended just before </head>.
function applyMeta(template, head) {
  let html = template;

  const replaceOrAppend = (regex, replacement) => {
    if (regex.test(html)) {
      html = html.replace(regex, replacement);
    } else {
      html = html.replace("</head>", `    ${replacement}\n  </head>`);
    }
  };

  // <title>
  replaceOrAppend(/<title>[\s\S]*?<\/title>/i, `<title>${head.title}</title>`);

  // name="description"
  replaceOrAppend(
    /<meta\s+name="description"[^>]*>/i,
    `<meta name="description" content="${head.description}" />`,
  );

  // Open Graph
  replaceOrAppend(
    /<meta\s+property="og:title"[^>]*>/i,
    `<meta property="og:title" content="${head.title}" />`,
  );
  replaceOrAppend(
    /<meta\s+property="og:description"[^>]*>/i,
    `<meta property="og:description" content="${head.description}" />`,
  );
  replaceOrAppend(
    /<meta\s+property="og:type"[^>]*>/i,
    `<meta property="og:type" content="${head.type}" />`,
  );
  replaceOrAppend(
    /<meta\s+property="og:image"[^>]*>/i,
    `<meta property="og:image" content="${head.image}" />`,
  );
  replaceOrAppend(
    /<meta\s+property="og:url"[^>]*>/i,
    `<meta property="og:url" content="${head.canonical}" />`,
  );

  // Twitter
  replaceOrAppend(
    /<meta\s+name="twitter:title"[^>]*>/i,
    `<meta name="twitter:title" content="${head.title}" />`,
  );
  replaceOrAppend(
    /<meta\s+name="twitter:description"[^>]*>/i,
    `<meta name="twitter:description" content="${head.description}" />`,
  );
  replaceOrAppend(
    /<meta\s+name="twitter:image"[^>]*>/i,
    `<meta name="twitter:image" content="${head.image}" />`,
  );

  // canonical link
  replaceOrAppend(
    /<link\s+rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${head.canonical}" />`,
  );

  return html;
}

async function emit(template, routePath, head) {
  const html = applyMeta(template, head);
  // "/" -> dist/public/index.html ; "/pricing" -> dist/public/pricing/index.html
  const outDir =
    routePath === "/" ? DIST : path.join(DIST, routePath.replace(/^\//, ""));
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "index.html"), html, "utf8");
}

async function main() {
  if (!existsSync(TEMPLATE)) {
    console.error(
      `[generate-route-meta] template not found: ${TEMPLATE}. Run "vite build" first.`,
    );
    process.exit(1);
  }
  const template = await readFile(TEMPLATE, "utf8");

  // Static public routes. Values mirror each page's useMeta() call.
  const staticRoutes = [
    {
      path: "/",
      title: "MatchLab Club: A second brain for your dating life",
      description:
        "Feed your real signals into one engine. Build your match readiness score. Earn introductions to people you would never find on your own.",
    },
    {
      path: "/pricing",
      title: "Pricing: Free, $97 & $197 Coaching",
      description:
        "Three ways to feed the engine that turns your real signals into real matches. Start free with the Signal Check, go deeper with the Dating Reset, or get founder-curated intros with Wingman.",
    },
    {
      path: "/waitlist",
      title: "Early Access Waitlist",
      description:
        "Join the MatchLab Club waitlist. Early access to the limited launch cohort, lifetime founding-member pricing, and priority support.",
    },
    {
      path: "/how-it-works",
      title: "How It Works: From your signals to real matches",
      description:
        "See the whole machine end to end. Feed your real signals, watch Your Mirror understand you, climb your Match Readiness, and earn introductions to people near you.",
    },
    {
      path: "/signal-check",
      title: "Free 3-Min Signal Check",
      description:
        "Paste your dating bio and get your Signal Strength score, profile category, #1 improvement, and a rewritten line, free, instant, no account needed.",
    },
    {
      path: "/quizzes",
      title: "Quiz Lab",
      description:
        "Short, honest quizzes that read your dating pattern in 60-90 seconds. No signup needed. Each one feeds your dating second-brain.",
    },
    {
      path: "/blog",
      title: "Dating Coaching Blog",
      description:
        "Evidence-based articles on dating profile science, message coaching, photo psychology, and communication patterns. From MatchLab Club.",
    },
    {
      path: "/privacy",
      title: "Privacy Policy",
      description:
        "How MatchLab Club handles your data, what we collect, why, and your rights. Plain English, no legal jargon.",
    },
    {
      path: "/terms",
      title: "Terms of Service",
      description: "MatchLab Club terms of service, plain English, no surprises.",
    },
  ];

  let count = 0;
  for (const route of staticRoutes) {
    await emit(
      template,
      route.path,
      buildHead({
        title: route.title,
        description: route.description,
        canonicalPath: route.path,
      }),
    );
    count++;
  }

  // Dynamic: blog posts (/blog/:slug)
  const articles = await extractEntries("src/lib/blogArticles.ts", [
    "metaTitle",
    "title",
    "metaDescription",
    "excerpt",
  ]);
  for (const [slug, e] of Object.entries(articles)) {
    const title = e.metaTitle ?? e.title;
    const description = e.metaDescription ?? e.excerpt;
    if (!title || !description) continue;
    await emit(
      template,
      `/blog/${slug}`,
      buildHead({
        title,
        description,
        canonicalPath: `/blog/${slug}`,
        type: "article",
      }),
    );
    count++;
  }

  // Dynamic: quizzes (/quizzes/:slug)
  const quizzes = await extractEntries("src/lib/quizzes.ts", ["title", "pitch"]);
  for (const [slug, e] of Object.entries(quizzes)) {
    if (!e.title || !e.pitch) continue;
    await emit(
      template,
      `/quizzes/${slug}`,
      buildHead({
        title: `${e.title} · Quiz Lab`,
        description: e.pitch,
        canonicalPath: `/quizzes/${slug}`,
      }),
    );
    count++;
  }

  console.log(`[generate-route-meta] wrote ${count} prerendered route shells.`);
}

main().catch((err) => {
  console.error("[generate-route-meta] failed:", err);
  process.exit(1);
});

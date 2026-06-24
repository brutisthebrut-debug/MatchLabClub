import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { detectAiTells, countEmDashes } from "@workspace/echo";

/**
 * Voice lint: scans user-facing copy in artifacts/nldc/src and fails on
 * Echo-voice violations (banned AI-tell words and em dashes). This is the
 * automated guard that replaces hand sweeps for off-voice phrasing.
 *
 * It only inspects strings that actually reach the user (JSX text, a small
 * allowlist of copy-bearing JSX attributes, copy-bearing object properties,
 * and toast/notification arguments). Code identifiers, classNames, CSS,
 * testids, imports, and comments are intentionally ignored — they are not
 * copy and would produce noise (e.g. the `glass-elevated` utility class).
 */

const SRC_DIR = join(process.cwd(), "src");

// "unlock(ed)" is intentional gamification reward language (see replit.md user
// preferences), so it is carved out of the AI-tell set for this check. Every
// other AI-tell word still fails. "the machine" positioning and the brand
// tagline contain no banned words, so they pass naturally.
const ALLOWED_AI_TELLS = new Set(["unlock"]);

function detectLintedAiTells(text: string): string[] {
  return detectAiTells(text).filter((w) => !ALLOWED_AI_TELLS.has(w));
}

// JSX attributes whose string value is shown to the user.
const COPY_JSX_ATTRS = new Set([
  "title",
  "label",
  "placeholder",
  "alt",
  "description",
  "heading",
  "subtitle",
  "tooltip",
  "content",
  "message",
  "text",
  "cta",
  "ctaLabel",
  "aria-label",
  "ariaLabel",
]);

// Object/property keys that carry user-facing copy across this codebase.
const COPY_PROP_KEYS = new Set([
  "title",
  "label",
  "description",
  "text",
  "body",
  "headline",
  "subtitle",
  "subheading",
  "heading",
  "cta",
  "ctaLabel",
  "message",
  "blurb",
  "question",
  "answer",
  "quote",
  "summary",
  "caption",
  "hint",
  "helper",
  "prompt",
  "eyebrow",
  "tagline",
  "intro",
  "note",
  "detail",
  "details",
  "copy",
  "line",
  "placeholder",
  "action",
  "subtext",
]);

// Functions whose string arguments surface to the user.
const COPY_CALLEES = new Set([
  "toast",
  "success",
  "error",
  "info",
  "warning",
  "message",
  "loading",
  "promise",
]);

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...listSourceFiles(full));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue;
    if (/\.test\.(ts|tsx)$/.test(entry)) continue;
    out.push(full);
  }
  return out;
}

function staticTemplateText(node: ts.TemplateLiteral): string {
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  let text = node.head.text;
  for (const span of node.templateSpans) text += " " + span.literal.text;
  return text;
}

interface CopyHit {
  text: string;
  line: number;
}

function attrName(attr: ts.JsxAttribute): string {
  return ts.isIdentifier(attr.name) ? attr.name.text : attr.name.getText();
}

function propKey(prop: ts.PropertyAssignment): string | null {
  const name = prop.name;
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name)) return name.text;
  return null;
}

function calleeName(call: ts.CallExpression): string | null {
  const expr = call.expression;
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name)) {
    return expr.name.text;
  }
  return null;
}

function collectCopy(source: ts.SourceFile): CopyHit[] {
  const hits: CopyHit[] = [];
  const add = (text: string, node: ts.Node) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    hits.push({ text: trimmed, line: line + 1 });
  };

  const visit = (node: ts.Node) => {
    // JSX text between tags is always user-facing copy.
    if (ts.isJsxText(node)) {
      add(node.text, node);
    }

    // Allowlisted JSX attributes (title="...", placeholder="...", etc.).
    if (ts.isJsxAttribute(node) && COPY_JSX_ATTRS.has(attrName(node))) {
      const init = node.initializer;
      if (init && ts.isStringLiteral(init)) add(init.text, init);
      else if (init && ts.isJsxExpression(init) && init.expression) {
        const e = init.expression;
        if (ts.isStringLiteral(e)) add(e.text, e);
        else if (ts.isTemplateLiteral(e)) add(staticTemplateText(e), e);
      }
    }

    // Copy-bearing object properties ({ title: "...", description: `...` }).
    if (ts.isPropertyAssignment(node)) {
      const key = propKey(node);
      if (key && COPY_PROP_KEYS.has(key)) {
        const v = node.initializer;
        if (ts.isStringLiteral(v)) add(v.text, v);
        else if (ts.isTemplateLiteral(v)) add(staticTemplateText(v), v);
      }
    }

    // toast()/toast.success()/etc. string arguments.
    if (ts.isCallExpression(node)) {
      const name = calleeName(node);
      if (name && COPY_CALLEES.has(name)) {
        for (const arg of node.arguments) {
          if (ts.isStringLiteral(arg)) add(arg.text, arg);
          else if (ts.isTemplateLiteral(arg)) add(staticTemplateText(arg), arg);
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  return hits;
}

interface Violation {
  file: string;
  line: number;
  problem: string;
  snippet: string;
}

function lintSource(code: string, label: string, isTsx: boolean): Violation[] {
  const source = ts.createSourceFile(
    label,
    code,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const violations: Violation[] = [];
  for (const hit of collectCopy(source)) {
    const tells = detectLintedAiTells(hit.text);
    if (tells.length > 0) {
      violations.push({
        file: label,
        line: hit.line,
        problem: `AI-tell word(s): ${tells.join(", ")}`,
        snippet: hit.text.slice(0, 120),
      });
    }
    if (countEmDashes(hit.text) > 0) {
      violations.push({
        file: label,
        line: hit.line,
        problem: "em dash (use a comma, period, or sentence break)",
        snippet: hit.text.slice(0, 120),
      });
    }
  }
  return violations;
}

function lintCopy(file: string): Violation[] {
  const code = readFileSync(file, "utf8");
  return lintSource(code, relative(SRC_DIR, file), file.endsWith(".tsx"));
}

describe("Echo voice lint over artifacts/nldc/src copy", () => {
  const files = listSourceFiles(SRC_DIR);

  it("finds source files to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("has no banned AI-tell words or em dashes in user-facing copy", () => {
    const violations = files.flatMap(lintCopy);
    const report = violations
      .map((v) => `  ${v.file}:${v.line} — ${v.problem}\n    "${v.snippet}"`)
      .join("\n");
    expect(violations, `\nOff-voice copy found:\n${report}\n`).toEqual([]);
  });
});

describe("voice lint detection has teeth", () => {
  it("flags banned AI-tell words in JSX text", () => {
    const v = lintSource(`const X = () => <p>Let us leverage this</p>;`, "x.tsx", true);
    expect(v.some((h) => h.problem.includes("leverage"))).toBe(true);
  });

  it("flags em dashes in JSX text", () => {
    const v = lintSource(`const X = () => <p>One thing — then another</p>;`, "x.tsx", true);
    expect(v.some((h) => h.problem.includes("em dash"))).toBe(true);
  });

  it("flags banned words in copy-bearing object props", () => {
    const v = lintSource(`const c = { description: "A seamless experience" };`, "x.ts", false);
    expect(v.some((h) => h.problem.includes("seamless"))).toBe(true);
  });

  it("flags banned words in copy JSX attributes", () => {
    const v = lintSource(`const X = () => <Card title="Embark on the journey" />;`, "x.tsx", true);
    expect(v.some((h) => h.problem.includes("embark on"))).toBe(true);
  });

  it("flags banned words in toast arguments", () => {
    const v = lintSource(`toast.success("Picture this win");`, "x.ts", false);
    expect(v.some((h) => h.problem.includes("picture this"))).toBe(true);
  });

  it("allows gamification 'unlock(ed)' reward language", () => {
    const v = lintSource(`const X = () => <p>Momentum Unlocked</p>;`, "x.tsx", true);
    expect(v).toEqual([]);
  });

  it("ignores non-copy strings like classNames", () => {
    const v = lintSource(
      `const X = () => <div className="glass-elevated rounded-[2rem]" />;`,
      "x.tsx",
      true,
    );
    expect(v).toEqual([]);
  });
});

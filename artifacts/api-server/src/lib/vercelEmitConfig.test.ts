import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("Vercel API TypeScript emit contract", () => {
  it("includes the web platform libraries used by the Express route graph", async () => {
    const path = fileURLToPath(new URL("../../tsconfig.json", import.meta.url));
    const config = JSON.parse(await readFile(path, "utf8")) as {
      compilerOptions?: { lib?: string[]; types?: string[] };
      include?: string[];
      exclude?: string[];
    };

    expect(config.compilerOptions?.types).toContain("node");
    expect(config.compilerOptions?.lib).toEqual(
      expect.arrayContaining(["ES2023", "DOM", "DOM.Iterable"]),
    );
    expect(config.include).toEqual(["src"]);
    expect(config.exclude).toContain("src/**/*.test.ts");
  });
});

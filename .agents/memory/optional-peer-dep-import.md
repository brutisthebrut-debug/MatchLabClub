---
name: Optional peer dependency dynamic import
description: How to import an optional, possibly-uninstalled npm package from TS server code without TS2307.
---

# Optional peer dependency dynamic import

When server code wants to use an optional package that may not be installed
(e.g. `twilio` for SMS, mirroring how `mailer.ts` treats its optional transport),
a normal `await import("twilio")` makes `tsc` emit **TS2307 "Cannot find module"**
because TypeScript statically resolves the literal specifier at compile time.

**Pattern:** put the module name in a variable so the specifier is not a literal:

```ts
const specifier = "twilio";
const mod = await import(specifier).catch(() => null);
if (!mod) return { transport: "log" }; // graceful degrade
```

**Why:** TS only type-checks/resolves *string-literal* import specifiers. A
variable specifier is treated as dynamic, so a missing optional dep no longer
breaks the typecheck, while runtime still works once the package is installed.

**How to apply:** any adapter that degrades to a log/no-op fallback when an
optional dependency or its env credentials are absent (SMS, mail transports,
analytics SDKs). Always pair with a runtime `catch`/null-guard so the absence is
handled, not just hidden from the compiler.

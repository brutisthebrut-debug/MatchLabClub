---
name: Validating YAML/config with no root parser
description: How to parse/validate YAML (e.g. bitbucket-pipelines.yml) in this repo when no parser resolves from the repo root.
---

There is no YAML parser resolvable from the repo root (`require("yaml")` /
`require("js-yaml")` both fail from cwd, and `python3 -c "import yaml"` has no
pyyaml). Do NOT try to `find` one under `node_modules` — a recursive `find`/`rg`
over `node_modules` times out.

**How to apply:** list the pnpm store instead (`ls node_modules/.pnpm/ | grep -iE '^(yaml|js-yaml)@'`)
and `require()` the package by absolute path, e.g.
`require("/home/runner/workspace/node_modules/.pnpm/js-yaml@4.1.1/node_modules/js-yaml/index.js").load(...)`.
This is the reliable way to structurally validate `bitbucket-pipelines.yml`
(anchors resolve, steps present) before relying on it. Note: this only checks
YAML syntax/structure, not Bitbucket's own pipeline schema.

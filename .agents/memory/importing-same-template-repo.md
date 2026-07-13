---
name: Importing a GitHub repo built on the same Replit monorepo template
description: How to bring in a GitHub repo that was originally exported from a Replit project using the standard pnpm-workspace/artifacts template (api-server + mockup-sandbox + lib/*).
---

When a user gives a GitHub URL for a project "previously built/exported from Replit", clone it to /tmp and diff it against the current fresh workspace scaffold file-by-file (root package.json, pnpm-workspace.yaml, drizzle config, openapi.yaml, per-package package.json) before copying anything.

**Why:** These repos are usually the exact same scaffold (artifacts/api-server, artifacts/mockup-sandbox, lib/db, lib/api-spec, lib/api-zod, lib/api-client-react, scripts) with only a handful of product-specific files added/changed on top — e.g. a `telegram/` subfolder under api-server/src, a few schema files under lib/db/src/schema, and one or two added dependencies. Copying the whole repo over would clobber the current artifact IDs/`.replit-artifact` registration and other environment-specific wiring.

**How to apply:** Clone to /tmp, `diff` shared scaffold files first to confirm they match, then copy only the differing/product-specific source files (route handlers, schema files, bot logic) into the current workspace paths. Merge in any added dependencies to the relevant package.json by hand rather than overwriting the whole file. Then check the repo's own replit.md for required env vars/secrets, request them, `pnpm install`, `pnpm run typecheck`, push DB schema if it has new tables, and restart the relevant workflow.

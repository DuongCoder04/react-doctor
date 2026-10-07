---
"eslint-plugin-react-doctor": patch
"oxlint-plugin-react-doctor": patch
---

ESLint adapter now respects rule `requires` gates. Rules that require capabilities the project doesn't have (like `ssr` or `react-router:8`) are now correctly skipped when capabilities are declared, matching the CLI behavior. Fixes false errors on dependency bumps when using the ESLint adapter with explicit capabilities.

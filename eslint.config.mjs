import { createRequire } from "module";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// FlatCompat comes from @eslint/eslintrc's CommonJS build. Its ES module build
// does `import minimatch from "minimatch"`, and minimatch is pinned to 11+ in
// package.json overrides for a security advisory; 11 has no default export,
// so that import fails and ESLint (and the lint step of `next build`) stops.
const require = createRequire(import.meta.url);
const { FlatCompat } = require("@eslint/eslintrc");
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];

export default eslintConfig;

// eslint.config.js — flat config. The one non-default rule is the data-layer boundary (port/PLAN.md §4):
// screens never import the Supabase client; they use src/data (useQuery/useRpc/mutate) and receive `sb` in callbacks.
const expo = require("eslint-config-expo/flat");

module.exports = [
  ...expo,
  { ignores: ["dist/*", "ios/*", "android/*", ".expo/*", "node_modules/*", "*.generated.ts", "*.generated.tsx"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/core/**", "src/data/**", "src/dev/**"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{ name: "@supabase/supabase-js", message: "Use src/data (useQuery/useRpc/mutate). Raw Supabase access is limited to src/core and src/data." }],
        patterns: [{ group: ["@/core/supabase", "**/core/supabase"], message: "Use src/data (useQuery/useRpc/mutate). Raw Supabase access is limited to src/core and src/data." }],
      }],
    },
  },
];

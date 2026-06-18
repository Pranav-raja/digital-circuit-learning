import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    // ADR-004: the brain (core/) imports nothing from the body (ui/canvas/storage).
    // The boundary is enforced here so a stray import fails lint, not review.
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "**/ui/**",
            "**/canvas/**",
            "**/storage/**",
            "../ui/*",
            "../canvas/*",
            "../storage/*",
          ],
        },
      ],
    },
  },
);
